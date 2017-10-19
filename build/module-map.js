'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const { readFile, writeFile } = require('node-utils').fsAsync;

const { exists } = require('./fs-utils');

class ModuleMap {

  constructor(projectRoot /*: string*/) {
    this.loaded = false;

    this.moduleMapPath = _path2.default.join(projectRoot, 'module-map.json');
  }

  async load() {
    if (this.loaded) {
      return;
    }

    const moduleMapExists = await exists(this.moduleMapPath);

    if (moduleMapExists) {
      this.moduleMap = JSON.parse((await readFile(this.moduleMapPath)));
    } else {
      this.moduleMap = {};
      await this.write();
    }
  }

  async write() {
    await writeFile(this.moduleMapPath, JSON.stringify(this.moduleMap, null, 2));
  }

  async add(moduleName /*: string*/, modulePath /*: string*/) {
    this.moduleMap[moduleName] = modulePath;
    await this.write();
  }

  async removeLinkToTarget(moduleTarget /*: string*/) {
    for (let moduleName in this.moduleMap) {
      if (this.moduleMap[moduleName] === moduleTarget) {
        delete this.moduleMap[moduleName];
      }
    }
    await this.write();
  }
}
exports.default = ModuleMap;