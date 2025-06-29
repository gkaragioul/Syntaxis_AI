import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';

export const redis = new Redis(config.redis.url);

redis.on('error', (err) => {
  logger.error('Redis connection error', { err });
});
