// @flow

import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { genNullable, genEnforce, genAllEnforce, genAllNullable } from 'gen-await';
import builtinModules from 'builtin-modules';
import notifier from 'node-notifier';

import FileHandler from './file-handler';
import { exists, linkFile, readSymlinkTarget } from './fs-utils';
import ModuleError from './module-error';

const shouldNotify: boolean = require('minimist')(process.argv.slice(2)).nofity;

const [access, lstat, mkdir, readdir, readFile, readlink, symlink, unlink] = [
  fs.access,
  fs.lstat,
  fs.mkdir,
  fs.readdir,
  fs.readFile,
  fs.readlink,
  fs.symlink,
  fs.unlink,
].map(promisify);

import type { Stats } from 'fs';

export default async function(filePath: string) {
  const handler = new FileHandler(filePath);

  if (!await handler.exists()) {
    cleanModule(handler);
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

    addModule(handler);
  }
  cleanModule(handler);
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

  if (existingTarget && !await exists(existingTarget)) {
    unlink(linkTarget);
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
    linkFile(linkSource, linkTarget);
  }
}

async function cleanModule(handler: FileHandler) {
  const moduleDir = await handler.getNearestNodeModulesDir();

  if (!moduleDir) {
    return;
  }
  const [files: Array<string>, moduleName] = await Promise.all([
    genEnforce(readdir(moduleDir)),
    genNullable(handler.getModuleName()),
  ]);
  const normalizedFileToRemove = path.normalize(handler.filePath);

  files.forEach(async fileName => {
    const filePath = path.join(moduleDir, fileName);

    const target = await readSymlinkTarget(filePath);
    if (!target) {
      return;
    }

    if (path.normalize(path.join(moduleDir, target)) === normalizedFileToRemove) {
      // old symlink, probably re-named the module
      if (!moduleName || fileName !== `${moduleName}.js`) {
        unlink(filePath);
      }
    }
  });
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
