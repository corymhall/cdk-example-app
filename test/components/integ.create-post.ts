import { ExpectedResult, IntegTest } from '@aws-cdk/integ-tests-alpha';
import { marshall } from '@aws-sdk/util-dynamodb';
import { RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { AttributeType, ITable, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { HallApp } from 'hall-constructs';
import { testCases } from './test-cases';
import { CreatePost } from '../../src/components/create-post';
import { Api } from '../../src/constructs/api';
import { Monitoring } from '../../src/constructs/monitoring';

const app = new HallApp({
  repoName: 'cdk-example-app',
});

export class TestCase extends Stack {
  public readonly table: ITable;
  public readonly api: Api;
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const monitor = new Monitoring(this, 'CreatePostMonitor');

    this.api = new Api(this, 'CreatePostIntegApi', {
      monitor: monitor,
    });

    this.table = new Table(this, 'CreatePostIntegTable', {
      removalPolicy: RemovalPolicy.DESTROY,
      partitionKey: {
        name: 'pk',
        type: AttributeType.STRING,
      },
    });
    new CreatePost(this, 'CreatePost', {
      api: this.api,
      monitor,
      table: this.table,
    });
  }
}

const testCase = new TestCase(app, 'integ-create-post', {});

const integ = new IntegTest(app, 'integ-test', {
  testCases: [testCase],
  diffAssets: true,
  cdkCommandOptions: {
    deploy: {
      args: {
        rollback: true,
      },
    },
  },
});

// ---------------------------------------------
// --------------Test Cases----------------------
// ---------------------------------------------

for (const test of testCases) {
  integ.assertions
    .httpApiCall(`${testCase.api.url!}posts`, {
      method: 'POST',
      body: JSON.stringify(test),
    })
    .next(
      integ.assertions
        .awsApiCall('DynamoDB', 'getItem', {
          Key: {
            pk: { S: test.pk },
          },
          TableName: testCase.table.tableName,
        })
        .expect(
          ExpectedResult.objectLike({
            Item: marshall({
              author: test.author,
              content: test.content,
              pk: test.pk,
              status: test.status,
              summary: test.summary,
            }),
          }),
        ),
    );
}
