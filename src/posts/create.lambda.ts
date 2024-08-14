/* eslint-disable import/no-extraneous-dependencies */
import { LambdaInterface } from '@aws-lambda-powertools/commons';
import { Logger } from '@aws-lambda-powertools/logger';
import { Metrics, MetricUnits } from '@aws-lambda-powertools/metrics';
import { Tracer } from '@aws-lambda-powertools/tracer';
import {
  ConditionalCheckFailedException,
  DynamoDBClient,
  PutItemCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import {
  APIGatewayProxyEventV2,
  APIGatewayProxyResult,
  Context,
} from 'aws-lambda';

const metrics = new Metrics({
  defaultDimensions: {
    environment: process.env.ENV ?? 'dev',
  },
});

const tracer = new Tracer();
const logger = new Logger();
const client = tracer.captureAWSv3Client(new DynamoDBClient({}));

class LambdaHandler implements LambdaInterface {
  @tracer.captureLambdaHandler()
  @logger.injectLambdaContext()
  @metrics.logMetrics({ captureColdStartMetric: true })
  public async handler(
    event: APIGatewayProxyEventV2,
    _context: Context,
  ): Promise<APIGatewayProxyResult> {
    tracer.getSegment();
    const item = marshall({
      ...JSON.parse(event.body!),
      createdAt: new Date().toISOString(),
    });
    const tableName = process.env.TABLE_NAME;
    if (!tableName) {
      throw new Error('TABLE_NAME env var not provided!');
    }
    const putItem = new PutItemCommand({
      TableName: tableName,
      ConditionExpression: 'attribute_not_exists(pk)',
      Item: item,
    });
    try {
      await client.send(putItem);
      metrics.addMetric('createPostSuccess', MetricUnits.Count, 1);
      tracer.putAnnotation('createPostSuccess', true);
    } catch (e) {
      if (!(e instanceof ConditionalCheckFailedException)) {
        tracer.putAnnotation('createPostFailure', false);
        metrics.addMetric('createPostFailure', MetricUnits.Count, 1);
        throw new Error(`failed creating post: ${e}`);
      } else {
        metrics.addMetric('createPostSuccess', MetricUnits.Count, 1);
        tracer.putAnnotation('createPostSuccess', true);
      }
    }
    return {
      statusCode: 200,
      body: 'OK',
    };
  }
}

const handlerClass = new LambdaHandler();
export const handler = handlerClass.handler.bind(handlerClass);
