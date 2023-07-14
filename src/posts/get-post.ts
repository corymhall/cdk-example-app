// ~~ Generated by projen. To modify, edit .projenrc.ts and run "npx projen".
import * as path from 'path';
// eslint-disable-next-line import/no-extraneous-dependencies
import { LogLevel } from '@aws-lambda-powertools/logger/lib/types';
import { AwsLogDriver, TaskDefinition, ContainerImage, ITaskDefinitionExtension, ContainerDefinitionOptions } from 'aws-cdk-lib/aws-ecs';
import { ILogGroup } from 'aws-cdk-lib/aws-logs';
import { Duration } from 'aws-cdk-lib/core';
import { Env, IContainer } from '../types';

export interface GetPostServiceProps extends Omit<ContainerDefinitionOptions, 'image'> {
  readonly logLevel?: LogLevel;
  readonly env?: Env;
}

export class GetPostService implements IContainer {
  constructor(public readonly id: string, private readonly props?: GetPostServiceProps) {}
  public bind(logGroup: ILogGroup): ITaskDefinitionExtension {
    const id = this.id;
    const props = this.props;
    return {
      extend(taskDefinition: TaskDefinition): void {
        taskDefinition.addContainer(id, {
          ...props,
          image: ContainerImage.fromAsset(path.join(__dirname, '../../assets/posts/get-post.server')),
          healthCheck: {
            command: ['CMD-SHELL', 'curl -s http://127.0.0.1:8080/health'],
            interval: Duration.seconds(5),
            retries: 1,
            startPeriod: Duration.seconds(10),
            timeout: Duration.seconds(2),
          },
          portMappings: [{
            containerPort: 8080,
          }],
          environment: {
            ...props?.environment,
            AWS_EMF_AGENT_ENDPOINT: 'tcp://127.0.0.1:25888',
            LOG_LEVEL: props?.logLevel ?? 'DEBUG',
            POWERTOOLS_SERVICE_NAME: 'GetPostService',
            POWERTOOLS_METRICS_NAMESPACE: 'blogApp',
            ENV: props?.env ?? Env.DEV,
          },
          logging: AwsLogDriver.awsLogs({
            streamPrefix: id,
            logGroup: logGroup,
          }),
        });
      },
    };
  }
}