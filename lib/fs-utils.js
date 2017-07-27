'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.readSymlinkTarget = readSymlinkTarget;
exports.linkFile = linkFile;
exports.exists = exists;

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _util = require('util');

var _genAwait = require('gen-await');

var _moduleError = require('./module-error');

var _moduleError2 = _interopRequireDefault(_moduleError);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const [access, lstat, readlink, symlink] = [_fs2.default.access, _fs2.default.lstat, _fs2.default.readlink, _fs2.default.symlink].map(_util.promisify);

async function readSymlinkTarget(filePath) {
  if (!(await exists(filePath))) {
    return null;
  }

  const stat = await lstat(filePath);
  if (!stat.isSymbolicLink()) {
    return null;
  }

  return readlink(filePath);
}

async function linkFile(source, target) {
  try {
    console.log(symlink);
    symlink(source, target);
  } catch (err) {
    throw new _moduleError2.default(`Could not create symlink because ${err}.`);
  }
}

async function exists(path) {
  const hasStats = await (0, _genAwait.genNullable)(lstat(path));
  return hasStats !== null;
}