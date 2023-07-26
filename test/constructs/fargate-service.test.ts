import { Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { Network } from '../../src/components/network';
import { ApiGatewayService } from '../../src/constructs/fargate-service';
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
  const network = new Network(stack, 'Network');
  new ApiGatewayService(stack, 'Service', {
    appContainer: new TestAppContainer(),
    cluster: network.cluster,
  });

  // THEN
  const template = Template.fromStack(stack);
  template.templateMatches({
    Resources: Match.objectLike({
      ServiceLogGroupB910EE76: Match.objectLike({ Type: 'AWS::Logs::LogGroup' }),
      ServiceTaskDefTaskRole0CFE2F57: Match.objectLike({ Type: 'AWS::IAM::Role' }),
      ServiceTaskDefTaskRoleDefaultPolicy9CCB4F8E: Match.objectLike({ Type: 'AWS::IAM::Policy' }),
      ServiceTaskDefExecutionRole919F7BE3: Match.objectLike({ Type: 'AWS::IAM::Role' }),
      ServiceTaskDefExecutionRoleDefaultPolicy3073559D: Match.objectLike({ Type: 'AWS::IAM::Policy' }),
      ServiceAppService43155DA6: Match.objectLike({ Type: 'AWS::ECS::Service' }),
      ServiceAppServiceSecurityGroup3948D0B5: Match.objectLike({ Type: 'AWS::EC2::SecurityGroup' }),
    }),
  });

  // cause replacement
  template.hasResourceProperties('AWS::ECS::Service', {
    DeploymentController: {
      Type: 'ECS',
    },
    LaunchType: 'FARGATE',
    Role: Match.absent(),
    SchedulingStrategy: Match.absent(),
  });
  template.hasResourceProperties('AWS::ECS::TaskDefinition', {
    ContainerDefinitions: [
      Match.objectLike({
        Name: 'test',
      }),
      Match.objectLike({
        Name: 'xray',
      }),
      Match.objectLike({
        Name: 'cloudwatch-agent',
      }),
    ],
  });
  template.resourceCountIs('AWS::Logs::LogGroup', 1);
});

