import { AddRoutesOptions, HttpApi, HttpApiProps, HttpRoute, IVpcLink, VpcLink } from '@aws-cdk/aws-apigatewayv2-alpha';
import { HttpLambdaIntegration, HttpServiceDiscoveryIntegration } from '@aws-cdk/aws-apigatewayv2-integrations-alpha';
import { Connections, IConnectable, IVpc, Port, SecurityGroup } from 'aws-cdk-lib/aws-ec2';
import { Function } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { ApiGatewayService } from './fargate-service';
import { Monitoring } from './monitoring';
import { ApiMonitor } from './monitoring/api';

/**
 * Application specific properties for configuring an HTTP API
 * extends the core HTTP API props with some tweaks
 */
export interface ApiProps extends Omit<HttpApiProps, 'createDefaultStage'> {
  /**
   * Central monitoring construct that can be used to
   * add monitoring for this construct
   */
  readonly monitor: Monitoring;

  /**
   * Required if any of the routes target a resource within a VPC
   * For example ECS services
   *
   * @default - does not target any resources in a vpc
   */
  readonly vpc?: IVpc;
}

/**
 * Options for adding a API route to a Lambda Function
 */
export interface AddFunctionRouteOptions extends Omit<AddRoutesOptions, 'integration' | 'authorizer' | 'authorizationScopes'> {
  /**
   * The Lambda Function to route traffic to
   */
  app: Function;
}

/**
 * Options for adding an API route to an ECS Service
 */
export interface AddServiceRouteOptions extends Omit<AddRoutesOptions, 'integration' | 'authorizer' | 'authorizationScopes'> {
  /**
   * The Service to route traffic to
   */
  app: ApiGatewayService;
}

/**
 * An HTTP Api with some specific changes for this application
 *
 * Some of this should honestly be done on the core construct...
 */
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

  /**
   * Add a route to an ECS service
   *
   * @param id - id of the integration
   * @param options - options for configuring the route
   * @returns the HttpRoute
   */
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
  /**
   * Add a route to a Lambda Function
   *
   * @param id - id of the integration
   * @param options - options for configuring the route
   * @returns the HTTPRoute
   */
  public addLambdaRoute(id: string, options: AddFunctionRouteOptions): HttpRoute[] {
    return super.addRoutes({
      ...options,
      integration: new HttpLambdaIntegration(id, options.app),
    });
  }
}
