// @flow

import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

import { genAllNullable } from 'gen-await';
import ModuleError from './module-error';
import { exists } from './fs-utils';

const [lstat, mkdir, readFile] = [fs.lstat, fs.mkdir, fs.readFile].map(promisify);

import type { Stats } from 'fs';

const PROVIDES_MODULE_RX = /^\s*(?:\*||\/\/)\s*\@providesModule\s*(\S+)$/m;

export default class FileHandler {
  filePath: string;
  stats: ?Stats;
  nodeModulesPath: ?string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async exists(): Promise<boolean> {
    return exists(this.filePath);
  }

  async canProcess(): Promise<boolean> {
    const stats = await this.getStats();
    if (stats.isSymbolicLink()) {
      return false;
    }

    if (!stats.isFile()) {
      throw new ModuleError(`Attempting to process ${this.filePath}, but it is not a file.`);
    }

    return true;
  }

  async getStats(): Promise<Stats> {
    if (this.stats) {
      return this.stats;
    }

    this.stats = await lstat(this.filePath);

    return this.stats;
  }

  async getNearestNodeModulesDir(shouldCreate: ?boolean): Promise<?string> {
    if (this.nodeModulesPath) {
      return this.nodeModulesPath;
    }

    const splitPath = this.filePath.split(path.sep);
    for (var i = splitPath.length - 1; i >= 0; i--) {
      const dir = splitPath.slice(0, i);
      const [nodeModulesExists, packageJsonExists] = await genAllNullable(
        exists(path.join(...dir.concat('node_modules'))),
        exists(path.join(...dir.concat('package.json'))),
      );

      if (nodeModulesExists || packageJsonExists) {
        if (!nodeModulesExists) {
          if (shouldCreate) {
            try {
              mkdir(dir.concat('node_modules').join(path.sep));
            } catch (err) {
              throw new ModuleError(`Could not create node_modules directory in ${path.join(...dir)} because ${err}.`);
            }
          } else {
            return null;
          }
        }

        return path.join(...dir, 'node_modules');
      }
    }
  }

  async getOrCreateNearestNodeModulesDir(): Promise<?string> {
    return await this.getNearestNodeModulesDir(true);
  }

  async getModuleName(): Promise<?string> {
    const fileContents = await readFile(this.filePath);
    const matches = PROVIDES_MODULE_RX.exec(fileContents);

    if (!matches) {
      return;
    }

    return matches[1];
  }
}
