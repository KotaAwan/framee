/**
 * Base Error class for Framee.
 * All custom errors should extend this so they can be handled consistently
 * by the global error handler middleware.
 */
export class FrameeError extends Error {
  constructor(message, code = 'INTERNAL_ERROR', statusCode = 500, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends FrameeError {
  constructor(message, details = null) {
    super(message, 'VALIDATION_ERROR', 422, details);
  }
}

export class AuthenticationError extends FrameeError {
  constructor(message = 'Authentication required.') {
    super(message, 'UNAUTHORIZED', 401);
  }
}

export class ForbiddenError extends FrameeError {
  constructor(message = 'Access denied.') {
    super(message, 'FORBIDDEN', 403);
  }
}

export class NotFoundError extends FrameeError {
  constructor(message = 'Resource not found.') {
    super(message, 'NOT_FOUND', 404);
  }
}

export class ConflictError extends FrameeError {
  constructor(message = 'Resource conflict or locked state.') {
    super(message, 'CONFLICT', 409);
  }
}

export class DatabaseError extends FrameeError {
  constructor(message, details = null) {
    super(message, 'DATABASE_ERROR', 500, details);
  }
}
