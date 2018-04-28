// @flow

import path from 'path';

import { Err, fsAsync, genAwait } from 'node-utils';
import { exists } from './fs-utils';
import memoize from 'memoized-decorator';

import type { tAbsolutePath, tModuleName, tRelativePath } from 'flow-types';
import { toTModuleName } from 'flow-types';

const { readFile, writeFile } = fsAsync;
const { gen, genAllNull } = genAwait;

import type { IModuleMap } from './interfaces';

function sortObject(obj: Object) {
  const newObj = {};
  const keys = Object.keys(obj);
  keys.sort().forEach(key => (newObj[key] = obj[key]));
  return newObj;
}

export default class ModuleMap implements IModuleMap {
  projectRoot: tAbsolutePath;
  moduleMapPath: tAbsolutePath;
  moduleMap: { [tModuleName]: tRelativePath };

  constructor(projectRoot: tAbsolutePath) {
    this.projectRoot = projectRoot;
    this.moduleMapPath = path.join(projectRoot, 'module-map.json');
  }

  @memoize
  async load(): Promise<void> {
    const moduleMapExists = await exists(this.moduleMapPath);

    if (moduleMapExists) {
      this.moduleMap = JSON.parse(await readFile(this.moduleMapPath));
    } else {
      this.moduleMap = {};
      await this.write();
    }
  }

  async write() {
    const moduleJSON = JSON.stringify(this.moduleMap, null, 2);
    const [err] = await gen(writeFile(this.moduleMapPath, moduleJSON));

    if (err) {
      throw new Err(`Failed to write module map to ${this.moduleMapPath} because ${Err.printable(err)}`);
    }
  }

  getProjectRoot(): tAbsolutePath {
    return this.projectRoot;
  }

  getModuleMapPath(): tAbsolutePath {
    return this.moduleMapPath;
  }

  async __genModulePath(moduleName: tModuleName): Promise<?tRelativePath> {
    await this.load();

    return this.moduleMap[moduleName];
  }

  async __genAbsoluteModulePath(moduleName: tModuleName): Promise<?tAbsolutePath> {
    const relModulePath = await this.__genModulePath(moduleName);

    if (!relModulePath) return null;

    return path.join(this.projectRoot, relModulePath);
  }

  __genRelativePath(absPath: tAbsolutePath): tRelativePath {
    const relPath = path.relative(this.projectRoot, absPath);

    if (relPath.indexOf('..') >= 0) {
      throw new Err(`ModuleMap.__genRelativePath called with a path outside of the project root`);
    }

    return relPath;
  }

  async __clean(moduleName: tModuleName) {
    await this.load();

    const absModulePath = await this.__genAbsoluteModulePath(moduleName);
    if (!absModulePath) return;

    const linkedModuleExists = await exists(absModulePath);
    if (linkedModuleExists) return;

    await this.removeModule(moduleName);
  }

  async canAdd(moduleName: tModuleName, modulePath: tAbsolutePath): Promise<true | string> {
    await genAllNull(this.load(), this.__clean(moduleName));

    const relativeModulePath = path.relative(this.projectRoot, modulePath);
    const existingTarget = this.moduleMap[moduleName];
    if (!existingTarget || existingTarget === relativeModulePath) {
      return true;
    }

    return `${moduleName} is already mapped to ${existingTarget}`;
  }

  async add(moduleName: tModuleName, modulePath: tAbsolutePath) {
    await this.load();

    const canAdd = await this.canAdd(moduleName, modulePath);

    if (!canAdd) {
      throw new Err(`Failed to add ${moduleName} to map because it is already mapped to ${this.moduleMap[moduleName]}`);
    }

    this.moduleMap[moduleName] = this.__genRelativePath(modulePath);
    this.moduleMap = sortObject(this.moduleMap);
    await this.write();
  }

  async removeModule(moduleName: tModuleName) {
    await this.load();

    if (!this.moduleMap[moduleName]) return;

    delete this.moduleMap[moduleName];
    await this.write();
  }

  async existingModuleName(modulePath: tAbsolutePath): Promise<?tModuleName> {
    await this.load();

    const relModulePath = await this.__genRelativePath(modulePath);

    for (const moduleName in this.moduleMap) {
      // TODO: remove this dependent on https://github.com/facebook/flow/issues/5777
      const typedModuleName = toTModuleName(moduleName);

      if (this.moduleMap[typedModuleName] === relModulePath) {
        return typedModuleName;
      }
    }
  }

  async genModules(): Promise<{ [tModuleName]: tRelativePath }> {
    await this.load();

    return this.moduleMap;
  }
}
