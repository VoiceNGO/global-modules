'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = ModuleError;
function ModuleError(message /*: string*/) {
  Error.captureStackTrace(this, this.constructor);
  this.name = this.constructor.name;
  this.message = message;
}

require('util').inherits(ModuleError, Error);