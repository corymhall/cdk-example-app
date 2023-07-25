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
