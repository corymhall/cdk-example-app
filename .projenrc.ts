import { awscdk } from 'projen';
import { NodePackageManager, Transform } from 'projen/lib/javascript';
import { EcsAutoDiscover, LambdaAutoDiscover } from './projenrc/auto-discover';
const alphaVersion = '^2.151.0-alpha.0';
const project = new awscdk.AwsCdkTypeScriptApp({
  cdkVersion: '2.151.0',
  defaultReleaseBranch: 'main',
  release: false,
  buildWorkflow: false,
  depsUpgrade: false,
  githubOptions: {
    mergify: false,
    pullRequestLint: false,
  },
  name: 'cdk-example-app',
  projenrcTs: true,
  prettier: true,
  prettierOptions: {
    settings: {
      singleQuote: true,
    },
  },
  eslintOptions: {
    dirs: [],
    prettier: true,
  },
  packageManager: NodePackageManager.NPM,
  deps: [
    'express',
    '@cdklabs/cdk-validator-cfnguard',
    'hall-constructs',
    `@aws-cdk/integ-tests-alpha@${alphaVersion}`,
    `@aws-cdk/aws-redshift-alpha@${alphaVersion}`,
    `@aws-cdk/integ-runner@${alphaVersion}`,
    'cdk-monitoring-constructs',
    'node-fetch',
  ],
  lambdaAutoDiscover: false,
  devDeps: [
    '@swc/core',
    '@swc/helpers',
    'cdk-dia',
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
  buildCommand: undefined,
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
const eslint = project.tryFindObjectFile('.eslintrc.json');
// I don't want to show linting errors for things that get auto fixed
eslint?.addOverride('extends', ['plugin:import/typescript']);

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
// project.cdkConfig.json.addOverride('app', 'npx ts-node -P tsconfig.json --prefer-ts-exts src/main.ts');
// project.cdkConfig.json.addOverride('app', 'npx node -r ts-node/register --inspect-brk src/main.ts');
const buildCommand = 'yarn projen && yarn projen compile && yarn projen bundle';
project.tsconfig?.file.addOverride('ts-node', {
  swc: true,
});
project.tsconfigDev.file.addOverride('ts-node', {
  swc: true,
});
project.cdkTasks.synthSilent.reset();
project.cdkTasks.synthSilent.exec(`npx cdk synth -q --build "${buildCommand}"`);
project.addTask('dia', {
  steps: [
    {
      exec: 'npx cdk-dia --rendering cytoscape-html',
    },
    {
      exec: 'npx http-server diagram -o',
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
