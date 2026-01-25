// @ts-nocheck

import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redis } from '../redis';
import { ProductionSecurityConfig, RateLimitConfig } from '../config/production-security.config';
import { logger } from '../utils/logger';

export class RateLimitEnhancementMiddleware {
  private config: RateLimitConfig;
  private redis = redis;
  private progressiveDelays: Map<string, { count: number; lastRequest: Date }>;

  constructor(private securityConfig: ProductionSecurityConfig) {
    this.config = securityConfig.getRateLimitConfig();
    this.progressiveDelays = new Map();
  }

  private createLimiter(options: {
    windowMs: number;
    max: number;
    keyPrefix: string;
    message?: string;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
  }) {
    const { windowMs, max, keyPrefix, message, skipSuccessfulRequests, skipFailedRequests } = options;

    const limiterConfig: any = {
      windowMs,
      max,
      message: message || 'Too many requests, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: skipSuccessfulRequests || false,
      skipFailedRequests: skipFailedRequests || false,
      keyGenerator: (req: Request) => {
        const userId = (req as any).user?.id;
        return userId ? `${req.ip}:${userId}` : req.ip;
      },
      handler: (req: Request, res: Response) => {
        logger.warn('Rate limit exceeded', {
          ip: req.ip,
          path: req.path,
          keyPrefix,
          userId: (req as any).user?.id,
        });

        res.status(429).json({
          error: message || 'Too many requests, please try again later.',
          retryAfter: res.getHeader('Retry-After'),
          limit: max,
          windowMs,
        });
      },
    };

    if (this.config.redis.enabled) {
      limiterConfig.store = new RedisStore({
        sendCommand: (...args: string[]) => this.redis.call(...args),
        prefix: `${this.config.redis.keyPrefix}:${keyPrefix}:`,
      });
    }

    return rateLimit(limiterConfig);
  }

  public globalLimiter() {
    return this.createLimiter({
      windowMs: this.config.global.windowMs,
      max: this.config.global.max,
      keyPrefix: 'global',
      message: 'Too many requests from this IP, please try again later.',
    });
  }

  public authLimiter() {
    return this.createLimiter({
      windowMs: this.config.auth.windowMs,
      max: this.config.auth.max,
      keyPrefix: 'auth',
      message: 'Too many authentication attempts, please try again later.',
      skipSuccessfulRequests: this.config.auth.skipSuccessfulRequests,
    });
  }

  public uploadLimiter() {
    return this.createLimiter({
      windowMs: this.config.upload.windowMs,
      max: this.config.upload.max,
      keyPrefix: 'upload',
      message: 'Too many upload requests, please try again later.',
    });
  }

  public ocrLimiter() {
    return this.createLimiter({
      windowMs: this.config.ocr.windowMs,
      max: this.config.ocr.max,
      keyPrefix: 'ocr',
      message: 'Too many OCR processing requests, please try again later.',
    });
  }

  public apiLimiter() {
    return this.createLimiter({
      windowMs: this.config.api.windowMs,
      max: this.config.api.max,
      keyPrefix: 'api',
      message: 'Too many API requests, please try again later.',
    });
  }

  public progressiveLimiter() {
    if (!this.config.progressive.enabled) {
      return (req: Request, res: Response, next: NextFunction) => next();
    }

    return (req: Request, res: Response, next: NextFunction) => {
      const key = req.ip;
      const now = new Date();
      const delayData = this.progressiveDelays.get(key);

      if (delayData) {
        const timeSinceLastRequest = now.getTime() - delayData.lastRequest.getTime();
        const requiredDelay = Math.min(
          delayData.count * this.config.progressive.multiplier * 1000,
          this.config.progressive.maxDelay
        );

        if (timeSinceLastRequest < requiredDelay) {
          const remainingDelay = requiredDelay - timeSinceLastRequest;

          logger.warn('Progressive rate limit applied', {
            ip: key,
            delay: remainingDelay,
            requestCount: delayData.count,
          });

          return res.status(429).json({
            error: 'Request rate too high, progressive delay applied.',
            retryAfter: Math.ceil(remainingDelay / 1000),
            delayMs: remainingDelay,
          });
        }

        if (timeSinceLastRequest > this.config.global.windowMs) {
          this.progressiveDelays.set(key, { count: 1, lastRequest: now });
        } else {
          delayData.count++;
          delayData.lastRequest = now;
        }
      } else {
        this.progressiveDelays.set(key, { count: 1, lastRequest: now });
      }

      next();
    };
  }

  public suspiciousActivityDetector() {
    const suspiciousPatterns = [
      /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/i,
      /(\'|\"|;|--|\*|\|)/,
      /(\b(or|and)\b\s+\d+\s*=\s*\d+)/i,
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/i,
      /on\w+\s*=/i,
      /\.\./,
      /%2e%2e/i,
      /(\||;|&|`|\$\(|\${)/,
      /(rm|cat|ls|ps|kill|chmod|chown|sudo)/i,
    ];

    const suspiciousUserAgents = [
      /sqlmap/i,
      /nikto/i,
      /nmap/i,
      /burp/i,
      /owasp/i,
      /zap/i,
      /curl/i,
      /wget/i,
    ];

    const suspiciousActivity = new Map<string, { count: number; lastActivity: Date; blocked: boolean }>();

    return (req: Request, res: Response, next: NextFunction) => {
      const key = req.ip;
      const now = new Date();
      const checkString = `${req.url} ${JSON.stringify(req.query)} ${JSON.stringify(req.body)}`;
      const userAgent = req.get('User-Agent') || '';

      const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(checkString)) ||
        suspiciousUserAgents.some(pattern => pattern.test(userAgent));

      if (isSuspicious) {
        const activity = suspiciousActivity.get(key) || { count: 0, lastActivity: now, blocked: false };
        activity.count++;
        activity.lastActivity = now;

        if (activity.count >= 5 && (now.getTime() - activity.lastActivity.getTime()) < 10 * 60 * 1000) {
          activity.blocked = true;

          logger.error('Suspicious activity detected - IP blocked', {
            ip: key,
            suspiciousCount: activity.count,
            url: req.url,
            userAgent,
          });

          return res.status(403).json({
            error: 'Suspicious activity detected. Access blocked.',
          });
        }

        suspiciousActivity.set(key, activity);

        logger.warn('Suspicious activity detected', {
          ip: key,
          url: req.url,
          userAgent,
          suspiciousCount: activity.count,
        });
      }

      const oneHourAgo = now.getTime() - 60 * 60 * 1000;
      for (const [ip, activity] of suspiciousActivity.entries()) {
        if (activity.lastActivity.getTime() < oneHourAgo) {
          suspiciousActivity.delete(ip);
        }
      }

      next();
    };
  }

  public enhanceExisting() {
    return (req: Request, res: Response, next: NextFunction) => {
      res.setHeader('X-RateLimit-Policy', 'Enhanced');
      res.setHeader('X-RateLimit-Backend', this.config.redis.enabled ? 'Redis' : 'Memory');
      next();
    };
  }

  public createCustomLimiter(options: {
    windowMs: number;
    max: number;
    keyPrefix: string;
    message?: string;
    condition?: (req: Request) => boolean;
  }) {
    const { condition, ...limiterOptions } = options;
    const limiter = this.createLimiter(limiterOptions);

    return (req: Request, res: Response, next: NextFunction) => {
      if (condition && !condition(req)) {
        return next();
      }
      return limiter(req, res, next);
    };
  }

  public getMetrics() {
    return {
      redisEnabled: this.config.redis.enabled,
      progressiveEnabled: this.config.progressive.enabled,
      activeDelays: this.progressiveDelays.size,
      configuration: {
        global: this.config.global,
        auth: this.config.auth,
        upload: this.config.upload,
        ocr: this.config.ocr,
        api: this.config.api,
      },
    };
  }

  public async getRedisStats() {
    try {
      const info = await this.redis.info('memory');
      const keyCount = await this.redis.dbsize();

      return {
        connected: true,
        keyCount,
        memoryInfo: info,
      };
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  public async clearRateLimitData(ip?: string) {
    try {
      if (ip) {
        const pattern = `${this.config.redis.keyPrefix}:*:${ip}*`;
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } else {
        const pattern = `${this.config.redis.keyPrefix}:*`;
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      }
      return true;
    } catch (error) {
      return false;
    }
  }
}
