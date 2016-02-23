if(!global._babelPolyfill) { require('babel-polyfill'); }

import Proto from 'uberproto';
import filter from 'feathers-query-filters';
import errors from 'feathers-errors';
import errorHandler from './error-handler';
import { getSelect, multiOptions, objectifyId } from './utils';

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
    this.paginate = options.paginate || {};
  }

  extend(obj) {
    return Proto.extend(obj, this);
  }

  _find(params, count, getFilter = filter) {
    // Start with finding all, and limit when necessary.
    let query = this.Model.find(params.query);
    let filters = getFilter(params.query|| {});

    // $select uses a specific find syntax, so it has to come first.
    if (filters.$select) {
      query = this.Model.find(params.query, getSelect(filters.$select));
    }

    // Handle $sort
    if (filters.$sort){
      query.sort(filters.$sort);
    }

    // Handle $limit
    if (filters.$limit){
      query.limit(filters.$limit);
    }

    // Handle $skip
    if (filters.$skip){
      query.skip(filters.$skip);
    }

    const runQuery = total => {
      return query.toArray().then(data => {
        return {
          total,
          limit: filters.$limit,
          skip: filters.$skip || 0,
          data
        };
      });
    };
    
    if (count) {
      return this.Model.count(params.query).then(runQuery);
    }
    
    return runQuery();
  }
  
  find(params) {
    const paginate = !!this.paginate.default;
    const result = this._find(params, paginate, query => filter(query, this.paginate));
    
    if(!paginate) {
      return result.then(page => page.data);
    }
    
    return result;
  }

  _get(id) {
    id = objectifyId(id, this.id);

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
    return this.Model.insert(data).then(result => {
      return result.ops.length > 1 ? result.ops : result.ops[0];
    }).catch(errorHandler);
  }

  patch(id, data, params) {
    let { query, options } = multiOptions(id, params, this.id);

    // We can not update the id
    delete data[this.id];

    // Run the query
    return this.Model
        .update(query, { $set: data }, options)
        .then(() => this._findOrGet(id, params));
  }

  update(id, data, params) {
    if(Array.isArray(data) || id === null) {
      return Promise.reject('Not replacing multiple records. Did you mean `patch`?');
    }

    let { query, options } = multiOptions(id, params, this.id);

    // We can not update the id, but it must be set to its previous value
    data[this.id] = id;

    return this.Model
        .update(query, data, options)
        .then(() => this._findOrGet(id))
        .catch(errorHandler);
  }

  remove(id, params) {
    let { query, options } = multiOptions(id, params, this.id);

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
