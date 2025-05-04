import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {ZoneStackProps} from "../bin/zonestackprops"
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as route53 from 'aws-cdk-lib/aws-route53';
export class ZoneStack extends cdk.Stack {


    constructor(scope: Construct, id: string, props?: ZoneStackProps) {
        super(scope, id, props);

        const zoneName = props!.zoneName

        const hostedZone = new route53.HostedZone(this, 'CreatedZone', {
            zoneName,
        });
        console.warn(`Created new hosted zone for: ${zoneName}`);

        // Store the Hosted Zone ID in SSM Parameter Store
        new ssm.StringParameter(this, 'HostedZoneIdParameter', {
            parameterName: `/shared/hosted-zone/${zoneName}/id`,
            stringValue: hostedZone.hostedZoneId,
        });
    }
}

