// @flow

import path from 'path';

import ModuleMap from './module-map';
import FileLinker from './file-linker';
import { Err, arrayAsync } from 'node-utils';

import type { tAbsolutePath } from 'flow-types';

const { genEvery, genForEach } = arrayAsync;

export default async function relink(projectRoot: tAbsolutePath) {
  const moduleMap = new ModuleMap(projectRoot);
  const linker = new FileLinker(projectRoot);
  const modules = await moduleMap.genModules();
  const aryModules = Object.entries(modules);

  const [canAddErr, canAddAll] = await genEvery(aryModules, async module => {
    const [moduleName, modulePath] = module;
    const fullModulePath = path.resolve(projectRoot, modulePath);
    const canAdd = await linker.canAdd(moduleName, fullModulePath);

    if (canAdd !== true) {
      throw new Err(canAdd);
    }

    return true;
  });

  if (canAddErr || !canAddAll) {
    throw new Err.Fatal('unable to link all files from module-map.json', canAddErr);
  }

  const addErr = await genForEach(aryModules, async module => {
    const [moduleName, modulePath] = module;
    const fullModulePath = path.resolve(projectRoot, modulePath);

    await linker.add(moduleName, fullModulePath);
  });

  if (addErr) {
    throw new Err.Fatal('failed to link all files from module-map.json', addErr);
  }
}
