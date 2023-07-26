import { Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { AttributeType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { CreatePost } from '../../src/components/create-post';
import { Api } from '../../src/constructs/api';
import { Monitoring } from '../../src/constructs/monitoring';

/**
 * In this test we are testing the "CreatePost" construct
 * and asserting that certain things unique to this construct are set
 */
test('resources are created with expected properties', () => {
  const stack = new Stack();
  const monitor = new Monitoring(stack, 'Monitor');
  new CreatePost(stack, 'CreatePost', {
    api: new Api(stack, 'Api', {
      monitor,
    }),
    monitor,
    table: new Table(stack, 'Table', {
      partitionKey: {
        name: 'pk',
        type: AttributeType.STRING,
      },
    }),
  });

  const template = Template.fromStack(stack);
  template.hasResourceProperties('AWS::Lambda::Function', {
    Environment: {
      Variables: {
        LOG_LEVEL: 'DEBUG',
        POWERTOOLS_LOGGER_LOG_EVENT: 'true',
        POWERTOOLS_SERVICE_NAME: 'CreateFunction',
        POWERTOOLS_METRICS_NAMESPACE: 'blogApp',
        ENV: 'dev',
        TABLE_NAME: { Ref: 'TableCD117FA1' },
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      },
    },
    TracingConfig: { Mode: 'Active' },
    Layers: [
      {
        'Fn::Join': [
          '',
          Match.arrayWith([
            Match.stringLikeRegexp('AWSLambdaPowertoolsTypeScript'),
          ]),
        ],
      },
    ],
  });
  template.hasResourceProperties('AWS::IAM::Policy', {
    PolicyDocument: {
      Statement: Match.arrayWith([
        Match.objectLike({
          Action: Match.arrayWith([
            'xray:PutTraceSegments',
            'xray:PutTelemetryRecords',
          ]),
        }),
        Match.objectLike({
          Action: Match.arrayWith([
            'dynamodb:BatchWriteItem',
            'dynamodb:PutItem',
            'dynamodb:UpdateItem',
            'dynamodb:DeleteItem',
            'dynamodb:DescribeTable',
          ]),
        }),
      ]),
    },
  });
});
