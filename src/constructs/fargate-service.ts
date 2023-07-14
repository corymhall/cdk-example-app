import { Duration } from 'aws-cdk-lib';
import { Alarm, Metric, TreatMissingData, Unit } from 'aws-cdk-lib/aws-cloudwatch';
import { SubnetType } from 'aws-cdk-lib/aws-ec2';
import { DeploymentControllerType, FargatePlatformVersion, FargateTaskDefinition, ICluster, FargateService, IFargateTaskDefinition, CfnService } from 'aws-cdk-lib/aws-ecs';
// import { CfnGroup } from 'aws-cdk-lib/aws-xray';
import { Rule } from 'aws-cdk-lib/aws-events';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { DnsRecordType } from 'aws-cdk-lib/aws-servicediscovery';
import { Construct } from 'constructs';
import { Extensions } from './extensions';
import { IContainer } from '../types';

export interface ApiGatewayServiceProps {
  readonly cluster: ICluster;
  readonly appContainer: IContainer;
}

export class ApiGatewayService extends Construct {
  public readonly service: FargateService;
  public readonly taskDefinition: IFargateTaskDefinition;

  constructor(scope: Construct, id: string, props: ApiGatewayServiceProps) {
    super(scope, id);
    const logGroup = new LogGroup(this, 'LogGroup', {
      retention: RetentionDays.ONE_MONTH,
    });
    const taskDefinition = new FargateTaskDefinition(this, 'TaskDef', { });

    taskDefinition.addExtension(props.appContainer.bind(logGroup));
    taskDefinition.addExtension(Extensions.xray(logGroup));
    taskDefinition.addExtension(Extensions.cloudWatchAgent(logGroup));

    const service = new FargateService(this, 'AppService', {
      enableECSManagedTags: true,
      minHealthyPercent: 50,
      platformVersion: FargatePlatformVersion.VERSION1_4,
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
    const rule = new Rule(this, 'Rule', {
      eventPattern: {
        detailType: ['ECS Task State Change'],
        source: ['aws.ecs'],
        detail: {
          // taskDefinitionArn: [taskDefinition.taskDefinitionArn],
          clusterArn: [props.cluster.clusterArn],
          desiredStatus: ['STOPPED'],
          stopCode: ['ServiceSchedulerInitiated'],
          stoppedReason: ['Task failed container health checks'],
          containers: {
            name: [props.appContainer.id],
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
    const cfnService = service.node.defaultChild as CfnService;
    cfnService.addPropertyOverride('DeploymentConfiguration.Alarms', {
      AlarmNames: [alarm.alarmName],
      Enable: true,
      Rollback: true,
    });
    service.enableCloudMap({ containerPort: 8080, dnsRecordType: DnsRecordType.SRV });
    // new CfnGroup(this, 'XrayGroup', {
    //   groupName: '',
    //   filterExpression: '',
    //   insightsConfiguration: {
    //     insightsEnabled: true,
    //   },
    // });

    this.service = service;
    this.taskDefinition = taskDefinition;
  }
}
