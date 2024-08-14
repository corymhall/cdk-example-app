import { Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { Network } from '../../src/components/network';

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
  new Network(stack, 'Network');

  // THEN
  Template.fromStack(stack).templateMatches({
    Resources: Match.objectLike({
      NetworkVpc7FB7348F: Match.objectLike({ Type: 'AWS::EC2::VPC' }),
      NetworkVpcPublicSubnet1Subnet36933139: Match.objectLike({
        Type: 'AWS::EC2::Subnet',
      }),
      NetworkVpcPublicSubnet1RouteTable30235CE2: Match.objectLike({
        Type: 'AWS::EC2::RouteTable',
      }),
      NetworkVpcPublicSubnet1RouteTableAssociation643926C7: Match.objectLike({
        Type: 'AWS::EC2::SubnetRouteTableAssociation',
      }),
      NetworkVpcPublicSubnet1DefaultRoute31EC04EC: Match.objectLike({
        Type: 'AWS::EC2::Route',
      }),
      NetworkVpcPublicSubnet1EIPE0D52090: Match.objectLike({
        Type: 'AWS::EC2::EIP',
      }),
      NetworkVpcPublicSubnet1NATGateway64781A21: Match.objectLike({
        Type: 'AWS::EC2::NatGateway',
      }),
      NetworkVpcPublicSubnet2SubnetC427CCE0: Match.objectLike({
        Type: 'AWS::EC2::Subnet',
      }),
      NetworkVpcPublicSubnet2RouteTable0FACEBB2: Match.objectLike({
        Type: 'AWS::EC2::RouteTable',
      }),
      NetworkVpcPublicSubnet2RouteTableAssociationC662643B: Match.objectLike({
        Type: 'AWS::EC2::SubnetRouteTableAssociation',
      }),
      NetworkVpcPublicSubnet2DefaultRoute0CF082AB: Match.objectLike({
        Type: 'AWS::EC2::Route',
      }),
      NetworkVpcPublicSubnet2EIP24F41572: Match.objectLike({
        Type: 'AWS::EC2::EIP',
      }),
      NetworkVpcPublicSubnet2NATGateway42CB86F5: Match.objectLike({
        Type: 'AWS::EC2::NatGateway',
      }),
      NetworkVpcPrivateSubnet1Subnet6DD86AE6: Match.objectLike({
        Type: 'AWS::EC2::Subnet',
      }),
      NetworkVpcPrivateSubnet1RouteTable7D7AA3CD: Match.objectLike({
        Type: 'AWS::EC2::RouteTable',
      }),
      NetworkVpcPrivateSubnet1RouteTableAssociation327CA62F: Match.objectLike({
        Type: 'AWS::EC2::SubnetRouteTableAssociation',
      }),
      NetworkVpcPrivateSubnet1DefaultRoute08635105: Match.objectLike({
        Type: 'AWS::EC2::Route',
      }),
      NetworkVpcPrivateSubnet2Subnet1BDBE877: Match.objectLike({
        Type: 'AWS::EC2::Subnet',
      }),
      NetworkVpcPrivateSubnet2RouteTableC48862D1: Match.objectLike({
        Type: 'AWS::EC2::RouteTable',
      }),
      NetworkVpcPrivateSubnet2RouteTableAssociation89A2F1E8: Match.objectLike({
        Type: 'AWS::EC2::SubnetRouteTableAssociation',
      }),
      NetworkVpcPrivateSubnet2DefaultRouteA15DC6D5: Match.objectLike({
        Type: 'AWS::EC2::Route',
      }),
      NetworkVpcIGW6BEA7B02: Match.objectLike({
        Type: 'AWS::EC2::InternetGateway',
      }),
      NetworkVpcVPCGW8F3799B5: Match.objectLike({
        Type: 'AWS::EC2::VPCGatewayAttachment',
      }),
      NetworkCluster17B54D11: Match.objectLike({ Type: 'AWS::ECS::Cluster' }),
      NetworkClusterDefaultServiceDiscoveryNamespaceD090BA35: Match.objectLike({
        Type: 'AWS::ServiceDiscovery::PrivateDnsNamespace',
      }),
      NetworkCluster237516A5: Match.objectLike({
        Type: 'AWS::ECS::ClusterCapacityProviderAssociations',
      }),
    }),
  });

  Template.fromStack(stack).hasResourceProperties(
    'AWS::ServiceDiscovery::PrivateDnsNamespace',
    {
      // requires replacement if changed
      Name: 'blog-dev.com',
    },
  );
});
