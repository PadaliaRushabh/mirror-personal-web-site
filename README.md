# personal-web-site


# Personal Website Infrastructure

## Overview

This repository contains the AWS CDK code that provisions and deploys the infrastructure for my personal website. The infrastructure includes S3 buckets for hosting static files, CloudFront distributions for content delivery, and Route 53 for DNS management. The project also includes a GitLab CI/CD pipeline for automated deployment.

## Infrastructure Components

### S3 Buckets
Two S3 buckets are created to host the static files for the website:

- **Production Bucket (`pws-prd`)**: Used to host the production version of the website.
- **Staging Bucket (`pws-staging`)**: Used to host the staging version of the website.

Both buckets are configured with the following properties:
- **Public Read Access**: Disabled
- **Encryption**: S3-managed encryption
- **Block Public Access**: Enabled
- **Access Control**: Full control to the bucket owner
- **Removal Policy**: Destroy (the bucket will be deleted when the stack is destroyed)

### CloudFront Distributions
Two CloudFront distributions are created to serve the content from the S3 buckets:

- **Production Distribution (`pws-distribution-prd`)**
- **Staging Distribution (`pws-distribution-staging`)**

Both distributions are configured with the following properties:
- **Viewer Protocol Policy**: Allow all protocols (HTTP and HTTPS)
- **Allowed Methods**: GET, HEAD, OPTIONS
- **SSL Support Method**: SNI
- **Minimum Protocol Version**: TLS v1.2 2021
- **Custom Error Responses**: 
  - 403 errors are redirected to `/index.html` with a 200 status code.
- **Certificates**: Uses an SSL certificate provided via the `CustomStackProps`.

### Route 53 Hosted Zone
A Route 53 hosted zone is created for managing the DNS records for the domain `rushabhpadalia.me`.

### DNS Records
The following DNS records are created in Route 53:

- **A Record for `rushabhpadalia.me`**: Points to the production CloudFront distribution.
- **A Record for `www.rushabhpadalia.me`**: Points to the production CloudFront distribution.
- **A Record for `staging.rushabhpadalia.me`**: Points to the staging CloudFront distribution.

### S3 Bucket Deployment
Static files are deployed to the respective S3 buckets using the `BucketDeployment` construct. After deployment, the CloudFront distributions are invalidated to ensure the latest content is served.

- **Production Deployment (`bucket-deploy-pws-prd`)**
  - Source: `./resources/static/prd`
  - Destination: Production S3 Bucket
  - Invalidation: Invalidates all paths (`/*`) on the production CloudFront distribution

- **Staging Deployment (`bucket-deploy-pws-staging`)**
  - Source: `./resources/static/staging`
  - Destination: Staging S3 Bucket
  - Invalidation: Invalidates all paths (`/*`) on the staging CloudFront distribution


## Photo gallery

`gallery.html` shows photos with a title and description. It is fully serverless:

```
you ──upload──▶ S3 photos bucket (uploads/) ──event──▶ Lambda (photo_gallery)
                                                         │ resizes, strips EXIF/GPS
                                                         ▼
            gallery.html ◀── CloudFront /photos/* ◀── photos/photos.json + web-sized images
```

### Add a photo

Each photo gets a caption file with the **same name**:

```
sunset-at-bondi.jpg
sunset-at-bondi.json
```

```json
{
  "title": "Sunset at Bondi",
  "description": "Shot on a winter evening.\nNew lines are kept.",
  "date": "2026-07-01"
}
```

All fields are optional. Without a caption file the title comes from the filename
(`sunset-at-bondi` → "Sunset at bondi"). `date` (YYYY-MM-DD) is shown in the viewer and
controls the order (newest first); photos without one are ordered by upload time.
The upload date of the photo file is always shown too (editing only the `.json` doesn't change it;
replacing the photo does).

Upload both files to `uploads/` (bucket name is in the `PhotosBucketName` stack output):

```bash
BUCKET=$(aws cloudformation describe-stacks --stack-name PersonalWebSiteStack-prd \
  --query "Stacks[0].Outputs[?OutputKey=='PhotosBucketName'].OutputValue" --output text)

aws s3 cp sunset-at-bondi.json "s3://$BUCKET/uploads/"
aws s3 cp sunset-at-bondi.jpg  "s3://$BUCKET/uploads/"

# or keep a local folder in sync (add --delete to also remove photos you deleted locally)
aws s3 sync ./gallery "s3://$BUCKET/uploads/"
```

The gallery updates within about a minute. Supported formats: JPG, PNG, WebP
(convert iPhone HEIC photos to JPG first).

- **Change a title/description:** edit the `.json` and upload it again.
- **Replace a photo:** upload a new file with the same name.
- **Remove a photo:** `aws s3 rm "s3://$BUCKET/uploads/sunset-at-bondi.jpg"` (and its `.json`).

### Bucket layout

| Prefix | Written by | Public? |
| --- | --- | --- |
| `uploads/` | you — originals + caption files | No |
| `photos/<name>/<version>/thumb.webp`, `large.webp` | Lambda | Yes, via CloudFront |
| `photos/photos.json` | Lambda — the list the page reads | Yes, via CloudFront |
| `meta/` | Lambda — image sizes | No |

Originals (and the GPS location inside them) are never served. The photos bucket is
**retained** if the stack is deleted, so your photos are never lost by a redeploy.

The Lambda's Python dependency (Pillow) is bundled by `cdk deploy` using the local
`python3 -m pip` (falls back to Docker if pip is unavailable).

## Update Namecheap DNS
The domain is purchased via namecheap. In the Namecheap account, update the nameservers to point to the AWS Route 53 nameservers. This will connect domain to the Route 53 hosted zone.

