import {
  ComparisonOperator,
  Dashboard,
  GraphWidget,
  IMetric,
  IWidget,
  Metric,
} from 'aws-cdk-lib/aws-cloudwatch';
import { IFunction } from 'aws-cdk-lib/aws-lambda';
import {
  AnomalyDetectingAlarmFactory,
  CustomMonitoring,
  HeaderLevel,
  HeaderWidget,
  IDynamicDashboardSegment,
  MonitoringFacade,
} from 'cdk-monitoring-constructs';
import { IMonitorComponent, DASH_NAME_PREFIX } from './monitoring';

export class LambdaMonitor implements IMonitorComponent {
  private readonly invocationMetric: Metric;
  private readonly durationMetric: Metric;
  private readonly errorMetric: Metric;
  private readonly commonWidgets: IWidget[] = [];
  private readonly componentMetrics: IMetric[] = [];
  constructor(
    public readonly id: string,
    private readonly fn: IFunction,
  ) {
    this.invocationMetric = this.fn.metricInvocations({ label: 'invocations' });
    this.errorMetric = this.fn.metricErrors({ label: 'errors' });
    this.durationMetric = this.fn.metricDuration({ label: 'duration' });
  }
  bind(facade: MonitoringFacade): IDynamicDashboardSegment {
    const metricFactory = facade.createMetricFactory();
    const alarmFactory = facade.createAlarmFactory('');
    const anomalyFactory = new AnomalyDetectingAlarmFactory(alarmFactory);
    const durationAnomalyMetric = metricFactory.createMetricAnomalyDetection(
      this.durationMetric,
      3,
      'duration',
      undefined,
      'duration',
    );
    const invocationAnomalyMetric = metricFactory.createMetricAnomalyDetection(
      this.invocationMetric,
      3,
      'invocations',
      undefined,
      'invocations',
    );
    anomalyFactory.addAlarmWhenOutOfBand(
      invocationAnomalyMetric,
      'Invocations-Anomaly',
      'Critical',
      {
        alarmWhenAboveTheBand: true,
        alarmWhenBelowTheBand: true,
        standardDeviationForAlarm: 4,
      },
    );
    anomalyFactory.addAlarmWhenOutOfBand(
      durationAnomalyMetric,
      'Duration-Anomaly',
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
          left: [this.invocationMetric],
          title: 'Invocations',
        }),
        new GraphWidget({
          left: [this.durationMetric],
          title: 'Duration',
        }),
        new GraphWidget({
          left: [this.errorMetric],
          title: 'Errors',
        }),
      ],
    );
    componentDash.addWidgets(...this.commonWidgets);
    const durationMonitor = new CustomMonitoring(facade, {
      alarmFriendlyName: 'DurationAnomalyDetectionAlarm',
      metricGroups: [
        {
          title: `${this.fn.functionName} Duration`,
          metrics: [
            {
              metric: durationAnomalyMetric,
              alarmFriendlyName: 'Anomaly-Duration',
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
    alarmsDash.addWidgets(...durationMonitor.widgets());

    const errorMonitor = new CustomMonitoring(facade, {
      alarmFriendlyName: 'ErrorsAlarm',
      metricGroups: [
        {
          title: `${this.fn.functionName} Errors`,
          metrics: [
            {
              metric: this.errorMetric,
              addAlarm: {
                Critical: {
                  comparisonOperator:
                    ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
                  threshold: 3,
                },
              },
              alarmFriendlyName: 'errors',
            },
          ],
        },
      ],
    });
    alarmsDash.addWidgets(...errorMonitor.widgets());

    const invocationMonitor = new CustomMonitoring(facade, {
      alarmFriendlyName: 'InvocationsAnomalyDetectionAlarm',
      metricGroups: [
        {
          title: `${this.fn.functionName} Invocations`,
          metrics: [
            {
              metric: invocationAnomalyMetric,
              alarmFriendlyName: 'Anomaly-Invocations',
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
    alarmsDash.addWidgets(...invocationMonitor.widgets());

    const commonWidgets = this.commonWidgets;
    const fn = this.fn;
    return {
      widgetsForDashboard(name: string): IWidget[] {
        switch (name) {
          case 'Infrastructure':
            return [
              new HeaderWidget(`${fn.functionName}`, HeaderLevel.LARGE),
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
