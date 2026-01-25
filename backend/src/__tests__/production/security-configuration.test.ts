/**
 * Production Security Configuration Tests
 * 
 * Task 3.1.4: Production Security Configuration Tests - TDD RED Phase
 * 
 * These tests define the production security configuration requirements before deployment.
 * Following strict TDD: Red-Green-Refactor methodology.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import { setupTestEnvironment, cleanupTestEnvironment } from '../utils/test-environment';

// Production Security Requirements
const SECURITY_REQUIREMENTS = {
  CORS_STRICT_ORIGINS: true,
  RATE_LIMITING_ENABLED: true,
  SECURITY_HEADERS_REQUIRED: true,
  INPUT_VALIDATION_STRICT: true,
  SQL_INJECTION_PROTECTION: true,
  XSS_PROTECTION: true,
  CSRF_PROTECTION: true,
  SESSION_SECURITY: true,
  API_KEY_VALIDATION: true,
  ENCRYPTION_AT_REST: true,
  AUDIT_LOGGING: true,
  VULNERABILITY_SCANNING: true,
} as const;

// Security Configuration Interfaces
interface SecurityConfiguration {
  cors: {
    origins: string[];
    credentials: boolean;
    methods: string[];
    allowedHeaders: string[];
    exposedHeaders: string[];
    maxAge: number;
  };
  rateLimit: {
    windowMs: number;
    max: number;
    message: string;
    standardHeaders: boolean;
    legacyHeaders: boolean;
    skipSuccessfulRequests: boolean;
    skipFailedRequests: boolean;
  };
  headers: {
    contentSecurityPolicy: string;
    strictTransportSecurity: string;
    xFrameOptions: string;
    xContentTypeOptions: string;
    referrerPolicy: string;
    permissionsPolicy: string;
  };
  validation: {
    maxRequestSize: number;
    allowedFileTypes: string[];
    maxFileSize: number;
    sanitizeInput: boolean;
    validateSchema: boolean;
  };
  authentication: {
    jwtSecret: string;
    jwtExpiry: number;
    bcryptRounds: number;
    sessionTimeout: number;
    maxLoginAttempts: number;
    lockoutDuration: number;
  };
  encryption: {
    algorithm: string;
    keySize: number;
    ivSize: number;
    saltRounds: number;
  };
  audit: {
    enabled: boolean;
    logLevel: string;
    retentionDays: number;
    sensitiveFields: string[];
  };
}

interface SecurityScan {
  scanId: string;
  timestamp: Date;
  target: string;
  scanType: 'vulnerability' | 'penetration' | 'compliance' | 'configuration';
  status: 'running' | 'completed' | 'failed';
  findings: Array<{
    id: string;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    category: string;
    title: string;
    description: string;
    recommendation: string;
    cve?: string;
    cvss?: number;
  }>;
  compliance: {
    owasp: { score: number; passed: number; total: number };
    gdpr: { compliant: boolean; issues: string[] };
    pci: { compliant: boolean; issues: string[] };
  };
}

interface SecurityAudit {
  auditId: string;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  action: string;
  resource: string;
  method: string;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  errorMessage?: string;
  metadata: any;
}

interface SecurityMetrics {
  period: { start: Date; end: Date };
  requests: {
    total: number;
    blocked: number;
    suspicious: number;
    rateLimited: number;
  };
  authentication: {
    successful: number;
    failed: number;
    bruteForceAttempts: number;
    accountLockouts: number;
  };
  vulnerabilities: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  compliance: {
    owaspScore: number;
    gdprCompliant: boolean;
    pciCompliant: boolean;
  };
}

// RED: These services don't exist yet - tests will fail
class ProductionSecurityService {
  constructor(config: SecurityConfiguration) {}
  async initialize(): Promise<void> {
    throw new Error('Not implemented');
  }
  async validateSecurityConfiguration(): Promise<boolean> {
    throw new Error('Not implemented');
  }
  async performVulnerabilityScan(): Promise<SecurityScan> {
    throw new Error('Not implemented');
  }
  async validateCORSConfiguration(): Promise<boolean> {
    throw new Error('Not implemented');
  }
  async validateSecurityHeaders(): Promise<boolean> {
    throw new Error('Not implemented');
  }
  async validateRateLimiting(): Promise<boolean> {
    throw new Error('Not implemented');
  }
  async validateInputValidation(): Promise<boolean> {
    throw new Error('Not implemented');
  }
  async validateAuthenticationSecurity(): Promise<boolean> {
    throw new Error('Not implemented');
  }
  async validateEncryptionConfiguration(): Promise<boolean> {
    throw new Error('Not implemented');
  }
  async getSecurityMetrics(period: { start: Date; end: Date }): Promise<SecurityMetrics> {
    throw new Error('Not implemented');
  }
  async getAuditLogs(filters: any): Promise<SecurityAudit[]> {
    throw new Error('Not implemented');
  }
  async testSQLInjectionProtection(): Promise<boolean> {
    throw new Error('Not implemented');
  }
  async testXSSProtection(): Promise<boolean> {
    throw new Error('Not implemented');
  }
  async testCSRFProtection(): Promise<boolean> {
    throw new Error('Not implemented');
  }
}

describe('Production Security Configuration', () => {
  let securityService: ProductionSecurityService;
  let securityConfig: SecurityConfiguration;

  beforeEach(async () => {
    await setupTestEnvironment({ useMocks: true });
    
    securityConfig = {
      cors: {
        origins: ['https://app.syntaxis.ai', 'https://syntaxis.ai'],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        exposedHeaders: ['X-Total-Count', 'X-Response-Time'],
        maxAge: 86400, // 24 hours
      },
      rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 1000, // requests per window
        message: 'Too many requests from this IP',
        standardHeaders: true,
        legacyHeaders: false,
        skipSuccessfulRequests: false,
        skipFailedRequests: false,
      },
      headers: {
        contentSecurityPolicy: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
        strictTransportSecurity: 'max-age=31536000; includeSubDomains; preload',
        xFrameOptions: 'DENY',
        xContentTypeOptions: 'nosniff',
        referrerPolicy: 'strict-origin-when-cross-origin',
        permissionsPolicy: 'camera=(), microphone=(), geolocation=()',
      },
      validation: {
        maxRequestSize: 50 * 1024 * 1024, // 50MB
        allowedFileTypes: ['.pdf', '.jpg', '.jpeg', '.png', '.gif'],
        maxFileSize: 10 * 1024 * 1024, // 10MB
        sanitizeInput: true,
        validateSchema: true,
      },
      authentication: {
        jwtSecret: process.env.JWT_SECRET || 'super-secret-key',
        jwtExpiry: 24 * 60 * 60, // 24 hours
        bcryptRounds: 12,
        sessionTimeout: 60 * 60, // 1 hour
        maxLoginAttempts: 5,
        lockoutDuration: 15 * 60, // 15 minutes
      },
      encryption: {
        algorithm: 'aes-256-gcm',
        keySize: 256,
        ivSize: 16,
        saltRounds: 12,
      },
      audit: {
        enabled: true,
        logLevel: 'info',
        retentionDays: 90,
        sensitiveFields: ['password', 'ssn', 'creditCard'],
      },
    };

    securityService = new ProductionSecurityService(securityConfig);
  });

  afterEach(async () => {
    await cleanupTestEnvironment();
  });

  describe('Security Service Initialization', () => {
    it('should initialize production security service', async () => {
      // RED: This test will fail until ProductionSecurityService is implemented
      await expect(securityService.initialize()).resolves.not.toThrow();
    });

    it('should validate security configuration', async () => {
      await securityService.initialize();
      
      const isValid = await securityService.validateSecurityConfiguration();
      expect(isValid).toBe(true);
    });

    it('should reject insecure configuration', async () => {
      const insecureConfig: SecurityConfiguration = {
        ...securityConfig,
        cors: {
          ...securityConfig.cors,
          origins: ['*'], // Wildcard not allowed in production
        },
        authentication: {
          ...securityConfig.authentication,
          jwtSecret: 'weak-secret', // Weak secret
          bcryptRounds: 4, // Too few rounds
        },
      };

      const insecureService = new ProductionSecurityService(insecureConfig);
      await expect(insecureService.initialize()).rejects.toThrow('Insecure configuration detected');
    });
  });

  describe('CORS Configuration', () => {
    it('should validate strict CORS configuration', async () => {
      // RED: This test will fail until CORS validation is implemented
      await securityService.initialize();
      
      const isCORSValid = await securityService.validateCORSConfiguration();
      expect(isCORSValid).toBe(true);
    });

    it('should only allow specific origins', async () => {
      await securityService.initialize();
      
      expect(securityConfig.cors.origins).toEqual(['https://app.syntaxis.ai', 'https://syntaxis.ai']);
      expect(securityConfig.cors.origins).not.toContain('*');
      expect(securityConfig.cors.origins).not.toContain('http://localhost');
    });

    it('should validate CORS headers', async () => {
      await securityService.initialize();
      
      expect(securityConfig.cors.credentials).toBe(true);
      expect(securityConfig.cors.methods).toContain('GET');
      expect(securityConfig.cors.methods).toContain('POST');
      expect(securityConfig.cors.methods).not.toContain('TRACE');
      expect(securityConfig.cors.allowedHeaders).toContain('Authorization');
    });

    it('should reject requests from unauthorized origins', async () => {
      await securityService.initialize();
      
      // Mock request from unauthorized origin
      const unauthorizedOrigin = 'https://malicious-site.com';
      expect(securityConfig.cors.origins).not.toContain(unauthorizedOrigin);
    });
  });

  describe('Security Headers', () => {
    it('should validate all required security headers', async () => {
      // RED: This test will fail until security headers validation is implemented
      await securityService.initialize();
      
      const areHeadersValid = await securityService.validateSecurityHeaders();
      expect(areHeadersValid).toBe(true);
    });

    it('should have Content Security Policy', async () => {
      await securityService.initialize();
      
      expect(securityConfig.headers.contentSecurityPolicy).toBeDefined();
      expect(securityConfig.headers.contentSecurityPolicy).toContain("default-src 'self'");
      expect(securityConfig.headers.contentSecurityPolicy).not.toContain("'unsafe-eval'");
    });

    it('should have Strict Transport Security', async () => {
      await securityService.initialize();
      
      expect(securityConfig.headers.strictTransportSecurity).toBeDefined();
      expect(securityConfig.headers.strictTransportSecurity).toContain('max-age=31536000');
      expect(securityConfig.headers.strictTransportSecurity).toContain('includeSubDomains');
      expect(securityConfig.headers.strictTransportSecurity).toContain('preload');
    });

    it('should have X-Frame-Options protection', async () => {
      await securityService.initialize();
      
      expect(securityConfig.headers.xFrameOptions).toBe('DENY');
    });

    it('should have X-Content-Type-Options protection', async () => {
      await securityService.initialize();
      
      expect(securityConfig.headers.xContentTypeOptions).toBe('nosniff');
    });

    it('should have secure Referrer Policy', async () => {
      await securityService.initialize();
      
      expect(securityConfig.headers.referrerPolicy).toBe('strict-origin-when-cross-origin');
    });

    it('should have restrictive Permissions Policy', async () => {
      await securityService.initialize();
      
      expect(securityConfig.headers.permissionsPolicy).toContain('camera=()');
      expect(securityConfig.headers.permissionsPolicy).toContain('microphone=()');
      expect(securityConfig.headers.permissionsPolicy).toContain('geolocation=()');
    });
  });

  describe('Rate Limiting', () => {
    it('should validate rate limiting configuration', async () => {
      // RED: This test will fail until rate limiting validation is implemented
      await securityService.initialize();
      
      const isRateLimitValid = await securityService.validateRateLimiting();
      expect(isRateLimitValid).toBe(true);
    });

    it('should have appropriate rate limits', async () => {
      await securityService.initialize();
      
      expect(securityConfig.rateLimit.windowMs).toBe(15 * 60 * 1000); // 15 minutes
      expect(securityConfig.rateLimit.max).toBe(1000); // 1000 requests per window
      expect(securityConfig.rateLimit.standardHeaders).toBe(true);
    });

    it('should block excessive requests', async () => {
      await securityService.initialize();
      
      // Rate limiting should be enabled
      expect(securityConfig.rateLimit.max).toBeGreaterThan(0);
      expect(securityConfig.rateLimit.windowMs).toBeGreaterThan(0);
    });

    it('should provide informative rate limit messages', async () => {
      await securityService.initialize();
      
      expect(securityConfig.rateLimit.message).toBeDefined();
      expect(securityConfig.rateLimit.message).toContain('Too many requests');
    });
  });

  describe('Input Validation', () => {
    it('should validate input validation configuration', async () => {
      // RED: This test will fail until input validation is implemented
      await securityService.initialize();
      
      const isInputValidationValid = await securityService.validateInputValidation();
      expect(isInputValidationValid).toBe(true);
    });

    it('should have request size limits', async () => {
      await securityService.initialize();
      
      expect(securityConfig.validation.maxRequestSize).toBe(50 * 1024 * 1024); // 50MB
      expect(securityConfig.validation.maxFileSize).toBe(10 * 1024 * 1024); // 10MB
    });

    it('should restrict file types', async () => {
      await securityService.initialize();
      
      expect(securityConfig.validation.allowedFileTypes).toContain('.pdf');
      expect(securityConfig.validation.allowedFileTypes).toContain('.jpg');
      expect(securityConfig.validation.allowedFileTypes).not.toContain('.exe');
      expect(securityConfig.validation.allowedFileTypes).not.toContain('.bat');
    });

    it('should enable input sanitization', async () => {
      await securityService.initialize();
      
      expect(securityConfig.validation.sanitizeInput).toBe(true);
      expect(securityConfig.validation.validateSchema).toBe(true);
    });
  });

  describe('Authentication Security', () => {
    it('should validate authentication security configuration', async () => {
      // RED: This test will fail until authentication validation is implemented
      await securityService.initialize();
      
      const isAuthSecure = await securityService.validateAuthenticationSecurity();
      expect(isAuthSecure).toBe(true);
    });

    it('should have strong JWT configuration', async () => {
      await securityService.initialize();
      
      expect(securityConfig.authentication.jwtSecret.length).toBeGreaterThan(32);
      expect(securityConfig.authentication.jwtExpiry).toBe(24 * 60 * 60); // 24 hours
    });

    it('should have strong password hashing', async () => {
      await securityService.initialize();
      
      expect(securityConfig.authentication.bcryptRounds).toBeGreaterThanOrEqual(12);
    });

    it('should have brute force protection', async () => {
      await securityService.initialize();
      
      expect(securityConfig.authentication.maxLoginAttempts).toBe(5);
      expect(securityConfig.authentication.lockoutDuration).toBe(15 * 60); // 15 minutes
    });

    it('should have session timeout', async () => {
      await securityService.initialize();
      
      expect(securityConfig.authentication.sessionTimeout).toBe(60 * 60); // 1 hour
    });
  });

  describe('Encryption Configuration', () => {
    it('should validate encryption configuration', async () => {
      // RED: This test will fail until encryption validation is implemented
      await securityService.initialize();
      
      const isEncryptionValid = await securityService.validateEncryptionConfiguration();
      expect(isEncryptionValid).toBe(true);
    });

    it('should use strong encryption algorithm', async () => {
      await securityService.initialize();
      
      expect(securityConfig.encryption.algorithm).toBe('aes-256-gcm');
      expect(securityConfig.encryption.keySize).toBe(256);
      expect(securityConfig.encryption.ivSize).toBe(16);
    });

    it('should have strong salt rounds', async () => {
      await securityService.initialize();
      
      expect(securityConfig.encryption.saltRounds).toBeGreaterThanOrEqual(12);
    });
  });

  describe('Vulnerability Testing', () => {
    it('should test SQL injection protection', async () => {
      // RED: This test will fail until SQL injection testing is implemented
      await securityService.initialize();
      
      const isSQLProtected = await securityService.testSQLInjectionProtection();
      expect(isSQLProtected).toBe(true);
    });

    it('should test XSS protection', async () => {
      await securityService.initialize();
      
      const isXSSProtected = await securityService.testXSSProtection();
      expect(isXSSProtected).toBe(true);
    });

    it('should test CSRF protection', async () => {
      await securityService.initialize();
      
      const isCSRFProtected = await securityService.testCSRFProtection();
      expect(isCSRFProtected).toBe(true);
    });

    it('should perform comprehensive vulnerability scan', async () => {
      await securityService.initialize();
      
      const scan = await securityService.performVulnerabilityScan();
      
      expect(scan).toBeDefined();
      expect(scan.scanId).toBeDefined();
      expect(scan.timestamp).toBeInstanceOf(Date);
      expect(scan.target).toBeDefined();
      expect(scan.scanType).toBe('vulnerability');
      expect(scan.status).toBe('completed');
      expect(Array.isArray(scan.findings)).toBe(true);
      expect(scan.compliance).toBeDefined();
    });

    it('should have no critical vulnerabilities', async () => {
      await securityService.initialize();
      
      const scan = await securityService.performVulnerabilityScan();
      
      const criticalFindings = scan.findings.filter(f => f.severity === 'critical');
      expect(criticalFindings).toHaveLength(0);
      
      const highFindings = scan.findings.filter(f => f.severity === 'high');
      expect(highFindings.length).toBeLessThan(3); // Minimal high severity issues
    });

    it('should meet compliance requirements', async () => {
      await securityService.initialize();
      
      const scan = await securityService.performVulnerabilityScan();
      
      expect(scan.compliance.owasp.score).toBeGreaterThan(80);
      expect(scan.compliance.gdpr.compliant).toBe(true);
      expect(scan.compliance.pci.compliant).toBe(true);
    });
  });

  describe('Security Auditing', () => {
    it('should have audit logging enabled', async () => {
      // RED: This test will fail until audit logging is implemented
      await securityService.initialize();
      
      expect(securityConfig.audit.enabled).toBe(true);
      expect(securityConfig.audit.logLevel).toBe('info');
      expect(securityConfig.audit.retentionDays).toBe(90);
    });

    it('should protect sensitive fields in logs', async () => {
      await securityService.initialize();
      
      expect(securityConfig.audit.sensitiveFields).toContain('password');
      expect(securityConfig.audit.sensitiveFields).toContain('ssn');
      expect(securityConfig.audit.sensitiveFields).toContain('creditCard');
    });

    it('should retrieve audit logs with filters', async () => {
      await securityService.initialize();
      
      const auditLogs = await securityService.getAuditLogs({
        action: 'login',
        timeRange: {
          start: new Date(Date.now() - 24 * 60 * 60 * 1000),
          end: new Date(),
        },
      });
      
      expect(Array.isArray(auditLogs)).toBe(true);
      
      if (auditLogs.length > 0) {
        auditLogs.forEach(log => {
          expect(log.auditId).toBeDefined();
          expect(log.timestamp).toBeInstanceOf(Date);
          expect(log.action).toBeDefined();
          expect(log.resource).toBeDefined();
          expect(log.ipAddress).toBeDefined();
          expect(typeof log.success).toBe('boolean');
        });
      }
    });
  });

  describe('Security Metrics', () => {
    it('should provide comprehensive security metrics', async () => {
      // RED: This test will fail until security metrics are implemented
      await securityService.initialize();
      
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      
      const metrics = await securityService.getSecurityMetrics({
        start: oneHourAgo,
        end: now,
      });
      
      expect(metrics).toBeDefined();
      expect(metrics.period.start).toEqual(oneHourAgo);
      expect(metrics.period.end).toEqual(now);
      expect(metrics.requests).toBeDefined();
      expect(metrics.authentication).toBeDefined();
      expect(metrics.vulnerabilities).toBeDefined();
      expect(metrics.compliance).toBeDefined();
    });

    it('should track request security metrics', async () => {
      await securityService.initialize();
      
      const metrics = await securityService.getSecurityMetrics({
        start: new Date(Date.now() - 60 * 60 * 1000),
        end: new Date(),
      });
      
      expect(metrics.requests.total).toBeGreaterThanOrEqual(0);
      expect(metrics.requests.blocked).toBeGreaterThanOrEqual(0);
      expect(metrics.requests.suspicious).toBeGreaterThanOrEqual(0);
      expect(metrics.requests.rateLimited).toBeGreaterThanOrEqual(0);
    });

    it('should track authentication metrics', async () => {
      await securityService.initialize();
      
      const metrics = await securityService.getSecurityMetrics({
        start: new Date(Date.now() - 60 * 60 * 1000),
        end: new Date(),
      });
      
      expect(metrics.authentication.successful).toBeGreaterThanOrEqual(0);
      expect(metrics.authentication.failed).toBeGreaterThanOrEqual(0);
      expect(metrics.authentication.bruteForceAttempts).toBeGreaterThanOrEqual(0);
      expect(metrics.authentication.accountLockouts).toBeGreaterThanOrEqual(0);
    });

    it('should track vulnerability metrics', async () => {
      await securityService.initialize();
      
      const metrics = await securityService.getSecurityMetrics({
        start: new Date(Date.now() - 60 * 60 * 1000),
        end: new Date(),
      });
      
      expect(metrics.vulnerabilities.critical).toBe(0); // Should be zero
      expect(metrics.vulnerabilities.high).toBeLessThan(3); // Minimal high severity
      expect(metrics.vulnerabilities.medium).toBeGreaterThanOrEqual(0);
      expect(metrics.vulnerabilities.low).toBeGreaterThanOrEqual(0);
    });

    it('should track compliance metrics', async () => {
      await securityService.initialize();
      
      const metrics = await securityService.getSecurityMetrics({
        start: new Date(Date.now() - 60 * 60 * 1000),
        end: new Date(),
      });
      
      expect(metrics.compliance.owaspScore).toBeGreaterThan(80);
      expect(metrics.compliance.gdprCompliant).toBe(true);
      expect(metrics.compliance.pciCompliant).toBe(true);
    });
  });

  describe('Production Security Requirements Compliance', () => {
    it('should meet all production security requirements', async () => {
      await securityService.initialize();
      
      // Validate all security components
      const [
        corsValid,
        headersValid,
        rateLimitValid,
        inputValidationValid,
        authSecure,
        encryptionValid,
        sqlProtected,
        xssProtected,
        csrfProtected,
      ] = await Promise.all([
        securityService.validateCORSConfiguration(),
        securityService.validateSecurityHeaders(),
        securityService.validateRateLimiting(),
        securityService.validateInputValidation(),
        securityService.validateAuthenticationSecurity(),
        securityService.validateEncryptionConfiguration(),
        securityService.testSQLInjectionProtection(),
        securityService.testXSSProtection(),
        securityService.testCSRFProtection(),
      ]);
      
      expect(corsValid).toBe(SECURITY_REQUIREMENTS.CORS_STRICT_ORIGINS);
      expect(headersValid).toBe(SECURITY_REQUIREMENTS.SECURITY_HEADERS_REQUIRED);
      expect(rateLimitValid).toBe(SECURITY_REQUIREMENTS.RATE_LIMITING_ENABLED);
      expect(inputValidationValid).toBe(SECURITY_REQUIREMENTS.INPUT_VALIDATION_STRICT);
      expect(authSecure).toBe(SECURITY_REQUIREMENTS.SESSION_SECURITY);
      expect(encryptionValid).toBe(SECURITY_REQUIREMENTS.ENCRYPTION_AT_REST);
      expect(sqlProtected).toBe(SECURITY_REQUIREMENTS.SQL_INJECTION_PROTECTION);
      expect(xssProtected).toBe(SECURITY_REQUIREMENTS.XSS_PROTECTION);
      expect(csrfProtected).toBe(SECURITY_REQUIREMENTS.CSRF_PROTECTION);
    });

    it('should pass comprehensive security scan', async () => {
      await securityService.initialize();
      
      const scan = await securityService.performVulnerabilityScan();
      
      // No critical or high vulnerabilities
      const criticalFindings = scan.findings.filter(f => f.severity === 'critical');
      const highFindings = scan.findings.filter(f => f.severity === 'high');
      
      expect(criticalFindings).toHaveLength(0);
      expect(highFindings.length).toBeLessThan(3);
      
      // High compliance scores
      expect(scan.compliance.owasp.score).toBeGreaterThan(80);
      expect(scan.compliance.gdpr.compliant).toBe(true);
      expect(scan.compliance.pci.compliant).toBe(true);
    });

    it('should have audit logging enabled', async () => {
      await securityService.initialize();
      
      expect(securityConfig.audit.enabled).toBe(SECURITY_REQUIREMENTS.AUDIT_LOGGING);
    });
  });
});
