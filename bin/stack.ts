import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { PersonalWebSiteStack } from '../lib/stack';
import {CertificateStack} from '../lib/certificatestack';


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

const isDeployCertificate = (deployTarget === 'all' || deployTarget === 'certificate');
console.log("Deploying Certificate: ", isDeployCertificate);

if (isDeployCertificate) {
    console.log("Start Deploying Certificate");

    const certificatestack = new CertificateStack(app, `CertificateStack`, {  
        env: { 
            account: account,
            region: 'us-east-1' 
        },
        environment: environment,
        crossRegionReferences: true // <-- Enable cross region references
    });

}

const isDeployWebsite = (deployTarget === 'all' || deployTarget === "website");
console.log("Deploying Website: ", isDeployWebsite);

if (isDeployWebsite) {
    console.log("Start Deploying Website");
    new PersonalWebSiteStack(app, `PersonalWebSiteStack-${environment}`, {
        env: { 
            account: account,
            region: 'ap-southeast-2' 
        },
        environment: environment,
        domainName:domainName,
        bucketName: bucketName,
        crossRegionReferences: true // <-- Enable cross region references

    });
}
