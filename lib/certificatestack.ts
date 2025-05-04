import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as certmgr from 'aws-cdk-lib/aws-certificatemanager';
import {CertificateStackProps} from "../bin/certificatestackprops"
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as route53 from 'aws-cdk-lib/aws-route53';
export class CertificateStack extends cdk.Stack {

  public readonly certificate: certmgr.ICertificate;

  constructor(scope: Construct, id: string, props?: CertificateStackProps) {
    super(scope, id, props);
    
    const environment = props?.environment
    
    // Generate new SSL certificate
    this.certificate = new certmgr.Certificate(this, `pws-Certificate`, {
      domainName: 'rushabhpadalia.me',
      subjectAlternativeNames: ['*.rushabhpadalia.me'], // Include subdomains
      validation: certmgr.CertificateValidation.fromDns(),
    });

    new ssm.StringParameter(this, 'CertificateArnParameter', {
      parameterName: '/shared/certificate/arn',
      stringValue: this.certificate.certificateArn,
    });

      // // Import existing SSL certificate
      // const certificateArn = ssm.StringParameter.valueForStringParameter(this, '/shared/certificate/arn');
      // this.certificate = certmgr.Certificate.fromCertificateArn(this, 'ImportedCertificate', certificateArn);
    

  }
}

