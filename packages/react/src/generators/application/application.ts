import { extraEslintDependencies, reactEslintJson } from '../../utils/lint';
import { NormalizedSchema, Schema } from './schema';
import { createApplicationFiles } from './lib/create-application-files';
import { updateJestConfig } from './lib/update-jest-config';
import { normalizeOptions } from './lib/normalize-options';
import { addProject } from './lib/add-project';
import { addCypress } from './lib/add-cypress';
import { addJest } from './lib/add-jest';
import { addRouting } from './lib/add-routing';
import { setDefaults } from './lib/set-defaults';
import { addStyledModuleDependencies } from '../../rules/add-styled-dependencies';
import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  formatFiles,
  GeneratorCallback,
  joinPathFragments,
  Tree,
  updateJson,
} from '@nrwl/devkit';
import { parallelizeTasks } from '@nrwl/workspace/src/utilities/parallelize-tasks';
import reactInitGenerator from '../init/init';
import { lintProjectGenerator } from '@nrwl/linter';

async function addLinting(host: Tree, options: NormalizedSchema) {
  const tasks: GeneratorCallback[] = [];
  const lintTask = await lintProjectGenerator(host, {
    linter: options.linter,
    project: options.projectName,
    tsConfigPaths: [
      joinPathFragments(options.appProjectRoot, 'tsconfig.app.json'),
    ],
    eslintFilePatterns: [`${options.appProjectRoot}/**/*.{ts,tsx,js,jsx}`],
    skipFormat: true,
  });
  tasks.push(lintTask);

  updateJson(
    host,
    joinPathFragments(options.appProjectRoot, '.eslintrc.json'),
    (json) => {
      json.extends = [...reactEslintJson.extends, ...json.extends];
      return json;
    }
  );

  const installTask = await addDependenciesToPackageJson(
    host,
    extraEslintDependencies.dependencies,
    extraEslintDependencies.devDependencies
  );
  tasks.push(installTask);

  return parallelizeTasks(...tasks);
}

export async function applicationGenerator(host: Tree, schema: Schema) {
  const options = normalizeOptions(host, schema);

  const initTask = await reactInitGenerator(host, {
    ...options,
    skipFormat: true,
  });

  createApplicationFiles(host, options);
  addProject(host, options);
  const lintTask = await addLinting(host, options);
  const cypressTask = await addCypress(host, options);
  const jestTask = await addJest(host, options);
  updateJestConfig(host, options);
  const styledTask = addStyledModuleDependencies(host, options.styledModule);
  const routingTask = addRouting(host, options);
  setDefaults(host, options);

  if (!options.skipFormat) {
    await formatFiles(host);
  }

  return parallelizeTasks(
    initTask,
    lintTask,
    cypressTask,
    jestTask,
    styledTask,
    routingTask
  );
}

export default applicationGenerator;
export const applicationSchematic = convertNxGenerator(applicationGenerator);