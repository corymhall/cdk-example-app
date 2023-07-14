import { LinuxBuildImage } from 'aws-cdk-lib/aws-codebuild';
import { App, Stack } from 'aws-cdk-lib/core';
import { CodePipeline, CodePipelineSource, ShellStep } from 'aws-cdk-lib/pipelines';
import { AppStage } from './app';

const app = new App();

new AppStage(app, 'DevStage', {
  env: {
    region: 'us-east-2',
    account: process.env.CDK_DEFAULT_ACCOUNT, // my personal dev account
  },
});

const pipelineStack = new Stack(app, 'BlogPost-PipelineStack', {
  env: {
    region: 'us-east-2',
    account: '183533638597', // shared services account
  },
});

const pipeline = new CodePipeline(pipelineStack, 'DeliveryPipeline', {
  synth: new ShellStep('synth', {
    input: CodePipelineSource.connection('corymhall/cdk-example-app', 'main', {
      connectionArn: 'arn:aws:codestar-connections:us-east-2:183533638597:connection/ca65d486-ca6e-41cb-aab2-645db37fdb2c',
    }),
    commands: [
      'yarn install --frozen-lockfile',
      'npx cdk synth',
    ],
    primaryOutputDirectory: 'cdk.out',
  }),
  codeBuildDefaults: {
    buildEnvironment: { buildImage: LinuxBuildImage.STANDARD_7_0 },
  },
  crossAccountKeys: true,
  useChangeSets: false,
});

pipeline.addStage(new AppStage(app, 'PreProdStage', {
  env: {
    region: 'us-east-2',
    account: '539334897376', // pre-prod account
  },
}));

pipeline.addStage(new AppStage(app, 'ProdStage', {
  env: {
    region: 'us-east-2',
    account: '202865745565', // prod account
  },
}));
