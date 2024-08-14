import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { PersonalWebSiteStack } from '../lib/stack';
import {CertificateStack} from '../lib/certificatestack';

const app = new cdk.App();

const certificatestack = new CertificateStack(app, 'CertificateStack', {  
    env: { region: 'us-east-1' },
    crossRegionReferences: true // <-- Enable cross region references
});

new PersonalWebSiteStack(app, 'PersonalWebSiteStack', {
    env: { region: 'ap-southeast-2' },
    certificate: certificatestack.certificate,
    crossRegionReferences: true // <-- Enable cross region references

});
