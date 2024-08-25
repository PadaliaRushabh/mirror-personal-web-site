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

## Prerequisites

Before deploying this stack, ensure you have the following:

- **AWS Account**: With permissions to manage S3, CloudFront, and Route 53.
- **AWS CLI**: Configured with your credentials.
- **Node.js**: For running AWS CDK commands.
- **AWS CDK**: Installed globally.

## Update Namecheap DNS
In your Namecheap account, update the nameservers to point to the AWS Route 53 nameservers. This will connect your domain to the Route 53 hosted zone.

## File Structure
├── bin/
│   └── stackprops.ts         # CustomStackProps definition
├── lib/
│   └── personal-website-stack.ts # Main stack definition
├── resources/
│   └── static/
│       ├── prd/              # Static files for production
│       └── staging/          # Static files for staging
├── cdk.json                  # CDK configuration file
├── package.json              # Node.js dependencies and scripts
├── README.md                 # Project documentation
└── tsconfig.json             # TypeScript configuration


# AWS Architecture for Personal Website

## Overview

This architecture leverages AWS services to host, secure, and deliver a personal static website with high availability, scalability, and security. The key components include S3 for static file storage, CloudFront for content delivery, Route 53 for DNS management, and GitLab CI/CD for automated deployments.

## Architecture Components

### 1. S3 Buckets for Static Website Hosting
- **Purpose**: S3 is used to store and serve the static files (HTML, CSS, images, etc.) of the website.
- **Setup**:
  - **Production Bucket** (`pws-prd`): Hosts the production version of the website.
  - **Staging Bucket** (`pws-staging`): Hosts the staging version of the website.
  - **Security**:
    - Public access is blocked.
    - Data is encrypted using S3-managed encryption keys.
    - Access is controlled with `BUCKET_OWNER_FULL_CONTROL`.
    - Buckets are set to be destroyed when the stack is deleted (`RemovalPolicy.DESTROY`).

### 2. CloudFront Distributions
- **Purpose**: CloudFront acts as a Content Delivery Network (CDN) that ensures fast, secure delivery of the website by caching content at global edge locations.
- **Setup**:
  - **Production Distribution** (`pws-distribution-prd`): Serves content from the production S3 bucket.
  - **Staging Distribution** (`pws-distribution-staging`): Serves content from the staging S3 bucket.
  - **Security**:
    - SSL/TLS certificates are used to secure the communication between users and CloudFront.
    - The latest TLS version (TLS v1.2) is enforced.
    - Custom error responses redirect 403 errors to `index.html`.
  - **Origins**: CloudFront fetches content from the S3 buckets using Origin Access Identity (OAI), ensuring that the S3 buckets are not publicly accessible.

### 3. Origin Access Identity (OAI)
- **Purpose**: Restricts direct access to the S3 buckets by allowing only CloudFront to fetch content from th

