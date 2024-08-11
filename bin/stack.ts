import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { PersonalWebSiteStack } from '../lib/stack';

const app = new cdk.App();

const env = app.node.tryGetContext('environment')

new PersonalWebSiteStack(app, 'PersonalWebSiteStack', {"env":env});
