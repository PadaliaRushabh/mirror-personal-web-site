import io
import json

import boto3
import pytest
from moto import mock_aws
from PIL import Image

from resources.lambdas.photo_gallery import index as gallery

BUCKET = "test-photos"


# --- pure helpers -----------------------------------------------------------

@pytest.mark.parametrize("key,expected", [
    ("uploads/sunset.jpg", ("sunset", "image")),
    ("uploads/Sunset.JPEG", ("Sunset", "image")),
    ("uploads/beach day.png", ("beach day", "image")),
    ("uploads/sunset.json", ("sunset", "caption")),
    ("uploads/notes.txt", None),
    ("uploads/sub/sunset.jpg", None),
    ("uploads/.DS_Store", None),
    ("photos/sunset/abc/thumb.webp", None),
])
def test_split_upload_key(key, expected):
    assert gallery.split_upload_key(key) == expected


def test_title_from_stem():
    assert gallery.title_from_stem("sunset-at_bondi") == "Sunset at bondi"
    assert gallery.title_from_stem("IMG_1234") == "IMG 1234"


def test_parse_caption_full():
    raw = json.dumps({"title": " Sunset ", "description": "Winter evening", "date": "2026-07-01"}).encode()
    assert gallery.parse_caption(raw, "x") == {
        "title": "Sunset", "description": "Winter evening", "date": "2026-07-01"}


def test_parse_caption_missing_or_broken_falls_back_to_filename():
    expected = {"title": "Blue mountains", "description": "", "date": ""}
    assert gallery.parse_caption(None, "blue-mountains") == expected
    assert gallery.parse_caption(b"{not json", "blue-mountains") == expected
    assert gallery.parse_caption(b"[1, 2]", "blue-mountains") == expected


def test_parse_caption_unicode_and_bad_date():
    raw = '﻿{"title": "Café ☕", "date": "1 July"}'.encode("utf-8")
    caption = gallery.parse_caption(raw, "x")
    assert caption["title"] == "Café ☕"
    assert caption["date"] == ""


def test_build_manifest_sorts_newest_first():
    photos = [{"id": "a", "_sort": "2025-01-01"}, {"id": "b", "_sort": "2026-05-01"}]
    manifest = gallery.build_manifest(photos, generated_at="now")
    assert [p["id"] for p in manifest["photos"]] == ["b", "a"]
    assert manifest["count"] == 2
    assert "_sort" not in manifest["photos"][0]


def _jpeg(width=3000, height=2000, gps=True) -> bytes:
    img = Image.new("RGB", (width, height), (200, 100, 50))
    exif = Image.Exif()
    exif[0x0112] = 6  # orientation: rotate 90 degrees
    if gps:
        exif[0x8825] = {1: "S", 2: (35.0, 17.0, 0.0)}
    buf = io.BytesIO()
    img.save(buf, "JPEG", exif=exif)
    return buf.getvalue()


def test_make_renditions_resizes_rotates_and_strips_exif():
    out = gallery.make_renditions(_jpeg())
    body, width, height = out["thumb"]
    # Orientation 6 means the 3000x2000 photo is really portrait.
    assert (width, height) == (533, 800)
    assert out["large"][1:] == (1333, 2000)
    with Image.open(io.BytesIO(body)) as img:
        assert img.format == "WEBP"
        assert not img.getexif()


# --- full flow against a fake S3 -----------------------------------------------

@pytest.fixture(name="bucket")
def fixture_bucket(monkeypatch):
    monkeypatch.setenv("AWS_DEFAULT_REGION", "ap-southeast-2")
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "testing")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "testing")
    with mock_aws():
        gallery._s3 = None  # pylint: disable=protected-access
        client = boto3.client("s3")
        client.create_bucket(Bucket=BUCKET, CreateBucketConfiguration={"LocationConstraint": "ap-southeast-2"})
        yield client
        gallery._s3 = None  # pylint: disable=protected-access


def _event(key, name="ObjectCreated:Put"):
    return {"Records": [{"eventName": name, "s3": {"bucket": {"name": BUCKET}, "object": {"key": key}}}]}


def _manifest(client):
    return json.loads(client.get_object(Bucket=BUCKET, Key="photos/photos.json")["Body"].read())


def test_upload_caption_then_photo_builds_photos_json(bucket):
    bucket.put_object(Bucket=BUCKET, Key="uploads/sunset at bondi.json",
                      Body=json.dumps({"title": "Sunset at Bondi", "description": "Winter evening"}))
    gallery.handler(_event("uploads/sunset+at+bondi.json"), None)
    assert _manifest(bucket)["count"] == 0  # caption alone shows nothing yet

    bucket.put_object(Bucket=BUCKET, Key="uploads/sunset at bondi.jpg", Body=_jpeg())
    gallery.handler(_event("uploads/sunset+at+bondi.jpg"), None)

    manifest = _manifest(bucket)
    assert manifest["count"] == 1
    photo = manifest["photos"][0]
    assert photo["title"] == "Sunset at Bondi"
    assert photo["description"] == "Winter evening"
    assert photo["uploaded"].endswith("+00:00")
    assert photo["thumb"]["src"].startswith("photos/sunset%20at%20bondi/")
    thumb_key = photo["thumb"]["src"].replace("%20", " ")
    head = bucket.head_object(Bucket=BUCKET, Key=thumb_key)
    assert head["ContentType"] == "image/webp"


def test_editing_caption_updates_title(bucket):
    bucket.put_object(Bucket=BUCKET, Key="uploads/lake.jpg", Body=_jpeg(gps=False))
    gallery.handler(_event("uploads/lake.jpg"), None)
    assert _manifest(bucket)["photos"][0]["title"] == "Lake"
    first_uploaded = _manifest(bucket)["photos"][0]["uploaded"]

    bucket.put_object(Bucket=BUCKET, Key="uploads/lake.json", Body=b'{"title": "Lake Burley Griffin"}')
    gallery.handler(_event("uploads/lake.json"), None)
    photo = _manifest(bucket)["photos"][0]
    assert photo["title"] == "Lake Burley Griffin"
    # Editing only the caption must not change the photo's upload date.
    assert photo["uploaded"] == first_uploaded


def test_deleting_photo_removes_it_and_its_files(bucket):
    bucket.put_object(Bucket=BUCKET, Key="uploads/lake.jpg", Body=_jpeg(gps=False))
    gallery.handler(_event("uploads/lake.jpg"), None)
    bucket.delete_object(Bucket=BUCKET, Key="uploads/lake.jpg")
    gallery.handler(_event("uploads/lake.jpg", "ObjectRemoved:Delete"), None)

    assert _manifest(bucket)["count"] == 0
    left = bucket.list_objects_v2(Bucket=BUCKET, Prefix="photos/lake/").get("KeyCount")
    assert left == 0
