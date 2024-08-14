/* eslint-disable import/no-extraneous-dependencies */
import { Logger } from '@aws-lambda-powertools/logger';
import { Metrics, MetricUnits } from '@aws-lambda-powertools/metrics';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import AWSXRay from 'aws-xray-sdk';
import express, { Request, Response } from 'express';

const logger = new Logger();
const client = AWSXRay.captureAWSv3Client(new DynamoDBClient({}));
const namespace = process.env.POWERTOOLS_METRICS_NAMESPACE ?? 'test';
const serviceName = process.env.POWERTOOLS_SERVICE_NAME ?? 'get-post';
const metrics = new Metrics({
  namespace,
  serviceName,
  defaultDimensions: {
    environment: process.env.ENV ?? 'dev',
  },
});

const app = express();
AWSXRay.middleware.setSamplingRules({
  version: 2,
  default: {
    fixed_target: 0,
    rate: 0,
  },
  rules: [
    {
      host: '*',
      fixed_target: 1,
      http_method: 'GET',
      rate: 1,
      url_path: '/posts/*',
    },
  ],
});
app.use(AWSXRay.express.openSegment(serviceName!));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/posts/:id', async (req: Request, res: Response) => {
  AWSXRay.getSegment();
  try {
    const getItem = new GetItemCommand({
      Key: {
        pk: {
          S: req.params.id,
        },
      },
      TableName: process.env.TABLE_NAME,
    });
    const item = await client.send(getItem);
    logger.info({ message: JSON.stringify(item.Item) });
    const result = unmarshall(item.Item ?? {});
    logger.info({
      message: JSON.stringify({ item: item.Item, result: result }),
    });
    metrics.addMetric('getItemSuccess', MetricUnits.Count, 1);
    res.status(200).json(result);
  } catch (e) {
    metrics.addMetric('getItemFailure', MetricUnits.Count, 1);
    logger.error({
      message: `error: ${e}`,
    });
    res.status(404).json({ message: 'Post not found' });
  } finally {
    metrics.publishStoredMetrics();
  }
});

app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({ statusCode: 200 });
});
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).send(JSON.stringify({ message: 'OK' }));
});

app.use(AWSXRay.express.closeSegment());

export default app;
