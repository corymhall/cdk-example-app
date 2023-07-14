import { HttpMethod } from '@aws-cdk/aws-apigatewayv2-alpha';
import { Metric } from 'aws-cdk-lib/aws-cloudwatch';
import { ITable } from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { Api } from '../constructs/api';
import { Monitoring } from '../constructs/monitoring/monitoring';
import { CreateFunction } from '../posts/create-function';

export interface CreatePostProps {
  readonly api: Api;
  readonly table: ITable;
  readonly monitor: Monitoring;
}

export class CreatePost extends Construct {
  constructor(scope: Construct, id: string, props: CreatePostProps) {
    super(scope, id);
    const app = new CreateFunction(this, 'CreatePost', {
      environment: {
        TABLE_NAME: props.table.tableName,
      },
    });
    props.api.addLambdaRoute('createPost', {
      app,
      path: '/posts',
      methods: [HttpMethod.POST],
    });

    app.lambdaMonitor.addComponentMetric(
      new Metric({
        metricName: 'ColdStart',
        dimensionsMap: {
          service: 'CreateFunction',
        },
        namespace: 'blogApp',
      }),
      new Metric({
        metricName: 'createPostFailure',
        dimensionsMap: {
          service: 'CreateFunction',
        },
        namespace: 'blogApp',
      }),
      new Metric({
        metricName: 'createPostSuccess',
        dimensionsMap: {
          service: 'CreateFunction',
        },
        namespace: 'blogApp',
      }),
    );

    props.monitor.addDashboardSegment(app.lambdaMonitor);
    props.table.grantWriteData(app);
  }
}
