const omit = require('lodash.omit');

const { ObjectID } = require('mongodb');
const Proto = require('uberproto');

const errors = require('@feathersjs/errors');
const { select, filterQuery } = require('@feathersjs/commons');

const errorHandler = require('./error-handler');

// Create the service.
class Service {
  constructor (options) {
    if (!options) {
      throw new Error('MongoDB options have to be provided');
    }

    this.Model = options.Model;
    this.id = options.id || '_id';
    this.events = options.events || [];
    this.paginate = options.paginate || {};
  }

  extend (obj) {
    return Proto.extend(obj, this);
  }

  _objectifyId (id) {
    if (this.id === '_id' && ObjectID.isValid(id)) {
      id = new ObjectID(id.toString());
    }

    return id;
  }

  _multiOptions (id, params) {
    let query = filterQuery(params.query || {}).query;
    let options = Object.assign({ multi: true }, params.mongodb || params.options);

    if (id !== null) {
      options.multi = false;
      query[this.id] = this._objectifyId(id);
    }

    return { query, options };
  }

  _getSelect (select) {
    if (Array.isArray(select)) {
      var result = {};
      select.forEach(name => {
        result[name] = 1;
      });
      return result;
    }

    return select;
  }

  _find (params, count, getFilter = filterQuery) {
    // Start with finding all, and limit when necessary.
    let { filters, query } = getFilter(params.query || {});

    // Objectify the id field if it's present
    if (query[this.id]) {
      query[this.id] = this._objectifyId(query[this.id]);
    }

    const q = this.Model.find(query);

    if (filters.$select) {
      q.project(this._getSelect(filters.$select));
    }

    if (filters.$sort) {
      q.sort(filters.$sort);
    }

    if (params.collation) {
      q.collation(params.collation);
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

    if (count) {
      return this.Model.countDocuments(query).then(runQuery);
    }

    return runQuery();
  }

  find (params) {
    const paginate = (params && typeof params.paginate !== 'undefined') ? params.paginate : this.paginate;
    const result = this._find(params, !!paginate.default,
      query => filterQuery(query, paginate)
    );

    if (!paginate.default) {
      return result.then(page => page.data);
    }

    return result;
  }

  _get (id, params) {
    id = this._objectifyId(id);

    return this.Model.findOne({ [this.id]: id })
      .then(data => {
        if (!data) {
          throw new errors.NotFound(`No record found for id '${id}'`);
        }

        return data;
      })
      .then(select(params, this.id))
      .catch(errorHandler);
  }

  get (id, params) {
    return this._get(id, params);
  }

  _findOrGet (id, params) {
    if (id === null) {
      return this._find(params).then(page => page.data);
    }

    return this._get(id, params);
  }

  create (data, params) {
    const setId = item => {
      const entry = Object.assign({}, item);

      // Generate a MongoId if we use a custom id
      if (this.id !== '_id' && typeof entry[this.id] === 'undefined') {
        entry[this.id] = new ObjectID().toHexString();
      }

      return entry;
    };

    let insertPromise = null;
    if (Array.isArray(data)) {
      insertPromise = this.Model.insertMany(data.map(setId));
    } else {
      insertPromise = this.Model.insertOne(setId(data));
    }

    return insertPromise
      .then(result => result.ops.length > 1 ? result.ops : result.ops[0])
      .then(select(params, this.id))
      .catch(errorHandler);
  }

  _normalizeId (id, data) {
    if (this.id === '_id') {
      // Default Mongo IDs cannot be updated. The Mongo library handles
      // this automatically.
      return omit(data, this.id);
    } else if (id !== null) {
      // If not using the default Mongo _id field set the ID to its
      // previous value. This prevents orphaned documents.
      return Object.assign({}, data, { [this.id]: id });
    } else {
      return data;
    }
  }

  // Map stray records into $set
  _remapModifiers (data) {
    var set = {};
    // Step through the rooot
    for (var key in data) {
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
      data['$set'] = set;
    }
    return data;
  }

  patch (id, data, params) {
    let { query, options } = this._multiOptions(id, params);
    const mapIds = page => page.data.map(current => current[this.id]);

    // By default we will just query for the one id. For multi patch
    // we create a list of the ids of all items that will be changed
    // to re-query them after the update
    const ids = id === null ? this._find(params)
      .then(mapIds) : Promise.resolve([id]);

    if (params.collation) {
      query = Object.assign(query, { collation: params.collation });
    }

    // Run the query
    return ids
      .then(idList => {
        // Create a new query that re-queries all ids that
        // were originally changed
        const findParams = Object.assign({}, params, {
          query: {
            [this.id]: { $in: idList }
          }
        });
        let remapModifier = this._remapModifiers(this._normalizeId(id, data));
        return this.Model
          .updateMany(query, remapModifier, options)
          .then(() => this._findOrGet(id, findParams));
      })
      .then(select(params, this.id))
      .catch(errorHandler);
  }

  update (id, data, params) {
    if (Array.isArray(data) || id === null) {
      return Promise.reject(new errors.BadRequest('Not replacing multiple records. Did you mean `patch`?'));
    }

    let { query, options } = this._multiOptions(id, params);
    return this.Model
      .replaceOne(query, this._normalizeId(id, data), options)
      .then(() => this._findOrGet(id))
      .then(select(params, this.id))
      .catch(errorHandler);
  }

  remove (id, params) {
    let { query } = this._multiOptions(id, params);

    if (params.collation) {
      query = Object.assign(query, { collation: params.collation });
    }
    return this._findOrGet(id, params)
      .then(items => this.Model
        .deleteMany(query)
        .then(() => items)
        .then(select(params, this.id))
      ).catch(errorHandler);
  }
}

module.exports = function init (options) {
  return new Service(options);
};

module.exports.Service = Service;
