import Redis from 'ioredis';
import { config } from './config';
import { logger } from './utils/logger';

export const redisConfig = {
    maxRetriesPerRequest: 1,
    retryStrategy: (times: number) => {
        if (times > 3) {
            logger.warn('Redis retry limit reached. Continuing without Redis.');
            return null;
        }
        return Math.min(times * 200, 1000);
    },
    reconnectOnError: (err: Error) => {
        logger.error('Redis reconnect on error', { error: err.message });
        return true;
    }
};

const redis = new Redis(config.redis.url, redisConfig);

redis.on('error', (err) => {
    logger.warn('Redis connection error. Some features like rate limiting and queues might be unavailable.', {
        error: err.message
    });
});

redis.on('connect', () => {
    logger.info('Successfully connected to Redis');
});

export { redis };
export default redis;
