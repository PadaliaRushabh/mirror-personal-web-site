"""
Photo gallery builder.

Triggered by S3 events on the photos bucket's ``uploads/`` prefix.

Bucket layout::

    uploads/sunset.jpg              <- you upload the photo
    uploads/sunset.json             <- you upload {"title": ..., "description": ...}
    photos/sunset/<version>/thumb.webp   <- generated (EXIF/GPS stripped)
    photos/sunset/<version>/large.webp   <- generated (EXIF/GPS stripped)
    photos/photos.json              <- generated list the website reads
    meta/sunset.json                <- generated sizes/version (private)

Only ``photos/`` is served publicly through CloudFront, so your original
uploads (and any GPS location inside them) are never exposed.
"""

import io
import json
import logging
import os
import re
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import quote, unquote_plus

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger("PhotoGallery")
logger.setLevel(os.getenv("LOG_LEVEL", "INFO"))

UPLOAD_PREFIX = "uploads/"
PUBLIC_PREFIX = "photos/"
META_PREFIX = "meta/"
MANIFEST_KEY = PUBLIC_PREFIX + "photos.json"

IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp")
CAPTION_EXTENSION = ".json"

THUMB_MAX_PX = int(os.getenv("THUMB_MAX_PX", "800"))
LARGE_MAX_PX = int(os.getenv("LARGE_MAX_PX", "2000"))
WEBP_QUALITY = int(os.getenv("WEBP_QUALITY", "82"))

# Generated images never change at a given URL (the version is in the path).
IMMUTABLE_CACHE = "public, max-age=31536000, immutable"
# photos.json changes whenever you upload, so keep caches short.
MANIFEST_CACHE = "public, max-age=60"

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

_s3 = None


def s3():
    """Lazily create the S3 client (keeps unit tests free of AWS)."""
    global _s3  # pylint: disable=global-statement
    if _s3 is None:
        _s3 = boto3.client("s3")
    return _s3


# ---------------------------------------------------------------------------
# Pure helpers (unit tested)
# ---------------------------------------------------------------------------

def split_upload_key(key: str) -> Optional[tuple]:
    """Return (stem, kind) for an upload key, or None if it should be ignored.

    kind is "image" or "caption". Files in sub-folders are ignored.
    """
    if not key.startswith(UPLOAD_PREFIX):
        return None
    name = key[len(UPLOAD_PREFIX):]
    if not name or "/" in name or name.startswith("."):
        return None
    stem, ext = os.path.splitext(name)
    ext = ext.lower()
    if not stem:
        return None
    if ext in IMAGE_EXTENSIONS:
        return stem, "image"
    if ext == CAPTION_EXTENSION:
        return stem, "caption"
    return None


def title_from_stem(stem: str) -> str:
    """Fallback title when no caption file exists: 'sunset-at_bondi' -> 'Sunset at bondi'."""
    words = re.sub(r"[-_]+", " ", stem).strip()
    words = re.sub(r"\s+", " ", words)
    return words[:1].upper() + words[1:] if words else stem


def parse_caption(raw: Optional[bytes], stem: str) -> dict:
    """Read a caption file, falling back gracefully if it is missing or broken."""
    caption = {}
    if raw:
        try:
            loaded = json.loads(raw.decode("utf-8-sig"))
            if isinstance(loaded, dict):
                caption = loaded
            else:
                logger.warning("Caption for %s is not a JSON object, ignoring it", stem)
        except (UnicodeDecodeError, json.JSONDecodeError) as err:
            logger.warning("Caption for %s is not valid JSON (%s), ignoring it", stem, err)

    title = str(caption.get("title") or "").strip() or title_from_stem(stem)
    description = str(caption.get("description") or "").strip()
    date = str(caption.get("date") or "").strip()
    if date and not DATE_RE.match(date):
        logger.warning("Ignoring date %r for %s (use YYYY-MM-DD)", date, stem)
        date = ""
    return {"title": title, "description": description, "date": date}


def version_from_etag(etag: str) -> str:
    """Short, URL-safe version id from an S3 ETag (changes when the photo changes)."""
    return re.sub(r"[^0-9a-zA-Z]", "", etag or "")[:12] or "v1"


def public_url(key: str) -> str:
    """Site-relative URL for a key under photos/ (CloudFront serves /photos/*)."""
    return quote(key, safe="/")


def build_manifest(photos: list, generated_at: Optional[str] = None) -> dict:
    """Sort photo entries (newest first) and wrap them in the photos.json shape.

    Each entry needs a private "_sort" key (ISO date string) which is removed.
    """
    ordered = sorted(photos, key=lambda p: (p["_sort"], p["id"]), reverse=True)
    for photo in ordered:
        photo.pop("_sort", None)
    return {
        "generatedAt": generated_at or datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "count": len(ordered),
        "photos": ordered,
    }


def make_renditions(data: bytes) -> dict:
    """Create thumbnail and large WebP versions. Returns {name: (bytes, w, h)}.

    Applies the camera's rotation, then drops all EXIF (including GPS).
    """
    from PIL import Image, ImageOps  # pylint: disable=import-outside-toplevel

    with Image.open(io.BytesIO(data)) as src:
        img = ImageOps.exif_transpose(src)
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGBA" if "A" in img.getbands() else "RGB")

        out = {}
        for name, max_px in (("thumb", THUMB_MAX_PX), ("large", LARGE_MAX_PX)):
            copy = img.copy()
            copy.thumbnail((max_px, max_px), Image.Resampling.LANCZOS)
            buf = io.BytesIO()
            copy.save(buf, "WEBP", quality=WEBP_QUALITY, method=6)
            out[name] = (buf.getvalue(), copy.width, copy.height)
        return out


# ---------------------------------------------------------------------------
# S3 operations
# ---------------------------------------------------------------------------

def _list_keys(bucket: str, prefix: str) -> list:
    keys = []
    for page in s3().get_paginator("list_objects_v2").paginate(Bucket=bucket, Prefix=prefix):
        keys.extend(page.get("Contents", []))
    return keys


def _get_bytes(bucket: str, key: str) -> Optional[bytes]:
    try:
        return s3().get_object(Bucket=bucket, Key=key)["Body"].read()
    except s3().exceptions.NoSuchKey:
        return None


def _delete_prefix(bucket: str, prefix: str) -> None:
    keys = [{"Key": obj["Key"]} for obj in _list_keys(bucket, prefix)]
    for i in range(0, len(keys), 1000):
        s3().delete_objects(Bucket=bucket, Delete={"Objects": keys[i:i + 1000], "Quiet": True})


def process_image(bucket: str, key: str, stem: str) -> None:
    """Generate renditions for one uploaded photo and record their sizes."""
    obj = s3().get_object(Bucket=bucket, Key=key)
    version = version_from_etag(obj["ETag"])
    renditions = make_renditions(obj["Body"].read())

    # Remove renditions from any earlier upload with the same name.
    _delete_prefix(bucket, f"{PUBLIC_PREFIX}{stem}/")

    meta = {"version": version, "source": key}
    for name, (body, width, height) in renditions.items():
        out_key = f"{PUBLIC_PREFIX}{stem}/{version}/{name}.webp"
        s3().put_object(Bucket=bucket, Key=out_key, Body=body,
                        ContentType="image/webp", CacheControl=IMMUTABLE_CACHE)
        meta[name] = {"key": out_key, "width": width, "height": height}

    s3().put_object(Bucket=bucket, Key=f"{META_PREFIX}{stem}.json",
                    Body=json.dumps(meta).encode(), ContentType="application/json")
    logger.info("Processed %s -> version %s", key, version)


def remove_image(bucket: str, stem: str) -> None:
    """Clean up renditions after a photo is deleted from uploads/."""
    _delete_prefix(bucket, f"{PUBLIC_PREFIX}{stem}/")
    s3().delete_object(Bucket=bucket, Key=f"{META_PREFIX}{stem}.json")
    logger.info("Removed renditions for %s", stem)


def _current_etag(bucket: str, key: str) -> Optional[str]:
    try:
        return s3().head_object(Bucket=bucket, Key=key)["ETag"]
    except ClientError as err:
        if err.response.get("Error", {}).get("Code") in ("404", "NoSuchKey", "NotFound"):
            return None
        raise


def rebuild_manifest(bucket: str, attempts: int = 5) -> dict:
    """Rebuild photos/photos.json, safely when several uploads happen at once.

    Uses an S3 conditional write: if another invocation updated photos.json
    while this one was building, the write is rejected and we rebuild from a
    fresh listing, so the last write always reflects the latest uploads.
    """
    for attempt in range(attempts):
        etag = _current_etag(bucket, MANIFEST_KEY)
        manifest = _collect_manifest(bucket)
        condition = {"IfMatch": etag} if etag else {"IfNoneMatch": "*"}
        try:
            s3().put_object(Bucket=bucket, Key=MANIFEST_KEY,
                            Body=json.dumps(manifest, ensure_ascii=False, indent=2).encode("utf-8"),
                            ContentType="application/json; charset=utf-8", CacheControl=MANIFEST_CACHE,
                            **condition)
        except ClientError as err:
            code = err.response.get("Error", {}).get("Code")
            if code in ("PreconditionFailed", "ConditionalRequestConflict") and attempt < attempts - 1:
                logger.info("photos.json changed while building, retrying (%s)", code)
                continue
            raise
        logger.info("Wrote %s with %d photos", MANIFEST_KEY, manifest["count"])
        return manifest
    raise RuntimeError("unreachable")


def _collect_manifest(bucket: str) -> dict:
    """Build the photos.json content from what is currently in uploads/."""
    images, captions = {}, set()
    for obj in _list_keys(bucket, UPLOAD_PREFIX):
        parsed = split_upload_key(obj["Key"])
        if not parsed:
            continue
        stem, kind = parsed
        if kind == "image":
            images[stem] = obj
        else:
            captions.add(stem)

    photos = []
    for stem, obj in images.items():
        meta_raw = _get_bytes(bucket, f"{META_PREFIX}{stem}.json")
        if not meta_raw:
            logger.info("Skipping %s: not processed yet", stem)
            continue
        meta = json.loads(meta_raw)
        caption = parse_caption(
            _get_bytes(bucket, f"{UPLOAD_PREFIX}{stem}{CAPTION_EXTENSION}") if stem in captions else None,
            stem,
        )
        photos.append({
            "id": stem,
            "title": caption["title"],
            "description": caption["description"],
            "date": caption["date"],
            # When the photo file was uploaded (UTC); the page shows it in the visitor's time zone.
            "uploaded": obj["LastModified"].astimezone(timezone.utc).isoformat(timespec="seconds"),
            "thumb": {"src": public_url(meta["thumb"]["key"]),
                      "width": meta["thumb"]["width"], "height": meta["thumb"]["height"]},
            "large": {"src": public_url(meta["large"]["key"]),
                      "width": meta["large"]["width"], "height": meta["large"]["height"]},
            "_sort": caption["date"] or obj["LastModified"].date().isoformat(),
        })

    return build_manifest(photos)


def handler(event: dict, context: any) -> dict:  # pylint: disable=unused-argument
    """S3 event handler: process changed photos, then rebuild photos.json once."""
    buckets = set()
    for record in event.get("Records", []):
        bucket = record["s3"]["bucket"]["name"]
        key = unquote_plus(record["s3"]["object"]["key"])
        parsed = split_upload_key(key)
        if not parsed:
            logger.info("Ignoring %s", key)
            continue
        stem, kind = parsed
        removed = record.get("eventName", "").startswith("ObjectRemoved")
        if kind == "image":
            if removed:
                remove_image(bucket, stem)
            else:
                process_image(bucket, key, stem)
        buckets.add(bucket)

    for bucket in buckets:
        rebuild_manifest(bucket)
    return {"rebuilt": sorted(buckets)}
