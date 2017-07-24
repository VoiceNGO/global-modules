// @flow

import fs from 'fs';
import { promisify } from 'util';

import { genNullable } from 'gen-await';
import ModuleError from './module-error';

const [access, lstat, readlink, symlink] = [fs.access, fs.lstat, fs.readlink, fs.symlink].map(promisify);

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
    console.log(symlink);
    symlink(source, target);
  } catch (err) {
    throw new ModuleError(`Could not create symlink because ${err}.`);
  }
}

export async function exists(path: string): Promise<boolean> {
  const hasStats = await genNullable(lstat(path));
  return hasStats !== null;
}
