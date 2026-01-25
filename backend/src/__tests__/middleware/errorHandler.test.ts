import { Request, Response, NextFunction } from 'express';
import {
  errorHandlerMiddleware,
  notFoundHandler,
} from '../../middleware/errorHandler';
import { ValidationError } from '../../utils/errors';
import { ErrorCode } from '../../types/errors';
import { loggerUtils } from '../../utils/logger';

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
  },
  loggerUtils: {
    logError: jest.fn().mockReturnValue('test-log-id'),
  },
}));

describe('Enhanced Error Handler Middleware (Task 2.3.2)', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let jsonSpy: jest.SpyInstance;
  let statusSpy: jest.SpyInstance;

  beforeEach(() => {
    mockRequest = {
      method: 'GET',
      originalUrl: '/test',
      headers: { 'x-request-id': 'test-request-id' },
      get: jest.fn().mockReturnValue('test-user-agent'),
      ip: '127.0.0.1',
      body: {},
      params: {},
      query: {},
    };

    jsonSpy = jest.fn();
    statusSpy = jest.fn().mockReturnValue({ json: jsonSpy });

    mockResponse = {
      status: statusSpy,
      json: jsonSpy,
    };

    mockNext = jest.fn();

    // Clear mocks
    jest.clearAllMocks();
  });

  describe('Error Categorization and Handling', () => {
    it('should handle validation errors with proper categorization', () => {
      const validationError = new ValidationError(
        'Invalid email format',
        'email',
        'invalid-email',
      );

      errorHandlerMiddleware(
        validationError,
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ErrorCode.VALIDATION_ERROR,
            userMessage: 'Invalid email format',
            nextSteps: 'Please check your input and try again',
            helpUrl: '/help/validation',
            logId: 'test-log-id',
            details: { field: 'email', value: 'invalid-email' },
          }),
          requestId: 'test-request-id',
        }),
      );
    });

    it('should handle JWT authentication errors', () => {
      const jwtError = new Error('Invalid token');
      jwtError.name = 'JsonWebTokenError';

      errorHandlerMiddleware(
        jwtError,
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(statusSpy).toHaveBeenCalledWith(401);
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ErrorCode.AUTHENTICATION_ERROR,
            userMessage: 'Invalid authentication token',
            nextSteps: 'Please log in again',
          }),
        }),
      );
    });

    it('should handle expired token errors', () => {
      const expiredError = new Error('Token expired');
      expiredError.name = 'TokenExpiredError';

      errorHandlerMiddleware(
        expiredError,
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(statusSpy).toHaveBeenCalledWith(401);
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ErrorCode.AUTHENTICATION_ERROR,
            userMessage: 'Authentication token has expired',
          }),
        }),
      );
    });

    it('should handle Prisma unique constraint violations', () => {
      const prismaError = {
        code: 'P2002',
        meta: { target: ['email'] },
        message: 'Unique constraint failed',
      };

      errorHandlerMiddleware(
        prismaError,
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(statusSpy).toHaveBeenCalledWith(409);
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ErrorCode.CONFLICT_ERROR,
            userMessage: 'A record with this information already exists',
            details: { constraint: ['email'] },
          }),
        }),
      );
    });

    it('should handle Prisma record not found errors', () => {
      const prismaError = {
        code: 'P2025',
        message: 'Record not found',
      };

      errorHandlerMiddleware(
        prismaError,
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(statusSpy).toHaveBeenCalledWith(404);
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ErrorCode.RESOURCE_NOT_FOUND,
            userMessage: 'The requested resource was not found',
          }),
        }),
      );
    });

    it('should handle rate limiting errors', () => {
      const rateLimitError = new Error('Too Many Requests');

      errorHandlerMiddleware(
        rateLimitError,
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(statusSpy).toHaveBeenCalledWith(429);
    });

    it('should handle payload too large errors', () => {
      const payloadError = {
        type: 'entity.too.large',
        limit: 1048576,
        length: 2097152,
        message: 'Request entity too large',
      };

      errorHandlerMiddleware(
        payloadError,
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(statusSpy).toHaveBeenCalledWith(413);
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ErrorCode.VALIDATION_ERROR,
            userMessage: 'Request payload too large',
            details: { limit: 1048576, received: 2097152 },
          }),
        }),
      );
    });

    it('should handle malformed JSON errors', () => {
      const jsonError = {
        type: 'entity.parse.failed',
        message: 'Unexpected token in JSON',
      };

      errorHandlerMiddleware(
        jsonError,
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ErrorCode.VALIDATION_ERROR,
            userMessage: 'Invalid JSON format',
            helpUrl: '/help/json-format',
          }),
        }),
      );
    });

    it('should handle file upload size limit errors', () => {
      const fileError = {
        code: 'LIMIT_FILE_SIZE',
        limit: 5242880,
        message: 'File too large',
      };

      errorHandlerMiddleware(
        fileError,
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(statusSpy).toHaveBeenCalledWith(413);
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ErrorCode.VALIDATION_ERROR,
            userMessage: 'File size exceeds the maximum allowed limit',
            details: { maxSize: 5242880 },
          }),
        }),
      );
    });

    it('should handle database connection errors', () => {
      const dbError = new Error('database connection failed');

      errorHandlerMiddleware(
        dbError,
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(statusSpy).toHaveBeenCalledWith(503);
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ErrorCode.SERVICE_UNAVAILABLE,
            userMessage: 'Database service is temporarily unavailable',
          }),
        }),
      );
    });

    it('should handle network timeout errors', () => {
      const timeoutError = {
        code: 'ETIMEDOUT',
        message: 'Connection timed out',
      };

      errorHandlerMiddleware(
        timeoutError,
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(statusSpy).toHaveBeenCalledWith(503);
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ErrorCode.SERVICE_UNAVAILABLE,
            userMessage: 'External service is temporarily unavailable',
          }),
        }),
      );
    });

    it('should handle unknown errors with development details', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const unknownError = new Error('Something went wrong');
      unknownError.stack = 'Error stack trace';

      errorHandlerMiddleware(
        unknownError,
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ErrorCode.INTERNAL_ERROR,
            userMessage: 'An unexpected error occurred',
            details: {
              message: 'Something went wrong',
              stack: 'Error stack trace',
            },
          }),
        }),
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should handle unknown errors without details in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const unknownError = new Error('Something went wrong');

      errorHandlerMiddleware(
        unknownError,
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ErrorCode.INTERNAL_ERROR,
            userMessage: 'An unexpected error occurred',
            details: undefined,
          }),
        }),
      );

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Not Found Handler', () => {
    it('should handle 404 errors with helpful information', () => {
      notFoundHandler(mockRequest as Request, mockResponse as Response);

      expect(statusSpy).toHaveBeenCalledWith(404);
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ErrorCode.RESOURCE_NOT_FOUND,
            userMessage: 'Route GET /test not found',
            nextSteps:
              'Please check the URL and method, or refer to the API documentation',
            helpUrl: '/help/api-reference',
            details: expect.objectContaining({
              method: 'GET',
              path: '/test',
              availableRoutes: expect.arrayContaining([
                '/api/v1/auth',
                '/api/v1/files',
                '/api/v1/invoices',
                '/api/v1/system',
              ]),
            }),
          }),
        }),
      );
    });
  });

  describe('Error Logging', () => {
    it('should log errors with proper context', () => {
      const error = new Error('Test error');

      errorHandlerMiddleware(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(loggerUtils.logError).toHaveBeenCalledWith(error, {
        requestId: 'test-request-id',
        method: 'GET',
        url: '/test',
        userAgent: 'test-user-agent',
        ip: '127.0.0.1',
        userId: undefined,
        body: {},
        params: {},
        query: {},
      });
    });
  });
});
