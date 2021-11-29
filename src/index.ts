import { ObjectId, Collection } from "mongodb";
import { errors } from "@feathersjs/errors";
import { _ } from "@feathersjs/commons";
import {
  AdapterService,
  ServiceOptions,
  InternalServiceMethods,
  AdapterParams,
  select,
} from "@feathersjs/adapter-commons";
import { errorHandler } from "./error-handler";
import { NullableId, Id, Paginated } from "@feathersjs/feathers";

type Nullable_Id = ObjectId | NullableId;
type _Id = ObjectId | Id;

interface AnyData {
  [key: string]: any;
}

export interface MongoServiceOptions extends ServiceOptions {
  Model?: Collection;
}

// Create the service.
export class Service<T = any, D = Partial<T>>
  extends AdapterService<T, D>
  implements InternalServiceMethods<T>
{
  options: any;
  Model: any;

  constructor(options: MongoServiceOptions) {
    super(Object.assign({ id: "_id" }, options));
    this.Model = options.Model;
  }

  _getModel(params: AdapterParams = {}) {
    return params.adapter?.Model || this.Model;
  }

  _objectifyId(id: _Id) {
    if (this.options.disableObjectify) {
      return id;
    }

    if (this.id === "_id" && ObjectId.isValid(id)) {
      id = new ObjectId(id.toString());
    }

    return id;
  }

  _multiOptions(id: Nullable_Id, params: AdapterParams = {}) {
    const { query } = this.filterQuery(params);
    const options = Object.assign(
      { multi: true },
      params.mongodb || params.options
    );

    if (id !== null) {
      options.multi = false;
      query.$and = (query.$and || []).concat({
        [this.id]: this._objectifyId(id),
      });
    }

    return { query, options };
  }

  _options(params: AdapterParams = {}) {
    const { filters, query, paginate } = this.filterQuery(params);
    const options = Object.assign({}, params.mongodb || params.options);
    return { filters, query, paginate, options };
  }

  _getSelect(select: any) {
    if (Array.isArray(select)) {
      const result: any = {};
      select.forEach((name) => {
        result[name] = 1;
      });
      return result;
    }

    return select;
  }

  _findOrGet(id: Nullable_Id, params: AdapterParams = {}) {
    if (id === null) {
      return this._find(params);
    }

    return this._get(id, params);
  }

  _normalizeId(id: Nullable_Id, data: AnyData): AnyData {
    if (this.id === "_id") {
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
  _remapModifiers(data: any) {
    let set: any = {};
    // Step through the rooot
    for (const key in data) {
      // Check for keys that aren't modifiers
      if (key.charAt(0) !== "$") {
        // Move them to set, and remove their record
        set[key] = data[key];
        delete data[key];
      }
      // If the '$set' modifier is used, add that to the temp variable
      if (key === "$set") {
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

  _find(params: AdapterParams = {}) {
    // Start with finding all, and limit when necessary.
    const { filters, query, paginate, options } = this._options(params);
    const Model = this._getModel(params);

    if (query[this.id]) {
      query[this.id] = this._objectifyId(query[this.id]);
    }

    const q = Model.find(query, options);

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

    let runQuery = (total: number) => {
      return q.toArray().then((data: T[]): Paginated<T> => {
        return {
          total,
          limit: filters.$limit,
          skip: filters.$skip || 0,
          data,
        };
      });
    };

    if (filters.$limit === 0) {
      runQuery = (total: number) => {
        return Promise.resolve({
          total,
          limit: filters.$limit,
          skip: filters.$skip || 0,
          data: [],
        });
      };
    }

    if (paginate && paginate.default) {
      if (
        this.options.useEstimatedDocumentCount &&
        typeof Model.estimatedDocumentCount === "function"
      ) {
        return Model.estimatedDocumentCount(query, options).then(runQuery);
      } else {
        return Model.countDocuments(query, options).then(runQuery);
      }
    }

    return runQuery(0).then((page: Paginated<T>) => page.data);
  }

  _get(id: _Id, params = {}) {
    const { query, options } = this._options(params);
    const Model = this._getModel(params);

    query.$and = (query.$and || []).concat({
      [this.id]: this._objectifyId(id),
    });

    return Model.findOne(query, options)
      .then((data: any) => {
        if (!data) {
          throw new errors.NotFound(`No record found for id '${id}'`);
        }

        return data;
      })
      .then(select(params, this.id))
      .catch(errorHandler);
  }

  _create(data: AnyData, params: AdapterParams = {}) {
    const { options } = this._options(params);
    const Model = this._getModel(params);
    const setId = (item: AnyData) => {
      const entry = Object.assign({}, item);

      // Generate a MongoId if we use a custom id
      if (this.id !== "_id" && typeof entry[this.id] === "undefined") {
        entry[this.id] = new ObjectId().toHexString();
      }

      return entry;
    };

    const promise = Array.isArray(data)
      ? Model.insertMany(data.map(setId), options)
      : Model.insertOne(setId(data), options);

    return promise
      .then((result: AnyData) => {
        if (result.insertedId) {
          return Model.findOne({ _id: result.insertedId }, options);
        }

        if (result.insertedIds) {
          return Promise.all(
            Object.values(result.insertedIds).map((_id) =>
              Model.findOne({ _id }, options)
            )
          );
        }

        return result.ops.length > 1 ? result.ops : result.ops[0];
      })
      .then(select(params, this.id))
      .catch(errorHandler);
  }

  _patch(id: Nullable_Id, data: AnyData, params: AdapterParams = {}) {
    let { query, options } = this._multiOptions(id, params);
    const Model = this._getModel(params);

    if (params.collation) {
      query = Object.assign(query, { collation: params.collation });
    }

    const remapModifier = this._remapModifiers(this._normalizeId(id, data));

    const idParams = Object.assign({}, params, {
      paginate: false,
    });

    const ids = this._findOrGet(id, idParams).then((result: AnyData) => {
      const items = Array.isArray(result) ? result : [result];
      return items.map((item) => item[this.id]);
    });

    return ids.then((idList: _Id[]) => {
      const findParams = Object.assign({}, params, {
        paginate: false,
        query: { [this.id]: { $in: idList } },
      });

      return Model.updateMany(query, remapModifier, options)
        .then(() => this._findOrGet(id, findParams))
        .then(select(params, this.id))
        .catch(errorHandler);
    });
  }

  _update(id: _Id, data: AnyData, params: AdapterParams = {}) {
    if (Array.isArray(data) || id === null) {
      return Promise.reject(
        new errors.BadRequest(
          "Not replacing multiple records. Did you mean `patch`?"
        )
      );
    }

    const { query, options } = this._multiOptions(id, params);
    const Model = this._getModel(params);

    return Model.replaceOne(query, this._normalizeId(id, data), options)
      .then(() => this._findOrGet(id, params))
      .then(select(params, this.id))
      .catch(errorHandler);
  }

  _remove(id: Nullable_Id, params: AdapterParams = {}) {
    let { query, options } = this._multiOptions(id, params);
    const Model = this._getModel(params);

    if (params.collation) {
      query = Object.assign(query, { collation: params.collation });
    }

    const findParams = Object.assign({}, params, {
      paginate: false,
      query: params.query,
    });

    return this._findOrGet(id, findParams)
      .then((items: AnyData[]) => {
        return Model.deleteMany(query, options)
          .then(() => items)
          .then(select(params, this.id));
      })
      .catch(errorHandler);
  }
}

module.exports = function init(options: MongoServiceOptions) {
  return new Service(options);
};

module.exports.Service = Service;
