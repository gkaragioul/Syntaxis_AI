import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { EmailModule } from './email/email.module';
import { SecurityModule } from './middleware/security.module';
import { RateLimitModule } from './middleware/rate-limit.module';
import { validate } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      load: [
        () => require('./config/security.config').default,
        () => require('./config/rate-limit.config').default,
      ],
    }),
    SecurityModule,
    RateLimitModule,
    PrismaModule,
    AuthModule,
    EmailModule,
  ],
})
export class AppModule {}
