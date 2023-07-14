// eslint-disable-next-line import/no-extraneous-dependencies
import { Project } from 'projen';
import { LambdaAutoDiscoverOptions } from 'projen/lib/awscdk';
import { AutoDiscoverBase } from 'projen/lib/cdk';
import { EcsService, TYPESCRIPT_ECS_EXT } from './ecs';
import { LambdaFunction, TYPESCRIPT_LAMBDA_EXT } from './lambda';

/**
 * Creates lambdas from entry points discovered in the project's source tree.
 */
export class LambdaAutoDiscover extends AutoDiscoverBase {
  constructor(project: Project, options: LambdaAutoDiscoverOptions) {
    super(project, {
      projectdir: options.srcdir,
      extension: TYPESCRIPT_LAMBDA_EXT,
    });

    for (const entrypoint of this.entrypoints) {
      new LambdaFunction(this.project, {
        entrypoint,
        cdkDeps: options.cdkDeps,
        ...options.lambdaOptions,
      });
    }
  }
}

/**
 * Creates lambdas from entry points discovered in the project's source tree.
 */
export class EcsAutoDiscover extends AutoDiscoverBase {
  constructor(project: Project, options: LambdaAutoDiscoverOptions) {
    super(project, {
      projectdir: options.srcdir,
      extension: TYPESCRIPT_ECS_EXT,
    });

    for (const entrypoint of this.entrypoints) {
      new EcsService(this.project, {
        entrypoint,
        cdkDeps: options.cdkDeps,
        ...options.lambdaOptions,
      });
    }
  }
}

