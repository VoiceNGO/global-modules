'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.readSymlinkTarget = readSymlinkTarget;
exports.linkFile = linkFile;
exports.exists = exists;

var _moduleError = require('./module-error');

var _moduleError2 = _interopRequireDefault(_moduleError);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const { genNullable } = require('node-utils').genAwait;
const { access, lstat, readlink, symlink } = require('node-utils').fsAsync;
async function readSymlinkTarget(filePath /*: string*/) /*: Promise<?string>*/ {
  if (!(await exists(filePath))) {
    return null;
  }

  const stat = await lstat(filePath);
  if (!stat.isSymbolicLink()) {
    return null;
  }

  return readlink(filePath);
}

async function linkFile(source /*: string*/, target /*: string*/) {
  try {
    symlink(source, target);
  } catch (err) {
    throw new _moduleError2.default(`Could not create symlink because ${err}.`);
  }
}

async function exists(path /*: string*/) /*: Promise<boolean>*/ {
  const hasStats = await genNullable(lstat(path));
  return hasStats !== null;
}