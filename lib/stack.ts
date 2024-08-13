import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as certmgr from 'aws-cdk-lib/aws-certificatemanager';
import { BlockPublicAccess, BucketAccessControl } from "aws-cdk-lib/aws-s3";
import {AllowedMethods, Distribution, OriginAccessIdentity, ViewerProtocolPolicy} from "aws-cdk-lib/aws-cloudfront";
import {S3Origin} from "aws-cdk-lib/aws-cloudfront-origins";
import {CustomStackProps} from "../bin/stackprops"

export class PersonalWebSiteStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: CustomStackProps) {
    super(scope, id, props);

    const ENVIRONMENT = props?.environment || "dev"

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
      sources: [s3deploy.Source.asset('./resources/static')],
      destinationBucket: websiteBucket,
    });

    const originAccess = new OriginAccessIdentity(this, `pws-OriginAccessControl-${ENVIRONMENT}`, {comment: 'Personal Website'});
    const s3origin = new S3Origin(websiteBucket, {originAccessIdentity: originAccess})

    // Create a new hosted zone for the domain
    const hostedZone = new route53.HostedZone(this, `pws-HostedZone-${ENVIRONMENT}`, {
      zoneName: 'rushabhpadalia.me',
    });

    // Generate new SSL certificate
    const certificate = new certmgr.Certificate(this, `pws-Certificate-${ENVIRONMENT}`, {
      domainName: 'rushabhpadalia.me',
      subjectAlternativeNames: ['*.rushabhpadalia.me'], // Include subdomains
      validation: certmgr.CertificateValidation.fromDns(),
    });


    const distribution = new Distribution(this, `pws-distribution-${ENVIRONMENT}`, {
      defaultBehavior: {
          origin: s3origin,
          viewerProtocolPolicy: ViewerProtocolPolicy.ALLOW_ALL,
          allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS
      },
      domainNames: ['rushabhpadalia.me', 'test.rushabhpadalia.me'],
      sslSupportMethod: cloudfront.SSLMethod.SNI,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      errorResponses: [
          {
              httpStatus: 403,
              responsePagePath: '/index.html',
              responseHttpStatus: 200
          }
      ], 
      certificate: certificate
  })


    // Create a Route 53 record set to point to CloudFront
    new route53.ARecord(this, `pws-AliasRecord-${ENVIRONMENT}`, {
      zone: hostedZone,
      recordName: 'rushabhpadalia.me',
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
    });

    new route53.ARecord(this, `pws-SubdomainAliasRecord-${ENVIRONMENT}`, {
      recordName: 'test.rushabhpadalia.me',
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
      zone: hostedZone,
    });
  }
}

