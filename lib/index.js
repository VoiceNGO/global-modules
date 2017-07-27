'use strict';

var _processor = require('./processor');

var _processor2 = _interopRequireDefault(_processor);

var _argFilenames = require('./arg-filenames');

var _argFilenames2 = _interopRequireDefault(_argFilenames);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

_argFilenames2.default.forEach(_processor2.default);