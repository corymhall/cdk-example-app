import { Stack } from 'aws-cdk-lib';
import { ITaskDefinitionExtension, ContainerImage, AwsLogDriver, Protocol } from 'aws-cdk-lib/aws-ecs';
import { ILogGroup } from 'aws-cdk-lib/aws-logs';
import { IContainer } from '../src/types';

export class TestAppContainer implements IContainer {
  id = 'TestContainer';
  bind(logGroup: ILogGroup): ITaskDefinitionExtension {
    return {
      extend(taskDefinition) {
        taskDefinition.addContainer('test', {
          image: ContainerImage.fromRegistry('dummy'),
          essential: true,
          memoryReservationMiB: 256,
          portMappings: [{
            containerPort: 8080,
            protocol: Protocol.UDP,
          }],
          environment: {
            AWS_REGION: Stack.of(taskDefinition).region,
          },
          logging: new AwsLogDriver({ streamPrefix: 'test', logGroup: logGroup }),
        });
      },
    };
  }
}
