// @ts-nocheck

import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  private readonly cspDirectives: string;
  private readonly hstsMaxAge: number;
  private readonly isProduction: boolean;

  constructor(private configService: ConfigService) {
    this.isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';
    this.hstsMaxAge = this.configService.get<number>('HSTS_MAX_AGE', 31536000); // 1 year in seconds

    // Define CSP directives
    this.cspDirectives = [
      // Default source restrictions
      "default-src 'self'",

      // Script sources
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",

      // Style sources
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",

      // Image sources
      "img-src 'self' data: https:",

      // Font sources
      "font-src 'self' https://fonts.gstatic.com",

      // Connect sources (API endpoints)
      `connect-src 'self' ${this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000')}`,

      // Frame sources (none allowed)
      "frame-src 'none'",

      // Object sources (none allowed)
      "object-src 'none'",

      // Media sources
      "media-src 'self'",

      // Form action restrictions
      "form-action 'self'",

      // Base URI restrictions
      "base-uri 'self'",

      // Frame ancestor restrictions
      "frame-ancestors 'none'",

      // Upgrade insecure requests
      'upgrade-insecure-requests',
    ].join('; ');
  }

  use(req: Request, res: Response, next: NextFunction) {
    // Remove sensitive headers
    res.removeHeader('X-Powered-By');

    // Set security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader(
      'Permissions-Policy',
      'geolocation=(), microphone=(), camera=()',
    );
    res.setHeader('Content-Security-Policy', this.cspDirectives);

    // Set HSTS header in production
    if (this.isProduction) {
      res.setHeader(
        'Strict-Transport-Security',
        `max-age=${this.hstsMaxAge}; includeSubDomains; preload`,
      );
    }

    // Set CORS headers
    const allowedOrigins = this.configService
      .get<string>('ALLOWED_ORIGINS', '')
      .split(',');
    const origin = req.headers.origin;

    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader(
        'Access-Control-Allow-Methods',
        'GET,HEAD,PUT,PATCH,POST,DELETE',
      );
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Accept, Authorization',
      );
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
    }

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    next();
  }
}
