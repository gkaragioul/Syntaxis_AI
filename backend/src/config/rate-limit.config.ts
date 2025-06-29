import { registerAs } from '@nestjs/config';

export default registerAs('rateLimit', () => ({
  // Global rate limit configuration
  global: {
    ttl: parseInt(process.env.RATE_LIMIT_TTL || '60', 10), // Time window in seconds
    limit: parseInt(process.env.RATE_LIMIT_MAX || '100', 10), // Max requests per window
  },

  // Specific endpoint configurations
  endpoints: {
    // Authentication endpoints
    auth: {
      login: {
        ttl: 60, // 1 minute
        limit: 5, // 5 attempts per minute
      },
      register: {
        ttl: 3600, // 1 hour
        limit: 3, // 3 registrations per hour
      },
      forgotPassword: {
        ttl: 3600, // 1 hour
        limit: 3, // 3 requests per hour
      },
      resetPassword: {
        ttl: 3600, // 1 hour
        limit: 3, // 3 attempts per hour
      },
      verifyEmail: {
        ttl: 3600, // 1 hour
        limit: 5, // 5 attempts per hour
      },
    },

    // API endpoints
    api: {
      default: {
        ttl: 60, // 1 minute
        limit: 60, // 60 requests per minute
      },
      upload: {
        ttl: 60, // 1 minute
        limit: 10, // 10 uploads per minute
      },
      download: {
        ttl: 60, // 1 minute
        limit: 30, // 30 downloads per minute
      },
    },

    // Webhook endpoints
    webhooks: {
      default: {
        ttl: 60, // 1 minute
        limit: 120, // 120 requests per minute
      },
    },
  },

  // Trusted IPs that bypass rate limiting
  trustedIps: (process.env.TRUSTED_IPS || '').split(',').filter(Boolean),

  // Storage configuration
  storage: {
    // Use Redis in production, memory in development
    type: process.env.NODE_ENV === 'production' ? 'redis' : 'memory',
    // Redis configuration (if using Redis)
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0', 10),
    },
  },

  // Rate limit headers
  headers: {
    // Whether to include rate limit headers in the response
    enabled: true,
    // Header names
    remaining: 'X-RateLimit-Remaining',
    limit: 'X-RateLimit-Limit',
    reset: 'X-RateLimit-Reset',
  },
}));
