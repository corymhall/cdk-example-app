import { AddRoutesOptions, HttpApi, HttpApiProps, HttpRoute, IVpcLink, VpcLink } from '@aws-cdk/aws-apigatewayv2-alpha';
import { HttpLambdaIntegration, HttpServiceDiscoveryIntegration } from '@aws-cdk/aws-apigatewayv2-integrations-alpha';
import { Connections, IConnectable, IVpc, Port, SecurityGroup } from 'aws-cdk-lib/aws-ec2';
import { Function } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { ApiGatewayService } from './fargate-service';
import { Monitoring } from './monitoring';
import { ApiMonitor } from './monitoring/api';

export interface ApiProps extends Omit<HttpApiProps, 'createDefaultStage'> {
  readonly monitor: Monitoring;
  readonly vpc?: IVpc;
}

export interface AddFunctionRouteOptions extends Omit<AddRoutesOptions, 'integration' | 'authorizer' | 'authorizationScopes'> {
  app: Function;
}

export interface AddServiceRouteOptions extends Omit<AddRoutesOptions, 'integration' | 'authorizer' | 'authorizationScopes'> {
  app: ApiGatewayService;
}

export class Api extends HttpApi implements IConnectable {
  public readonly connections: Connections;
  private readonly vpcLink?: IVpcLink;
  constructor(scope: Construct, id: string, props: ApiProps) {
    super(scope, id, {
      ...props,
      createDefaultStage: true,
    });

    this.connections = props.vpc ? new Connections({
      securityGroups: [
        new SecurityGroup(this, 'VpcLinkSg', {
          vpc: props.vpc,
          allowAllIpv6Outbound: true,
          allowAllOutbound: true,
          description: 'Security Group for API Gateway Vpc Link',
        }),
      ],
    }) : new Connections();
    if (props.vpc) {
      this.vpcLink = new VpcLink(this, 'VpcLink', {
        vpc: props.vpc,
        securityGroups: this.connections.securityGroups,
      });
    }
    const apiMonitor = new ApiMonitor('ApiMonitor', this);
    props.monitor.addDashboardSegment(apiMonitor);
  }

  public addServiceRoute(id: string, options: AddServiceRouteOptions): HttpRoute[] {
    const route = super.addRoutes({
      ...options,
      integration: new HttpServiceDiscoveryIntegration(id, options.app.service.cloudMapService!, {
        vpcLink: this.vpcLink,
      }),
    });
    options.app.service.connections.allowFrom(this, Port.tcp(8080));
    return route;
  }
  public addLambdaRoute(id: string, options: AddFunctionRouteOptions): HttpRoute[] {
    return super.addRoutes({
      ...options,
      integration: new HttpLambdaIntegration(id, options.app),
    });
  }
}
