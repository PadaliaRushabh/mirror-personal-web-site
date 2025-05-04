import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import { BlockPublicAccess, BucketAccessControl } from "aws-cdk-lib/aws-s3";
import {AllowedMethods, Distribution, OriginAccessIdentity, ViewerProtocolPolicy} from "aws-cdk-lib/aws-cloudfront";
import {S3Origin} from "aws-cdk-lib/aws-cloudfront-origins";
import {CustomStackProps} from "../bin/stackprops"
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as certmgr from 'aws-cdk-lib/aws-certificatemanager';

export class PersonalWebSiteStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: CustomStackProps) {
    super(scope, id, props);

    const environment = props!.environment
    const bucketName = props!.bucketName
    const domainName = props!.domainName
    const certArn = props!.certificateArn

    const zoneName = props!.zoneName
    const isProd = environment === 'prd';

    // Create an S3 bucket for static website hosting
    const websiteBucket = new s3.Bucket(this, bucketName, {
      publicReadAccess: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: BlockPublicAccess.BLOCK_ACLS,
      accessControl: BucketAccessControl.BUCKET_OWNER_FULL_CONTROL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const originAccess = new OriginAccessIdentity(this, `pws-OriginAccessControl-${environment}`, {comment: 'PRD Personal Website'});
    const s3origin = new S3Origin(websiteBucket, {originAccessIdentity: originAccess})
    
    const ssmZoneId = ssm.StringParameter.valueForStringParameter(this, `/shared/hosted-zone/${zoneName}/id`);

    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'ImportedZone', {
      hostedZoneId: ssmZoneId,
      zoneName,
    });
  
    console.log(`Imported hosted zone from SSM: ${zoneName} -> ${ssmZoneId}`);
      
    const certificate = certmgr.Certificate.fromCertificateArn(this, 'ImportedCert', certArn);

    const distribution = new Distribution(this, `pws-distribution-${environment}`, {
      defaultBehavior: {
          origin: s3origin,
          viewerProtocolPolicy: ViewerProtocolPolicy.ALLOW_ALL,
          allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS
      },
      domainNames: domainName,
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

    // Deploy static files to the S3 bucket
    new s3deploy.BucketDeployment(this, `bucket-deploy-pws-${environment}`, {
      sources: [s3deploy.Source.asset('./resources/static/web')],
      destinationBucket: websiteBucket,
      distribution: distribution, // CloudFront distribution to invalidate
      distributionPaths: ['/*'], // Invalidate all paths, or specify the paths you need
    });


    // Create a Route 53 record set to point to CloudFront
    domainName.forEach((domain) => {
      const safeId = `pws-AliasRecord_${domain.replace(/[\.\-]/g, '_')}`;

      new route53.ARecord(this, safeId, {
        zone: hostedZone,
        recordName: domain, // e.g., 'dev.rushabhpadalia.me'
        target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
      });
    });


  }
}

