import { ErrorCode } from '../types/errors';

// Standard API response interfaces
export interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
  timestamp: string;
  requestId?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    userMessage: string;
    nextSteps: string;
    helpUrl: string;
    logId?: string;
    details?: any;
  };
  timestamp: string;
  requestId?: string;
}

// Generate unique request ID for tracking
const generateRequestId = (): string => {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Create standardized success response
export const createSuccessResponse = <T>(
  data: T,
  message?: string,
  requestId?: string,
): ApiSuccessResponse<T> => {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
    requestId: requestId || generateRequestId(),
  };
};

// Create standardized error response
export const createErrorResponse = (
  code: ErrorCode,
  userMessage: string,
  nextSteps: string,
  helpUrl: string,
  logId?: string,
  details?: any,
  requestId?: string,
): ApiErrorResponse => {
  return {
    success: false,
    error: {
      code,
      userMessage,
      nextSteps,
      helpUrl,
      logId,
      details,
    },
    timestamp: new Date().toISOString(),
    requestId: requestId || generateRequestId(),
  };
};

// Common error responses
export const commonErrors = {
  unauthorized: (requestId?: string) =>
    createErrorResponse(
      ErrorCode.AUTHENTICATION_ERROR,
      'Authentication required',
      'Please log in to access this resource',
      '/help/authentication',
      undefined,
      undefined,
      requestId,
    ),

  forbidden: (requestId?: string) =>
    createErrorResponse(
      ErrorCode.AUTHORIZATION_ERROR,
      'Access denied',
      'You do not have permission to access this resource',
      '/help/permissions',
      undefined,
      undefined,
      requestId,
    ),

  notFound: (resource: string, requestId?: string) =>
    createErrorResponse(
      ErrorCode.RESOURCE_NOT_FOUND,
      `${resource} not found`,
      'Please check the resource ID and try again',
      '/help/resources',
      undefined,
      undefined,
      requestId,
    ),

  validationError: (details: any, requestId?: string) =>
    createErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      'Invalid input data',
      'Please check your input and try again',
      '/help/validation',
      undefined,
      details,
      requestId,
    ),

  rateLimitExceeded: (requestId?: string) =>
    createErrorResponse(
      ErrorCode.RATE_LIMIT_EXCEEDED,
      'Too many requests',
      'Please wait a moment before trying again',
      '/help/rate-limits',
      undefined,
      undefined,
      requestId,
    ),

  serverError: (logId?: string, requestId?: string) =>
    createErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Internal server error',
      'An unexpected error occurred. Our team has been notified.',
      '/help/server-errors',
      logId,
      undefined,
      requestId,
    ),

  serviceUnavailable: (service: string, requestId?: string) =>
    createErrorResponse(
      ErrorCode.SERVICE_UNAVAILABLE,
      `${service} service is currently unavailable`,
      'Please try again in a few minutes',
      '/help/service-status',
      undefined,
      undefined,
      requestId,
    ),
};

// Response wrapper for async route handlers
export const asyncHandler = (
  fn: (req: any, res: any, next: any) => Promise<any>,
) => {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Pagination response helper
export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export const createPaginatedResponse = <T>(
  items: T[],
  page: number,
  limit: number,
  total: number,
  message?: string,
  requestId?: string,
): ApiSuccessResponse<PaginatedResponse<T>> => {
  const totalPages = Math.ceil(total / limit);

  return createSuccessResponse(
    {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    },
    message,
    requestId,
  );
};

// Health check response helper
export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  version: string;
  uptime: number;
  timestamp: string;
  services: {
    [key: string]: {
      status: 'healthy' | 'unhealthy' | 'degraded';
      responseTime?: number;
      error?: string;
    };
  };
}

export const createHealthResponse = (
  status: 'healthy' | 'unhealthy' | 'degraded',
  services: HealthCheckResponse['services'],
  version: string = process.env.npm_package_version || '1.0.0',
  requestId?: string,
): ApiSuccessResponse<HealthCheckResponse> => {
  return createSuccessResponse(
    {
      status,
      version,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      services,
    },
    `System status: ${status}`,
    requestId,
  );
};
