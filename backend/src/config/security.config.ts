// @ts-nocheck

import { registerAs } from '@nestjs/config';

export default registerAs('security', () => ({
  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET,
    accessTokenExpiry: process.env.JWT_EXPIRY || '15m',
    refreshTokenExpiry: parseInt(
      process.env.JWT_REFRESH_EXPIRY || '604800',
      10,
    ), // 7 days in seconds
  },

  // HSTS Configuration
  hsts: {
    enabled: process.env.NODE_ENV === 'production',
    maxAge: parseInt(process.env.HSTS_MAX_AGE || '31536000', 10), // 1 year in seconds
    includeSubDomains: true,
    preload: true,
  },

  // CORS Configuration
  cors: {
    allowedOrigins: (process.env.ALLOWED_ORIGINS || '')
      .split(',')
      .filter(Boolean),
    allowedMethods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
    exposedHeaders: [],
    credentials: true,
    maxAge: 86400, // 24 hours
  },

  // Content Security Policy
  csp: {
    enabled: true,
    reportOnly: process.env.NODE_ENV !== 'production',
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      connectSrc: ["'self'", process.env.FRONTEND_URL],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      formAction: ["'self'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },

  // Rate Limiting (to be implemented)
  rateLimit: {
    enabled: process.env.NODE_ENV === 'production',
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
  },

  // Security Headers
  headers: {
    // Remove X-Powered-By header
    removeXPoweredBy: true,

    // X-Content-Type-Options
    xContentTypeOptions: 'nosniff',

    // X-Frame-Options
    xFrameOptions: 'DENY',

    // X-XSS-Protection
    xXssProtection: '1; mode=block',

    // Referrer-Policy
    referrerPolicy: 'strict-origin-when-cross-origin',

    // Permissions-Policy
    permissionsPolicy: {
      geolocation: '()',
      microphone: '()',
      camera: '()',
      payment: '()',
      usb: '()',
      accelerometer: '()',
      gyroscope: '()',
      magnetometer: '()',
    },
  },
}));
