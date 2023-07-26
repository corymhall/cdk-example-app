import { Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { AttributeType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { GetPost } from '../../src/components/get-post';
import { Network } from '../../src/components/network';
import { Api } from '../../src/constructs/api';
import { Monitoring } from '../../src/constructs/monitoring';

/**
 * In this test we are testing the "CreatePost" construct
 * and asserting that certain things unique to this construct are set
 */
test('resources are created with expected properties', () => {
  // GIVEN
  const stack = new Stack();
  const monitor = new Monitoring(stack, 'Monitor');
  const network = new Network(stack, 'Network');

  // WHEN
  new GetPost(stack, 'CreatePost', {
    api: new Api(stack, 'Api', {
      vpc: network.cluster.vpc,
      monitor,
    }),
    cluster: network.cluster,
    monitor,
    table: new Table(stack, 'Table', {
      partitionKey: {
        name: 'pk',
        type: AttributeType.STRING,
      },
    }),
  });

  // THEN
  const template = Template.fromStack(stack);
  template.hasResourceProperties('AWS::ECS::TaskDefinition', {
    ContainerDefinitions: Match.arrayWith([
      Match.objectLike({
        Name: 'getPost',
        Environment: [
          {
            Name: 'TABLE_NAME',
            Value: { Ref: 'TableCD117FA1' },
          },
          {
            Name: 'AWS_EMF_AGENT_ENDPOINT',
            Value: 'tcp://127.0.0.1:25888',
          },
          {
            Name: 'LOG_LEVEL',
            Value: 'DEBUG',
          },
          {
            Name: 'POWERTOOLS_SERVICE_NAME',
            Value: 'GetPostService',
          },
          {
            Name: 'POWERTOOLS_METRICS_NAMESPACE',
            Value: 'blogApp',
          },
          {
            Name: 'ENV',
            Value: 'dev',
          },
        ],
      }),
    ]),
  });
  template.hasResourceProperties('AWS::IAM::Policy', {
    PolicyDocument: Match.objectLike({
      Statement: Match.arrayWith([
        Match.objectLike({
          Action: 'cloudwatch:PutMetricData',
        }),
        Match.objectLike({
          Action: Match.arrayWith([
            'dynamodb:BatchGetItem',
            'dynamodb:GetRecords',
            'dynamodb:GetShardIterator',
            'dynamodb:Query',
            'dynamodb:GetItem',
            'dynamodb:Scan',
            'dynamodb:ConditionCheckItem',
            'dynamodb:DescribeTable',
          ]),
        }),
      ]),
    }),
  });
});
