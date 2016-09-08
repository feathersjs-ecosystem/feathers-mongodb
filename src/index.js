import omit from 'lodash.omit';
import { ObjectID } from 'mongodb';
import Proto from 'uberproto';
import filter from 'feathers-query-filters';
import errors from 'feathers-errors';
import errorHandler from './error-handler';

// Create the service.
class Service {
  constructor(options) {
    if (!options) {
      throw new Error('MongoDB options have to be provided');
    }

    if (!options.Model) {
      throw new Error('MongoDB collection `Model` needs to be provided');
    }

    this.Model = options.Model;
    this.id = options.id || '_id';
    this.events = options.events || [];
    this.paginate = options.paginate || {};
  }

  extend(obj) {
    return Proto.extend(obj, this);
  }

  _objectifyId(id) {
    if (this.id === '_id' && ObjectID.isValid(id)) {
      id = new ObjectID(id.toString());
    }

    return id;
  }

  _multiOptions(id, params) {
    let query = Object.assign({}, params.query);
    let options = Object.assign({ multi: true }, params.options);

    if (id !== null) {
      options.multi = false;
      query[this.id] = this._objectifyId(id);
    }

    return { query, options };
  }

  _getSelect(select) {
    if (Array.isArray(select)) {
      var result = {};
      select.forEach(name => result[name] = 1);
      return result;
    }

    return select;
  }

  _find(params, count, getFilter = filter) {
    // Start with finding all, and limit when necessary.
    let { filters, query } = getFilter(params.query|| {});
    let q = this.Model.find(query);

    if (filters.$select) {
      q = this.Model.find(query, this._getSelect(filters.$select));
    }

    if (filters.$sort){
      q.sort(filters.$sort);
    }

    if (filters.$limit){
      q.limit(filters.$limit);
    }

    if (filters.$skip){
      q.skip(filters.$skip);
    }

    const runQuery = total => {
      return q.toArray().then(data => {
        return {
          total,
          limit: filters.$limit,
          skip: filters.$skip || 0,
          data
        };
      });
    };

    if (count) {
      return this.Model.count(query).then(runQuery);
    }

    return runQuery();
  }

  find(params) {
    const paginate = (params && typeof params.paginate !== 'undefined') ?
      params.paginate : this.paginate;
    const result = this._find(params, !!paginate.default,
      query => filter(query, paginate)
    );

    if(!paginate.default) {
      return result.then(page => page.data);
    }

    return result;
  }

  _get(id) {
    id = this._objectifyId(id);

    return this.Model.findOne({ [this.id]: id })
      .then(data => {
        if (!data) {
          throw new errors.NotFound(`No record found for id '${id}'`);
        }

        return data;
      })
      .catch(errorHandler);
  }

  get(id, params) {
    return this._get(id, params);
  }

  _findOrGet(id, params) {
    if(id === null) {
      return this._find(params).then(page => page.data);
    }

    return this._get(id, params);
  }

  create(data) {
    const entry = Object.assign({}, data);

    // Generate a MongoId if we use a custom id
    if(this.id !== '_id' && typeof entry[this.id] === 'undefined') {
      entry[this.id] = new ObjectID().toHexString();
    }

    return this.Model.insert(entry)
      .then(result => result.ops.length > 1 ? result.ops : result.ops[0])
      .catch(errorHandler);
  }

  _normalizeId(id, data) {
    if (this.id === '_id') {
      // Default Mongo IDs cannot be updated. The Mongo library handles
      // this automatically.
      return omit(data, this.id);
    } else {
      // If not using the default Mongo _id field set the ID to its
      // previous value. This prevents orphaned documents.
      return Object.assign({}, data, { [this.id]: id });
    }
  }

  patch(id, data, params) {
    let { query, options } = this._multiOptions(id, params);

    // Run the query
    return this.Model
        .update(query, { $set: this._normalizeId(id, data) }, options)
        .then(() => this._findOrGet(id, params));
  }

  update(id, data, params) {
    if(Array.isArray(data) || id === null) {
      return Promise.reject('Not replacing multiple records. Did you mean `patch`?');
    }

    let { query, options } = this._multiOptions(id, params);

    return this.Model
        .update(query, this._normalizeId(id, data), options)
        .then(() => this._findOrGet(id))
        .catch(errorHandler);
  }

  remove(id, params) {
    let { query, options } = this._multiOptions(id, params);

    return this._findOrGet(id, params).then(items => {
      return this.Model
          .remove(query, options)
          .then(() => items)
          .catch(errorHandler);
    });
  }
}

export default function init(options) {
  return new Service(options);
}

init.Service = Service;
