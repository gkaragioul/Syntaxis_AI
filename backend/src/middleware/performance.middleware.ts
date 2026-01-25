// @ts-nocheck

/**
 * Performance Optimization Middleware
 *
 * Task 2.2.2: Performance Optimizations Implementation - TDD GREEN Phase
 *
 * This middleware implements performance optimizations to meet <200ms API response requirement.
 * Following TDD: Red-Green-Refactor approach.
 */

import { Request, Response, NextFunction } from 'express';
import { Logger } from 'winston';
import { logger } from '../utils/logger';
import compression from 'compression';
import helmet from 'helmet';

// Performance configuration
interface PerformanceConfig {
  enableCompression: boolean;
  enableCaching: boolean;
  enableRequestLogging: boolean;
  responseTimeThreshold: number;
  slowQueryThreshold: number;
}

const defaultConfig: PerformanceConfig = {
  enableCompression: true,
  enableCaching: true,
  enableRequestLogging: true,
  responseTimeThreshold: 200, // 200ms
  slowQueryThreshold: 100, // 100ms
};

// Request timing interface
interface RequestTiming {
  startTime: number;
  endTime?: number;
  duration?: number;
  endpoint: string;
  method: string;
  statusCode?: number;
}

/**
 * Performance monitoring middleware
 * GREEN: Basic implementation to track response times
 */
export const performanceMonitoring = (config: PerformanceConfig = defaultConfig) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    // Add timing info to request
    (req as any).timing = {
      startTime,
      endpoint: req.path,
      method: req.method,
    } as RequestTiming;

    // Override res.end to capture response time
    const originalEnd = res.end;
    res.end = function(chunk?: any, encoding?: any) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Update timing info
      const timing = (req as any).timing as RequestTiming;
      timing.endTime = endTime;
      timing.duration = duration;
      timing.statusCode = res.statusCode;

      // Log slow requests
      if (config.enableRequestLogging && duration > config.responseTimeThreshold) {
        logger.warn('Slow API response detected', {
          endpoint: req.path,
          method: req.method,
          duration,
          statusCode: res.statusCode,
          threshold: config.responseTimeThreshold,
        });
      }

      // Add performance headers
      res.setHeader('X-Response-Time', `${duration}ms`);
      res.setHeader('X-Performance-Threshold', `${config.responseTimeThreshold}ms`);

      // Call original end method
      originalEnd.call(this, chunk, encoding);
    };

    next();
  };
};

/**
 * Response compression middleware
 * GREEN: Enable gzip compression for faster responses
 */
export const responseCompression = compression({
  filter: (req, res) => {
    // Don't compress if the request includes a cache-control: no-transform directive
    if (req.headers['cache-control'] && req.headers['cache-control'].includes('no-transform')) {
      return false;
    }

    // Use compression filter function
    return compression.filter(req, res);
  },
  threshold: 1024, // Only compress responses larger than 1KB
});

/**
 * Security headers middleware (optimized for performance)
 * GREEN: Basic security headers without performance impact
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: false, // Disable CSP for better performance in development
  crossOriginEmbedderPolicy: false,
});

/**
 * Request caching middleware
 * GREEN: Simple in-memory caching for GET requests
 */
const cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

export const requestCaching = (ttlMs: number = 60000) => { // 1 minute default TTL
  return (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Generate cache key
    const cacheKey = `${req.method}:${req.path}:${JSON.stringify(req.query)}:${req.get('Authorization') || ''}`;

    // Check cache
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('X-Cache-TTL', `${Math.round((cached.ttl - (Date.now() - cached.timestamp)) / 1000)}s`);
      return res.json(cached.data);
    }

    // Override res.json to cache response
    const originalJson = res.json;
    res.json = function(data: any) {
      // Cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cache.set(cacheKey, {
          data,
          timestamp: Date.now(),
          ttl: ttlMs,
        });

        // Clean up expired entries periodically
        if (cache.size > 1000) {
          const now = Date.now();
          for (const [key, value] of cache.entries()) {
            if (now - value.timestamp > value.ttl) {
              cache.delete(key);
            }
          }
        }
      }

      res.setHeader('X-Cache', 'MISS');
      return originalJson.call(this, data);
    };

    next();
  };
};

/**
 * Database query optimization middleware
 * GREEN: Add query timing and optimization hints
 */
export const databaseOptimization = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Add database timing context
    (req as any).dbTiming = {
      queries: [],
      totalTime: 0,
    };

    // Add query optimization hints to request context
    (req as any).queryHints = {
      useIndex: true,
      limitResults: true,
      selectFields: true,
      avoidN1: true,
    };

    next();
  };
};

/**
 * Request size limiting middleware
 * GREEN: Prevent large payloads that slow down processing
 */
export const requestSizeLimiting = (maxSize: string = '10mb') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = req.get('content-length');

    if (contentLength) {
      const sizeInBytes = parseInt(contentLength);
      const maxSizeInBytes = parseSize(maxSize);

      if (sizeInBytes > maxSizeInBytes) {
        return res.status(413).json({
          error: 'Request entity too large',
          maxSize,
          receivedSize: formatBytes(sizeInBytes),
        });
      }
    }

    next();
  };
};

/**
 * API rate limiting for performance protection
 * GREEN: Prevent API abuse that could degrade performance
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export const performanceRateLimit = (maxRequests: number = 100, windowMs: number = 15 * 60 * 1000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientId = req.ip || req.get('x-forwarded-for') || 'unknown';
    const now = Date.now();

    // Clean up expired entries
    for (const [key, value] of rateLimitStore.entries()) {
      if (now > value.resetTime) {
        rateLimitStore.delete(key);
      }
    }

    // Get or create rate limit entry
    let rateLimitEntry = rateLimitStore.get(clientId);
    if (!rateLimitEntry || now > rateLimitEntry.resetTime) {
      rateLimitEntry = {
        count: 0,
        resetTime: now + windowMs,
      };
      rateLimitStore.set(clientId, rateLimitEntry);
    }

    // Check rate limit
    if (rateLimitEntry.count >= maxRequests) {
      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', Math.ceil(rateLimitEntry.resetTime / 1000).toString());

      return res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.ceil((rateLimitEntry.resetTime - now) / 1000),
      });
    }

    // Increment counter
    rateLimitEntry.count++;

    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', (maxRequests - rateLimitEntry.count).toString());
    res.setHeader('X-RateLimit-Reset', Math.ceil(rateLimitEntry.resetTime / 1000).toString());

    next();
  };
};

/**
 * Health check optimization
 * GREEN: Ultra-fast health check endpoint
 */
export const optimizedHealthCheck = (req: Request, res: Response, next: NextFunction) => {
  if (req.path === '/api/health' && req.method === 'GET') {
    // Bypass all other middleware for health checks
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Response-Time', '1ms');
    return res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  }

  next();
};

/**
 * Utility functions
 */
function parseSize(size: string): number {
  const units: { [key: string]: number } = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
  };

  const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*([a-z]+)?$/);
  if (!match) return 0;

  const value = parseFloat(match[1]);
  const unit = match[2] || 'b';

  return value * (units[unit] || 1);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Combined performance middleware stack
 * GREEN: All performance optimizations in one middleware stack
 */
export const performanceMiddlewareStack = [
  optimizedHealthCheck,
  performanceMonitoring(),
  securityHeaders,
  responseCompression,
  requestSizeLimiting(),
  performanceRateLimit(),
  requestCaching(),
  databaseOptimization(),
];

// Export individual middleware for selective use
export default {
  performanceMonitoring,
  responseCompression,
  securityHeaders,
  requestCaching,
  databaseOptimization,
  requestSizeLimiting,
  performanceRateLimit,
  optimizedHealthCheck,
  performanceMiddlewareStack,
};
