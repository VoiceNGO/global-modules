// @flow

const processor = require('./processor');
const fileNames = require('./arg-filenames');
fileNames.forEach(processor);
