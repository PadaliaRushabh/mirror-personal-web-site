import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { PersonalWebSiteStack } from '../../lib/stack';
import { Runtime } from 'aws-cdk-lib/aws-lambda';

test('Lambda Function Created', () => {
  const app = new cdk.App();
  const stack = new PersonalWebSiteStack(app, 'PersonalWebSiteStack');
  
  // Prepare the stack for assertions
  const template = Template.fromStack(stack);
  
  // Assert that a Lambda function is created
  template.hasResourceProperties('AWS::Lambda::Function', {
    Handler: 'index.handler',
    Runtime: Runtime.PYTHON_3_9,
  });
});
