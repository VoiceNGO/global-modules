// @flow

import { Stats } from 'fs';
import path from 'path';

import { Err, fsAsync, genAwait } from 'node-utils';
import ModuleMap from './module-map';
import { exists } from './fs-utils';

import type { tAbsolutePath, tModuleName } from 'flow-types';

const { genNull, genAllNull } = genAwait;
const { lstat, readFile } = fsAsync;
const PROVIDES_MODULE_RX = /^\s*(?:\*|\/\/)\s*@providesModule\s*(\S+)$/m;

export default class FileHandler {
  __filePath: tAbsolutePath;

  constructor(__filePath: tAbsolutePath) {
    this.__filePath = __filePath;
  }

  getFilePath(): tAbsolutePath {
    return this.__filePath;
  }

  // eslint-disable-next-line require-await
  async exists(): Promise<boolean> {
    return exists(this.__filePath);
  }

  async canProcess(): Promise<boolean> {
    const stats = await this.genStats();
    if (stats.isSymbolicLink()) {
      return false;
    }

    if (!stats.isFile()) {
      throw new Err(`Attempting to process ${this.__filePath}, but it is not a file.`);
    }

    return true;
  }

  // eslint-disable-next-line require-await
  async genStats(): Promise<Stats> {
    return lstat(this.__filePath);
  }

  async genProjectDir(): Promise<?tAbsolutePath> {
    const splitPath = this.__filePath.split(path.sep);
    for (let i = splitPath.length - 1; i >= 0; i--) {
      const dir = splitPath.slice(0, i);
      const packageJSONPath = path.resolve('/', ...dir, 'package.json');
      const packageJsonExists = await genNull(exists(packageJSONPath));

      if (packageJsonExists) {
        return path.resolve('/', ...dir);
      }
    }
  }

  async genWorkspaceDir(): Promise<?tAbsolutePath> {
    const { sep } = path;
    const parentDirs = path.dirname(this.__filePath).split(sep);

    while (parentDirs.length > 0) {
      const packageJSONPath = path.resolve('/', ...parentDirs, 'package.json');
      const packageJSONExists = await exists(packageJSONPath);

      if (packageJSONExists) {
        try {
          const json = require(packageJSONPath);

          if (json.private && json.workspaces) {
            return path.resolve('/', ...parentDirs);
          }
        } catch (err) {
          // intentionally empty
        }
      }
      parentDirs.pop();
    }
  }

  async genModuleName(): Promise<?tModuleName> {
    const fileContents = await genNull(readFile(this.__filePath));
    const matches = PROVIDES_MODULE_RX.exec(fileContents || '');

    return matches ? matches[1] : null;
  }

  async genProjectModuleMap(): Promise<ModuleMap> {
    const projectDir = await genNull(this.genProjectDir());

    if (!projectDir) {
      throw new Err(`Could not get project module map for ${this.__filePath} because no project was found`);
    }

    return new ModuleMap(projectDir);
  }

  async genWorkspaceModuleMap(): Promise<ModuleMap> {
    const workspaceDir = await genNull(this.genWorkspaceDir());

    if (!workspaceDir) {
      throw new Err(`Could not get workspace module map for ${this.__filePath} because no workspace was found`);
    }

    return new ModuleMap(workspaceDir);
  }

  async genModuleMaps(): Promise<Array<ModuleMap>> {
    const moduleMaps: Array<ModuleMap | null> = await genAllNull(
      this.genWorkspaceModuleMap(),
      this.genProjectModuleMap(),
    );

    return moduleMaps.filter(Boolean);
  }
}
