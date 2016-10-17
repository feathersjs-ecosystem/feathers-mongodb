import errors from 'feathers-errors';

export default function errorHandler (error) {
  let feathersError = error;

  // NOTE (EK): The list of error code is way too massive to map
  // them to a specific error object so we'll use a generic one.
  // See https://github.com/mongodb/mongo/blob/master/docs/errors.md

  if (error.name === 'MongoError') {
    feathersError = new errors.GeneralError(error, {
      ok: error.ok,
      code: error.code
    });
  }

  throw feathersError;
}
