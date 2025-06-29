import { Injectable, ExecutionContext, SetMetadata } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

export const RATE_LIMIT_KEY = 'rate_limit';
export const RateLimit = (options: { ttl: number; limit: number }) =>
  SetMetadata(RATE_LIMIT_KEY, options);

@Injectable()
export class RateLimitGuard extends ThrottlerGuard {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  protected getTracker(req: Request): string {
    // Use IP address as the default tracker
    return req.ip;
  }

  protected async getRateLimitOptions(context: ExecutionContext) {
    // Get endpoint-specific rate limit options
    const endpointOptions = this.reflector.get<{ ttl: number; limit: number }>(
      RATE_LIMIT_KEY,
      context.getHandler(),
    );

    if (endpointOptions) {
      return endpointOptions;
    }

    // Get the request path to determine which rate limit to apply
    const request = context.switchToHttp().getRequest<Request>();
    const path = request.path;

    // Get rate limit configuration
    const rateLimitConfig = this.configService.get('rateLimit');

    // Check if the IP is trusted
    const trustedIps = rateLimitConfig.trustedIps;
    if (trustedIps.includes(request.ip)) {
      return { ttl: 1, limit: Number.MAX_SAFE_INTEGER }; // No rate limit for trusted IPs
    }

    // Apply specific endpoint limits based on path
    if (path.startsWith('/auth')) {
      if (path.includes('/login')) {
        return rateLimitConfig.endpoints.auth.login;
      }
      if (path.includes('/register')) {
        return rateLimitConfig.endpoints.auth.register;
      }
      if (path.includes('/forgot-password')) {
        return rateLimitConfig.endpoints.auth.forgotPassword;
      }
      if (path.includes('/reset-password')) {
        return rateLimitConfig.endpoints.auth.resetPassword;
      }
      if (path.includes('/verify-email')) {
        return rateLimitConfig.endpoints.auth.verifyEmail;
      }
    }

    if (path.startsWith('/api/webhooks')) {
      return rateLimitConfig.endpoints.webhooks.default;
    }

    if (path.startsWith('/api')) {
      if (path.includes('/upload')) {
        return rateLimitConfig.endpoints.api.upload;
      }
      if (path.includes('/download')) {
        return rateLimitConfig.endpoints.api.download;
      }
      return rateLimitConfig.endpoints.api.default;
    }

    // Return global rate limit as fallback
    return rateLimitConfig.global;
  }

  protected async handleRequest(
    context: ExecutionContext,
    limit: number,
    ttl: number,
  ): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse();

    // Get rate limit configuration
    const rateLimitConfig = this.configService.get('rateLimit');

    // Skip rate limiting for trusted IPs
    if (rateLimitConfig.trustedIps.includes(request.ip)) {
      return true;
    }

    // Get the tracker (IP address)
    const tracker = this.getTracker(request);

    // Get the current count for this tracker
    const key = this.generateKey(context, tracker);
    const ttls = await this.storageService.get(key);
    const now = Date.now();
    const requestCount = ttls.filter(
      (timestamp) => timestamp > now - ttl * 1000,
    ).length;

    // Add rate limit headers if enabled
    if (rateLimitConfig.headers.enabled) {
      const resetTime = Math.max(...ttls) + ttl * 1000;
      response.header(
        rateLimitConfig.headers.remaining,
        Math.max(0, limit - requestCount),
      );
      response.header(rateLimitConfig.headers.limit, limit);
      response.header(rateLimitConfig.headers.reset, resetTime);
    }

    // Check if the request should be throttled
    if (requestCount >= limit) {
      throw this.throttlerException;
    }

    // Add the current timestamp to the tracker
    await this.storageService.add(key, now);

    return true;
  }
}
