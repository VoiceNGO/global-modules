'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});

var _util = require('util');

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _genAwait = require('gen-await');

var _builtinModules = require('builtin-modules');

var _builtinModules2 = _interopRequireDefault(_builtinModules);

var _nodeNotifier = require('node-notifier');

var _nodeNotifier2 = _interopRequireDefault(_nodeNotifier);

var _fileHandler = require('./file-handler');

var _fileHandler2 = _interopRequireDefault(_fileHandler);

var _fsUtils = require('./fs-utils');

var _moduleError = require('./module-error');

var _moduleError2 = _interopRequireDefault(_moduleError);

function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : { default: obj };
}

const shouldNotify = require('minimist')(process.argv.slice(2)).nofity;

const [access, lstat, mkdir, readdir, readFile, readlink, symlink, unlink] = [
  _fs2.default.access,
  _fs2.default.lstat,
  _fs2.default.mkdir,
  _fs2.default.readdir,
  _fs2.default.readFile,
  _fs2.default.readlink,
  _fs2.default.symlink,
  _fs2.default.unlink,
].map(_util.promisify);

exports.default = async function(filePath) {
  const handler = new _fileHandler2.default(filePath);

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
      throw new _moduleError2.default(`Unable to find an appropriate node_modules directory for ${filePath}.`);
    }

    addModule(handler);
  }
  cleanModule(handler);
};

async function addModule(handler) {
  const [nodeModulesDir, moduleName] = await (0, _genAwait.genAllEnforce)(
    handler.getNearestNodeModulesDir(),
    handler.getModuleName(),
  );

  if (~_builtinModules2.default.indexOf(moduleName)) {
    throw new _moduleError2.default(
      `${moduleName} is the name of a builtin node module.  Refusing to create a symlink of the same name.`,
    );
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

  let [existingTarget, directoryExists] = await (0, _genAwait.genAllNullable)(
    (0, _fsUtils.readSymlinkTarget)(linkTarget),
    (0, _fsUtils.exists)(folderTarget),
  );

  if (directoryExists) {
    throw new _moduleError2.default(
      `A file or directory at ${folderTarget} already exists which would cause a naming conflict with ` +
        `${linkTarget}.  Refusing to create the link.`,
    );
  }

  if (existingTarget && !await (0, _fsUtils.exists)(existingTarget)) {
    unlink(linkTarget);
    existingTarget = null;
  }

  if (existingTarget) {
    if (existingTarget !== linkSource) {
      throw new _moduleError2.default(
        `link to ${linkTarget} already exists pointing to ${existingTarget}.  ` +
          `Cowardly refusing to replacing it with ${linkSource}.`,
      );
    }
  } else {
    (0, _fsUtils.linkFile)(linkSource, linkTarget);
  }
}

async function cleanModule(handler) {
  const moduleDir = await handler.getNearestNodeModulesDir();

  if (!moduleDir) {
    return;
  }
  const [files, moduleName] = await Promise.all([
    (0, _genAwait.genEnforce)(readdir(moduleDir)),
    (0, _genAwait.genNullable)(handler.getModuleName()),
  ]);
  const normalizedFileToRemove = _path2.default.normalize(handler.filePath);

  files.forEach(async fileName => {
    const filePath = _path2.default.join(moduleDir, fileName);

    const target = await (0, _fsUtils.readSymlinkTarget)(filePath);
    if (!target) {
      return;
    }

    if (_path2.default.normalize(_path2.default.join(moduleDir, target)) === normalizedFileToRemove) {
      // old symlink, probably re-named the module
      if (!moduleName || fileName !== `${moduleName}.js`) {
        unlink(filePath);
      }
    }
  });
}

function catchError(type, err) {
  const errPrefix = err instanceof _moduleError2.default ? '' : `uncaught ${type}: `;

  if (shouldNotify) {
    _nodeNotifier2.default.notify({
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
