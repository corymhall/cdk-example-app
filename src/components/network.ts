import { IVpc, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Cluster, ICluster } from 'aws-cdk-lib/aws-ecs';
import { Construct } from 'constructs';
import { Env } from '../types';

export interface NetworkProps {
  readonly vpc?: IVpc;
  readonly env?: Env;
}

export class Network extends Construct {
  public readonly cluster: ICluster;
  constructor(scope: Construct, id: string, props?: NetworkProps) {
    super(scope, id);

    const vpc = props?.vpc ?? new Vpc(this, 'Vpc', {
      maxAzs: 3,
    });

    const name = props?.env === Env.PROD ? 'blog.com' : 'blog-dev.com';
    this.cluster = new Cluster(this, 'Cluster', {
      enableFargateCapacityProviders: true,
      containerInsights: true,
      defaultCloudMapNamespace: {
        name,
      },
      vpc,
    });
  }
}
