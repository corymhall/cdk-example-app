import * as path from 'path';
// eslint-disable-next-line import/no-extraneous-dependencies
import { pascal } from 'case';
import { Component, Project, SourceCode } from 'projen';
import { LambdaFunctionOptions, LambdaRuntime } from 'projen/lib/awscdk';
import { Bundler, Eslint } from 'projen/lib/javascript';
import { TypeScriptProject } from 'projen/lib/typescript';

/**
 * Suffix for AWS Lambda handlers.
 */
export const TYPESCRIPT_LAMBDA_EXT = '.lambda.ts';

/**
 * Suffix for AWS Edge Lambda handlers.
 */
export const TYPESCRIPT_EDGE_LAMBDA_EXT = '.edge-lambda.ts';

/**
 * Suffix for AWS Lambda Extensions.
 */
export const TYPESCRIPT_LAMBDA_EXTENSION_EXT = '.lambda-extension.ts';

/**
 * Converts the given path string to posix if it wasn't already.
 */
export function convertToPosixPath(p: string) {
  return p.split(path.sep).join(path.posix.sep);
}

/**
 * Generates a pre-bundled AWS Lambda function construct from handler code.
 *
 * To use this, create an AWS Lambda handler file under your source tree with
 * the `.lambda.ts` extension and add a `LambdaFunction` component to your
 * typescript project pointing to this entrypoint.
 *
 * This will add a task to your "compile" step which will use `esbuild` to
 * bundle the handler code into the build directory. It will also generate a
 * file `src/foo-function.ts` with a custom AWS construct called `FooFunction`
 * which extends `@aws-cdk/aws-lambda.Function` which is bound to the bundled
 * handle through an asset.
 *
 * @example
 *
 * new LambdaFunction(myProject, {
 *   srcdir: myProject.srcdir,
 *   entrypoint: 'src/foo.lambda.ts',
 * });
 */
export class LambdaFunction extends Component {
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
      !entrypoint.endsWith(TYPESCRIPT_LAMBDA_EXT) &&
      !entrypoint.endsWith(TYPESCRIPT_EDGE_LAMBDA_EXT)
    ) {
      throw new Error(
        `${entrypoint} must have a ${TYPESCRIPT_LAMBDA_EXT} or ${TYPESCRIPT_EDGE_LAMBDA_EXT} extension`,
      );
    }

    const basePath = path.posix.join(
      path.dirname(entrypoint),
      path.basename(
        entrypoint,
        options.edgeLambda ? TYPESCRIPT_EDGE_LAMBDA_EXT : TYPESCRIPT_LAMBDA_EXT,
      ),
    );
    const constructFile = options.constructFile ?? `${basePath}-function.ts`;

    if (path.extname(constructFile) !== '.ts') {
      throw new Error(
        `Construct file name "${constructFile}" must have a .ts extension`,
      );
    }

    // type names
    const constructName =
      options.constructName ?? pascal(path.basename(basePath)) + 'Function';
    const propsType = `${constructName}Props`;

    const bundle = bundler.addBundle(entrypoint, {
      target: runtime.esbuildTarget,
      platform: runtime.esbuildPlatform,
      externals: runtime.defaultExternals,
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

    const src = new SourceCode(project, constructFile);
    if (src.marker) {
      src.line(`// ${src.marker}`);
    }
    src.line("import * as path from 'path';");
    src.line('// eslint-disable-next-line import/no-extraneous-dependencies');
    src.line("import { LogLevel } from '@aws-lambda-powertools/logger/lib/types';");

    src.line("import * as lambda from 'aws-cdk-lib/aws-lambda';");
    src.line("import { Stack, ArnFormat } from 'aws-cdk-lib/core';");
    src.line("import { Construct } from 'constructs';");
    src.line(`import { LambdaMonitor } from '${path.relative(path.dirname(constructAbs), path.join(project.outdir, 'src/constructs/monitoring'))}';`);
    src.line(`import { Env } from '${path.relative(path.dirname(constructAbs), path.join(project.outdir, 'src/types'))}';`);
    src.line();
    src.line('/**');
    src.line(` * Props for ${constructName}`);
    src.line(' */');
    src.open(
      `export interface ${propsType} extends lambda.FunctionOptions {`,
    );
    src.line('readonly logLevel?: LogLevel;');
    src.line('readonly env?: Env;');
    src.close('}');
    src.line();
    src.line('/**');
    src.line(
      ` * An AWS Lambda function which executes ${convertToPosixPath(
        basePath,
      )}.`,
    );
    src.line(' */');
    src.open(`export class ${constructName} extends lambda.Function {`);
    src.line('public readonly lambdaMonitor: LambdaMonitor;');
    src.open(
      `constructor(scope: Construct, id: string, props: ${propsType}) {`,
    );
    src.open('super(scope, id, {');
    src.line(`description: '${convertToPosixPath(entrypoint)}',`);
    src.line('...props,');

    src.open('environment: {');
    src.line("LOG_LEVEL: props?.logLevel ?? 'DEBUG',");
    src.line("POWERTOOLS_LOGGER_LOG_EVENT: 'true',");
    src.line(`POWERTOOLS_SERVICE_NAME: '${constructName}',`);
    src.line("POWERTOOLS_METRICS_NAMESPACE: 'blogApp',");
    src.line('ENV: props?.env ?? Env.DEV,');
    src.line('...props?.environment,');
    src.close('},');
    src.open('layers: [');
    src.open("lambda.LayerVersion.fromLayerVersionArn(scope, 'PowertoolsLayer', Stack.of(scope).formatArn({");
    src.line("resource: 'layer',");
    src.line("service: 'lambda',");
    src.line('arnFormat: ArnFormat.COLON_RESOURCE_NAME,');
    src.line("resourceName: 'AWSLambdaPowertoolsTypeScript:15',");
    src.line("account: '094274105915',");
    src.close('})),');
    src.close('],');

    src.line('memorySize: props?.memorySize ?? 256,');
    src.line('tracing: lambda.Tracing.ACTIVE,');
    src.line('architecture: lambda.Architecture.ARM_64,');

    src.line(
      `runtime: new lambda.Runtime('${runtime.functionRuntime}', lambda.RuntimeFamily.NODEJS),`,
    );
    src.line("handler: 'index.handler',");
    src.line(
      `code: lambda.Code.fromAsset(path.join(__dirname, '${convertToPosixPath(
        relativeOutfile,
      )}')),`,
    );
    src.close('});');
    if ((options.awsSdkConnectionReuse ?? true) && !options.edgeLambda) {
      src.line(
        "this.addEnvironment('AWS_NODEJS_CONNECTION_REUSE_ENABLED', '1', { removeInEdge: true });",
      );
    }
    src.line(`this.lambdaMonitor = new LambdaMonitor('${constructName}', this);`);
    src.close('}');
    src.close('}');

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
