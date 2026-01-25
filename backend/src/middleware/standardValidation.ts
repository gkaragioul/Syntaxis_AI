import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { createErrorResponse } from '../utils/response';
import { ErrorCode } from '../types/errors';

// Standard validation schemas
export const standardSchemas = {
  uuid: z.string().uuid('Invalid UUID format'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  pagination: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).optional(),
  }),
  dateString: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  dateTimeString: z.string().datetime('Invalid datetime format'),
  positiveNumber: z.number().positive('Must be a positive number'),
  nonNegativeNumber: z.number().min(0, 'Must be non-negative'),
  fileUpload: z.object({
    mimetype: z.enum(['application/pdf'], {
      message: 'Only PDF files are allowed',
    }),
    size: z.number().max(10 * 1024 * 1024, 'File size must be less than 10MB'),
  }),
};

// Enhanced validation middleware with consistent error handling
export const validateRequest = (schema: {
  params?: z.ZodSchema;
  query?: z.ZodSchema;
  body?: z.ZodSchema;
  headers?: z.ZodSchema;
}) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestId = req.headers['x-request-id'] as string;

    try {
      // Validate parameters
      if (schema.params) {
        const result = schema.params.safeParse(req.params);
        if (!result.success) {
          return res.status(400).json(
            createErrorResponse(
              ErrorCode.VALIDATION_ERROR,
              `Invalid parameters: ${result.error.errors.map((e) => e.message).join(', ')}`,
              'Please check your request parameters and try again',
              '/help/api-reference',
              undefined,
              {
                field: 'params',
                errors: result.error.errors,
              },
              requestId,
            ),
          );
        }
        req.params = result.data;
      }

      // Validate query parameters
      if (schema.query) {
        const result = schema.query.safeParse(req.query);
        if (!result.success) {
          return res.status(400).json(
            createErrorResponse(
              ErrorCode.VALIDATION_ERROR,
              `Invalid query parameters: ${result.error.errors.map((e) => e.message).join(', ')}`,
              'Please check your query parameters and try again',
              '/help/api-reference',
              undefined,
              {
                field: 'query',
                errors: result.error.errors,
              },
              requestId,
            ),
          );
        }
        req.query = result.data;
      }

      // Validate request body
      if (schema.body) {
        const result = schema.body.safeParse(req.body);
        if (!result.success) {
          return res.status(400).json(
            createErrorResponse(
              ErrorCode.VALIDATION_ERROR,
              `Invalid request body: ${result.error.errors.map((e) => e.message).join(', ')}`,
              'Please check your request body and try again',
              '/help/api-reference',
              undefined,
              {
                field: 'body',
                errors: result.error.errors,
              },
              requestId,
            ),
          );
        }
        req.body = result.data;
      }

      // Validate headers
      if (schema.headers) {
        const result = schema.headers.safeParse(req.headers);
        if (!result.success) {
          return res.status(400).json(
            createErrorResponse(
              ErrorCode.VALIDATION_ERROR,
              `Invalid headers: ${result.error.errors.map((e) => e.message).join(', ')}`,
              'Please check your request headers and try again',
              '/help/api-reference',
              undefined,
              {
                field: 'headers',
                errors: result.error.errors,
              },
              requestId,
            ),
          );
        }
      }

      next();
    } catch (error) {
      return res
        .status(500)
        .json(
          createErrorResponse(
            ErrorCode.INTERNAL_ERROR,
            'Validation error occurred',
            'Please try again or contact support',
            '/help/server-errors',
            undefined,
            undefined,
            requestId,
          ),
        );
    }
  };
};

// Standard parameter validation schemas
export const paramSchemas = {
  id: z.object({
    id: standardSchemas.uuid,
  }),
  invoiceId: z.object({
    invoiceId: standardSchemas.uuid,
  }),
  fileId: z.object({
    fileId: standardSchemas.uuid,
  }),
  userId: z.object({
    userId: standardSchemas.uuid,
  }),
};

// Standard query validation schemas
export const querySchemas = {
  pagination: standardSchemas.pagination,
  search: z.object({
    q: z.string().min(1).max(100).optional(),
    ...standardSchemas.pagination.shape,
  }),
  dateRangeBase: z.object({
    startDate: standardSchemas.dateString.optional(),
    endDate: standardSchemas.dateString.optional(),
    ...standardSchemas.pagination.shape,
  }),
  dateRange: z
    .object({
      startDate: standardSchemas.dateString.optional(),
      endDate: standardSchemas.dateString.optional(),
      ...standardSchemas.pagination.shape,
    })
    .refine(
      (data) => {
        if (data.startDate && data.endDate) {
          return new Date(data.startDate) <= new Date(data.endDate);
        }
        return true;
      },
      {
        message: 'Start date must be before or equal to end date',
        path: ['dateRange'],
      },
    ),
  status: z.object({
    status: z
      .enum(['active', 'inactive', 'pending', 'completed', 'failed'])
      .optional(),
    ...standardSchemas.pagination.shape,
  }),
};

// Standard body validation schemas
export const bodySchemas = {
  auth: {
    login: z.object({
      email: standardSchemas.email,
      password: z.string().min(1, 'Password is required'),
      rememberMe: z.boolean().optional(),
    }),
    register: z.object({
      email: standardSchemas.email,
      password: standardSchemas.password,
      name: z.string().min(1, 'Name is required').max(100),
      acceptTerms: z.boolean().refine((val) => val === true, {
        message: 'You must accept the terms and conditions',
      }),
    }),
    changePassword: z
      .object({
        currentPassword: z.string().min(1, 'Current password is required'),
        newPassword: standardSchemas.password,
        confirmPassword: z.string(),
      })
      .refine((data) => data.newPassword === data.confirmPassword, {
        message: 'Passwords do not match',
        path: ['confirmPassword'],
      }),
  },
  invoice: {
    create: z.object({
      fileId: standardSchemas.uuid,
      templateId: standardSchemas.uuid.optional(),
      options: z
        .object({
          engine: z.enum(['tesseract', 'google-vision']).optional(),
          skipValidation: z.boolean().optional(),
        })
        .optional(),
    }),
    update: z.object({
      invoiceNumber: z.string().max(50).optional(),
      invoiceDate: standardSchemas.dateString.optional(),
      dueDate: standardSchemas.dateString.optional(),
      vendorName: z.string().max(100).optional(),
      totalAmount: standardSchemas.positiveNumber.optional(),
      taxAmount: standardSchemas.nonNegativeNumber.optional(),
      subtotal: standardSchemas.positiveNumber.optional(),
      status: z.enum(['draft', 'pending', 'approved', 'rejected']).optional(),
      notes: z.string().max(500).optional(),
    }),
  },
  file: {
    metadata: z.object({
      description: z.string().max(200).optional(),
      tags: z.array(z.string().max(50)).max(10).optional(),
      category: z.enum(['invoice', 'receipt', 'statement', 'other']).optional(),
    }),
  },
};

// Middleware to ensure consistent response format
export const standardizeResponse = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const originalJson = res.json;

  res.json = function (data: any) {
    const requestId = req.headers['x-request-id'] as string;

    // If it's already a standardized response, don't modify it
    if (data && typeof data === 'object' && 'success' in data) {
      return originalJson.call(this, data);
    }

    // Standardize the response
    const standardResponse = {
      success: true,
      data,
      timestamp: new Date().toISOString(),
      requestId,
    };

    return originalJson.call(this, standardResponse);
  };

  next();
};

// Content type validation middleware
export const validateContentType = (
  allowedTypes: string[] = ['application/json'],
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestId = req.headers['x-request-id'] as string;

    if (req.method === 'GET' || req.method === 'DELETE') {
      return next();
    }

    const contentType = req.headers['content-type'];

    if (!contentType) {
      return res
        .status(400)
        .json(
          createErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            'Content-Type header is required',
            'Please specify a valid Content-Type header',
            '/help/api-reference',
            undefined,
            { allowedTypes },
            requestId,
          ),
        );
    }

    const isValidType = allowedTypes.some((type) =>
      contentType.toLowerCase().includes(type.toLowerCase()),
    );

    if (!isValidType) {
      return res
        .status(400)
        .json(
          createErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            `Invalid Content-Type: ${contentType}`,
            `Please use one of the allowed content types: ${allowedTypes.join(', ')}`,
            '/help/api-reference',
            undefined,
            { allowedTypes, received: contentType },
            requestId,
          ),
        );
    }

    next();
  };
};

export default {
  validateRequest,
  standardSchemas,
  paramSchemas,
  querySchemas,
  bodySchemas,
  standardizeResponse,
  validateContentType,
};
