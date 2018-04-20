// @flow

import path from 'path';

import { deleteLinksTo, processFile } from './processor';
import { watchman } from 'node-utils';

import type { tAbsolutePath } from 'flow-types';
import { toTAbsolutePath } from 'flow-types';

async function onCreateOrModify(file: Object, root?: tAbsolutePath = toTAbsolutePath('/')) {
  await processFile(path.resolve(root, file.name));
}

async function onDestroy(file: Object, root?: tAbsolutePath = toTAbsolutePath('/')) {
  const filePath = path.resolve(root, file.name);
  await deleteLinksTo(filePath);
}

module.exports = async (folder: tAbsolutePath, filePattern?: string) => {
  const emitter = await watchman(folder, filePattern);

  if (!emitter) {
    throw new Error(`failed to create watch on ${folder}`);
  }

  emitter.on('createOrModify', onCreateOrModify).on('destroy', onDestroy);
};
