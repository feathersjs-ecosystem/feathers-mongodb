'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.multiOptions = multiOptions;
exports.getSelect = getSelect;
exports.objectifyId = objectifyId;

var _mongodb = require('mongodb');

function multiOptions(id, params) {
  var idField = arguments.length <= 2 || arguments[2] === undefined ? '_id' : arguments[2];

  var query = Object.assign({}, params.query);
  var options = Object.assign({ multi: true }, params.options);

  if (id !== null) {
    options.multi = false;
    query[idField] = objectifyId(id, idField);
  }

  return { query: query, options: options };
}

function getSelect(select) {
  if (Array.isArray(select)) {
    var result = {};
    select.forEach(function (name) {
      return result[name] = 1;
    });
    return result;
  }

  return select;
}

function objectifyId(id, idField) {
  if (idField === '_id' && _mongodb.ObjectID.isValid(id)) {
    id = new _mongodb.ObjectID(id.toString());
  }

  return id;
}