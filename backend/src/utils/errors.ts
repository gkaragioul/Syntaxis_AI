export class ValidationError extends Error {
  public field?: string;
  public value?: any;

  constructor(field: string, value: any, message: string);
  constructor(message: string);
  constructor(fieldOrMessage: string, value?: any, message?: string) {
    if (message !== undefined) {
      // Three-parameter constructor: field, value, message
      super(message);
      this.field = fieldOrMessage;
      this.value = value;
    } else {
      // Single-parameter constructor: message only
      super(fieldOrMessage);
    }
    this.name = 'ValidationError';
  }
}

export class ServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ServiceError';
  }
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class LicenseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LicenseError';
  }
}

export class DeviceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeviceError';
  }
}

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ServiceUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ServiceUnavailableError';
  }
}

export class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BadRequestError';
  }
}

export class InternalServerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InternalServerError';
  }
}

export function isCustomError(error: any): error is Error {
  return (
    error instanceof Error &&
    (error.name === 'ValidationError' ||
      error.name === 'ServiceError' ||
      error.name === 'AuthenticationError' ||
      error.name === 'LicenseError' ||
      error.name === 'DeviceError' ||
      error.name === 'RateLimitError' ||
      error.name === 'DatabaseError' ||
      error.name === 'NotFoundError' ||
      error.name === 'ConflictError' ||
      error.name === 'ForbiddenError' ||
      error.name === 'UnauthorizedError' ||
      error.name === 'ServiceUnavailableError' ||
      error.name === 'BadRequestError' ||
      error.name === 'InternalServerError')
  );
}

export function getErrorStatusCode(error: Error): number {
  switch (error.name) {
    case 'ValidationError':
    case 'BadRequestError':
      return 400;
    case 'AuthenticationError':
    case 'UnauthorizedError':
      return 401;
    case 'ForbiddenError':
      return 403;
    case 'NotFoundError':
      return 404;
    case 'ConflictError':
      return 409;
    case 'RateLimitError':
      return 429;
    case 'ServiceUnavailableError':
      return 503;
    case 'ServiceError':
    case 'InternalServerError':
    case 'DatabaseError':
      return 500;
    default:
      return 500;
  }
}
