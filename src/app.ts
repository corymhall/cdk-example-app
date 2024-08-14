import { Stack } from 'aws-cdk-lib';
import { Stage, StageProps } from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import { CreatePost } from './components/create-post';
import { Data } from './components/data';
import { GetPost } from './components/get-post';
import { Network } from './components/network';
import { Api } from './constructs/api';
import { Monitoring } from './constructs/monitoring';

/**
 * My main application stage this contains all of the stack/resources
 * for my application and can be deployed as a single unit
 */
export class AppStage extends Stage {
  /**
   * The public facing Http API
   */
  public readonly api: Api;

  /**
   * The stack containing the application
   */
  public readonly appStack: Stack;

  /**
   * The stack containing the monitoring resources
   */
  public readonly monitoringStack: Stack;

  /**
   * This contains the route urls that is supported by the API
   * this allows for accessing the needed URL with autocomplete
   */
  public readonly routes: {
    'GET /posts': (postId: string) => string;
    'POST /posts': string;
  };

  constructor(scope: Construct, id: string, props?: StageProps) {
    super(scope, id, props);

    // -------------------------------------------------------------------
    // ---------------------Monitoring Stack------------------------------
    // -------------------------------------------------------------------
    // This is separate from the other stacks to avoid circular dependencies
    const monitoringStack = new Stack(this, 'MonitoringStack');
    const monitor = new Monitoring(monitoringStack, 'Monitoring');

    // -------------------------------------------------------------------
    // -------------------------Data Stack-------------------------------
    // -------------------------------------------------------------------
    // Stack containing my stateful resources. Enabled extra protection
    const datastore = new Stack(this, 'DataStack', {
      terminationProtection: true,
    });

    const table = new Data(datastore, 'PostsTable', { monitor });

    // -----------------------------------------------------------
    // --------------------App Stack------------------------------
    // -----------------------------------------------------------
    // Contains resources for my application. This includes the VPC, but could also
    // not include the VPC
    const appStack = new Stack(this, 'AppStack');
    const network = new Network(appStack, 'Network', {});

    // ------------Create Rest API-------------------
    const api = new Api(appStack, 'Api', { monitor, vpc: network.cluster.vpc });

    // ---------------------Create an ECS Service-----------------------
    new GetPost(appStack, 'GetPost', {
      api,
      cluster: network.cluster,
      monitor,
      table,
    });

    // -------------------Create a Lambda Service-----------------------
    new CreatePost(appStack, 'CreatePost', {
      api,
      monitor,
      table,
    });

    this.api = api;
    this.appStack = appStack;
    this.monitoringStack = monitoringStack;

    this.routes = {
      ['GET /posts']: (path: string) => {
        return `${api.url!}/post/${path}`;
      },
      ['POST /posts']: `${api.url!}/post`,
    };
  }
}
