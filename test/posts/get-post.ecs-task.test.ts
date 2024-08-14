import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';

import request from 'supertest';
import app from '../../src/posts/get-post.ecs-task';
import { testCases } from '../components/test-cases';
const TABLE_NAME = 'test-table';
const ddbMock = mockClient(DynamoDBClient);
beforeEach(() => {
  process.env.POWERTOOLS_SERVICE_NAME = 'dev';
  process.env.POWERTOOLS_METRICS_NAMESPACE = 'dev';
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
  process.env.POWERTOOLS_SERVICE_NAME = undefined;
  process.env.POWERTOOLS_METRICS_NAMESPACE = undefined;
  jest.restoreAllMocks();
});

describe('get post', () => {
  test.each([testCases])('successful', async (testCase) => {
    // GIVEN
    ddbMock.on(GetItemCommand).resolves({
      Item: marshall(testCase),
    });

    // WHEN
    const res = await request(app).get(`/posts/${testCase.pk}`);

    // THEN
    expect(res.statusCode).toEqual(200);
    expect(res.body).toEqual(testCase);
  });

  test.each([testCases])('failure', async (testCase) => {
    // GIVEN
    ddbMock.on(GetItemCommand).rejects({});

    // WHEN
    const res = await request(app).get(`/posts/${testCase.pk}`);

    // THEN
    expect(res.statusCode).toEqual(404);
    expect(res.body).toEqual({ message: 'Post not found' });
  });
});
