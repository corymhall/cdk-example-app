import { HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { Metric } from 'aws-cdk-lib/aws-cloudwatch';
import { ITable } from 'aws-cdk-lib/aws-dynamodb';
import { ICluster } from 'aws-cdk-lib/aws-ecs';
import { Construct } from 'constructs';
import { Api } from '../constructs/api';
import { ApiGatewayService } from '../constructs/fargate-service';
import { Monitoring } from '../constructs/monitoring';
import { EcsMonitor } from '../constructs/monitoring/ecs';
import { GetPostService } from '../posts/get-post';

/**
 * Configuration for the GetPost component
 */
export interface GetPostProps {
  /**
   * The HTTP Api
   */
  readonly api: Api;

  /**
   * The DynamoDB table that contains Post data
   */
  readonly table: ITable;

  /**
   * The ECS Cluster to place the service in
   */
  readonly cluster: ICluster;

  /**
   * Central monitoring construct that can be used to
   * add monitoring for this construct
   */
  readonly monitor: Monitoring;
}

/**
 * Application component for retrieving a specific blog post by id
 */
export class GetPost extends Construct {
  constructor(scope: Construct, id: string, props: GetPostProps) {
    super(scope, id);
    const app = new ApiGatewayService(this, 'GetPost', {
      appContainer: new GetPostService('getPost', {
        environment: {
          TABLE_NAME: props.table.tableName,
        },
      }),
      cluster: props.cluster,
    });
    props.table.grantReadData(app.service.taskDefinition.taskRole);
    props.api.addServiceRoute('getPost', {
      app,
      path: '/posts/{id}',
      methods: [HttpMethod.GET],
    });
    const ecsMonitor = new EcsMonitor('GetPost', app.service);

    /**
     * Add specific component level metrics
     * including metrics that are emitted by the application
     *
     * Depending on the metric I might also want to add alarms
     */
    ecsMonitor.addComponentMetric(
      new Metric({
        metricName: 'getItemSuccess',
        dimensionsMap: {
          service: 'GetPost',
        },
        namespace: 'blogApp',
      }),
      new Metric({
        metricName: 'getItemFailure',
        dimensionsMap: {
          service: 'GetItem',
        },
        namespace: 'blogApp',
      }),
    );

    /**
     * For scaling I would really need to know the specific attributes of this service
     * Is it memory intensive or CPU intensive? What is a good target?
     */
    const scaling = app.service.autoScaleTaskCount({
      maxCapacity: 10,
      minCapacity: 1,
    });

    scaling.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: 60,
    });
    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 60,
    });
    props.monitor.addDashboardSegment(ecsMonitor);
  }
}
