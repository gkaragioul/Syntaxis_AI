import { logger } from '../utils/logger';

export interface SecurityConfig {
  level: 'low' | 'medium' | 'high';
  monitoring: boolean;
  rateLimit: RateLimitConfig;
  csp: CSPConfig;
  cors: CORSConfig;
  headers: SecurityHeadersConfig;
  validation: ValidationConfig;
  logging: SecurityLoggingConfig;
}

export interface RateLimitConfig {
  enabled: boolean;
  redis: {
    enabled: boolean;
    url: string;
    keyPrefix: string;
  };
  global: {
    windowMs: number;
    max: number;
  };
  auth: {
    windowMs: number;
    max: number;
    skipSuccessfulRequests: boolean;
  };
  upload: {
    windowMs: number;
    max: number;
  };
  ocr: {
    windowMs: number;
    max: number;
  };
  api: {
    windowMs: number;
    max: number;
  };
  progressive: {
    enabled: boolean;
    multiplier: number;
    maxDelay: number;
  };
}

export interface CSPConfig {
  enabled: boolean;
  reportOnly: boolean;
  directives: {
    defaultSrc: string[];
    scriptSrc: string[];
    styleSrc: string[];
    imgSrc: string[];
    connectSrc: string[];
    fontSrc: string[];
    objectSrc: string[];
    mediaSrc: string[];
    frameSrc: string[];
    formAction: string[];
    baseUri: string[];
    frameAncestors: string[];
  };
  reportUri?: string;
}

export interface CORSConfig {
  enabled: boolean;
  origin: string[] | boolean;
  methods: string[];
  allowedHeaders: string[];
  credentials: boolean;
  maxAge: number;
  preflightContinue: boolean;
  optionsSuccessStatus: number;
}

export interface SecurityHeadersConfig {
  hsts: {
    enabled: boolean;
    maxAge: number;
    includeSubDomains: boolean;
    preload: boolean;
  };
  xContentTypeOptions: boolean;
  xFrameOptions: string;
  xXssProtection: string;
  referrerPolicy: string;
  permissionsPolicy: Record<string, string>;
  removeXPoweredBy: boolean;
}

export interface ValidationConfig {
  enabled: boolean;
  sanitizeInput: boolean;
  validateFileUploads: boolean;
  preventPathTraversal: boolean;
  maxRequestSize: string;
  allowedFileTypes: string[];
  maxFileSize: number;
}

export interface SecurityLoggingConfig {
  enabled: boolean;
  level: 'debug' | 'info' | 'warn' | 'error';
  logSecurityEvents: boolean;
  logFailedAuth: boolean;
  logSuspiciousActivity: boolean;
  alertThresholds: {
    failedAuthAttempts: number;
    suspiciousRequests: number;
    rateLimitViolations: number;
  };
}

export class ProductionSecurityConfig {
  private config: SecurityConfig;
  private environment: string;

  constructor() {
    this.environment = process.env.NODE_ENV || 'development';
    this.config = this.buildConfiguration();
    this.validateConfiguration();
  }

  private buildConfiguration(): SecurityConfig {
    const isProduction = this.environment === 'production';
    const isStaging = this.environment === 'staging';
    const isDevelopment = this.environment === 'development';

    return {
      level: isProduction ? 'high' : isStaging ? 'medium' : 'low',
      monitoring: process.env.ENABLE_SECURITY_MONITORING === 'true' || isProduction,

      rateLimit: {
        enabled: true,
        redis: {
          enabled: !isDevelopment,
          url: process.env.REDIS_URL || 'redis://localhost:6379',
          keyPrefix: 'rate-limit',
        },
        global: {
          windowMs: 15 * 60 * 1000, // 15 minutes
          max: isProduction ? 100 : isDevelopment ? 1000 : 500,
        },
        auth: {
          windowMs: 15 * 60 * 1000, // 15 minutes
          max: isProduction ? 5 : isDevelopment ? 50 : 20,
          skipSuccessfulRequests: true,
        },
        upload: {
          windowMs: 60 * 1000, // 1 minute
          max: isProduction ? 10 : isDevelopment ? 100 : 50,
        },
        ocr: {
          windowMs: 60 * 1000, // 1 minute
          max: isProduction ? 20 : isDevelopment ? 200 : 100,
        },
        api: {
          windowMs: 60 * 1000, // 1 minute
          max: isProduction ? 60 : isDevelopment ? 600 : 300,
        },
        progressive: {
          enabled: isProduction,
          multiplier: 2,
          maxDelay: 30000, // 30 seconds
        },
      },

      csp: {
        enabled: true,
        reportOnly: isDevelopment,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: isDevelopment 
            ? ["'self'", "'unsafe-inline'", "'unsafe-eval'"]
            : ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", process.env.FRONTEND_URL || 'http://localhost:3000'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
          formAction: ["'self'"],
          baseUri: ["'self'"],
          frameAncestors: ["'none'"],
        },
        reportUri: isProduction ? '/api/v1/security/csp-report' : undefined,
      },

      cors: {
        enabled: true,
        origin: isDevelopment 
          ? true 
          : (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:3000').split(','),
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Requested-With'],
        credentials: true,
        maxAge: 86400, // 24 hours
        preflightContinue: false,
        optionsSuccessStatus: 204,
      },

      headers: {
        hsts: {
          enabled: isProduction,
          maxAge: 31536000, // 1 year
          includeSubDomains: true,
          preload: true,
        },
        xContentTypeOptions: true,
        xFrameOptions: 'DENY',
        xXssProtection: '1; mode=block',
        referrerPolicy: 'strict-origin-when-cross-origin',
        permissionsPolicy: {
          geolocation: '()',
          microphone: '()',
          camera: '()',
          payment: '()',
          usb: '()',
          accelerometer: '()',
          gyroscope: '()',
          magnetometer: '()',
          fullscreen: '(self)',
        },
        removeXPoweredBy: true,
      },

      validation: {
        enabled: true,
        sanitizeInput: true,
        validateFileUploads: true,
        preventPathTraversal: true,
        maxRequestSize: '100mb',
        allowedFileTypes: [
          'application/pdf',
          'image/jpeg',
          'image/jpg',
          'image/png',
          'image/gif',
          'image/webp',
          'text/plain',
        ],
        maxFileSize: 100 * 1024 * 1024, // 100MB
      },

      logging: {
        enabled: true,
        level: isProduction ? 'warn' : isDevelopment ? 'debug' : 'info',
        logSecurityEvents: true,
        logFailedAuth: true,
        logSuspiciousActivity: true,
        alertThresholds: {
          failedAuthAttempts: isProduction ? 5 : 20,
          suspiciousRequests: isProduction ? 10 : 50,
          rateLimitViolations: isProduction ? 20 : 100,
        },
      },
    };
  }

  public getConfig(): SecurityConfig {
    return this.config;
  }

  public isProduction(): boolean {
    return this.environment === 'production';
  }

  public getSecurityLevel(): 'low' | 'medium' | 'high' {
    return this.config.level;
  }

  public isSecurityMonitoringEnabled(): boolean {
    return this.config.monitoring;
  }

  public getRateLimitConfig(): RateLimitConfig {
    return this.config.rateLimit;
  }

  public getCSPConfig(): CSPConfig {
    return this.config.csp;
  }

  public getCORSConfig(): CORSConfig {
    return this.config.cors;
  }

  public getSecurityHeadersConfig(): SecurityHeadersConfig {
    return this.config.headers;
  }

  public getValidationConfig(): ValidationConfig {
    return this.config.validation;
  }

  public getLoggingConfig(): SecurityLoggingConfig {
    return this.config.logging;
  }

  public validateConfiguration(): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate required environment variables for production
    if (this.isProduction()) {
      const requiredEnvVars = [
        'JWT_SECRET',
        'DATABASE_URL',
        'REDIS_URL',
        'FRONTEND_URL',
      ];

      for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
          errors.push(`Missing required environment variable: ${envVar}`);
        }
      }

      // Check JWT secret strength
      const jwtSecret = process.env.JWT_SECRET;
      if (jwtSecret && jwtSecret.length < 32) {
        warnings.push('JWT_SECRET should be at least 32 characters long for production');
      }

      // Check if HTTPS is enforced
      if (!this.config.headers.hsts.enabled) {
        warnings.push('HSTS should be enabled in production');
      }

      // Check CSP configuration
      if (this.config.csp.reportOnly) {
        warnings.push('CSP should not be in report-only mode in production');
      }
    }

    // Validate rate limiting configuration
    if (this.config.rateLimit.enabled && !this.config.rateLimit.redis.enabled && this.isProduction()) {
      warnings.push('Redis-based rate limiting is recommended for production');
    }

    // Log validation results
    if (errors.length > 0) {
      logger.error('Security configuration validation failed', { errors });
    }

    if (warnings.length > 0) {
      logger.warn('Security configuration warnings', { warnings });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  public getSecurityMetrics(): Record<string, any> {
    return {
      environment: this.environment,
      securityLevel: this.config.level,
      monitoringEnabled: this.config.monitoring,
      rateLimitEnabled: this.config.rateLimit.enabled,
      cspEnabled: this.config.csp.enabled,
      hstsEnabled: this.config.headers.hsts.enabled,
      validationEnabled: this.config.validation.enabled,
      loggingLevel: this.config.logging.level,
    };
  }
}
