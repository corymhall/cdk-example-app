import { Duration } from 'aws-cdk-lib';
import {
  Alarm,
  Metric,
  TreatMissingData,
  Unit,
} from 'aws-cdk-lib/aws-cloudwatch';
import { SubnetType } from 'aws-cdk-lib/aws-ec2';
import {
  DeploymentControllerType,
  FargateTaskDefinition,
  ICluster,
  FargateService,
  IFargateTaskDefinition,
  CfnService,
} from 'aws-cdk-lib/aws-ecs';
import { Rule } from 'aws-cdk-lib/aws-events';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { DnsRecordType } from 'aws-cdk-lib/aws-servicediscovery';
import { Construct } from 'constructs';
import { Extensions } from './extensions';
import { IContainer } from '../types';

/**
 * Options for configuring an ECS Service behind an API Gateway HTTP Api
 */
export interface ApiGatewayServiceProps {
  /**
   * The ECS Cluster to place the service in
   */
  readonly cluster: ICluster;

  /**
   * The application container
   */
  readonly appContainer: IContainer;
}

/**
 * An ECS Service sitting behind an API Gateway HTTP Api
 *
 * Creates the LogGroup, TaskDefinition, and ECS Service
 */
export class ApiGatewayService extends Construct {
  /**
   * The ECS Fargate Service
   */
  public readonly service: FargateService;

  /**
   * The Fargate Task Definition
   */
  public readonly taskDefinition: IFargateTaskDefinition;
  private readonly appContainer: IContainer;

  constructor(scope: Construct, id: string, props: ApiGatewayServiceProps) {
    super(scope, id);
    const logGroup = new LogGroup(this, 'LogGroup', {
      retention: RetentionDays.ONE_MONTH,
    });
    const taskDefinition = new FargateTaskDefinition(this, 'TaskDef', {
      memoryLimitMiB: 1024,
    });

    taskDefinition.addExtension(props.appContainer.bind(logGroup));
    taskDefinition.addExtension(Extensions.xray(logGroup));
    taskDefinition.addExtension(Extensions.cloudWatchAgent(logGroup));

    const service = new FargateService(this, 'AppService', {
      enableECSManagedTags: true,
      minHealthyPercent: 50,
      cluster: props.cluster,
      circuitBreaker: {
        rollback: true,
      },
      deploymentController: {
        type: DeploymentControllerType.ECS,
      },
      vpcSubnets: props.cluster.vpc.selectSubnets({
        subnetType: SubnetType.PRIVATE_WITH_EGRESS,
      }),
      taskDefinition,
    });

    service.enableCloudMap({
      containerPort: 8080,
      dnsRecordType: DnsRecordType.SRV,
    });

    this.service = service;
    this.taskDefinition = taskDefinition;
    this.appContainer = props.appContainer;
    this.failDeploymentsFaster(props.cluster);
  }

  /**
   * When using the ECS circuit breaker, the fastest that a failing deployment can trigger the
   * circuit breaker is 10 minutes (which is insanely slow). This is an alternative method
   * that uses a deployment alarm that triggers when tasks are stopped dur to health check failures
   *
   * This speeds it up to ~5 minutes which is about as good as you can get on ECS.
   *
   * @param cluster - ECS Cluster the service is deployed to
   */
  private failDeploymentsFaster(cluster: ICluster): void {
    const rule = new Rule(this, 'Rule', {
      eventPattern: {
        detailType: ['ECS Task State Change'],
        source: ['aws.ecs'],
        detail: {
          // taskDefinitionArn: [taskDefinition.taskDefinitionArn],
          clusterArn: [cluster.clusterArn],
          desiredStatus: ['STOPPED'],
          stopCode: ['ServiceSchedulerInitiated'],
          stoppedReason: ['Task failed container health checks'],
          containers: {
            name: [this.appContainer.id],
          },
        },
      },
    });
    const metric = new Metric({
      metricName: 'TriggeredRules',
      namespace: 'AWS/Events',
      dimensionsMap: {
        RuleName: rule.ruleName,
      },
      statistic: 'Average',
      unit: Unit.COUNT,
      period: Duration.seconds(10),
    });
    const alarm = new Alarm(this, 'DeploymentFailing', {
      metric,
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });
    const cfnService = this.service.node.defaultChild as CfnService;
    cfnService.addPropertyOverride('DeploymentConfiguration.Alarms', {
      AlarmNames: [alarm.alarmName],
      Enable: true,
      Rollback: true,
    });
  }
}
