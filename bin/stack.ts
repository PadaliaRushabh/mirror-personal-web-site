import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { PersonalWebSiteStack } from '../lib/stack';
import {CertificateStack} from '../lib/certificatestack';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as certmgr from 'aws-cdk-lib/aws-certificatemanager';

const app = new cdk.App();

const environment = app.node.tryGetContext('ENVIRONMENT'); // returns 'dev', 'tst', or 'prd'
const rawDomainName = app.node.tryGetContext('DOMAIN_NAME');
const bucketName = app.node.tryGetContext('BUCKET_NAME');
const deployTarget = app.node.tryGetContext('DEPLOY_TARGET') || 'all';

const domainName =  JSON.parse(rawDomainName || '[]');

const account = process.env.CDK_DEFAULT_ACCOUNT; // Use the default AWS account from the environment

console.log("Environment Variables From CI/CD: ", {
    environment: environment,
    rawDomainName: rawDomainName,
    domainName: domainName,
    bucketName: bucketName,
    deployTarget:deployTarget,
    account:account
});

let certificate: certmgr.ICertificate | undefined;

if (deployTarget === 'all' || deployTarget === 'certificate') {
    const certificatestack = new CertificateStack(app, `CertificateStack`, {  
        env: { 
            account: account,
            region: 'us-east-1' 
        },
        environment: environment,
        crossRegionReferences: true // <-- Enable cross region references
    });
    certificate = certificatestack.certificate;

} else if (deployTarget === 'website') {

    const certArn = ssm.StringParameter.valueForStringParameter(app, '/shared/certificate/arn');
    certificate = certmgr.Certificate.fromCertificateArn(app, 'ImportedCert', certArn);

} else{

    throw new Error('Not Supported Deploy Target');
}

const isDeployWebsite = ((deployTarget === 'all' || deployTarget === "website") && certificate);
console.log("Deploying Website: ", isDeployWebsite);

if (isDeployWebsite) {
    console.log("Deploying Website");
    new PersonalWebSiteStack(app, `PersonalWebSiteStack-${environment}`, {
        env: { 
            account: account,
            region: 'ap-southeast-2' 
        },
        certificate: certificate,
        environment: environment,
        domainName:domainName,
        bucketName: bucketName,
        crossRegionReferences: true // <-- Enable cross region references

    });
}
