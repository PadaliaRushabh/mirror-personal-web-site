import * as cdk from 'aws-cdk-lib';
import { AssetCode, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export class PersonalWebSiteStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const testingLambda = new Function(this, 'TestLambda', {
      functionName: 'TestLambda',
      runtime: Runtime.PYTHON_3_9,
      code: new AssetCode('resources/lambdas/test-lambda'),
      handler: 'index.handler',
      environment: {
        "LOG_LEVEL": "INFO"
      }
    });
  }
}

