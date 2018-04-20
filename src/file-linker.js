// @flow

import path from 'path';

import { arrayAsync, fsAsync, genAwait } from 'node-utils';
import { exists, linkFile, readSymlinkTarget } from './fs-utils';

import type { IModuleMap } from './interfaces';
import type { tAbsolutePath, tModuleName } from 'flow-types';

const { every: everyAsync } = arrayAsync;
const { lstat, mkdirp, unlink, dirIsEmpty, rmdir } = fsAsync;
const { gen, genAllNull } = genAwait;

const MODULE_SEPERATOR = '/';

async function isSymbolicLink(modulePath: tAbsolutePath): Promise<boolean> {
  const [err, stat] = await gen(lstat(modulePath));

  if (err || !stat) return false;

  return stat.isSymbolicLink();
}

export default class FileLinker implements IModuleMap {
  projectRoot: tAbsolutePath;
  nodeModulesPath: tAbsolutePath;

  constructor(projectRoot: tAbsolutePath) {
    this.projectRoot = projectRoot;
    this.nodeModulesPath = path.resolve(projectRoot, 'node_modules');
  }

  async canAdd(moduleName: tModuleName, modulePath: tAbsolutePath): Promise<true | string> {
    const linkPath = path.resolve(this.nodeModulesPath, moduleName);
    const [stats, currentTarget] = await genAllNull(lstat(linkPath), readSymlinkTarget(linkPath));

    if (stats && !stats.isSymbolicLink()) {
      return `${moduleName} already exists and is not a symlink`;
    }

    if (currentTarget && currentTarget !== modulePath) {
      return `${moduleName} is already linked to ${currentTarget}`;
    }

    const moduleContainsFolders = moduleName.indexOf(MODULE_SEPERATOR) >= 0;
    if (moduleContainsFolders) {
      const moduleParts = moduleName.split(MODULE_SEPERATOR);
      const folderParts = moduleParts.slice(0, -1);

      const allPartsAreFolders = await everyAsync(
        folderParts,
        async (current, index) => {
          const folders = folderParts.slice(0, index + 1);
          const folderPath = path.resolve(this.nodeModulesPath, ...folders);
          const [folderExists, folderStats] = await genAllNull(exists(folderPath), lstat(folderPath));

          if (!folderExists || (folderStats && folderStats.isDirectory())) return true;

          return false;
        },
        '',
      );

      if (!allPartsAreFolders) {
        return `Some parts of ${moduleName} already exist and are not directories`;
      }
    }

    return true;
  }

  async canRemove(moduleName: tModuleName): Promise<boolean> {
    const modulePath = path.resolve(this.nodeModulesPath, moduleName);
    const [fileExists, isSymLink] = await genAllNull(exists(modulePath), isSymbolicLink(modulePath));
    return !fileExists || !!isSymLink;
  }

  async add(moduleName: tModuleName, modulePath: tAbsolutePath) {
    const linkPath = path.resolve(this.nodeModulesPath, moduleName);
    const [canAdd, existingTarget] = await genAllNull(this.canAdd(moduleName, modulePath), readSymlinkTarget(linkPath));

    if (existingTarget && existingTarget === modulePath) return;
    if (!canAdd) {
      throw new Error(`can not link module ${moduleName} to ${modulePath}`);
    }

    const moduleContainsFolders = moduleName.indexOf(MODULE_SEPERATOR) >= 0;
    if (moduleContainsFolders) {
      const moduleParts = moduleName.split(MODULE_SEPERATOR);
      const folderParts = moduleParts.slice(0, -1);
      const folder = path.resolve(this.nodeModulesPath, ...folderParts);

      await mkdirp(folder);
    }

    await linkFile(modulePath, linkPath);
  }

  async removeModule(moduleName: tModuleName) {
    const canRemoveModule = await this.canRemove(moduleName);

    if (!canRemoveModule) {
      throw new Error(`can not unlink module ${moduleName}`);
    }

    const linkPath = path.resolve(this.nodeModulesPath, moduleName);
    const fileExists = await exists(linkPath);

    if (fileExists) {
      await unlink(linkPath);

      const moduleContainsFolders = moduleName.indexOf(MODULE_SEPERATOR) >= 0;
      if (moduleContainsFolders) {
        const moduleParts = moduleName.split(MODULE_SEPERATOR);
        const folderParts = moduleParts.slice(0, -1);

        for (let i = folderParts.length - 1; i >= 0; i--) {
          const dirPath = path.resolve(this.nodeModulesPath, ...folderParts.slice(0, i + 1));
          const isEmpty = await dirIsEmpty(dirPath);

          if (isEmpty) {
            await rmdir(dirPath);
          }
        }
      }
    }
  }
}
