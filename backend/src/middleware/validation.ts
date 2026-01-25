// @ts-nocheck

import { Request, Response, NextFunction } from 'express';

export interface ValidationSchema {
  params?: any;
  query?: any;
  body?: any;
  headers?: any;
}

export const validateRequest = (schema: ValidationSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Simple validation middleware for testing
    // In a real implementation, this would use a validation library like Joi or Zod

    const errors: string[] = [];

    // Basic validation logic
    if (schema.body) {
      for (const [key, rules] of Object.entries(schema.body)) {
        const value = req.body[key];

        if (rules.type === 'number' && typeof value === 'number') {
          if (rules.minimum !== undefined && value < rules.minimum) {
            errors.push(`${key} must be at least ${rules.minimum}`);
          }
          if (rules.maximum !== undefined && value > rules.maximum) {
            errors.push(`${key} must be at most ${rules.maximum}`);
          }
        }

        if (
          rules.type === 'array' &&
          !rules.optional &&
          !Array.isArray(value)
        ) {
          errors.push(`${key} must be an array`);
        }

        if (rules.type === 'string' && rules.format === 'date' && value) {
          const date = new Date(value);
          if (isNaN(date.getTime())) {
            errors.push(`${key} must be a valid date`);
          }
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid filter parameters',
        details: errors,
      });
    }

    next();
  };
};
