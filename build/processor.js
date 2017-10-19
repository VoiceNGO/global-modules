'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _builtinModules = require('builtin-modules');

var _builtinModules2 = _interopRequireDefault(_builtinModules);

var _nodeNotifier = require('node-notifier');

var _nodeNotifier2 = _interopRequireDefault(_nodeNotifier);

var _fileHandler = require('./file-handler');

var _fileHandler2 = _interopRequireDefault(_fileHandler);

var _moduleError = require('./module-error');

var _moduleError2 = _interopRequireDefault(_moduleError);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const { genNullable, genEnforce, genAllEnforce, genAllNullable } = require('node-utils').genAwait;

const { access, lstat, mkdir, readdir, readFile, readlink, unlink: origUnlink } = require('node-utils').fsAsync;

const { exists, linkFile: origLinkFile, readSymlinkTarget } = require('./fs-utils');


const shouldNotify /*: boolean*/ = require('minimist')(process.argv.slice(2)).nofity;

/*:: import type { Stats } from 'fs';*/

exports.default = async function (filePath /*: string*/) {
  const handler = new _fileHandler2.default(filePath);

  if (!(await handler.exists())) {
    await cleanModule(handler);
    return;
  }

  if (!(await handler.canProcess())) {
    return;
  }

  const moduleName = await handler.getModuleName();
  if (moduleName) {
    if (!(await handler.getOrCreateNearestNodeModulesDir())) {
      throw new _moduleError2.default(`Unable to find an appropriate node_modules directory for ${filePath}.`);
    }

    await addModule(handler);
  }
  await cleanModule(handler);
};

async function unlink(filePath /*: string*/, handler /*: FileHandler*/) {
  const moduleMap = await handler.getModuleMap();
  await Promise.all([moduleMap.removeLinkToTarget(filePath), origUnlink(filePath)]);
}

async function linkFile(linkSource /*: string*/, linkTarget /*: string*/, moduleName /*: string*/, handler /*: FileHandler*/) {
  const moduleMap = await handler.getModuleMap();
  await Promise.all([moduleMap.add(moduleName, linkSource), origLinkFile(linkSource, linkTarget)]);
}

async function addModule(handler /*: FileHandler*/) {
  const [nodeModulesDir, moduleName] = await genAllEnforce(handler.getNearestNodeModulesDir(), handler.getModuleName());
  if (~_builtinModules2.default.indexOf(moduleName)) {
    throw new _moduleError2.default(`${moduleName} is the name of a builtin node module.  Refusing to create a symlink of the same name.`);
  }
  const filePathSplitNormalized = _path2.default.normalize(handler.filePath).split(_path2.default.sep);
  const moduleDirSplitNormalized = _path2.default.normalize(nodeModulesDir).split(_path2.default.sep);
  let firstNonSharedIndex = 0;
  while (filePathSplitNormalized[firstNonSharedIndex] === moduleDirSplitNormalized[firstNonSharedIndex]) {
    firstNonSharedIndex++;
  }
  const linkSource = _path2.default.join('..', ...filePathSplitNormalized.slice(firstNonSharedIndex));
  const linkTarget = _path2.default.join(nodeModulesDir, `${moduleName}.js`);
  const folderTarget = _path2.default.join(nodeModulesDir, moduleName);
  let [existingTarget, directoryExists] = await genAllNullable(readSymlinkTarget(linkTarget), exists(folderTarget));
  if (directoryExists) {
    throw new _moduleError2.default(`A file or directory at ${folderTarget} already exists which would cause a naming conflict with ` + `${linkTarget}.  Refusing to create the link.`);
  }
  if (existingTarget && !(await exists(_path2.default.resolve(nodeModulesDir, existingTarget)))) {
    await unlink(linkTarget, handler);
    existingTarget = null;
  }
  if (existingTarget) {
    if (existingTarget !== linkSource) {
      throw new _moduleError2.default(`link to ${linkTarget} already exists pointing to ${existingTarget}.  ` + `Cowardly refusing to replacing it with ${linkSource}.`);
    }
  } else {
    await linkFile(linkSource, linkTarget, moduleName, handler);
  }
}

function timeout(timer /*: number*/) {
  return new Promise(resolve => setTimeout(resolve, timer));
}

async function cleanModule(handler /*: FileHandler*/) {
  const moduleDir = await handler.getNearestNodeModulesDir();
  if (!moduleDir) {
    return;
  }
  const [files, moduleName, moduleMap] = await Promise.all([genEnforce(readdir(moduleDir)), genNullable(handler.getModuleName()), handler.getModuleMap()]);
  const normalizedFileToRemove = _path2.default.normalize(handler.filePath);
  await Promise.all(files.map(async fileName => {
    const filePath = _path2.default.join(moduleDir, fileName);
    const target = await readSymlinkTarget(filePath);
    if (!target) {
      return;
    }
    if (_path2.default.normalize(_path2.default.join(moduleDir, target)) === normalizedFileToRemove) {
      // old symlink, probably re-named the module
      if (!moduleName || fileName !== `${moduleName}.js`) {
        await unlink(filePath, handler);
      }
    }
  }));
}

function catchError(type, err) {
  const errPrefix = err instanceof _moduleError2.default ? '' : `uncaught ${type}: `;

  if (shouldNotify) {
    _nodeNotifier2.default.notify({
      title: 'Global Modules Error',
      message: err.message
    });
  }
  console.error(`${errPrefix}${err}`);
  console.log(err);
}

process.on('uncaughtException', function (err) {
  catchError('exception', err);
});

process.on('unhandledRejection', function (reason, p) {
  catchError('promise rejection', reason);
});