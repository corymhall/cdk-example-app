import {
  Dashboard,
  GraphWidget,
  IMetric,
  IWidget,
  Metric,
} from 'aws-cdk-lib/aws-cloudwatch';
import { Operation, Table } from 'aws-cdk-lib/aws-dynamodb';
import {
  AnomalyDetectingAlarmFactory,
  CustomMonitoring,
  HeaderLevel,
  HeaderWidget,
  IDynamicDashboardSegment,
  MonitoringFacade,
} from 'cdk-monitoring-constructs';
import { IMonitorComponent, DASH_NAME_PREFIX } from './monitoring';

export class DynamoDBMonitor implements IMonitorComponent {
  private readonly commonWidgets: IWidget[] = [];
  private readonly userErrorsMetric: Metric;
  private readonly conditionChecksFailedMetric: Metric;
  private readonly getItemErrorMetrics: IMetric;
  private readonly putItemErrorMetrics: IMetric;
  private readonly getItemThrottledMetric: IMetric;
  private readonly putItemThrottledMetric: IMetric;
  private readonly successfulRequestLatencyMetric: Metric;
  private readonly readCapacityMetric: Metric;
  private readonly writeCapacityMetric: Metric;
  private readonly componentMetrics: IMetric[] = [];
  constructor(
    public readonly id: string,
    private readonly table: Table,
  ) {
    this.userErrorsMetric = this.table.metricUserErrors({
      label: 'user errors',
    });
    this.successfulRequestLatencyMetric =
      this.table.metricSuccessfulRequestLatency({
        label: 'successful request latency',
        dimensionsMap: { Operation: Operation.GET_ITEM },
      });
    this.conditionChecksFailedMetric =
      this.table.metricConditionalCheckFailedRequests({
        label: 'condition checks failed',
      });
    this.getItemErrorMetrics = this.table.metricSystemErrorsForOperations({
      operations: [Operation.GET_ITEM],
      label: 'get item error',
    });
    this.putItemErrorMetrics = this.table.metricSystemErrorsForOperations({
      operations: [Operation.PUT_ITEM],
      label: 'put item error',
    });
    this.getItemThrottledMetric =
      this.table.metricThrottledRequestsForOperations({
        operations: [Operation.GET_ITEM],
        label: 'get item throttled',
      });
    this.putItemThrottledMetric =
      this.table.metricThrottledRequestsForOperations({
        operations: [Operation.PUT_ITEM],
        label: 'put item throttled',
      });
    this.readCapacityMetric = this.table.metricConsumedReadCapacityUnits({
      label: 'read capacity',
    });
    this.writeCapacityMetric = this.table.metricConsumedWriteCapacityUnits({
      label: 'write capacity',
    });
  }
  bind(facade: MonitoringFacade): IDynamicDashboardSegment {
    const metricFactory = facade.createMetricFactory();
    const alarmFactory = facade.createAlarmFactory('');
    const anomalyFactory = new AnomalyDetectingAlarmFactory(alarmFactory);
    const successfulLatencyMetric = metricFactory.createMetricAnomalyDetection(
      this.successfulRequestLatencyMetric,
      3,
      'successLatency',
      undefined,
      'successLatency',
    );
    anomalyFactory.addAlarmWhenOutOfBand(
      successfulLatencyMetric,
      'SuccessLatency-Anomaly',
      'Critical',
      {
        alarmWhenAboveTheBand: true,
        alarmWhenBelowTheBand: true,
        standardDeviationForAlarm: 4,
      },
    );
    const dashboardName = `${DASH_NAME_PREFIX}-${this.id}`;
    const alarmsDash = new Dashboard(facade, `${this.id}Dashboard`, {
      dashboardName: `${dashboardName}-Alarms`,
    });
    const componentDash = new Dashboard(facade, `${this.id}DashboardDetail`, {
      dashboardName: `${dashboardName}-Detail`,
    });
    componentDash.addWidgets(
      ...this.componentMetrics.map(
        (metric) =>
          new GraphWidget({
            left: [metric],
          }),
      ),
    );
    this.commonWidgets.push(
      ...[
        new GraphWidget({
          left: [this.getItemErrorMetrics],
          title: 'Get Item Errors',
        }),
        new GraphWidget({
          left: [this.putItemErrorMetrics],
          title: 'Put Item Errors',
        }),
        new GraphWidget({
          left: [this.userErrorsMetric],
          title: 'User Errors',
        }),
        new GraphWidget({
          left: [this.conditionChecksFailedMetric],
          title: 'Condition Checks Failed',
        }),
        new GraphWidget({
          left: [this.successfulRequestLatencyMetric],
          title: 'Successful Request Latency',
        }),
        new GraphWidget({
          left: [this.putItemThrottledMetric],
          title: 'Put Item Throttled',
        }),
        new GraphWidget({
          left: [this.writeCapacityMetric],
          title: 'Consumed Write Capacity',
        }),
        new GraphWidget({
          left: [this.readCapacityMetric],
          title: 'Consumed Read Capacity',
        }),
        new GraphWidget({
          left: [this.getItemThrottledMetric],
          title: 'Get Item Throttled',
        }),
      ],
    );
    componentDash.addWidgets(...this.commonWidgets);
    const integrationLatencyMonitor = new CustomMonitoring(facade, {
      alarmFriendlyName: 'IntegrationLatencyAnomalyDetectionAlarm',
      metricGroups: [
        {
          title: `${this.table.tableName} Integration Latency`,
          metrics: [
            {
              metric: successfulLatencyMetric,
              alarmFriendlyName: 'Anomaly-IntegrationLatency',
              addAlarm: {},
              addAlarmOnAnomaly: {
                Warning: {
                  alarmWhenAboveTheBand: true,
                  alarmWhenBelowTheBand: true,
                  standardDeviationForAlarm: 4,
                },
              },
            },
          ],
        },
      ],
    });
    alarmsDash.addWidgets(...integrationLatencyMonitor.widgets());

    const commonWidgets = this.commonWidgets;
    const table = this.table;
    return {
      widgetsForDashboard(name: string): IWidget[] {
        switch (name) {
          case 'Infrastructure':
            return [
              new HeaderWidget(`${table.tableName}`, HeaderLevel.LARGE),
              ...commonWidgets,
            ];
          default:
            return [];
        }
      },
    };
  }

  public addComponentMetric(...metrics: IMetric[]): void {
    this.componentMetrics.push(...metrics);
  }
}
