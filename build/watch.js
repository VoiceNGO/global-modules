'use strict';

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _processor = require('./processor');

var _nodeUtils = require('node-utils');

var _flowTypes = require('flow-types');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

async function onCreateOrModify(file, root = (0, _flowTypes.toTAbsolutePath)('/')) {
  await (0, _processor.processFile)(_path2.default.resolve(root, file.name));
}

async function onDestroy(file, root = (0, _flowTypes.toTAbsolutePath)('/')) {
  const filePath = _path2.default.resolve(root, file.name);
  await (0, _processor.deleteLinksTo)(filePath);
}

module.exports = async (folder, filePattern) => {
  const emitter = await (0, _nodeUtils.watchman)(folder, filePattern);

  if (!emitter) {
    throw new Error(`failed to create watch on ${folder}`);
  }

  emitter.on('createOrModify', onCreateOrModify).on('destroy', onDestroy);
};