import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { ProductionSecurityConfig } from '../../config/production-security.config';

/**
 * Production Security Tests
 *
 * Tests the production security configuration and validation
 */
describe('Production Security', () => {
  let securityConfig: ProductionSecurityConfig;

  beforeEach(() => {
    // Mock environment for production
    process.env.NODE_ENV = 'production';
    process.env.SECURITY_LEVEL = 'high';
    process.env.ENABLE_SECURITY_MONITORING = 'true';

    securityConfig = new ProductionSecurityConfig();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Security Configuration', () => {
    it('should validate production security configuration', () => {
      const config = securityConfig.getConfig();

      expect(config.level).toBe('high');
      expect(config.monitoring).toBe(true);
      expect(config.rateLimit.enabled).toBe(true);
      expect(config.csp.enabled).toBe(true);
      expect(config.cors.enabled).toBe(true);
      expect(config.headers.hsts.enabled).toBe(true);
      expect(config.validation.enabled).toBe(true);
      expect(config.logging.enabled).toBe(true);
    });

    it('should have strict CSP configuration for production', () => {
      const cspConfig = securityConfig.getCSPConfig();

      expect(cspConfig.enabled).toBe(true);
      expect(cspConfig.reportOnly).toBe(false);
      expect(cspConfig.directives.defaultSrc).toContain("'self'");
      expect(cspConfig.directives.objectSrc).toContain("'none'");
      expect(cspConfig.directives.frameSrc).toContain("'none'");
    });

    it('should have secure headers configuration', () => {
      const headersConfig = securityConfig.getSecurityHeadersConfig();

      expect(headersConfig.removeXPoweredBy).toBe(true);
      expect(headersConfig.hsts.enabled).toBe(true);
      expect(headersConfig.hsts.maxAge).toBeGreaterThan(0);
      expect(headersConfig.xContentTypeOptions).toBe(true);
      expect(headersConfig.xFrameOptions).toBe('DENY');
    });

    it('should have CORS restrictions for production', () => {
      const corsConfig = securityConfig.getCORSConfig();

      expect(corsConfig.enabled).toBe(true);
      expect(corsConfig.credentials).toBe(true);
      expect(Array.isArray(corsConfig.origin)).toBe(true);
    });
  });

  describe('Rate Limiting Configuration', () => {
    it('should have different rate limits for different endpoints', () => {
      const rateLimitConfig = securityConfig.getRateLimitConfig();

      expect(rateLimitConfig.enabled).toBe(true);
      expect(rateLimitConfig.auth.max).toBeLessThan(rateLimitConfig.global.max);
      expect(rateLimitConfig.upload.max).toBeLessThan(rateLimitConfig.global.max);
      expect(rateLimitConfig.ocr.max).toBeGreaterThan(0);
      expect(rateLimitConfig.api.max).toBeGreaterThan(0);
    });

    it('should have progressive rate limiting configuration', () => {
      const rateLimitConfig = securityConfig.getRateLimitConfig();

      expect(rateLimitConfig.progressive.enabled).toBe(true);
      expect(rateLimitConfig.progressive.multiplier).toBeGreaterThan(1);
      expect(rateLimitConfig.progressive.maxDelay).toBeGreaterThan(0);
    });

    it('should have Redis configuration for production', () => {
      const rateLimitConfig = securityConfig.getRateLimitConfig();

      expect(rateLimitConfig.redis.enabled).toBe(true);
      expect(rateLimitConfig.redis.url).toBeDefined();
      expect(rateLimitConfig.redis.keyPrefix).toBe('rate-limit');
    });
  });

  describe('Input Validation Configuration', () => {
    it('should have input validation enabled', () => {
      const validationConfig = securityConfig.getValidationConfig();

      expect(validationConfig.enabled).toBe(true);
      expect(validationConfig.sanitizeInput).toBe(true);
      expect(validationConfig.validateFileUploads).toBe(true);
      expect(validationConfig.preventPathTraversal).toBe(true);
      expect(validationConfig.maxFileSize).toBeGreaterThan(0);
      expect(validationConfig.allowedFileTypes).toContain('application/pdf');
    });

    it('should have file upload validation configuration', () => {
      const validationConfig = securityConfig.getValidationConfig();

      expect(validationConfig.allowedFileTypes).toContain('image/jpeg');
      expect(validationConfig.allowedFileTypes).toContain('image/png');
      expect(validationConfig.allowedFileTypes).toContain('application/pdf');
      expect(validationConfig.maxFileSize).toBe(100 * 1024 * 1024); // 100MB
    });
  });

  describe('Security Logging Configuration', () => {
    it('should have security logging enabled', () => {
      const loggingConfig = securityConfig.getLoggingConfig();

      expect(loggingConfig.enabled).toBe(true);
      expect(loggingConfig.logSecurityEvents).toBe(true);
      expect(loggingConfig.logFailedAuth).toBe(true);
      expect(loggingConfig.logSuspiciousActivity).toBe(true);
      expect(loggingConfig.level).toBe('warn');
    });

    it('should have appropriate alert thresholds', () => {
      const loggingConfig = securityConfig.getLoggingConfig();

      expect(loggingConfig.alertThresholds.failedAuthAttempts).toBe(5);
      expect(loggingConfig.alertThresholds.suspiciousRequests).toBe(10);
      expect(loggingConfig.alertThresholds.rateLimitViolations).toBe(20);
    });

  });

  describe('Environment-Based Configuration', () => {
    it('should provide different configurations for different environments', () => {
      process.env.NODE_ENV = 'development';
      const devConfig = new ProductionSecurityConfig();

      process.env.NODE_ENV = 'staging';
      const stagingConfig = new ProductionSecurityConfig();

      process.env.NODE_ENV = 'production';
      const prodConfig = new ProductionSecurityConfig();

      expect(devConfig.getSecurityLevel()).toBe('low');
      expect(stagingConfig.getSecurityLevel()).toBe('medium');
      expect(prodConfig.getSecurityLevel()).toBe('high');
    });

    it('should validate security configuration completeness', () => {
      const validation = securityConfig.validateConfiguration();

      expect(validation).toBeDefined();
      expect(validation.isValid).toBeDefined();
      expect(validation.errors).toBeDefined();
      expect(validation.warnings).toBeDefined();
    });

    it('should provide security metrics', () => {
      const metrics = securityConfig.getSecurityMetrics();

      expect(metrics.environment).toBe('production');
      expect(metrics.securityLevel).toBe('high');
      expect(metrics.monitoringEnabled).toBe(true);
      expect(metrics.rateLimitEnabled).toBe(true);
      expect(metrics.cspEnabled).toBe(true);
      expect(metrics.hstsEnabled).toBe(true);
      expect(metrics.validationEnabled).toBe(true);
    });
  });
});
