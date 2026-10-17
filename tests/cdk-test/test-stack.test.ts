import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { PersonalWebSiteStack } from '../../lib/stack';

function synth(): Template {
  // Skip Lambda bundling (pip download) in unit tests.
  const app = new cdk.App({ context: { 'aws:cdk:bundling-stacks': [] } });
  const stack = new PersonalWebSiteStack(app, 'PersonalWebSiteStack', {
    env: { account: '123456789012', region: 'ap-southeast-2' },
    environment: 'dev',
    bucketName: 'pws-dev',
    domainName: ['dev.example.com'],
    zoneName: 'example.com',
    certificateArn: 'arn:aws:acm:us-east-1:123456789012:certificate/test',
  });
  return Template.fromStack(stack);
}

const template = synth();

test('Photo processing Lambda created', () => {
  template.hasResourceProperties('AWS::Lambda::Function', {
    Handler: 'index.handler',
    Runtime: 'python3.12',
    MemorySize: 1024,
  });
});

test('Photos bucket is kept when the stack is deleted', () => {
  template.hasResource('AWS::S3::Bucket', {
    DeletionPolicy: 'Retain',
    Properties: Match.objectLike({
      PublicAccessBlockConfiguration: Match.objectLike({ BlockPublicPolicy: true }),
    }),
  });
});

test('Uploads trigger the Lambda', () => {
  template.hasResourceProperties('Custom::S3BucketNotifications', {
    NotificationConfiguration: {
      LambdaFunctionConfigurations: Match.arrayWith([
        Match.objectLike({
          Events: ['s3:ObjectCreated:*'],
          Filter: { Key: { FilterRules: [{ Name: 'prefix', Value: 'uploads/' }] } },
        }),
        Match.objectLike({ Events: ['s3:ObjectRemoved:*'] }),
      ]),
    },
  });
});

test('CloudFront serves /photos/* from the photos bucket', () => {
  template.hasResourceProperties('AWS::CloudFront::Distribution', {
    DistributionConfig: Match.objectLike({
      CacheBehaviors: [Match.objectLike({ PathPattern: '/photos/*', ViewerProtocolPolicy: 'redirect-to-https' })],
    }),
  });
});
