import {
  ConditionalCheckFailedException,
  DynamoDBClient,
  PutItemCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { APIGatewayProxyEventV2, Context } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { handler } from '../../src/posts/create.lambda';
import { testCases } from '../components/test-cases';
const TABLE_NAME = 'test-table';
const ddbMock = mockClient(DynamoDBClient);
beforeEach(() => {
  process.env.TABLE_NAME = TABLE_NAME;
  jest.spyOn(console, 'info').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  jest.clearAllMocks();
  ddbMock.reset();
});

afterAll(() => {
  process.env.TABLE_NAME = undefined;
  jest.restoreAllMocks();
});

describe('create post', () => {
  test.each([testCases])('successful', async (testCase) => {
    // GIVEN
    ddbMock.on(PutItemCommand).resolves({});
    const body = JSON.stringify({
      ...testCase,
    });
    const req = createEvent(body);

    // WHEN
    const res = await handler(req.event, req.context);

    // THEN
    ddbMock.commandCalls(PutItemCommand, {
      TableName: TABLE_NAME,
      ConditionExpression: 'attribute_not_exists(pk)',
      Item: marshall(body),
    });
    expect(res).toEqual({
      statusCode: 200,
      body: 'OK',
    });
  });
  test.each([testCases])('failure', async (testCase) => {
    // GIVEN
    const body = JSON.stringify({
      ...testCase,
    });
    const req = createEvent(body);

    // WHEN
    ddbMock.on(PutItemCommand).rejects({});

    // THEN
    await expect(handler(req.event, req.context)).rejects.toThrow(
      /failed creating post/,
    );
    ddbMock.commandCalls(PutItemCommand, {
      TableName: TABLE_NAME,
      ConditionExpression: 'attribute_not_exists(pk)',
      Item: marshall(body),
    });
  });

  test('item already exists', async () => {
    // GIVEN
    const body = JSON.stringify({
      ...testCases[0],
    });
    const req = createEvent(body);

    // WHEN
    ddbMock.on(PutItemCommand).rejects(
      new ConditionalCheckFailedException({
        message: 'error',
        $metadata: {} as any,
      }),
    );
    const res = await handler(req.event, req.context);

    // THEN
    expect(res).toEqual({
      statusCode: 200,
      body: 'OK',
    });
    ddbMock.commandCalls(PutItemCommand, {
      TableName: TABLE_NAME,
      ConditionExpression: 'attribute_not_exists(pk)',
      Item: marshall(body),
    });
  });
});

function createEvent(body: string): {
  event: APIGatewayProxyEventV2;
  context: Context;
} {
  return {
    event: {
      version: '2.0',
      routeKey: 'POST /posts',
      rawPath: '/posts',
      rawQueryString: '',
      headers: {
        accept: '*/*',
        'accept-encoding': 'gzip,deflate',
        'content-length': '143',
        'content-type': 'text/plain;charset=UTF-8',
        host: 'hxzls0fu8c.execute-api.us-west-2.amazonaws.com',
        'user-agent': 'node-fetch/1.0 (+https://github.com/bitinn/node-fetch)',
        'x-amzn-trace-id': 'Root=1-64ad9aec-0afc754f0069c3f0151d05da',
        'x-forwarded-for': '34.220.207.9',
        'x-forwarded-port': '443',
        'x-forwarded-proto': 'https',
      },
      requestContext: {
        accountId: '12345678910',
        apiId: 'hxzls0fu8c',
        domainName: 'hxzls0fu8c.execute-api.us-west-2.amazonaws.com',
        domainPrefix: 'hxzls0fu8c',
        http: {
          method: 'POST',
          path: '/posts',
          protocol: 'HTTP/1.1',
          sourceIp: '34.220.207.9',
          userAgent: 'node-fetch/1.0 (+https://github.com/bitinn/node-fetch)',
        },
        requestId: 'H6Uk_hCxvHcEMaw=',
        routeKey: 'POST /posts',
        stage: '$default',
        time: '11/Jul/2023:18:09:48 +0000',
        timeEpoch: 1689098988494,
      },
      body,
      isBase64Encoded: false,
    },
    context: {
      succeed(_message) {
        return;
      },
      fail(_error) {
        return;
      },
      done(_error, _result) {
        return;
      },
      getRemainingTimeInMillis() {
        return 1;
      },
      awsRequestId: '',
      callbackWaitsForEmptyEventLoop: false,
      functionName: 'test-function',
      functionVersion: '1',
      invokedFunctionArn: '',
      logGroupName: 'loggroup',
      logStreamName: 'logstream',
      memoryLimitInMB: '125',
    },
  };
}
