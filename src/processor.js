// @flow

import path from 'path';
const { genNullable, genEnforce, genAllEnforce, genAllNullable } = require('node-utils').genAwait;
const { access, lstat, mkdir, readdir, readFile, readlink, unlink: origUnlink } = require('node-utils').fsAsync;

import builtinModules from 'builtin-modules';
import notifier from 'node-notifier';

import FileHandler from './file-handler';
const { exists, linkFile: origLinkFile, readSymlinkTarget } = require('./fs-utils');
import ModuleError from './module-error';

const shouldNotify: boolean = require('minimist')(process.argv.slice(2)).nofity;

import type { Stats } from 'fs';

export default async function(filePath: string) {
  const handler = new FileHandler(filePath);

  if (!await handler.exists()) {
    await cleanModule(handler);
    return;
  }

  if (!await handler.canProcess()) {
    return;
  }

  const moduleName = await handler.getModuleName();
  if (moduleName) {
    if (!await handler.getOrCreateNearestNodeModulesDir()) {
      throw new ModuleError(`Unable to find an appropriate node_modules directory for ${filePath}.`);
    }

    await addModule(handler);
  }
  await cleanModule(handler);
}

async function unlink(filePath: string, handler: FileHandler) {
  const moduleMap = await handler.getModuleMap();
  await Promise.all([moduleMap.removeLinkToTarget(filePath), origUnlink(filePath)]);
}

async function linkFile(linkSource: string, linkTarget: string, moduleName: string, handler: FileHandler) {
  const moduleMap = await handler.getModuleMap();
  await Promise.all([moduleMap.add(moduleName, linkSource), origLinkFile(linkSource, linkTarget)]);
}

async function addModule(handler: FileHandler) {
  const [nodeModulesDir, moduleName: string] = await genAllEnforce(
    handler.getNearestNodeModulesDir(),
    handler.getModuleName(),
  );
  if (~builtinModules.indexOf(moduleName)) {
    throw new ModuleError(
      `${moduleName} is the name of a builtin node module.  Refusing to create a symlink of the same name.`,
    );
  }
  const filePathSplitNormalized = path.normalize(handler.filePath).split(path.sep);
  const moduleDirSplitNormalized = path.normalize(nodeModulesDir).split(path.sep);
  let firstNonSharedIndex = 0;
  while (filePathSplitNormalized[firstNonSharedIndex] === moduleDirSplitNormalized[firstNonSharedIndex]) {
    firstNonSharedIndex++;
  }
  const linkSource = path.join('..', ...filePathSplitNormalized.slice(firstNonSharedIndex));
  const linkTarget = path.join(nodeModulesDir, `${moduleName}.js`);
  const folderTarget = path.join(nodeModulesDir, moduleName);
  let [existingTarget: string, directoryExists: boolean] = await genAllNullable(
    readSymlinkTarget(linkTarget),
    exists(folderTarget),
  );
  if (directoryExists) {
    throw new ModuleError(
      `A file or directory at ${folderTarget} already exists which would cause a naming conflict with ` +
        `${linkTarget}.  Refusing to create the link.`,
    );
  }
  if (existingTarget && !await exists(path.resolve(nodeModulesDir, existingTarget))) {
    await unlink(linkTarget, handler);
    existingTarget = null;
  }
  if (existingTarget) {
    if (existingTarget !== linkSource) {
      throw new ModuleError(
        `link to ${linkTarget} already exists pointing to ${existingTarget}.  ` +
          `Cowardly refusing to replacing it with ${linkSource}.`,
      );
    }
  } else {
    await linkFile(linkSource, linkTarget, moduleName, handler);
  }
}

function timeout(timer: number) {
  return new Promise(resolve => setTimeout(resolve, timer));
}

async function cleanModule(handler: FileHandler) {
  const moduleDir = await handler.getNearestNodeModulesDir();
  if (!moduleDir) {
    return;
  }
  const [files: Array<string>, moduleName, moduleMap] = await Promise.all([
    genEnforce(readdir(moduleDir)),
    genNullable(handler.getModuleName()),
    handler.getModuleMap(),
  ]);
  const normalizedFileToRemove = path.normalize(handler.filePath);
  await Promise.all(
    files.map(async fileName => {
      const filePath = path.join(moduleDir, fileName);
      const target = await readSymlinkTarget(filePath);
      if (!target) {
        return;
      }
      if (path.normalize(path.join(moduleDir, target)) === normalizedFileToRemove) {
        // old symlink, probably re-named the module
        if (!moduleName || fileName !== `${moduleName}.js`) {
          await unlink(filePath, handler);
        }
      }
    }),
  );
}

function catchError(type, err) {
  const errPrefix = err instanceof ModuleError ? '' : `uncaught ${type}: `;

  if (shouldNotify) {
    notifier.notify({
      title: 'Global Modules Error',
      message: err.message,
    });
  }
  console.error(`${errPrefix}${err}`);
  console.log(err);
}

process.on('uncaughtException', function(err) {
  catchError('exception', err);
});

process.on('unhandledRejection', function(reason, p) {
  catchError('promise rejection', reason);
});
