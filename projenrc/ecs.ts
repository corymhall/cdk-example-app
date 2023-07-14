import * as path from 'path';
// eslint-disable-next-line import/no-extraneous-dependencies
import { pascal } from 'case';
import { Component, Project, SourceCode } from 'projen';
import { LambdaFunctionOptions, LambdaRuntime } from 'projen/lib/awscdk';
import { Bundler, Eslint } from 'projen/lib/javascript';
import { TypeScriptProject } from 'projen/lib/typescript';
import { convertToPosixPath } from './lambda';

/**
 * Suffix for AWS Lambda handlers.
 */
export const TYPESCRIPT_ECS_EXT = '.ecs-task.ts';

export class EcsService extends Component {
  /**
   * Defines a pre-bundled AWS Lambda function construct from handler code.
   *
   * @param project The project to use
   * @param options Options
   */
  constructor(project: Project, options: LambdaFunctionOptions) {
    super(project);

    const bundler = Bundler.of(project);
    if (!bundler) {
      throw new Error(
        'No bundler found. Please add a Bundler component to your project.',
      );
    }

    const runtime = options.runtime ?? LambdaRuntime.NODEJS_18_X;

    // allow Lambda handler code to import dev-deps since they are only needed
    // during bundling
    const eslint = Eslint.of(project);
    eslint?.allowDevDeps(options.entrypoint);

    const entrypoint = options.entrypoint;

    if (
      !entrypoint.endsWith(TYPESCRIPT_ECS_EXT)
    ) {
      throw new Error(
        `${entrypoint} must have a ${TYPESCRIPT_ECS_EXT}`,
      );
    }

    const basePath = path.posix.join(
      path.dirname(entrypoint),
      path.basename(
        entrypoint,
        TYPESCRIPT_ECS_EXT,
      ),
    );
    const constructFile = options.constructFile ?? `${basePath}.ts`;

    if (path.extname(constructFile) !== '.ts') {
      throw new Error(
        `Construct file name "${constructFile}" must have a .ts extension`,
      );
    }

    const entryFile = `${basePath}.server.ts`;
    // type names
    const constructName =
      options.constructName ?? pascal(path.basename(basePath)) + 'Service';
    const propsType = `${constructName}Props`;

    const bundle = bundler.addBundle(entryFile, {
      target: runtime.esbuildTarget,
      platform: runtime.esbuildPlatform,
      ...options.bundlingOptions,
      tsconfigPath: (project as TypeScriptProject)?.tsconfigDev?.fileName,
    });

    // calculate the relative path between the directory containing the
    // generated construct source file to the directory containing the bundle
    // index.js by resolving them as absolute paths first.
    // e.g:
    //  - outfileAbs => `/project-outdir/assets/foo/bar/baz/foo-function/index.js`
    //  - constructAbs => `/project-outdir/src/foo/bar/baz/foo-function.ts`
    const outfileAbs = path.join(project.outdir, bundle.outfile);
    const constructAbs = path.join(project.outdir, constructFile);
    const relativeOutfile = path.relative(
      path.dirname(constructAbs),
      path.dirname(outfileAbs),
    );
    const dockerfile = path.join(path.relative(project.outdir, path.dirname(outfileAbs)), 'Dockerfile');

    const src = new SourceCode(project, constructFile);
    if (src.marker) {
      src.line(`// ${src.marker}`);
    }
    src.line("import * as path from 'path';");
    src.line('// eslint-disable-next-line import/no-extraneous-dependencies');
    src.line("import { LogLevel } from '@aws-lambda-powertools/logger/lib/types';");
    src.line("import { AwsLogDriver, TaskDefinition, ContainerImage, ITaskDefinitionExtension, ContainerDefinitionOptions } from 'aws-cdk-lib/aws-ecs';");
    src.line("import { ILogGroup } from 'aws-cdk-lib/aws-logs';");
    src.line("import { Duration } from 'aws-cdk-lib/core';");
    src.line(`import { Env, IContainer } from '${path.relative(path.dirname(constructAbs), path.join(project.outdir, 'src/types'))}';`);
    src.line('');

    src.open(`export interface ${propsType} extends Omit<ContainerDefinitionOptions, 'image'> {`);
    src.line('readonly logLevel?: LogLevel;');
    src.line('readonly env?: Env;');
    src.close('}');
    src.line('');


    src.open(`export class ${constructName} implements IContainer {`);
    src.line(`constructor(public readonly id: string, private readonly props?: ${propsType}) {}`);
    src.open('public bind(logGroup: ILogGroup): ITaskDefinitionExtension {');
    src.line('const id = this.id;');
    src.line('const props = this.props;');
    src.open('return {');
    src.open('extend(taskDefinition: TaskDefinition): void {');
    src.open('taskDefinition.addContainer(id, {');
    src.line('...props,');
    src.line(
      `image: ContainerImage.fromAsset(path.join(__dirname, '${convertToPosixPath(
        relativeOutfile,
      )}')),`,
    );
    src.open('healthCheck: {');
    src.line("command: ['CMD-SHELL', 'curl -s http://127.0.0.1:8080/health'],");
    src.line('interval: Duration.seconds(5),');
    src.line('retries: 1,');
    src.line('startPeriod: Duration.seconds(10),');
    src.line('timeout: Duration.seconds(2),');
    src.close('},');
    src.open('portMappings: [{');
    src.line('containerPort: 8080,');
    src.close('}],');
    src.open('environment: {');
    src.line('...props?.environment,');
    src.line("AWS_EMF_AGENT_ENDPOINT: 'tcp://127.0.0.1:25888',");
    src.line("LOG_LEVEL: props?.logLevel ?? 'DEBUG',");
    src.line(`POWERTOOLS_SERVICE_NAME: '${constructName}',`);
    src.line("POWERTOOLS_METRICS_NAMESPACE: 'blogApp',");
    src.line('ENV: props?.env ?? Env.DEV,');
    src.close('},');
    src.open('logging: AwsLogDriver.awsLogs({');
    src.line('streamPrefix: id,');
    src.line('logGroup: logGroup,');
    src.close('}),');
    src.close('});');
    src.close('},');
    src.close('};');
    src.close('}');
    src.close('}');

    const entry = new SourceCode(project, entryFile);
    entry.line(`import app from './${path.basename(entrypoint, '.ts')}';`);
    entry.open('app.listen(8080, () => {');
    entry.line("console.log('Listening on port 8080');");
    entry.close('});');

    const df = new SourceCode(project, dockerfile);
    df.line(`# ${df.marker}`);
    df.line('FROM node:18-alpine');
    df.line();
    df.line('RUN apk --no-cache add curl');
    df.line();
    df.line('COPY . /bundle');
    df.line('EXPOSE 8080');
    df.line('CMD ["node", "/bundle/index.js"]');


    this.project.logger.verbose(
      `${basePath}: construct "${constructName}" generated under "${constructFile}"`,
    );
    this.project.logger.verbose(
      `${basePath}: bundle task "${bundle.bundleTask.name}"`,
    );
    if (bundle.watchTask) {
      this.project.logger.verbose(
        `${basePath}: bundle watch task "${bundle.watchTask.name}"`,
      );
    }
  }
}
