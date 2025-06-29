import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../utils/errors';
import { createErrorResponse, commonErrors } from '../utils/response';
import { ErrorCode } from '../types/errors';
import { logger, loggerUtils } from '../utils/logger';

// Enhanced error categorization
interface ErrorCategory {
  type: 'client' | 'server' | 'network' | 'auth' | 'validation' | 'business';
  severity: 'low' | 'medium' | 'high' | 'critical';
  retryable: boolean;
}

const categorizeError = (error: any): ErrorCategory => {
  // Authentication/Authorization errors
  if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError' || error.status === 401 || error.status === 403) {
    return { type: 'auth', severity: 'medium', retryable: false };
  }

  // Validation errors
  if (error instanceof ValidationError || error.status === 400 || error.type === 'entity.parse.failed') {
    return { type: 'validation', severity: 'low', retryable: false };
  }

  // Network/Service errors
  if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
    return { type: 'network', severity: 'high', retryable: true };
  }

  // Database/Service unavailable
  if (error.message?.includes('database') || error.status === 503) {
    return { type: 'server', severity: 'high', retryable: true };
  }

  // Business logic errors (conflicts, not found)
  if (error.code === 'P2002' || error.code === 'P2025' || error.status === 404 || error.status === 409) {
    return { type: 'business', severity: 'medium', retryable: false };
  }

  // Rate limiting
  if (error.status === 429 || error.message?.includes('Too Many Requests')) {
    return { type: 'client', severity: 'medium', retryable: true };
  }

  // Server errors
  if (error.status >= 500) {
    return { type: 'server', severity: 'critical', retryable: true };
  }

  // Default to server error for unknown issues
  return { type: 'server', severity: 'critical', retryable: false };
};

// Enhanced error handler middleware with categorization
export const errorHandlerMiddleware = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const requestId = req.headers['x-request-id'] as string;

  // Categorize the error
  const category = categorizeError(error);

  // Log the error with category information
  const logId = loggerUtils.logError(error, {
    requestId,
    method: req.method,
    url: req.originalUrl,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: (req as any).user?.id,
    body: req.body,
    params: req.params,
    query: req.query,
    errorCategory: category,
  });

  // Enhanced error response helper
  const createEnhancedErrorResponse = (
    statusCode: number,
    errorCode: ErrorCode,
    userMessage: string,
    nextSteps: string,
    helpUrl: string,
    details?: any
  ) => {
    return res.status(statusCode).json(createErrorResponse(
      errorCode,
      userMessage,
      nextSteps,
      helpUrl,
      logId,
      {
        ...details,
        category: category.type,
        severity: category.severity,
        retryable: category.retryable,
        ...(category.retryable && {
          retryAfter: category.type === 'network' ? 5 : category.type === 'server' ? 30 : 60,
        }),
      },
      requestId
    ));
  };

  // Handle different types of errors with enhanced categorization
  if (error instanceof ValidationError) {
    return createEnhancedErrorResponse(
      400,
      ErrorCode.VALIDATION_ERROR,
      error.message,
      'Please check your input and try again',
      '/help/validation',
      { field: error.field, value: error.value }
    );
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    return createEnhancedErrorResponse(
      401,
      ErrorCode.AUTHENTICATION_ERROR,
      'Invalid authentication token',
      'Please log in again',
      '/help/authentication'
    );
  }

  if (error.name === 'TokenExpiredError') {
    return createEnhancedErrorResponse(
      401,
      ErrorCode.AUTHENTICATION_ERROR,
      'Authentication token has expired',
      'Please log in again',
      '/help/authentication'
    );
  }

  // Handle Prisma errors
  if (error.code === 'P2002') {
    return createEnhancedErrorResponse(
      409,
      ErrorCode.CONFLICT_ERROR,
      'A record with this information already exists',
      'Please use different values and try again',
      '/help/conflicts',
      { constraint: error.meta?.target }
    );
  }

  if (error.code === 'P2025') {
    return createEnhancedErrorResponse(
      404,
      ErrorCode.RESOURCE_NOT_FOUND,
      'The requested resource was not found',
      'Please check the resource ID and try again',
      '/help/resources'
    );
  }

  // Handle other Prisma errors
  if (error.code?.startsWith('P')) {
    const prismaErrorMessages: Record<string, string> = {
      'P2000': 'The provided value is too long for the field',
      'P2001': 'The record searched for does not exist',
      'P2003': 'Foreign key constraint failed',
      'P2004': 'A constraint failed on the database',
      'P2005': 'The value stored in the database is invalid for the field type',
      'P2006': 'The provided value is not valid for the field',
      'P2007': 'Data validation error',
      'P2008': 'Failed to parse the query',
      'P2009': 'Failed to validate the query',
      'P2010': 'Raw query failed',
      'P2011': 'Null constraint violation',
      'P2012': 'Missing a required value',
      'P2013': 'Missing the required argument',
      'P2014': 'The change would violate the required relation',
      'P2015': 'A related record could not be found',
      'P2016': 'Query interpretation error',
      'P2017': 'The records for relation are not connected',
      'P2018': 'The required connected records were not found',
      'P2019': 'Input error',
      'P2020': 'Value out of range for the type',
      'P2021': 'The table does not exist in the current database',
      'P2022': 'The column does not exist in the current database',
    };

    const userMessage = prismaErrorMessages[error.code] || 'A database error occurred';
    return createEnhancedErrorResponse(
      400,
      ErrorCode.VALIDATION_ERROR,
      userMessage,
      'Please check your request and try again',
      '/help/database-errors',
      { prismaCode: error.code }
    );
  }

  // Handle rate limiting errors
  if (error.message && error.message.includes('Too Many Requests')) {
    return res.status(429).json(commonErrors.rateLimitExceeded(requestId));
  }

  // Handle payload too large errors
  if (error.type === 'entity.too.large') {
    return res.status(413).json(createErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      'Request payload too large',
      'Please reduce the size of your request and try again',
      '/help/file-size-limits',
      logId,
      { limit: error.limit, received: error.length },
      requestId
    ));
  }

  // Handle malformed JSON errors
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json(createErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      'Invalid JSON format',
      'Please check your request format and try again',
      '/help/json-format',
      logId,
      undefined,
      requestId
    ));
  }

  // Handle CORS errors
  if (error.message && error.message.includes('CORS')) {
    return res.status(403).json(createErrorResponse(
      ErrorCode.AUTHORIZATION_ERROR,
      'Cross-origin request blocked',
      'Please ensure your request is from an allowed origin',
      '/help/cors',
      logId,
      undefined,
      requestId
    ));
  }

  // Handle file upload errors
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json(createErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      'File size exceeds the maximum allowed limit',
      'Please upload a smaller file and try again',
      '/help/file-upload',
      logId,
      { maxSize: error.limit },
      requestId
    ));
  }

  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json(createErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      'Unexpected file field',
      'Please check the file field name and try again',
      '/help/file-upload',
      logId,
      { field: error.field },
      requestId
    ));
  }

  // Handle database connection errors
  if (error.message && error.message.includes('database')) {
    return res.status(503).json(createErrorResponse(
      ErrorCode.SERVICE_UNAVAILABLE,
      'Database service is temporarily unavailable',
      'Please try again in a few minutes',
      '/help/service-status',
      logId,
      undefined,
      requestId
    ));
  }

  // Handle network/timeout errors
  if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
    return res.status(503).json(createErrorResponse(
      ErrorCode.SERVICE_UNAVAILABLE,
      'External service is temporarily unavailable',
      'Please try again in a few minutes',
      '/help/service-status',
      logId,
      undefined,
      requestId
    ));
  }

  // Default server error
  logger.error('Unhandled error:', error);
  
  return res.status(500).json(createErrorResponse(
    ErrorCode.INTERNAL_ERROR,
    'An unexpected error occurred',
    'Our team has been notified and is working to fix the issue',
    '/help/server-errors',
    logId,
    process.env.NODE_ENV === 'development' ? {
      message: error.message,
      stack: error.stack,
    } : undefined,
    requestId
  ));
};

// 404 handler for unmatched routes
export const notFoundHandler = (req: Request, res: Response) => {
  const requestId = req.headers['x-request-id'] as string;
  
  res.status(404).json(createErrorResponse(
    ErrorCode.RESOURCE_NOT_FOUND,
    `Route ${req.method} ${req.originalUrl} not found`,
    'Please check the URL and method, or refer to the API documentation',
    '/help/api-reference',
    undefined,
    {
      method: req.method,
      path: req.originalUrl,
      availableRoutes: [
        '/api/v1/auth',
        '/api/v1/files',
        '/api/v1/invoices',
        '/api/v1/system',
      ],
    },
    requestId
  ));
};

export default errorHandlerMiddleware;
