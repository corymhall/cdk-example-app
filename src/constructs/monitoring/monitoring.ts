import { DynamicDashboardFactory, IDynamicDashboardSegment, MonitoringFacade } from 'cdk-monitoring-constructs';
import { Construct } from 'constructs';

/**
  * Dashboards needed
  * 1. Customer experience dashboard
  *  - Present metrics on overall service health and adherence to goals
  *
  * 2. System-level dashboards (keep these at a high level)
  *  - Display interface-level monitoring data
  *    - input-related monitoring
  *      - Counts of requests received or work polled
  *      - request byte size percentiles
  *      - auth failure counts
  *    - process-related monitoring data
  *      - multi-modal business logic path/branch execution counts
  *      - backend microservice request counts/failure/latency percentiles
  *      - fault and error log output
  *      - request trace data
  *    - output related monitoring data
  *      - response type counts (with breakdowns for error/fault responses by customer)
  *      - size of responses
  *      - percentils for time-to-write first response byte and time-to-write complete response
  * 3. Service instance dashboards
  *  - Facilitate fast and comprehensive evaluation of the customer experience
  *  within a single service instance
  * 4. Service audit dashboards
  *  - displays data for all instances of a service across all AZs and regions
  * 5. Capacity planning and forecasting dashboards
  *
  * 6. Low-level dashboards
  *  7. Microservice-specific dashboards
  *  8. Infrastructure dashboards
  *  9. Dependency dashboards
  */

export const DASH_NAME_PREFIX = 'BlogAppDashboards';

/**
 * Central monitoring construct for this application
 * This adds specific functionality on top of the cdk-monitoring-constructs
 */
export class Monitoring extends Construct {
  public readonly facade: MonitoringFacade;
  private readonly factory: DynamicDashboardFactory;
  constructor(scope: Construct, id: string) {
    super(scope, id);
    this.factory = new DynamicDashboardFactory(this, 'DynamicDashboards', {
      dashboardNamePrefix: DASH_NAME_PREFIX,
      dashboardConfigs: [
        {
          name: 'Infrastructure',
        },
      ],
    });
    this.facade = new MonitoringFacade(this, 'Facade', {
      dashboardFactory: this.factory,
    });
  }
  public addDashboardSegment(segment: IMonitorComponent) {
    this.factory.addDynamicSegment(segment.bind(this.facade));
  }
}

/**
 * A application component that can be monitored
 */
export interface IMonitorComponent {
  /**
   * The identifier of the component
   */
  readonly id: string;

  /**
   * Bind the component to the central monitoring facade
   */
  bind(facade: MonitoringFacade): IDynamicDashboardSegment;
}
