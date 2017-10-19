// @flow

import path from 'path';

const { readFile, writeFile } = require('node-utils').fsAsync;
const { exists } = require('./fs-utils');

export default class ModuleMap {
  loaded: boolean = false;
  moduleMapPath: string;
  moduleMap: { [string]: string };

  constructor(projectRoot: string) {
    this.moduleMapPath = path.join(projectRoot, 'module-map.json');
  }

  async load() {
    if (this.loaded) {
      return;
    }

    const moduleMapExists = await exists(this.moduleMapPath);

    if (moduleMapExists) {
      this.moduleMap = JSON.parse(await readFile(this.moduleMapPath));
    } else {
      this.moduleMap = {};
      await this.write();
    }
  }

  async write() {
    await writeFile(this.moduleMapPath, JSON.stringify(this.moduleMap, null, 2));
  }

  async add(moduleName: string, modulePath: string) {
    this.moduleMap[moduleName] = modulePath;
    await this.write();
  }

  async removeLinkToTarget(moduleTarget: string) {
    for (let moduleName in this.moduleMap) {
      if (this.moduleMap[moduleName] === moduleTarget) {
        delete this.moduleMap[moduleName];
      }
    }
    await this.write();
  }
}
