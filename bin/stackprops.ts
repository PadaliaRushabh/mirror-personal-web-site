import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';

export interface CustomStackProps extends cdk.StackProps {
    certificateArn: string;
    createZone: boolean;
    zoneId: string;
    zoneName: string;
    environment: string;
    bucketName: string;
    domainName: string[];
}
