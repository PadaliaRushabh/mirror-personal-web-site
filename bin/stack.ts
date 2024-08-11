import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { PersonalWebSiteStack } from '../lib/stack';

const app = new cdk.App();
new PersonalWebSiteStack(app, 'PersonalWebSiteStack');
