import { Duration, Stack } from 'aws-cdk-lib';
import {
  AwsLogDriver,
  Protocol,
  ContainerImage,
  ITaskDefinitionExtension,
  TaskDefinition,
} from 'aws-cdk-lib/aws-ecs';
import { ManagedPolicy, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { ILogGroup } from 'aws-cdk-lib/aws-logs';

/**
 * Task Definition Extension that are useful for this application
 */
export abstract class Extensions {
  /**
   * Add a CloudWatch agent sidecar
   *
   * @param logGroup - CloudWatch LogGroup that the cloudwatch agent should log to
   * @returns a TaskDefinitionExtension
   */
  public static cloudWatchAgent(logGroup: ILogGroup): ITaskDefinitionExtension {
    return new CloudWatchAgentExtension(logGroup);
  }

  /**
   * Add an Xray agent sidecar enabling sending traces to xray
   *
   * @param logGroup - CloudWatch LogGroup that the xray agent should log to
   * @returns a TaskDefinitionExtension
   */
  public static xray(logGroup: ILogGroup): ITaskDefinitionExtension {
    return new XRayExtension(logGroup);
  }
}

export class XRayExtension implements ITaskDefinitionExtension {
  constructor(private readonly logGroup: ILogGroup) {}
  extend(taskDefinition: TaskDefinition): void {
    taskDefinition.addContainer('xray', {
      image: ContainerImage.fromRegistry('amazon/aws-xray-daemon:latest'),
      essential: true,
      memoryReservationMiB: 256,
      portMappings: [
        {
          containerPort: 2000,
          protocol: Protocol.UDP,
        },
      ],
      environment: {
        AWS_REGION: Stack.of(taskDefinition).region,
      },
      healthCheck: {
        command: ['CMD-SHELL', 'curl -s http://localhost:2000'],
        startPeriod: Duration.seconds(10),
        interval: Duration.seconds(5),
        timeout: Duration.seconds(2),
        retries: 3,
      },
      logging: new AwsLogDriver({
        streamPrefix: 'xray',
        logGroup: this.logGroup,
      }),
    });
    taskDefinition.taskRole.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess'),
    );
  }
}

class CloudWatchAgentExtension implements ITaskDefinitionExtension {
  constructor(private readonly logGroup: ILogGroup) {}
  extend(taskDefinition: TaskDefinition): void {
    taskDefinition.addContainer('cloudwatch-agent', {
      image: ContainerImage.fromRegistry(
        'public.ecr.aws/cloudwatch-agent/cloudwatch-agent:latest',
      ),
      portMappings: [
        {
          containerPort: 25888,
        },
      ],
      essential: true,
      environment: {
        CW_CONFIG_CONTENT: JSON.stringify({
          logs: {
            metrics_collected: {
              emf: {},
            },
          },
          metrics: {
            metrics_collected: {
              statsd: {},
            },
          },
        }),
      },
      logging: new AwsLogDriver({
        streamPrefix: 'cloudwatch-agent',
        logGroup: this.logGroup,
      }),
      memoryReservationMiB: 50,
    });
    taskDefinition.addToTaskRolePolicy(
      new PolicyStatement({
        resources: ['*'],
        actions: ['cloudwatch:PutMetricData'],
      }),
    );
  }
}
