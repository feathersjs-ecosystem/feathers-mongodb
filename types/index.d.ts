// TypeScript Version: 3.7
import { Params, Paginated, Id, NullableId } from '@feathersjs/feathers';
import { AdapterService, ServiceOptions, InternalServiceMethods } from '@feathersjs/adapter-commons';
import { Collection } from 'mongodb';

export interface MongoDBServiceOptions extends ServiceOptions {
  Model: Collection;
}

export class Service<T = any> extends AdapterService<T> implements InternalServiceMethods<T> {
  Model: Collection;
  options: MongoDBServiceOptions;

  constructor(config?: Partial<MongoDBServiceOptions>);

  _find(params?: Params): Promise<T | T[] | Paginated<T>>;
  _get(id: Id, params?: Params): Promise<T>;
  _create(data: Partial<T> | Array<Partial<T>>, params?: Params): Promise<T | T[]>;
  _update(id: NullableId, data: T, params?: Params): Promise<T>;
  _patch(id: NullableId, data: Partial<T>, params?: Params): Promise<T>;
  _remove(id: NullableId, params?: Params): Promise<T>;
}

declare const mongodb: ((config?: Partial<MongoDBServiceOptions>) => Service);
export default mongodb;
