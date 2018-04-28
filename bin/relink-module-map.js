#!/usr/bin/env node
// @flow

const path = require('path');
const argv = require('minimist')(process.argv.slice(2));
const Err = require('node-utils').Err;
const relink = require('..').relinkModuleMap;
const inputFolder = argv._[0];

if (!inputFolder) {
  /* eslint-disable no-console */
  console.error(`Usage: ${path.basename(__filename)} pathToProjectRoot`);
  process.exit(1);
}

async function run() {
  const projectRoot = path.resolve(process.cwd(), inputFolder);
  try {
    await relink(projectRoot);
  } catch (err) {
    console.error(`Failed to link all files in ${projectRoot}.  Error:`, Err.printable(err));
    process.exit(1);
  }

  console.log(`Re-linked all files in ${projectRoot}`);
}

run();
