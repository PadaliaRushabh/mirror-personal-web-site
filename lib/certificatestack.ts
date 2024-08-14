import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as certmgr from 'aws-cdk-lib/aws-certificatemanager';
import {CertificateStackProps} from "../bin/certificatestackprops"

export class CertificateStack extends cdk.Stack {

  public readonly certificate: certmgr.Certificate;


  constructor(scope: Construct, id: string, props?: CertificateStackProps) {
    super(scope, id, props);

    // Generate new SSL certificate
    this.certificate = new certmgr.Certificate(this, `pws-Certificate`, {
      domainName: 'rushabhpadalia.me',
      subjectAlternativeNames: ['*.rushabhpadalia.me'], // Include subdomains
      validation: certmgr.CertificateValidation.fromDns(),
    });

  }
}

