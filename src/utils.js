import { ObjectID } from 'mongodb';

export function multiOptions(id, params, idField = '_id') {
  let query = Object.assign({}, params.query);
  let options = Object.assign({ multi: true }, params.options);

  if(id !== null) {
    options.multi = false;
    query[idField] = objectifyId(id, idField);
  }

  return { query, options };
}

export function getSelect(select) {
  if(Array.isArray(select)) {
    var result = {};
    select.forEach(name => result[name] = 1);
    return result;
  }

  return select;
}

export function objectifyId(id, idField) {
  if (idField === '_id' && ObjectID.isValid(id)) {
    id = new ObjectID(id.toString());
  }

  return id;
}