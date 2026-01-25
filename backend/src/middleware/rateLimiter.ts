// @ts-nocheck

import rateLimit from 'express-rate-limit';
// import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';

import { redis } from '../redis';

// Create different limiters for different endpoints
export const createRateLimiter = (options: {
  windowMs: number;
  max: number;
  keyPrefix: string;
  message?: string;
}) => {
  const { windowMs, max, keyPrefix, message } = options;

  return rateLimit({
    /* store: new RedisStore({
      sendCommand: (...args: string[]) => redis.call(...args),
      prefix: `rate-limit:${keyPrefix}:`,
    }), */
    windowMs,
    max,
    message: message || 'Too many requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        keyPrefix,
      });
      res.status(429).json({
        error: message || 'Too many requests, please try again later.',
        retryAfter: res.getHeader('Retry-After'),
      });
    },
  });
};

// Specific limiters for different endpoints
export const notificationLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  keyPrefix: 'notifications',
  message: 'Too many notification requests, please try again later.',
});

export const errorReportLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  keyPrefix: 'error-reports',
  message: 'Too many error report requests, please try again later.',
});

export const downloadLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 5,
  keyPrefix: 'downloads',
  message: 'Too many download requests, please try again later.',
});

export const rateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 100,
  keyPrefix: 'general',
});

export default rateLimiter;
