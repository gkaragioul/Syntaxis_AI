import { describe, it, expect, beforeEach, jest } from '../jest-globals';
import { Request, Response, NextFunction } from 'express';
import { Redis } from 'ioredis';
import { rateLimiter } from '../../middleware/rateLimiter';
import { RateLimitError } from '../../utils/errors';

describe('Rate Limiter Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let redis: jest.Mocked<Redis>;

  beforeEach(() => {
    redis = new Redis() as jest.Mocked<Redis>;
    mockReq = {
      ip: '127.0.0.1',
      path: '/api/test',
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
    };
    mockNext = jest.fn();
  });

  describe('rateLimiter', () => {
    it('should allow request within rate limit', async () => {
      redis.incr.mockResolvedValueOnce(1);
      redis.expire.mockResolvedValueOnce('OK');

      const middleware = rateLimiter({
        windowMs: 60000,
        max: 10,
        redis,
      });

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it('should block request exceeding rate limit', async () => {
      redis.incr.mockResolvedValueOnce(11);
      redis.expire.mockResolvedValueOnce('OK');

      const middleware = rateLimiter({
        windowMs: 60000,
        max: 10,
        redis,
      });

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(RateLimitError));
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it('should set rate limit headers', async () => {
      redis.incr.mockResolvedValueOnce(5);
      redis.expire.mockResolvedValueOnce('OK');

      const middleware = rateLimiter({
        windowMs: 60000,
        max: 10,
        redis,
      });

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '10');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Remaining',
        '5',
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Reset',
        expect.any(Number),
      );
    });

    it('should handle Redis errors gracefully', async () => {
      redis.incr.mockRejectedValueOnce(new Error('Redis connection error'));

      const middleware = rateLimiter({
        windowMs: 60000,
        max: 10,
        redis,
      });

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it('should use different limits for different paths', async () => {
      const middleware = rateLimiter({
        windowMs: 60000,
        max: 10,
        redis,
        keyGenerator: (req) => `${req.ip}:${req.path}`,
      });

      // First path
      mockReq.path = '/api/test1';
      redis.incr.mockResolvedValueOnce(1);
      redis.expire.mockResolvedValueOnce('OK');

      await middleware(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
      mockNext.mockClear();

      // Second path
      mockReq.path = '/api/test2';
      redis.incr.mockResolvedValueOnce(1);
      redis.expire.mockResolvedValueOnce('OK');

      await middleware(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();

      expect(redis.incr).toHaveBeenCalledTimes(2);
      expect(redis.incr).toHaveBeenCalledWith('127.0.0.1:/api/test1');
      expect(redis.incr).toHaveBeenCalledWith('127.0.0.1:/api/test2');
    });

    it('should skip rate limiting for whitelisted IPs', async () => {
      const middleware = rateLimiter({
        windowMs: 60000,
        max: 10,
        redis,
        skip: (req) => req.ip === '127.0.0.1',
      });

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(redis.incr).not.toHaveBeenCalled();
      expect(redis.expire).not.toHaveBeenCalled();
    });

    it('should handle concurrent requests correctly', async () => {
      const middleware = rateLimiter({
        windowMs: 60000,
        max: 10,
        redis,
      });

      // Simulate concurrent requests
      const requests = Array(5)
        .fill(null)
        .map(() => ({
          ...mockReq,
          ip: '127.0.0.1',
        }));

      redis.incr.mockResolvedValueOnce(1);
      redis.incr.mockResolvedValueOnce(2);
      redis.incr.mockResolvedValueOnce(3);
      redis.incr.mockResolvedValueOnce(4);
      redis.incr.mockResolvedValueOnce(5);
      redis.expire.mockResolvedValue('OK');

      await Promise.all(
        requests.map((req) =>
          middleware(req as Request, mockRes as Response, mockNext),
        ),
      );

      expect(redis.incr).toHaveBeenCalledTimes(5);
      expect(mockNext).toHaveBeenCalledTimes(5);
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });
  });
});
