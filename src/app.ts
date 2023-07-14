import { Stack } from 'aws-cdk-lib';
import { Stage, StageProps } from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import { CreatePost } from './components/create-post';
import { Data } from './components/data';
import { GetPost } from './components/get-post';
import { Network } from './components/network';
import { Api } from './constructs/api';
import { Monitoring } from './constructs/monitoring';

export class AppStage extends Stage {
  public readonly api: Api;
  public readonly stack: Stack;
  public readonly monitoringStack: Stack;
  public readonly routes: {
    'GET /posts': (id: string) => string;
    'POST /posts': string;
  };

  constructor(scope: Construct, id: string, props?: StageProps) {
    super(scope, id, props);

    // -------------------------------------------------------------------
    // ---------------------Monitoring Stack------------------------------
    // -------------------------------------------------------------------
    const monitoringStack = new Stack(this, 'MonitoringStack');
    const monitor = new Monitoring(monitoringStack, 'Monitoring');

    // -------------------------------------------------------------------
    // -------------------------Data Stack-------------------------------
    // -------------------------------------------------------------------
    const datastore = new Stack(this, 'DataStack', {
      terminationProtection: true,
    });

    const table = new Data(datastore, 'PostsTable', { monitor });

    // -----------------------------------------------------------
    // --------------------App Stack------------------------------
    // -----------------------------------------------------------
    const appStack = new Stack(this, 'AppStack');
    const network = new Network(appStack, 'Network', { });

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
    this.stack = appStack;
    this.monitoringStack = monitoringStack;

    this.routes = {
      ['GET /posts']: ((path: string) => {
        return `${api.url!}/post/${path}`;
      }),
      ['POST /posts']: `${api.url!}/post`,
    };
  }
}
