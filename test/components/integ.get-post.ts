import { ExpectedResult, IntegTest } from '@aws-cdk/integ-tests-alpha';
import { marshall } from '@aws-sdk/util-dynamodb';
import { RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { AttributeType, ITable, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Vpc } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { HallApp } from 'hall-constructs';
import { testCases } from './test-cases';
import { GetPost } from '../../src/components/get-post';
import { Network } from '../../src/components/network';
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

    const monitor = new Monitoring(this, 'GetPostIntegMonitor');

    const network = new Network(this, 'GetPostIntegNetwork', {
      vpc: new Vpc(this, 'GetPostIntegVpc', { natGateways: 1 }),
    });
    this.api = new Api(this, 'GetPostIntegApi', {
      monitor,
      vpc: network.cluster.vpc,
    });

    this.table = new Table(this, 'GetPostIntegTable', {
      removalPolicy: RemovalPolicy.DESTROY,
      partitionKey: {
        name: 'pk',
        type: AttributeType.STRING,
      },
    });

    new GetPost(this, 'GetPost', {
      api: this.api,
      cluster: network.cluster,
      monitor,
      table: this.table,
    });
  }
}

const testCase = new TestCase(app, 'integ-get-post', { });

const integ = new IntegTest(app, 'integ-test', {
  testCases: [testCase],
  diffAssets: true,
});


// ---------------------------------------------
// --------------Test Cases----------------------
// ---------------------------------------------

for (const test of testCases) {
  integ.assertions.awsApiCall('DynamoDB', 'putItem', {
    Item: marshall(test),
    TableName: testCase.table.tableName,
  }).next(
    integ.assertions.httpApiCall(`${testCase.api.url!}posts/1`),
  ).expect(
    ExpectedResult.objectLike({
      body: test,
    }),
  );
}

