'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _util = require('util');

var _moduleError = require('./module-error');

var _moduleError2 = _interopRequireDefault(_moduleError);

var _fsUtils = require('./fs-utils');

var _moduleMap = require('./module-map');

var _moduleMap2 = _interopRequireDefault(_moduleMap);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const { genAllNullable, genNullable } = require('node-utils').genAwait;

const [lstat, mkdir, readFile] = [_fs2.default.lstat, _fs2.default.mkdir, _fs2.default.readFile].map(_util.promisify);

/*:: import type { Stats } from 'fs';*/


const PROVIDES_MODULE_RX = /^\s*(?:\*||\/\/)\s*\@providesModule\s*(\S+)$/m;

class FileHandler {

  constructor(filePath /*: string*/) {
    this.filePath = filePath;
  }

  async exists() /*: Promise<boolean>*/ {
    return (0, _fsUtils.exists)(this.filePath);
  }

  async canProcess() /*: Promise<boolean>*/ {
    const stats = await this.getStats();
    if (stats.isSymbolicLink()) {
      return false;
    }

    if (!stats.isFile()) {
      throw new _moduleError2.default(`Attempting to process ${this.filePath}, but it is not a file.`);
    }

    return true;
  }

  async getStats() /*: Promise<Stats>*/ {
    if (this.stats) {
      return this.stats;
    }

    this.stats = await lstat(this.filePath);

    return this.stats;
  }

  async getNearestNodeModulesDir(shouldCreate /*: ?boolean*/) /*: Promise<?string>*/ {
    if (this.nodeModulesPath) {
      return this.nodeModulesPath;
    }

    const splitPath = this.filePath.split(_path2.default.sep);
    for (var i = splitPath.length - 1; i >= 0; i--) {
      const dir = splitPath.slice(0, i);
      const [nodeModulesExists, packageJsonExists] = await genAllNullable((0, _fsUtils.exists)(_path2.default.join(...dir.concat('node_modules'))), (0, _fsUtils.exists)(_path2.default.join(...dir.concat('package.json'))));

      if (nodeModulesExists || packageJsonExists) {
        if (!nodeModulesExists) {
          if (shouldCreate) {
            try {
              mkdir(dir.concat('node_modules').join(_path2.default.sep));
            } catch (err) {
              throw new _moduleError2.default(`Could not create node_modules directory in ${_path2.default.join(...dir)} because ${err}.`);
            }
          } else {
            return null;
          }
        }

        return _path2.default.join(...dir, 'node_modules');
      }
    }
  }

  async getOrCreateNearestNodeModulesDir() /*: Promise<?string>*/ {
    return await this.getNearestNodeModulesDir(true);
  }

  async getModuleName() /*: Promise<?string>*/ {
    const fileContents = await genNullable(readFile(this.filePath));
    const matches = PROVIDES_MODULE_RX.exec(fileContents || '');

    return matches ? matches[1] : null;
  }

  async getModuleMap() /*: Promise<ModuleMap>*/ {
    if (!this.moduleMap) {
      const nodeModulesDir = await this.getNearestNodeModulesDir();
      if (!nodeModulesDir) {
        throw new _moduleError2.default(`Could not get module map for ${this.filePath}`);
      }

      this.moduleMap = new _moduleMap2.default(nodeModulesDir);
    }

    return this.moduleMap;
  }
}
exports.default = FileHandler;