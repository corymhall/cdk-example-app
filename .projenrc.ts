import { awscdk } from 'projen';
import { Transform } from 'projen/lib/javascript';
import { EcsAutoDiscover, LambdaAutoDiscover } from './projenrc/auto-discover';
const alphaVersion = '^2.86.0-alpha.0';
const project = new awscdk.AwsCdkTypeScriptApp({
  cdkVersion: '2.83.0',
  defaultReleaseBranch: 'main',
  name: 'cdk-example-app',
  projenrcTs: true,
  deps: [
    'express',
    'hall-constructs',
    `@aws-cdk/integ-tests-alpha@${alphaVersion}`,
    `@aws-cdk/aws-redshift-alpha@${alphaVersion}`,
    `@aws-cdk/aws-synthetics-alpha@${alphaVersion}`,
    `@aws-cdk/integ-runner@${alphaVersion}`,
    `@aws-cdk/aws-apigatewayv2-alpha@${alphaVersion}`,
    `@aws-cdk/aws-apigatewayv2-integrations-alpha@${alphaVersion}`,
    'cdk-monitoring-constructs',
    'node-fetch',
  ],
  lambdaAutoDiscover: false,
  devDeps: [
    'aws-sdk-client-mock',
    'supertest',
    '@types/supertest',
    'case',
    'aws-xray-sdk',
    '@aws-sdk/client-dynamodb',
    '@aws-sdk/util-dynamodb',
    '@types/aws-lambda',
    '@types/express',
    '@aws-lambda-powertools/commons',
    '@aws-lambda-powertools/logger',
    '@aws-lambda-powertools/metrics',
    '@aws-lambda-powertools/tracer',
  ],
  buildCommand: 'yarn projen && yarn projen compile && yarn projen bundle',
  jestOptions: {
    jestConfig: {
      transform: {
        '^.+\\.ts$': new Transform('ts-jest', {
          isolatedModules: true,
          tsconfig: 'tsconfig.dev.json',
        }),
      },
    },
  },

  // deps: [],                /* Runtime dependencies of this module. */
  // description: undefined,  /* The description is just a string that helps people understand the purpose of the package. */
  // devDeps: [],             /* Build dependencies for this module. */
  // packageName: undefined,  /* The "name" in package.json. */
});
project.tryFindObjectFile('package.json')?.addDeletionOverride('jest.globals');
project.removeTask('deploy');
project.addTask('deploy', {
  steps: [
    {
      spawn: project.compileTask.name,
    },
    {
      exec: 'npx cdk deploy --profile sandbox --method=direct --require-approval=never',
      receiveArgs: true,
    },
  ],
});
const integTest = project.addTask('integ', {
  exec: 'yarn integ-runner',
});
project.testTask.spawn(integTest);
const cdkjson = project.tryFindObjectFile('cdk.json');
cdkjson?.addToArray('watch.exclude', 'cdk-integ.out*');

project.gitignore.exclude('cdk-integ.out**');

const autoDiscoverOptions = {
  cdkDeps: project.cdkDeps,
  srcdir: project.srcdir,
  tsconfigPath: project.tsconfigDev.fileName,
};
new LambdaAutoDiscover(project, autoDiscoverOptions);
new EcsAutoDiscover(project, autoDiscoverOptions);

project.synth();

