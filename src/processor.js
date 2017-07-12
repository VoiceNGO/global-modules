// @flow
// @providesModule foo

import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { genAllNullable } from 'gen-await';

const [access, lstat, mkdir, readFile, symlink, unlink] = [
  fs.access,
  fs.lstat,
  fs.mkdir,
  fs.readFile,
  fs.symlink,
  fs.unlink,
].map(promisify);
const fileModuleMap: { [string]: string } = {};

import type { Stats } from 'fs';

const PROVIDES_MODULE_RX = /^\s*(?:\*||\/\/)\s*\@providesModule\s*(\S+)$/m;

export default async function(fileName: string) {
  const fileStat: Stats = await lstat(fileName);

  if (fileStat.isSymbolicLink()) {
    return;
  }

  if (!fileStat.isFile()) {
    throw new Error(`attempting to process ${fileName}, but it is not a file`);
  }

  const moduleName = await getModuleName(fileName);

  if (moduleName) {
    addModule(fileName, moduleName);
  } else {
    removeModule(fileName);
  }
};

async function getModuleName(fileName: string): Promise<?string> {
  const fileContents = await readFile(fileName);
  const matches = PROVIDES_MODULE_RX.exec(fileContents);

  if (!matches) {
    return;
  }

  return matches[1];
}

async function addModule(fileName: string, moduleName: string) {
  const nodeModulesDir = await getNearestProjectRootDir(fileName);

  if (!nodeModulesDir) {
    throw new Error(`Unable to find an appropriate node_modules directory for ${fileName}`);
  }

  linkModule(fileName, moduleName, nodeModulesDir);
}

function removeModule(fileName: string) {
  const module = fileModuleMap[fileName];

  if (module) {
    unlink(module);
  }
}

async function linkModule(fileName: string, moduleName: string, moduleDir: string) {
  const filePathNormalized = path.normalize(fileName).split(path.sep);
  const moduleDirNormalized = path.normalize(moduleDir).split(path.sep);
  let firstNonSharedIndex = 0;

  while(filePathNormalized[firstNonSharedIndex] === moduleDirNormalized[firstNonSharedIndex]){
    firstNonSharedIndex++;
  }

  const linkTarget = path.join('..', ...filePathNormalized.slice(firstNonSharedIndex));

  try {
    symlink(linkTarget, path.join(moduleDir, 'node_modules', moduleName));
  } catch (err) {
    throw new Error(`could not create symlink because ${err}`);
  }
}

async function getNearestProjectRootDir(fileName): Promise<?string> {
  const splitPath = fileName.split(path.sep);
  for (var i = splitPath.length - 1; i >= 0; i--) {
    const dir = splitPath.slice(0, i);
    const [nodeModulesExists, packageJsonExists] = await genAllNullable([
      access(path.join(...dir.concat('node_modules')), fs.constants.R_OK),
      access(path.join(...dir.concat('package.json')), fs.constants.R_OK),
    ]);

    if (nodeModulesExists !== null || packageJsonExists !== null) {
      if (nodeModulesExists === null) {
        try {
          mkdir(...dir.concat('node_modules'));
        } catch (err) {
          throw new Error(`could not create node_modules directory in ${path.join(...dir)} because ${err}`);
        }
      }
      return path.join(...dir);
    }
  }
}

process.on('uncaughtException', function(err) {
  console.error('uncaught exception:', err);
});

process.on('unhandledRejection', function(reason, p) {
  console.error('uncaught promise rejection:', reason);
});
