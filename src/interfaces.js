// @flow

import type { tAbsolutePath, tModuleName } from 'flow-types';

export interface IModuleMap {
  constructor(projectRoot: tAbsolutePath): void;
  canAdd(moduleName: tModuleName, modulePath: tAbsolutePath): Promise<true | string>;
  add(moduleName: tModuleName, modulePath: tAbsolutePath): Promise<void>;
  removeModule(moduleName: tModuleName): Promise<void>;
}
