import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { PersonalWebSiteStack } from '../lib/stack';
import {CertificateStack} from '../lib/certificatestack';

const app = new cdk.App();

const env = app.node.tryGetContext('environment')

const certificatestack = new CertificateStack(app, 'CertificateStack', {  
    env: { region: 'us-east-1' },
    environment: env
});

new PersonalWebSiteStack(app, 'PersonalWebSiteStack', {
    environment:env, 
    certificate: certificatestack.certificate
});
