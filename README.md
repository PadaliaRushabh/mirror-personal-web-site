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


## Update Namecheap DNS
The domain is purchased via namecheap. In the Namecheap account, update the nameservers to point to the AWS Route 53 nameservers. This will connect domain to the Route 53 hosted zone.

