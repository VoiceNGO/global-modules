// @flow

const { genNullable } = require('node-utils').genAwait;
const { access, lstat, readlink, symlink } = require('node-utils').fsAsync;
import ModuleError from './module-error';

export async function readSymlinkTarget(filePath: string): Promise<?string> {
  if (!await exists(filePath)) {
    return null;
  }

  const stat = await lstat(filePath);
  if (!stat.isSymbolicLink()) {
    return null;
  }

  return readlink(filePath);
}

export async function linkFile(source: string, target: string) {
  try {
    symlink(source, target);
  } catch (err) {
    throw new ModuleError(`Could not create symlink because ${err}.`);
  }
}

export async function exists(path: string): Promise<boolean> {
  const hasStats = await genNullable(lstat(path));
  return hasStats !== null;
}
