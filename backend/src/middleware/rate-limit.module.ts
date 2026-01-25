// @ts-nocheck

import { Module, Global } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RateLimitGuard } from './rate-limit.guard';

@Global()
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const rateLimitConfig = configService.get('rateLimit');
        return {
          ttl: rateLimitConfig.global.ttl,
          limit: rateLimitConfig.global.limit,
          storage:
            rateLimitConfig.storage.type === 'redis'
              ? {
                  type: 'redis',
                  host: rateLimitConfig.storage.redis.host,
                  port: rateLimitConfig.storage.redis.port,
                  password: rateLimitConfig.storage.redis.password,
                  db: rateLimitConfig.storage.redis.db,
                }
              : undefined,
        };
      },
    }),
  ],
  providers: [RateLimitGuard],
  exports: [RateLimitGuard],
})
export class RateLimitModule {}
