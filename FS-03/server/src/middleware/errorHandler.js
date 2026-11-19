import ApiError from '../utils/ApiError.js';
import { isProd } from '../config/env.js';

// Runs when no route matched.
export const notFound = (req, res, next) => {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

// One place that turns every error into a consistent JSON response.
// Express 5 forwards errors from async controllers here automatically.
export const errorHandler = (err, req, res, next) => { // eslint-disable-line no-unused-vars
  let status = err.statusCode || 500;
  let message = err.message || 'Server error';
  let errors = err.errors;

  if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Invalid JSON in request body';
  } else if (err.name === 'ValidationError') {
    status = 400;
    message = 'Validation failed';
    errors = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  } else if (err.name === 'CastError') {
    status = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  } else if (err.code === 11000) {
    status = 409;
    message = `${Object.keys(err.keyValue || {})[0] || 'Value'} already exists`;
  }

  if (status === 500) {
    console.error(err);
    if (isProd) message = 'Something went wrong';
  }

  res.status(status).json({
    success: false,
    message,
    ...(errors && { errors }),
    ...(!isProd && status === 500 && { stack: err.stack }),
  });
};
