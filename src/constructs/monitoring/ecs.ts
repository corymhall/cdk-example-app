import { Dashboard, GraphWidget, IMetric, IWidget, Metric } from 'aws-cdk-lib/aws-cloudwatch';
import { FargateService } from 'aws-cdk-lib/aws-ecs';
import { AnomalyDetectingAlarmFactory, CustomMonitoring, HeaderLevel, HeaderWidget, IDynamicDashboardSegment, MetricStatistic, MonitoringFacade } from 'cdk-monitoring-constructs';
import { IMonitorComponent, DASH_NAME_PREFIX } from './monitoring';

export class EcsMonitor implements IMonitorComponent {
  private readonly memoryUtilizationMetric: Metric;
  private readonly cpuUtilizationMetric: Metric;
  private readonly commonWidgets: IWidget[] = [];
  private readonly componentMetrics: IMetric[] = [];
  constructor(
    public readonly id: string,
    private readonly service: FargateService,
  ) {
    this.memoryUtilizationMetric = service.metricMemoryUtilization({ label: 'memory' });
    this.cpuUtilizationMetric = service.metricCpuUtilization({ label: 'cpu' });
  };
  bind(facade: MonitoringFacade): IDynamicDashboardSegment {
    facade.monitorSimpleFargateService({
      fargateService: this.service,
      addCpuUsageAlarm: {
        Cpu: { maxUsagePercent: 70 },
      },
      addMemoryUsageAlarm: {
        Memory: { maxUsagePercent: 70 },
      },
    });
    const metricFactory = facade.createMetricFactory();
    const alarmFactory = facade.createAlarmFactory('');
    const anomalyFactory = new AnomalyDetectingAlarmFactory(alarmFactory);
    const runTaskMetric = metricFactory.createMetric(
      'RunningTaskCount',
      MetricStatistic.AVERAGE,
      'Running Tasks',
      {
        ServiceName: this.service.serviceName,
        ClusterName: this.service.cluster.clusterName,
      },
      undefined,
      'ECS/ContainerInsights',
    );
    const runningTaskAnomalyMetric = metricFactory
      .createMetricAnomalyDetection(
        runTaskMetric,
        3,
        'runningTasks',
        undefined,
        'runningTasks',
      );
    anomalyFactory.addAlarmWhenOutOfBand(runningTaskAnomalyMetric, 'RunningTasks-Anomaly', 'Critical',
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
        left: [this.cpuUtilizationMetric],
        title: 'Cpu Utilization',
      }),
      new GraphWidget({
        left: [this.memoryUtilizationMetric],
        title: 'Memory Utilization',
      }),
    ]);
    componentDash.addWidgets(...this.commonWidgets);
    const durationMonitor = new CustomMonitoring(facade, {
      alarmFriendlyName: 'RunningTasksAnomalyDetectionAlarm',
      metricGroups: [{
        title: `${this.service.serviceName} Running Tasks`,
        metrics: [
          {
            metric: runningTaskAnomalyMetric,
            alarmFriendlyName: 'Anomaly-RunningTasks',
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
    alarmsDash.addWidgets(...durationMonitor.widgets());

    const commonWidgets = this.commonWidgets;
    const service = this.service;
    return {
      widgetsForDashboard(name: string): IWidget[] {
        console.log(name);
        switch (name) {
          case 'Infrastructure':
            return [
              new HeaderWidget(`${service.serviceName}`, HeaderLevel.LARGE),
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
