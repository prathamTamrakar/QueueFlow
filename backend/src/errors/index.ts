export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 500, isOperational = true, details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class RetryableError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 500, true, details);
  }
}

export class NonRetryableError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, true, details);
  }
}

export class IdempotencyConflictError extends AppError {
  constructor(message = 'Concurrent request in progress or payload conflict for this Idempotency-Key') {
    super(message, 409, true);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, true);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 422, true, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized access') {
    super(message, 401, true);
  }
}

export class JobTimeoutError extends RetryableError {
  constructor(message = 'Job execution exceeded maximum allowed timeout') {
    super(message);
  }
}
