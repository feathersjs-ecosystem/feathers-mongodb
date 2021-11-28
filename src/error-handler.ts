import { GeneralError } from '@feathersjs/errors';
import { MongoError } from 'mongodb'

interface SomeError extends MongoError {
  ok?: any
}

export function errorHandler (error: SomeError) {
  // NOTE (EK): The list of error code is way too massive to map
  // them to a specific error object so we'll use a generic one.
  // See https://github.com/mongodb/mongo/blob/master/docs/errors.md

  if (error.name === 'MongoError') {
    throw new GeneralError(error, {
      ok: error.ok,
      code: error.code
    });
  }

  throw error;
};
