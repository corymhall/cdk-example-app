# Example CDK Application

This is an example CDK application meant to illustrate the experience a
developer might have when using CDK to create an application on AWS. This is not
necessarily _the_ recommended way to create a CDK application, but is probably
the way that I would do it.

## Project Management

The project files are created and managed by
[projen](https://github.com/projen/projen). Projen allows you to manage your
project with the same construct programming model that you use in the rest of
your CDK application.

Some nice things that projen does for me:
1. Sets up all the TypeScript project boilerplate. I don't need to mess with
   those files (Projen actually makes sure I can't!)
2. Configures automated dependency updates
3. Adds all project commands to a common workflow. For example, when I run `yarn
   build` it will:
   a. Runs the `default` command to synthesize the project project
   b. Runs the `pre-compile` command
   c. Runs the `compile` command
   d. Runs the `post-compile` command
   e. Runs the `test` command
    e1. Runs the `jest` command
    e2. Runs the `eslint` command
    e3. Runs the `integ-runner` command
   f. Runs the `package` command

### Automated management of application components

I've implemented my own version of a function auto discover which can be viewed
in the [projenrc](./projenrc) folder.

Why did I do this? Because it makes it easier to focus on the application logic
and reduces the infrastructure boilerplate. When I want to add a new component
and just create the application entrypoint and the infrastructure components and
bundling are automatically created for me.

#### Lambda Functions

It will automatically discover any files with the naming strategy `*.lambda.ts`
and assume that those represent Lambda function handlers. When it finds these
files it will automatically:

- Create an Infrastructure component that creates the Lambda Function (see
  [create-function.ts](./src/posts/create-function.ts))
- Add a Bundling step that bundles the handler using `esbuild`.

#### ECS Services

It will automatically discover any files with the naming strategy `*.ecs-task.ts`
and assume that those represent ECS task servers. When it finds these files it
will automatically:

- Create an infrastructure component that registers the application container to
  the task definition (see [get-post.ts](./src/posts/get-post.ts))
- Add a Bundling step that bundles the entrypoint using `esbuild`
- Creates a Dockerfile in the asset out directory that will be used to build the
  container.

## Application lifecycle

### 1. Initialize the app

Ideally all of the projen stuff would be part of a separate library (not done to
keep everything in this project) so that I could do something like:

```console
npx projen new --from my-projen-lib@1.0.0
```

This would initialize the projen project with all of the customizations. My
organization could have projen templates for common project types (i.e. `--from
@my-org/projen-website`, `--from @my-org/projen-serverless`, `--from
@my-org/projen-ecs`, etc)

### 2. Create the application Stage

A CDK Stage is an abstraction that describes a single logical, cohesive
deployable unit of your application. Within a Stage we will define all of
our Stacks which should be deployed together. Once we define our stage, we can
then instantiate our stage multiple times to model multiple copies of our
application which could be deployed to different environments.

I start by creating the Stage because the first stage that I will instantiate
will be my development stage. This allows me to iterate in my development
environment and then when I am ready to deploy to production I can just
instantiate a new instance of the stage.

_src/app.ts_
```ts
import { Stage, StageProps } from 'aws-cdk-lib/core';
import { Construct } from 'constructs';

export class AppStage extends Stage {
  constructor(scope: Construct, id: string, props?: StageProps) {
    super(scope, id, props);
  }
}
```

_src/main.ts_
```ts
import { App } from 'aws-cdk-lib/core';
import { AppStage } from './app';

const app = new App();

new AppStage(app, 'DevStage', {
  env: {
    region: 'us-east-2',
    account: process.env.CDK_DEFAULT_ACCOUNT, // my personal dev account
  },
});
```

Now my app has a single Stage that will deploy to my personal development
account.

### 3. Start building the first component

#### Create Lambda handler

I'll start developing my first component (green). This component will be a
`construct` so that I could build and test it independently.

I'll create a new folder and file for the lambda handler [src/posts/create.lambda.ts](./src/posts/create.lambda.ts).
After re-running projen I should see a new file that was generated and contains
the CDK Lambda function [src/posts/create-function.ts](./src/posts/create-function.ts).

I can also create unit tests for the handler [test/posts/create.lambda.test.ts](./test/posts/create.lambda.test.ts)

At this point I will probably run `yarn test:watch` and iterate on the handler
code and unit tests.

Once I am ready to start testing it as a Lambda function, I can create
the `construct` for the component.

_src/components/create-post.ts_
```ts
export interface CreatePostProps {

}

export class CreatePost extends Construct {
  constructor(scope: Construct, id: string, props: CreatePostProps) {
    super(scope, id);
    new CreateFunction(this, 'CreatePost');
  }
}
```

I can also create the unit test for this component [test/components/create-post.test.ts](./test/components/create-post.test.ts).

#### Create integration test

Once I have the component created I can create the integration test which will
allow me to iterate in the cloud.

[test/components/integ.create-post.ts](./test/components/integ.create-post.ts)
```ts
export class TestCase extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    new CreatePost(this, 'CreatePost', { });
  }
}

const testCase = new TestCase(app, 'integ-create-post', { });

const integ = new IntegTest(app, 'integ-test', {
  testCases: [testCase],
  diffAssets: true,
});
```

I can then deploy this in `watch` mode. This allows me to watch for changes and
automatically deploy updates to just this component.

```console
yarn integ-runner --watch test/components/integ.create-post.ts
```

Now that it is deployed successfully I can go back and add the missing features
to the component.

#### Iterate and get component working

I have the Lambda function deployed, but I need to create an API Gateway with a
route to the Lambda function. I also need to create the DynamoDB table which
will contain the data for the app.

I'll update the integration test and add the API Gateway HTTP API.
_integ.create-post.ts_
```ts
export class TestCase extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const api = new HttpApi(this, 'IntegApi');
    const createPost = new CreatePost(this, 'CreatePost', {
      api,
    });
  }
}
```

Now I need to update the `CreatePost` construct to take the `HttpApi` and add
the route.

_src/components/create-post.ts_
```ts
export interface CreatePostProps {
  /**
   * The HTTP Api
   */
  readonly api: HttpApi;
}

export class CreatePost extends Construct {
  constructor(scope: Construct, id: string, props: CreatePostProps) {
    super(scope, id);
    const app = new CreateFunction(this, 'CreatePost');
    props.api.addRoutes({
      path: '/posts',
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration('createPost', app),
    });
  }
}
```

Next I'll setup the connection to the DynamoDB table.

_src/components/create-post.ts_
```ts
export interface CreatePostProps {
  ...,
  readonly table: ITable;
}
const app = new CreateFunction(this, 'CreatePost', {
  environment: {
    TABLE_NAME: props.table.tableName,
  },
});
```

_integ.create-post.ts_
```ts
export class TestCase extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const api = new HttpApi(this, 'IntegApi');
    const table = new Table(this, 'IntegTable', {
      partitionKey: {
        name: 'pk',
        type: AttributeType.STRING,
      },
    });
    const createPost = new CreatePost(this, 'CreatePost', {
      api,
      table,
    });
  }
}
```

At this point I can manually invoke the Api endpoint, but instead I'll setup
some automated assertion tests.

Lets create a new file to contain our test cases:

[test/components/test-cases.ts](./test/components/test-cases.ts)
```ts
const testCases: Post[] = [
  {
    author: 'corymhall',
    content: 'This is a test post',
    createdAt: new Date().toISOString(),
    pk: '1',
    status: Status.PUBLISHED,
    summary: 'Summary',
  },
];
```

I can reuse these test cases between my unit tests and my integration tests.

_test/components/integ-create-post.ts_
```ts
const integ = new IntegTest(...);

for (const test of testCases) {
  integ.assertions.httpApiCall(`${testCase.api.url!}posts`, {
    method: 'POST',
    body: JSON.stringify(test),
  }).next(
    integ.assertions.awsApiCall('DynamoDB', 'getItem', {
      Key: {
        pk: { S: test.pk },
      },
      TableName: testCase.table.tableName,
    }).expect(
      ExpectedResult.objectLike({
        Item: marshall({
          author: test.author,
          content: test.content,
          pk: test.pk,
          status: test.status,
          summary: test.summary,
        }),
      }),
    ),
  );
}
```

For every test case that I add a new assertion test will be created which will
invoke the HTTP Api and then query the DynamoDB table for the record that should
have just been created and assert that the record matches.

Now every time I save a file my unit tests will run and my integration test will
run and I will be able to see if the assertion tests have succeeded or not. I
can also setup these integration tests to be automatically run as part of CI/CD.

### 4. Start building the second component

Building the second component will largely follow the same process as what was
used for the first component so I won't go over it again here. The component 2
files can be viewed here:

- [components/get-post.ts](./src/components/get-post.ts)
- [posts/get-post.ts](./src/posts/get-post.ts)
- [posts/get-post.ecs-task.ts](./src/posts/get-post.ecs-task.ts)
- [constructs/fargate-service.ts](./src/constructs/fargate-service.ts)
- [constructs/extensions.ts](./src/constructs/extensions.ts)
- [test/posts/get-post.ecs-task.test.ts](./test/posts/get-post.ecs-task.test.ts)
- [test/posts/get-post.test.ts](./test/components/get-post.test.ts)
- [test/components/integ.get-post.ts](./test/components/integ.get-post.ts)


### 5. Putting it together

Now that we've got both components built and can test them independently, we can
put them together in our `AppStage`.

_see file_
[src/app.ts](./src/app.ts)

I'll then create a new integ test for the app stage.

_test/integ.app.ts_
```ts
const app = new App();

const appStage = new AppStage(app, 'BlogAppIntegStage', {
  env: {
    region: 'us-west-2',
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
});
```

And I'll add assertions that use both components, using the same test cases as
before.

```ts
const integ = new IntegTest(...);

testCases.forEach(test => {
  integ.assertions.httpApiCall(`${appStage.api.url!}posts`, {
    method: 'POST',
    body: JSON.stringify(test),
  }).next(
    integ.assertions.httpApiCall(`${appStage.api.url!}posts/${test.pk}`, {
    }).expect(ExpectedResult.objectLike({
      body: {
        author: test.author,
        content: test.content,
        pk: test.pk,
        status: test.status,
        summary: test.summary,
      },
    })),
  );
});
```

### 6. Create deployment pipeline

Now that I'm ready to deploy my application to my pre-prod and prod environments
I'll create a deployment pipeline.

_src/main.ts_
```ts
const pipeline = new CodePipeline(pipelineStack, 'DeliveryPipeline', {
  synth: new ShellStep('synth', {
    ...,
    commands: [
      'yarn install --frozen-lockfile',
      'npx cdk synth',
    ],
  }),
  crossAccountKeys: true,
  useChangeSets: false,
});
```

And add my deployment stages for each environment.

```ts
pipeline.addStage(new AppStage(app, 'PreProdStage', {
  env: {
    region: 'us-east-2',
    account: 'PRE_PROD_ACCOUNT', // pre-prod account
  },
}));

/**
 * Add a stage to the deployment pipeline for my pre-prod environment
 */
pipeline.addStage(new AppStage(app, 'ProdStage', {
  env: {
    region: 'us-east-2',
    account: 'PROD_ACCOUNT', // prod account
  },
}));
```

## Operating the application

Everything described above helps you get an application deployed to production,
but it doesn't help very much with operating the application. I haven't set up
any monitoring or observability, there are no metrics, alarms, or dashboards.

### Monitoring

Monitoring/observability can be broadly split between two layers; the
Infrastructure layer, and the application layer.

#### Application layer

At the application layer we need to determine what our business metrics are.
This is very specific to the individual components in our application. If we
take the `GetPost` component, we might say the metric we care about is the
number of `getPost` requests we receive. For that we will need to update our
application logic to emit this metric.

Using the [Lambda Powertools]() library we can do this using `Metrics`
[src/posts/get-post.ecs-task.ts](./src/posts/get-post.ecs-task.ts)
```ts
const metrics = new Metrics();

app.get('/posts/:id', async (req: Request, res: Response) => {
  try {
    // get the item
    metrics.addMetric('getItemSuccess', Metrics.Count, 1);
  } catch (e) {
    metrics.addMetric('getItemFailure', Metrics.Count, 1);
  }
});
```

Then we can monitor that metric, add it to a dashboard and setup alarms based on
what we expect it to be.

```ts
const getItemSuccessMetric = new Metric({
  metricName: 'getItemSuccess',
  dimensionsMap: { service: 'GetPost' },
  namespace: 'blogApp',
});

new GraphWidget({
  left: [getItemSuccessMetric],
});
```

Using the [ecs-monitoring-constructs]() I might setup anomaly detection for this
metric since I expect to have different levels depending on the time of day or
day of the week.

```ts
const getItemSuccessMetric = new Metric({...});
const facade = new MonitoringFacade();
const metricFactory = facade.createMetricFactory();
const alarmFactory = facade.createAlarmFactory();
const getItemAnomalyMetric = metricFactory.createMetricAnomalyDetection(
  getItemSuccessMetric,
  3, // standard deviation
  'getItemSuccess', // label
  undefined, // color
  'getItemSuccess', // expressionId
);
alarmFactory.addAlarmWhenOutOfBand(
  getItemAnomalyMetric,
  'getItemSuccess-Anomaly', // alarm name suffix
  'Warning', // disambiguator
  {
    alarmWhenAboveBand: false,
    alarmWhenBelowBand: true,
    standardDeviationForAlarm: 4,
  },
);
```

#### Infrastructure layer


