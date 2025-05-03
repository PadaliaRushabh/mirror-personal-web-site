import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import * as certmgr from 'aws-cdk-lib/aws-certificatemanager';

export interface CustomStackProps extends cdk.StackProps {
    certificate: certmgr.ICertificate;
    environment: string;
    bucketName: string;
    domainName: string[];
}
