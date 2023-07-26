import { IntegTest, ExpectedResult } from '@aws-cdk/integ-tests-alpha';
import { Stack } from 'aws-cdk-lib/core';
import { HallApp } from 'hall-constructs';
import { testCases } from './components/test-cases';
import { AppStage } from '../src/app';


const app = new HallApp({
  repoName: 'cdk-example-app',
});

const appStage = new AppStage(app, 'BlogAppIntegStage', {
  env: {
    region: 'us-west-2',
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
});

appStage.appStack.exportValue(appStage.api.apiEndpoint);
const testStack = new Stack(appStage, 'BlogAppIntegAssertionsStack', {
  env: {
    region: 'us-west-2',
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
});
const integ = new IntegTest(app, 'integ-tests', {
  cdkCommandOptions: {
    deploy: {
      args: {
        rollback: true,
      },
    },
  },
  assertionStack: testStack,
  enableLookups: true,
  testCases: [appStage.monitoringStack],
});

testCases.forEach(test => {
  integ.assertions.httpApiCall(`${appStage.api.url!}posts`, {
    method: 'POST',
    body: JSON.stringify(test),
  }).next(
    integ.assertions.httpApiCall(`${appStage.api.url!}posts/${test.pk}`, {
    }).expect(ExpectedResult.objectLike({
      body: {
        author: test.author,
        content: test.content,
        pk: test.pk,
        status: test.status,
        summary: test.summary,
      },
    })),
  );
});
