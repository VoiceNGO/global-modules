// @flow

declare function after(callback: Function): void;
declare function afterEach(callback: Function): void;
declare function before(callback: Function): void;
declare function beforeEach(callback: Function): void;
declare function describe(name: string, callback: Function): void;
declare function test(name: string, callback: Function): void;

import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { processFile } from '../src/processor';
import { genAwait } from 'node-utils';
import { readSymlinkTarget, exists } from '../src/fs-utils';
import expect from 'expect';

import type { tAbsolutePath } from 'flow-types';

const { genAllNull } = genAwait;
const [writeFile, unlink] = [fs.writeFile, fs.unlink].map(promisify);

function srcPath(fileName: string): tAbsolutePath {
  return path.resolve(`./${fileName}`);
}

function nodeModulesPath(fileName: string): tAbsolutePath {
  return path.resolve('node_modules', `${fileName}.js`);
}

async function createFile(fileName: string, moduleName: string) {
  await writeFile(srcPath(fileName), moduleName ? `// @providesModule ${moduleName}` : '');
  await processFile(srcPath(fileName));
}

async function isSymlinkedTo(linkName: string, expectedTarget: string): Promise<boolean> {
  const target = await readSymlinkTarget(nodeModulesPath(linkName));
  return target === path.join('..', expectedTarget);
}

function symlinkExists(linkName: string): Promise<boolean> {
  return exists(nodeModulesPath(linkName));
}

async function deleteFile(fileName: string) {
  await unlink(srcPath(fileName));
  await processFile(srcPath(fileName));
}

describe('Symlinks', () => {
  afterEach(async () => {
    try {
      await genAllNull(
        unlink(srcPath('foo.js')),
        unlink(srcPath('bar.js')),
        unlink(nodeModulesPath('foo')),
        unlink(nodeModulesPath('bar')),
      );
    } catch (err) {
      // intentionally empty
    }
  });

  test('symlinks modules', async () => {
    await createFile('foo.js', 'foo');

    expect(await isSymlinkedTo('foo', 'foo.js')).toBe(true);
  });

  test('will not overwrite one module with another', async () => {
    await createFile('foo.js', 'foo');
    await createFile('bar.js', 'foo');

    expect(await isSymlinkedTo('foo', 'foo.js')).toBe(true);
  });

  test('will not link modules that already exist', async () => {
    await createFile('foo.js', 'mocha');

    expect(await symlinkExists('mocha')).toBe(false);
  });

  test('will not link modules that conflict with core node modules', async () => {
    await createFile('foo.js', 'fs');

    expect(await symlinkExists('fs')).toBe(false);
  });

  test('will delete a symlink when module reference is removed', async () => {
    await createFile('foo.js', 'foo');
    await createFile('foo.js', '');

    expect(await symlinkExists('foo')).toBe(false);
  });

  test('will delete a symlink when file is deleted', async () => {
    await createFile('foo.js', 'foo');
    await deleteFile('foo.js');

    expect(await symlinkExists('foo')).toBe(false);
  });

  test('will delete and re-create a symlink when module reference is changed', async () => {
    await createFile('foo.js', 'foo');
    await createFile('foo.js', 'bar');

    expect(await isSymlinkedTo('bar', 'foo.js')).toBe(true);
    expect(await symlinkExists('foo')).toBe(false);
  });
});
