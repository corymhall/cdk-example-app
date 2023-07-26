import { HttpMethod } from '@aws-cdk/aws-apigatewayv2-alpha';
import { Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { Vpc } from 'aws-cdk-lib/aws-ec2';
import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { Network } from '../../src/components/network';
import { Api } from '../../src/constructs/api';
import { ApiGatewayService } from '../../src/constructs/fargate-service';
import { Monitoring } from '../../src/constructs/monitoring';
import { TestAppContainer } from '../utils';

/**
 * For the network stack I am trusting that the CDK constructs create the Resources
 * correctly so I'm not going to do a bunch of assertions to make sure that the VPC
 * has the correct resources.
 *
 * What I do want to assert is that the LogicalIds of the resources remain the same.
 */
test('resources should not be replaced', () => {
  // WHEN
  const stack = new Stack();
  new Api(stack, 'Api', {
    monitor: new Monitoring(stack, 'Monitoring'),
  });

  // THEN
  Template.fromStack(stack).templateMatches({
    Resources: Match.objectLike({
      ApiF70053CD: Match.objectLike({ Type: 'AWS::ApiGatewayV2::Api' }),
      ApiDefaultStage189A7074: Match.objectLike({ Type: 'AWS::ApiGatewayV2::Stage' }),
    }),
  });

  Template.fromStack(stack).hasResourceProperties('AWS::ApiGatewayV2::Stage', {
    // requires replacement if changed
    StageName: '$default',
  });
});

test('will create a vpc link', () => {
  // WHEN
  const stack = new Stack();
  const vpc = new Vpc(stack, 'Vpc');
  new Api(stack, 'Api', {
    vpc,
    monitor: new Monitoring(stack, 'Monitoring'),
  });

  // THEN
  Template.fromStack(stack).hasResourceProperties('AWS::ApiGatewayV2::VpcLink', {
    Name: 'ApiVpcLink623DC6E4',
    SecurityGroupIds: [{ 'Fn::GetAtt': ['ApiVpcLinkSg585A62E1', 'GroupId'] }],
    SubnetIds: [
      { Ref: 'VpcPrivateSubnet1Subnet536B997A' },
      { Ref: 'VpcPrivateSubnet2Subnet3788AAA1' },
    ],
  });
});

test('can add a service route', () => {
  // GIVEN
  const stack = new Stack();
  const network = new Network(stack, 'Network');
  const monitor = new Monitoring(stack, 'Monitoring');
  const api = new Api(stack, 'Api', {
    monitor,
    vpc: network.cluster.vpc,
  });

  // WHEN
  api.addServiceRoute('service', {
    path: '/path',
    methods: [HttpMethod.GET],
    app: new ApiGatewayService(stack, 'Service', {
      appContainer: new TestAppContainer(),
      cluster: network.cluster,
    }),
  });

  // THEN
  const template = Template.fromStack(stack);
  template.hasResourceProperties('AWS::EC2::SecurityGroup', {
    GroupDescription: 'Default/Service/AppService/SecurityGroup',
  });
  template.hasResourceProperties('AWS::ApiGatewayV2::Integration', {
    IntegrationType: 'HTTP_PROXY',
    ConnectionType: 'VPC_LINK',
    IntegrationMethod: 'ANY',
  });
  template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
    RouteKey: 'GET /path',
  });
  template.resourceCountIs('AWS::ECS::Service', 1);
  template.hasResourceProperties('AWS::ECS::TaskDefinition', {
    ContainerDefinitions: Match.arrayWith([
      Match.objectLike({
        Name: 'test',
      }),
    ]),
  });
  template.hasResourceProperties('AWS::EC2::SecurityGroupIngress', {
    Description: 'from ApiVpcLinkSgA7E93302:8080',
    FromPort: 8080,
    GroupId: { 'Fn::GetAtt': ['ServiceAppServiceSecurityGroup3948D0B5', 'GroupId'] },
    IpProtocol: 'tcp',
    SourceSecurityGroupId: { 'Fn::GetAtt': ['ApiVpcLinkSg585A62E1', 'GroupId'] },
    ToPort: 8080,
  });
});

test('can add a lambda route', () => {
  // GIVEN
  const stack = new Stack();
  const monitor = new Monitoring(stack, 'Monitoring');
  const api = new Api(stack, 'Api', {
    monitor,
  });

  // WHEN
  api.addLambdaRoute('lambda', {
    app: new Function(stack, 'Handler', {
      code: Code.fromInline('foo'),
      handler: 'index.handler',
      runtime: Runtime.NODEJS_18_X,
    }),
    path: '/path',
    methods: [HttpMethod.POST],
  });

  // THEN
  const template = Template.fromStack(stack);
  template.resourceCountIs('AWS::EC2::SecurityGroup', 0);
  template.hasResourceProperties('AWS::ApiGatewayV2::Integration', {
    IntegrationType: 'AWS_PROXY',
  });
  template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
    RouteKey: 'POST /path',
  });
  template.resourceCountIs('AWS::Lambda::Function', 1);
});

