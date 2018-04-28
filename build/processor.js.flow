// @flow

import FileHandler from './file-handler';
import ModuleMap from './module-map';
import FileLinker from './file-linker';

import { genAwait, arrayAsync } from 'node-utils';
import { getBuildPath } from './fs-utils';

import type { tAbsolutePath, tModuleName } from 'flow-types';
import type { IModuleMap } from './interfaces';

const { genForEachNull } = arrayAsync;
const { genAllNull, genAllEnforce } = genAwait;

type tProcessors = { moduleMap: ModuleMap, fileLinker: FileLinker, all: Array<IModuleMap> };

async function getProcessors(filePath: tAbsolutePath): Promise<?tProcessors> {
  const handler = new FileHandler(filePath);
  const [projectDir, workspaceDir] = await genAllNull(handler.genProjectDir(), handler.genWorkspaceDir());

  const workingDir = workspaceDir || projectDir;

  if (!workingDir) {
    return null;
  }

  const moduleMap = new ModuleMap(workingDir);
  const fileLinker = new FileLinker(workingDir);

  return { moduleMap, fileLinker, all: [moduleMap, fileLinker] };
}

export async function processFile(filePath: tAbsolutePath): Promise<void> {
  const handler = new FileHandler(filePath);
  const [moduleName, processors] = await genAllNull(handler.genModuleName(), getProcessors(filePath));

  if (!processors) {
    throw new Error(`processFile did not receive any processors`);
  }

  const buildPath = getBuildPath(filePath);
  const oldModuleName = await processors.moduleMap.existingModuleName(buildPath);

  if (oldModuleName && oldModuleName !== moduleName) {
    deleteLinksToModuleName(oldModuleName, processors);
  }
  if (!moduleName) return;

  const processorsCanAdd = await genAllEnforce(...processors.all.map(p => p.canAdd(moduleName, buildPath)));
  const canAddFile = processorsCanAdd.every(b => b === true);

  if (!canAddFile) {
    const reasons = [];
    processorsCanAdd.forEach(v => typeof v === 'string' && reasons.push(v));

    throw new Error(`Unable to link ${filePath} because ${reasons.join(', ')}`);
  }

  return genForEachNull(processors.all, processor => processor.add(moduleName, buildPath));
}

function deleteLinksToModuleName(moduleName: tModuleName, processors: tProcessors) {
  processors.all.forEach(processor => processor.removeModule(moduleName));
}

export async function deleteLinksTo(filePath: tAbsolutePath) {
  const processors = await getProcessors(filePath);

  if (!processors) return;
  processors;

  const oldModuleName = await processors.moduleMap.existingModuleName(filePath);
  if (!oldModuleName) return;

  deleteLinksToModuleName(oldModuleName, processors);
}
