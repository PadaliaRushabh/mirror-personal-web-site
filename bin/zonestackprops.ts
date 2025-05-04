import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';

export interface ZoneStackProps extends cdk.StackProps {
    environment: string;
    zoneName: string;
    
}
