const ObjectID = require('mongodb').ObjectID || require('mongodb').ObjectId;
const errors = require('@feathersjs/errors');
const { _ } = require('@feathersjs/commons');
const { AdapterService, select } = require('@feathersjs/adapter-commons');

const errorHandler = require('./error-handler');

// Create the service.
class Service extends AdapterService {
  constructor (options) {
    if (!options) {
      throw new Error('MongoDB options have to be provided');
    }

    super(Object.assign({
      id: '_id'
    }, options));
  }

  get Model () {
    return this.options.Model;
  }

  set Model (value) {
    this.options.Model = value;
  }

  _objectifyId (id) {
    if (this.options.disableObjectify) {
      return id;
    }

    if (this.id === '_id' && ObjectID.isValid(id)) {
      id = new ObjectID(id.toString());
    }

    return id;
  }

  _multiOptions (id, params = {}) {
    const { query } = this.filterQuery(params);
    const options = Object.assign({ multi: true }, params.mongodb || params.options);

    if (id !== null) {
      options.multi = false;
      query.$and = (query.$and || []).concat({ [this.id]: this._objectifyId(id) });
    }

    return { query, options };
  }

  _options (params = {}) {
    const { filters, query, paginate } = this.filterQuery(params);
    const options = Object.assign({}, params.mongodb || params.options);
    return { filters, query, paginate, options };
  }

  _getSelect (select) {
    if (Array.isArray(select)) {
      const result = {};
      select.forEach(name => {
        result[name] = 1;
      });
      return result;
    }

    return select;
  }

  _findOrGet (id, params = {}) {
    if (id === null) {
      return this._find(params);
    }

    return this._get(id, params);
  }

  _normalizeId (id, data) {
    if (this.id === '_id') {
      // Default Mongo IDs cannot be updated. The Mongo library handles
      // this automatically.
      return _.omit(data, this.id);
    } else if (id !== null) {
      // If not using the default Mongo _id field set the ID to its
      // previous value. This prevents orphaned documents.
      return Object.assign({}, data, { [this.id]: id });
    }
    return data;
  }

  // Map stray records into $set
  _remapModifiers (data) {
    let set = {};
    // Step through the rooot
    for (const key in data) {
      // Check for keys that aren't modifiers
      if (key.charAt(0) !== '$') {
        // Move them to set, and remove their record
        set[key] = data[key];
        delete data[key];
      }
      // If the '$set' modifier is used, add that to the temp variable
      if (key === '$set') {
        set = Object.assign(set, data[key]);
        delete data[key];
      }
    }
    // If we have a $set, then attach to the data object
    if (Object.keys(set).length > 0) {
      data.$set = set;
    }
    return data;
  }

  _find (params = {}) {
    // Start with finding all, and limit when necessary.
    const { filters, query, paginate, options } = this._options(params);

    if (query[this.id]) {
      query[this.id] = this._objectifyId(query[this.id]);
    }

    const q = this.Model.find(query, options);

    if (filters.$select) {
      q.project(this._getSelect(filters.$select));
    }

    if (filters.$sort) {
      q.sort(filters.$sort);
    }

    if (params.collation) {
      q.collation(params.collation);
    }

    if (params.hint) {
      q.hint(params.hint);
    }

    if (filters.$limit) {
      q.limit(filters.$limit);
    }

    if (filters.$skip) {
      q.skip(filters.$skip);
    }

    let runQuery = total => {
      return q.toArray().then(data => {
        return {
          total,
          limit: filters.$limit,
          skip: filters.$skip || 0,
          data
        };
      });
    };

    if (filters.$limit === 0) {
      runQuery = total => {
        return Promise.resolve({
          total,
          limit: filters.$limit,
          skip: filters.$skip || 0,
          data: []
        });
      };
    }

    if (paginate && paginate.default) {
      if (this.options.useEstimatedDocumentCount && (typeof this.Model.estimatedDocumentCount === 'function')) {
        return this.Model.estimatedDocumentCount(query, options).then(runQuery);
      } else {
        return this.Model.countDocuments(query, options).then(runQuery);
      }
    }

    return runQuery().then(page => page.data);
  }

  _get (id, params = {}) {
    const { query, options } = this._options(params);

    query.$and = (query.$and || []).concat({ [this.id]: this._objectifyId(id) });

    return this.Model.findOne(query, options).then(data => {
      if (!data) {
        throw new errors.NotFound(`No record found for id '${id}'`);
      }

      return data;
    }).then(select(params, this.id)).catch(errorHandler);
  }

  _create (data, params = {}) {
    const { options } = this._options(params);
    const setId = item => {
      const entry = Object.assign({}, item);

      // Generate a MongoId if we use a custom id
      if (this.id !== '_id' && typeof entry[this.id] === 'undefined') {
        entry[this.id] = new ObjectID().toHexString();
      }

      return entry;
    };

    const promise = Array.isArray(data)
      ? this.Model.insertMany(data.map(setId), options)
      : this.Model.insertOne(setId(data), options);

    return promise.then(result => {
      if (result.insertedId) {
        return this.Model.findOne({ _id: result.insertedId }, options);
      }

      if (result.insertedIds) {
        return Promise.all(Object.values(result.insertedIds).map(_id => this.Model.findOne({ _id }, options)));
      }

      return result.ops.length > 1 ? result.ops : result.ops[0];
    }).then(select(params, this.id)).catch(errorHandler);
  }

  _patch (id, data, params = {}) {
    let { query, options } = this._multiOptions(id, params);

    if (params.collation) {
      query = Object.assign(query, { collation: params.collation });
    }

    const remapModifier = this._remapModifiers(this._normalizeId(id, data));

    const idParams = Object.assign({}, params, {
      paginate: false
    });

    const ids = this._findOrGet(id, idParams)
      .then(result => {
        const items = Array.isArray(result) ? result : [result];
        return items.map(item => item[this.id]);
      });

    return ids.then(idList => {
      const findParams = Object.assign({}, params, {
        paginate: false,
        query: { [this.id]: { $in: idList } }
      });

      return this.Model.updateMany(query, remapModifier, options)
        .then(() => this._findOrGet(id, findParams))
        .then(select(params, this.id))
        .catch(errorHandler);
    });
  }

  _update (id, data, params = {}) {
    if (Array.isArray(data) || id === null) {
      return Promise.reject(
        new errors.BadRequest('Not replacing multiple records. Did you mean `patch`?')
      );
    }

    const { query, options } = this._multiOptions(id, params);

    return this.Model.replaceOne(query, this._normalizeId(id, data), options)
      .then(() => this._findOrGet(id, params))
      .then(select(params, this.id))
      .catch(errorHandler);
  }

  _remove (id, params = {}) {
    let { query, options } = this._multiOptions(id, params);

    if (params.collation) {
      query = Object.assign(query, { collation: params.collation });
    }

    const findParams = Object.assign({}, params, {
      paginate: false,
      query: params.query
    });

    return this._findOrGet(id, findParams)
      .then(items => {
        return this.Model.deleteMany(query, options)
          .then(() => items)
          .then(select(params, this.id));
      }).catch(errorHandler);
  }
}

module.exports = function init (options) {
  return new Service(options);
};

module.exports.Service = Service;
