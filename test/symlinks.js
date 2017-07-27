// @flow

declare function after(callback: Function): void;
declare function afterEach(callback: Function): void;
declare function before(callback: Function): void;
declare function beforeEach(callback: Function): void;
declare function describe(name: string, callback: Function): void;
declare function it(name: string, callback: Function): void;

import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import should from 'should';
import processor from '../src/processor';
import { genAllNullable } from 'gen-await';

import { readSymlinkTarget, exists } from '../src/fs-utils';
const [writeFile, unlink] = [fs.writeFile, fs.unlink].map(promisify);

function srcPath(fileName: string): string {
  return `./${fileName}`;
}

function nodeModulesPath(fileName: string): string {
  return path.join('node_modules', `${fileName}.js`);
}

async function createFile(fileName: string, moduleName: string) {
  await writeFile(srcPath(fileName), moduleName ? `// @providesModule ${moduleName}` : '');
  await processFile(srcPath(fileName));
}

async function isSymlinkedTo(linkName: string, expectedTarget: string): Promise<boolean> {
  const target = await readSymlinkTarget(nodeModulesPath(linkName));
  return target === path.join('..', expectedTarget);
}

async function symlinkExists(linkName: string): Promise<boolean> {
  return await exists(nodeModulesPath(linkName));
}

async function deleteFile(fileName: string) {
  await unlink(srcPath(fileName));
  await processFile(srcPath(fileName));
}

async function processFile(fileName: string) {
  try {
    await processor(fileName);
  } catch (err) {}
}

describe('Symlinks', () => {
  afterEach(async () => {
    try {
      await genAllNullable(
        unlink(srcPath('foo.js')),
        unlink(srcPath('bar.js')),
        unlink(nodeModulesPath('foo')),
        unlink(nodeModulesPath('bar')),
      );
    } catch (err) {}
  });

  it('symlinks modules', async () => {
    await createFile('foo.js', 'foo');

    (await isSymlinkedTo('foo', 'foo.js')).should.be.true();
  });

  it('will not overwrite one module with another', async () => {
    await createFile('foo.js', 'foo');
    await createFile('bar.js', 'foo');

    (await isSymlinkedTo('foo', 'foo.js')).should.be.true();
  });

  it('will not link modules that already exist', async () => {
    await createFile('foo.js', 'mocha');

    (await symlinkExists('mocha')).should.be.false();
  });

  it('will not link modules that conflict with core node modules', async () => {
    await createFile('foo.js', 'fs');
    await createFile('bar.js', 'fs');

    (await symlinkExists('fs')).should.be.false();
  });

  it('will delete a symlink when module reference is removed', async () => {
    await createFile('foo.js', 'foo');
    await createFile('foo.js', '');

    (await symlinkExists('foo')).should.be.false();
  });

  it('will delete a symlink when file is deleted', async () => {
    await createFile('foo.js', 'foo');
    await deleteFile('foo.js');

    (await symlinkExists('foo')).should.be.false();
  });

  it('will delete and re-create a symlink when module reference is changed', async () => {
    await createFile('foo.js', 'foo');
    await createFile('foo.js', 'bar');

    (await isSymlinkedTo('bar', 'foo.js')).should.be.true();
    (await symlinkExists('foo')).should.be.false();
  });
});
