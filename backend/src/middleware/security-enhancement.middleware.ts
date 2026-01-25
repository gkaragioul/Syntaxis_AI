// @ts-nocheck

import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import DOMPurify from 'isomorphic-dompurify';
import { ProductionSecurityConfig, SecurityConfig } from '../config/production-security.config';
import { logger } from '../utils/logger';
import path from 'path';

export class SecurityEnhancementMiddleware {
  private config: SecurityConfig;
  private securityMetrics: {
    totalRequests: number;
    blockedRequests: number;
    suspiciousRequests: number;
    rateLimitViolations: number;
    lastReset: Date;
  };

  constructor(private securityConfig: ProductionSecurityConfig) {
    this.config = securityConfig.getConfig();
    this.securityMetrics = {
      totalRequests: 0,
      blockedRequests: 0,
      suspiciousRequests: 0,
      rateLimitViolations: 0,
      lastReset: new Date(),
    };
  }

  public apply() {
    return [
      this.securityHeaders(),
      this.corsConfiguration(),
      this.inputValidation(),
      this.pathTraversalProtection(),
      this.securityLogging(),
      this.threatDetection(),
      this.securityMetrics(),
    ];
  }

  private securityHeaders() {
    const headersConfig = this.config.headers;
    const cspConfig = this.config.csp;

    return helmet({
      // HSTS
      hsts: headersConfig.hsts.enabled ? {
        maxAge: headersConfig.hsts.maxAge,
        includeSubDomains: headersConfig.hsts.includeSubDomains,
        preload: headersConfig.hsts.preload,
      } : false,

      // Content Security Policy
      contentSecurityPolicy: cspConfig.enabled ? {
        directives: {
          defaultSrc: cspConfig.directives.defaultSrc,
          scriptSrc: cspConfig.directives.scriptSrc,
          styleSrc: cspConfig.directives.styleSrc,
          imgSrc: cspConfig.directives.imgSrc,
          connectSrc: cspConfig.directives.connectSrc,
          fontSrc: cspConfig.directives.fontSrc,
          objectSrc: cspConfig.directives.objectSrc,
          mediaSrc: cspConfig.directives.mediaSrc,
          frameSrc: cspConfig.directives.frameSrc,
          formAction: cspConfig.directives.formAction,
          baseUri: cspConfig.directives.baseUri,
          frameAncestors: cspConfig.directives.frameAncestors,
          ...(cspConfig.reportUri && { reportUri: cspConfig.reportUri }),
        },
        reportOnly: cspConfig.reportOnly,
      } : false,

      // X-Content-Type-Options
      noSniff: headersConfig.xContentTypeOptions,

      // X-Frame-Options
      frameguard: { action: headersConfig.xFrameOptions.toLowerCase() as 'deny' | 'sameorigin' },

      // X-XSS-Protection
      xssFilter: headersConfig.xXssProtection === '1; mode=block',

      // Referrer Policy
      referrerPolicy: { policy: headersConfig.referrerPolicy as any },

      // Permissions Policy
      permissionsPolicy: headersConfig.permissionsPolicy,

      // Remove X-Powered-By
      hidePoweredBy: headersConfig.removeXPoweredBy,

      // Additional security headers
      crossOriginEmbedderPolicy: this.securityConfig.isProduction(),
      crossOriginOpenerPolicy: this.securityConfig.isProduction(),
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      originAgentCluster: this.securityConfig.isProduction(),
    });
  }

  private corsConfiguration() {
    const corsConfig = this.config.cors;

    if (!corsConfig.enabled) {
      return (req: Request, res: Response, next: NextFunction) => next();
    }

    return cors({
      origin: corsConfig.origin,
      methods: corsConfig.methods,
      allowedHeaders: corsConfig.allowedHeaders,
      credentials: corsConfig.credentials,
      maxAge: corsConfig.maxAge,
      preflightContinue: corsConfig.preflightContinue,
      optionsSuccessStatus: corsConfig.optionsSuccessStatus,
    });
  }

  public inputValidation() {
    const validationConfig = this.config.validation;

    return (req: Request, res: Response, next: NextFunction) => {
      if (!validationConfig.enabled) {
        return next();
      }

      try {
        // Sanitize request body
        if (req.body && validationConfig.sanitizeInput) {
          req.body = this.sanitizeObject(req.body);
        }

        // Sanitize query parameters
        if (req.query && validationConfig.sanitizeInput) {
          req.query = this.sanitizeObject(req.query);
        }

        // Sanitize URL parameters
        if (req.params && validationConfig.sanitizeInput) {
          req.params = this.sanitizeObject(req.params);
        }

        next();
      } catch (error) {
        logger.error('Input validation error', { error, url: req.url });
        res.status(400).json({ error: 'Invalid input data' });
      }
    };
  }

  private sanitizeObject(obj: any): any {
    if (typeof obj === 'string') {
      return DOMPurify.sanitize(obj, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = this.sanitizeObject(value);
      }
      return sanitized;
    }

    return obj;
  }

  public pathTraversalProtection() {
    const validationConfig = this.config.validation;

    return (req: Request, res: Response, next: NextFunction) => {
      if (!validationConfig.preventPathTraversal) {
        return next();
      }

      const suspiciousPatterns = [
        /\.\./,
        /\.\.\//,
        /\.\.\\/,
        /%2e%2e%2f/i,
        /%2e%2e%5c/i,
        /\.\.%2f/i,
        /\.\.%5c/i,
      ];

      const checkPath = (pathToCheck: string): boolean => {
        return suspiciousPatterns.some(pattern => pattern.test(pathToCheck));
      };

      // Check URL path
      if (checkPath(req.path)) {
        this.logSecurityEvent('path_traversal_attempt', 'high', {
          path: req.path,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
        });
        return res.status(400).json({ error: 'Invalid path' });
      }

      // Check query parameters
      for (const [key, value] of Object.entries(req.query)) {
        if (typeof value === 'string' && checkPath(value)) {
          this.logSecurityEvent('path_traversal_attempt', 'high', {
            parameter: key,
            value,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
          });
          return res.status(400).json({ error: 'Invalid parameter value' });
        }
      }

      next();
    };
  }

  public fileUploadSecurity() {
    const validationConfig = this.config.validation;

    return (req: Request, res: Response, next: NextFunction) => {
      if (!validationConfig.validateFileUploads) {
        return next();
      }

      // Check if this is a file upload request
      if (req.files || req.file) {
        const files = req.files || [req.file];
        const fileArray = Array.isArray(files) ? files : Object.values(files).flat();

        for (const file of fileArray) {
          if (!file) continue;

          // Check file size
          if (file.size > validationConfig.maxFileSize) {
            return res.status(400).json({
              error: `File size exceeds maximum allowed size of ${validationConfig.maxFileSize} bytes`
            });
          }

          // Check file type
          if (!validationConfig.allowedFileTypes.includes(file.mimetype)) {
            return res.status(400).json({
              error: `File type ${file.mimetype} is not allowed`
            });
          }

          // Check file extension
          const ext = path.extname(file.originalname).toLowerCase();
          const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.txt'];
          if (!allowedExtensions.includes(ext)) {
            return res.status(400).json({
              error: `File extension ${ext} is not allowed`
            });
          }

          // Check for suspicious file names
          const suspiciousNames = [
            /\.php$/i,
            /\.jsp$/i,
            /\.asp$/i,
            /\.exe$/i,
            /\.bat$/i,
            /\.cmd$/i,
            /\.sh$/i,
            /\.scr$/i,
          ];

          if (suspiciousNames.some(pattern => pattern.test(file.originalname))) {
            this.logSecurityEvent('suspicious_file_upload', 'high', {
              filename: file.originalname,
              mimetype: file.mimetype,
              ip: req.ip,
            });
            return res.status(400).json({ error: 'Suspicious file detected' });
          }
        }
      }

      next();
    };
  }

  public enhancedJWTValidation() {
    return (req: Request, res: Response, next: NextFunction) => {
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        return res.status(401).json({ error: 'No authorization header provided' });
      }

      if (!authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Invalid authorization header format' });
      }

      const token = authHeader.split(' ')[1];

      // Basic token format validation
      if (!token || token.split('.').length !== 3) {
        return res.status(401).json({ error: 'Invalid token format' });
      }

      // Check for suspicious token patterns
      const suspiciousPatterns = [
        /null/i,
        /undefined/i,
        /admin/i,
        /test/i,
        /debug/i,
      ];

      if (suspiciousPatterns.some(pattern => pattern.test(token))) {
        this.logSecurityEvent('suspicious_token', 'medium', {
          token: token.substring(0, 20) + '...',
          ip: req.ip,
        });
      }

      next();
    };
  }

  public sessionSecurity() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Ensure secure session handling
      if (this.securityConfig.isProduction()) {
        res.setHeader('Set-Cookie', [
          'sessionId=; Secure; HttpOnly; SameSite=Strict; Max-Age=0',
        ]);
      }

      next();
    };
  }

  public bruteForceProtection() {
    const attempts = new Map<string, { count: number; lastAttempt: Date; blocked: boolean }>();

    return (req: Request, res: Response, next: NextFunction) => {
      const key = req.ip;
      const now = new Date();
      const maxAttempts = this.config.logging.alertThresholds.failedAuthAttempts;
      const blockDuration = 15 * 60 * 1000; // 15 minutes

      const attemptData = attempts.get(key);

      if (attemptData) {
        // Check if still blocked
        if (attemptData.blocked && (now.getTime() - attemptData.lastAttempt.getTime()) < blockDuration) {
          return res.status(429).json({
            error: 'Too many failed attempts. Please try again later.',
            retryAfter: Math.ceil((blockDuration - (now.getTime() - attemptData.lastAttempt.getTime())) / 1000)
          });
        }

        // Reset if block period expired
        if (attemptData.blocked && (now.getTime() - attemptData.lastAttempt.getTime()) >= blockDuration) {
          attempts.set(key, { count: 0, lastAttempt: now, blocked: false });
        }
      }

      // Continue with request
      next();

      // Check response status to count failed attempts
      res.on('finish', () => {
        if (req.path.includes('/auth/login') && res.statusCode === 401) {
          const current = attempts.get(key) || { count: 0, lastAttempt: now, blocked: false };
          current.count++;
          current.lastAttempt = now;

          if (current.count >= maxAttempts) {
            current.blocked = true;
            this.logSecurityEvent('brute_force_detected', 'high', {
              ip: key,
              attempts: current.count,
            });
          }

          attempts.set(key, current);
        }
      });
    };
  }

  public securityLogging() {
    const loggingConfig = this.config.logging;

    return (req: Request, res: Response, next: NextFunction) => {
      if (!loggingConfig.enabled) {
        return next();
      }

      const startTime = Date.now();

      res.on('finish', () => {
        const duration = Date.now() - startTime;

        if (loggingConfig.logSecurityEvents) {
          logger.info('Security request log', {
            method: req.method,
            url: req.url,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            statusCode: res.statusCode,
            duration,
            contentLength: res.get('Content-Length'),
          });
        }
      });

      next();
    };
  }

  public threatDetection() {
    return (req: Request, res: Response, next: NextFunction) => {
      const threats = this.detectThreats(req);

      if (threats.length > 0) {
        this.logSecurityEvent('threats_detected', 'high', {
          threats,
          ip: req.ip,
          url: req.url,
          userAgent: req.get('User-Agent'),
        });

        // For high-severity threats, block the request
        const highSeverityThreats = threats.filter(t => t.severity === 'high');
        if (highSeverityThreats.length > 0) {
          return res.status(403).json({ error: 'Request blocked due to security policy' });
        }
      }

      next();
    };
  }

  private detectThreats(req: Request): Array<{ type: string; severity: 'low' | 'medium' | 'high' }> {
    const threats: Array<{ type: string; severity: 'low' | 'medium' | 'high' }> = [];

    // SQL Injection patterns
    const sqlPatterns = [
      /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/i,
      /(\'|\"|;|--|\*|\|)/,
      /(\b(or|and)\b\s+\d+\s*=\s*\d+)/i,
    ];

    // XSS patterns
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe[^>]*>.*?<\/iframe>/gi,
    ];

    // Command injection patterns
    const cmdPatterns = [
      /(\||;|&|`|\$\(|\${)/,
      /(rm|cat|ls|ps|kill|chmod|chown|sudo)/i,
    ];

    const checkString = `${req.url} ${JSON.stringify(req.query)} ${JSON.stringify(req.body)}`;

    if (sqlPatterns.some(pattern => pattern.test(checkString))) {
      threats.push({ type: 'sql_injection', severity: 'high' });
    }

    if (xssPatterns.some(pattern => pattern.test(checkString))) {
      threats.push({ type: 'xss_attempt', severity: 'high' });
    }

    if (cmdPatterns.some(pattern => pattern.test(checkString))) {
      threats.push({ type: 'command_injection', severity: 'high' });
    }

    // Check User-Agent for known attack tools
    const userAgent = req.get('User-Agent') || '';
    const suspiciousUserAgents = [
      /sqlmap/i,
      /nikto/i,
      /nmap/i,
      /burp/i,
      /owasp/i,
      /zap/i,
    ];

    if (suspiciousUserAgents.some(pattern => pattern.test(userAgent))) {
      threats.push({ type: 'suspicious_user_agent', severity: 'medium' });
    }

    return threats;
  }

  public securityMetrics() {
    return (req: Request, res: Response, next: NextFunction) => {
      this.securityMetrics.totalRequests++;

      // Reset metrics daily
      const now = new Date();
      if (now.getDate() !== this.securityMetrics.lastReset.getDate()) {
        this.securityMetrics = {
          totalRequests: 1,
          blockedRequests: 0,
          suspiciousRequests: 0,
          rateLimitViolations: 0,
          lastReset: now,
        };
      }

      next();
    };
  }

  private logSecurityEvent(event: string, severity: 'low' | 'medium' | 'high', details: any) {
    const loggingConfig = this.config.logging;

    if (!loggingConfig.logSecurityEvents) {
      return;
    }

    const logData = {
      event,
      severity,
      timestamp: new Date().toISOString(),
      ...details,
    };

    switch (severity) {
      case 'high':
        logger.error('Security event', logData);
        break;
      case 'medium':
        logger.warn('Security event', logData);
        break;
      case 'low':
        logger.info('Security event', logData);
        break;
    }

    // Increment metrics
    if (severity === 'high') {
      this.securityMetrics.blockedRequests++;
    }
    this.securityMetrics.suspiciousRequests++;
  }

  public getSecurityMetrics() {
    return {
      ...this.securityMetrics,
      config: this.securityConfig.getSecurityMetrics(),
    };
  }
}
