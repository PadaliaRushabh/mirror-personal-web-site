import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as certmgr from 'aws-cdk-lib/aws-certificatemanager';
import { BlockPublicAccess, BucketAccessControl } from "aws-cdk-lib/aws-s3";


export class PersonalWebSiteStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const ENVIRONMENT = props?.env || "dev"

    // Create an S3 bucket for static website hosting
    const websiteBucket = new s3.Bucket(this, `pws-${ENVIRONMENT}`, {
      publicReadAccess: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: BlockPublicAccess.BLOCK_ACLS,
      accessControl: BucketAccessControl.BUCKET_OWNER_FULL_CONTROL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Deploy static files to the S3 bucket
    new s3deploy.BucketDeployment(this, `bucket-deploy-pws-${ENVIRONMENT}`, {
      sources: [s3deploy.Source.asset('./static')],
      destinationBucket: websiteBucket,
    });

    // // Create a CloudFront distribution
    // const certificate = new certmgr.Certificate(this, 'Certificate', {
    //   domainName: 'example.com',
    //   validation: certmgr.CertificateValidation.fromDns(),
    // });

    // const distribution = new cloudfront.CloudFrontWebDistribution(this, 'WebsiteDistribution', {
    //   originConfigs: [{
    //     s3OriginSource: {
    //       s3BucketSource: websiteBucket,
    //     },
    //     behaviors: [{ isDefaultBehavior: true }],
    //   }],
    //   viewerCertificate: cloudfront.ViewerCertificate.fromAcmCertificate(certificate, {
    //     aliases: ['example.com'],
    //     securityPolicy: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2018,
    //     sslSupportMethod: cloudfront.SSLMethod.SNI,
    //   }),
    // });

    // // Create a Route 53 Hosted Zone
    // const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
    //   domainName: 'example.com',
    // });

    // // Create a Route 53 record set to point to CloudFront
    // new route53.ARecord(this, 'AliasRecord', {
    //   zone: hostedZone,
    //   recordName: 'example.com',
    //   target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
    // });
  }
}

