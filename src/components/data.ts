import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { Monitoring } from '../constructs/monitoring';
import { DynamoDBMonitor } from '../constructs/monitoring/dynamodb';

export interface DataProps {
  readonly monitor: Monitoring;
}

export class Data extends Table {
  constructor(scope: Construct, id: string, props: DataProps) {
    super(scope, id, {
      partitionKey: {
        name: 'pk',
        type: AttributeType.STRING,
      },
      billingMode: BillingMode.PAY_PER_REQUEST,
    });
    const tableMonitor = new DynamoDBMonitor('PostsTable', this);
    props.monitor.addDashboardSegment(tableMonitor);
  }
}
