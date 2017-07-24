// @flow

export default function ModuleError(message: string) {
  Error.captureStackTrace(this, this.constructor);
  this.name = this.constructor.name;
  this.message = message;
}

require('util').inherits(ModuleError, Error);
