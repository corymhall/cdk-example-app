import { HttpApi } from '@aws-cdk/aws-apigatewayv2-alpha';
import { Dashboard, GraphWidget, IMetric, IWidget, Metric } from 'aws-cdk-lib/aws-cloudwatch';
import { AnomalyDetectingAlarmFactory, CustomMonitoring, HeaderLevel, HeaderWidget, IDynamicDashboardSegment, MonitoringFacade } from 'cdk-monitoring-constructs';
import { IMonitorComponent, DASH_NAME_PREFIX } from './monitoring';

export class ApiMonitor implements IMonitorComponent {
  private readonly commonWidgets: IWidget[] = [];
  private readonly integrationLatencyMetric: Metric;
  private readonly latencyMetric: Metric;
  private readonly clientErrorMetric: Metric;
  private readonly serverErrorMetric: Metric;
  private readonly requestsMetric: Metric;
  private readonly componentMetrics: IMetric[] = [];
  constructor(
    public readonly id: string,
    private readonly api: HttpApi,
  ) {
    this.integrationLatencyMetric = this.api.metricIntegrationLatency({ label: 'integration latency' });
    this.requestsMetric = this.api.metricCount({ label: 'total requests' });
    this.latencyMetric = this.api.metricLatency({ label: 'latency' });
    this.clientErrorMetric = this.api.metricClientError({ label: 'client error' });
    this.serverErrorMetric = this.api.metricServerError({ label: 'server error' });
  };
  bind(facade: MonitoringFacade): IDynamicDashboardSegment {
    const metricFactory = facade.createMetricFactory();
    const alarmFactory = facade.createAlarmFactory('');
    const anomalyFactory = new AnomalyDetectingAlarmFactory(alarmFactory);
    const integrationLatencyMetric = metricFactory
      .createMetricAnomalyDetection(
        this.integrationLatencyMetric,
        3,
        'integrationLatency',
        undefined,
        'integrationLatency',
      );
    anomalyFactory.addAlarmWhenOutOfBand(integrationLatencyMetric, 'IntegrationLatency-Anomaly', 'Critical',
      { alarmWhenAboveTheBand: true, alarmWhenBelowTheBand: true, standardDeviationForAlarm: 4 },
    );
    const dashboardName = `${DASH_NAME_PREFIX}-${this.id}`;
    const alarmsDash = new Dashboard(facade, `${this.id}Dashboard`, {
      dashboardName: `${dashboardName}-Alarms`,
    });
    const componentDash = new Dashboard(facade, `${this.id}DashboardDetail`, {
      dashboardName: `${dashboardName}-Detail`,
    });
    componentDash.addWidgets(
      ...this.componentMetrics.map(metric =>
        new GraphWidget({
          left: [metric],
        }),
      ),
    );
    this.commonWidgets.push(...[
      new GraphWidget({
        left: [this.clientErrorMetric],
        title: 'Client Errors',
      }),
      new GraphWidget({
        left: [this.integrationLatencyMetric],
        title: 'Integration Latency',
      }),
      new GraphWidget({
        left: [this.latencyMetric],
        title: 'Latency',
      }),
      new GraphWidget({
        left: [this.requestsMetric],
        title: 'Requests',
      }),
      new GraphWidget({
        left: [this.serverErrorMetric],
        title: 'Server Errors',
      }),
    ]);
    componentDash.addWidgets(...this.commonWidgets);
    const integrationLatencyMonitor = new CustomMonitoring(facade, {
      alarmFriendlyName: 'IntegrationLatencyAnomalyDetectionAlarm',
      metricGroups: [{
        title: `${this.api.apiId} Integration Latency`,
        metrics: [
          {
            metric: integrationLatencyMetric,
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
      }],
    });
    alarmsDash.addWidgets(...integrationLatencyMonitor.widgets());

    const commonWidgets = this.commonWidgets;
    const api = this.api;
    return {
      widgetsForDashboard(name: string): IWidget[] {
        console.log(name);
        switch (name) {
          case 'Infrastructure':
            return [
              new HeaderWidget(`${api.apiId}`, HeaderLevel.LARGE),
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
