import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface PhotoGalleryProps {
  environment: string;
}

/**
 * Serverless photo gallery storage + processing.
 *
 * Upload a photo and a same-named .json caption to `uploads/` in the bucket.
 * The Lambda creates web-sized copies under `photos/` and rebuilds
 * `photos/photos.json`, which the gallery page reads via CloudFront.
 */
export class PhotoGallery extends Construct {
  public readonly bucket: s3.Bucket;
  public readonly processor: lambda.Function;

  constructor(scope: Construct, id: string, props: PhotoGalleryProps) {
    super(scope, id);

    // Your photos live here. RETAIN so deleting/redeploying the stack never deletes them.
    this.bucket = new s3.Bucket(this, 'PhotosBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const lambdaDir = path.resolve('./resources/lambdas/photo_gallery');

    this.processor = new lambda.Function(this, 'PhotoProcessor', {
      description: `Builds photos.json for the website gallery (${props.environment})`,
      runtime: lambda.Runtime.PYTHON_3_12,
      architecture: lambda.Architecture.X86_64,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(lambdaDir, {
        bundling: {
          // Used only if local bundling below fails (needs Docker).
          image: lambda.Runtime.PYTHON_3_12.bundlingImage,
          command: [
            'bash', '-c',
            'pip install -r requirements.txt -t /asset-output --only-binary=:all: && cp -au . /asset-output',
          ],
          // Preferred: download Linux wheels with the local pip (works in GitLab CI without Docker).
          local: {
            tryBundle(outputDir: string): boolean {
              try {
                execSync([
                  'python3 -m pip install',
                  `-r "${path.join(lambdaDir, 'requirements.txt')}"`,
                  `--target "${outputDir}"`,
                  '--platform manylinux2014_x86_64 --platform manylinux_2_28_x86_64',
                  '--implementation cp --python-version 3.12',
                  '--only-binary=:all: --upgrade --quiet --disable-pip-version-check',
                ].join(' '), { stdio: 'inherit' });
              } catch (err) {
                console.warn('Local bundling of photo Lambda failed, falling back to Docker:', err);
                return false;
              }
              fs.cpSync(lambdaDir, outputDir, {
                recursive: true,
                filter: (src) => !src.includes('__pycache__'),
              });
              return true;
            },
          },
        },
      }),
      memorySize: 1024, // more memory = more CPU = faster resizing
      timeout: cdk.Duration.seconds(60),
      environment: {
        LOG_LEVEL: 'INFO',
      },
      logGroup: new logs.LogGroup(this, 'PhotoProcessorLogs', {
        retention: logs.RetentionDays.ONE_MONTH,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
    });

    this.bucket.grantReadWrite(this.processor);

    // Run on every add/replace/delete in uploads/ (the Lambda only writes to photos/ and meta/,
    // so it never triggers itself).
    const target = new s3n.LambdaDestination(this.processor);
    const filter = { prefix: 'uploads/' };
    this.bucket.addEventNotification(s3.EventType.OBJECT_CREATED, target, filter);
    this.bucket.addEventNotification(s3.EventType.OBJECT_REMOVED, target, filter);
  }
}
