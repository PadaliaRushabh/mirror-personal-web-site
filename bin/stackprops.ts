import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';

export interface CustomStackProps extends cdk.StackProps {
    environment: string;
    bucketName: string;
    domainName: string[];
}
