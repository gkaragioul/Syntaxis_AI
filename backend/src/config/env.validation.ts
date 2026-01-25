// @ts-nocheck

import { plainToClass } from 'class-transformer';
import {
  IsString,
  IsNumber,
  IsBoolean,
  IsArray,
  validateSync,
  IsOptional,
  IsUrl,
  IsIP,
} from 'class-validator';

class EnvironmentVariables {
  @IsString()
  NODE_ENV: string;

  @IsString()
  JWT_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRY?: string;

  @IsNumber()
  @IsOptional()
  JWT_REFRESH_EXPIRY?: number;

  @IsNumber()
  @IsOptional()
  HSTS_MAX_AGE?: number;

  @IsString()
  @IsUrl()
  FRONTEND_URL: string;

  @IsArray()
  @IsString({ each: true })
  ALLOWED_ORIGINS: string[];

  // Rate Limiting
  @IsNumber()
  @IsOptional()
  RATE_LIMIT_TTL?: number;

  @IsNumber()
  @IsOptional()
  RATE_LIMIT_MAX?: number;

  @IsArray()
  @IsIP('4', { each: true })
  @IsOptional()
  TRUSTED_IPS?: string[];

  // Redis Configuration (for rate limiting)
  @IsString()
  @IsOptional()
  REDIS_HOST?: string;

  @IsNumber()
  @IsOptional()
  REDIS_PORT?: number;

  @IsString()
  @IsOptional()
  REDIS_PASSWORD?: string;

  @IsNumber()
  @IsOptional()
  REDIS_DB?: number;

  @IsString()
  @IsOptional()
  DATABASE_URL?: string;

  @IsString()
  @IsOptional()
  SMTP_HOST?: string;

  @IsNumber()
  @IsOptional()
  SMTP_PORT?: number;

  @IsString()
  @IsOptional()
  SMTP_USER?: string;

  @IsString()
  @IsOptional()
  SMTP_PASS?: string;

  @IsString()
  @IsOptional()
  SMTP_FROM?: string;

  @IsBoolean()
  @IsOptional()
  SMTP_SECURE?: boolean;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToClass(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validatedConfig;
}
