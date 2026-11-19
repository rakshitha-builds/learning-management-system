const ApiError = require('../utils/ApiError');

// validate({ body: zodSchema, query: zodSchema, params: zodSchema })
module.exports = (schemas) => (req, res, next) => {
  for (const key of ['params', 'query', 'body']) {
    if (!schemas[key]) continue;
    const result = schemas[key].safeParse(req[key]);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
      return next(ApiError.badRequest('Validation failed', details));
    }
    if (key === 'query') Object.defineProperty(req, 'query', { value: result.data, writable: true });
    else req[key] = result.data;
  }
  next();
};
