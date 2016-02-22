'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = errorHandler;

var _feathersErrors = require('feathers-errors');

var _feathersErrors2 = _interopRequireDefault(_feathersErrors);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function errorHandler(error) {
  var feathersError = error;

  // NOTE (EK): The list of error code is way too massive to map
  // them to a specific error object so we'll use a generic one.
  // See https://github.com/mongodb/mongo/blob/master/docs/errors.md

  if (error.name === 'MongoError') {
    feathersError = new _feathersErrors2.default.GeneralError(error, {
      ok: error.ok,
      code: error.code
    });
  }

  throw feathersError;
}
module.exports = exports['default'];