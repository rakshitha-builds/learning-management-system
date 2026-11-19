// Throw this anywhere in controllers/services: throw new ApiError(404, 'Course not found')
export default class ApiError extends Error {
  constructor(statusCode, message, errors) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
  }
}
