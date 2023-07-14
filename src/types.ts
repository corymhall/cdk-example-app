import { ITaskDefinitionExtension } from 'aws-cdk-lib/aws-ecs';
import { ILogGroup } from 'aws-cdk-lib/aws-logs';

export enum Env {
  PROD = 'prd',
  DEV = 'dev',
}

export interface IContainer {
  readonly id: string;
  bind(logGroup: ILogGroup): ITaskDefinitionExtension;
}
