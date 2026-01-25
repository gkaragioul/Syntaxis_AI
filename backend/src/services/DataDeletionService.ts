// @ts-nocheck

import { redis } from '../redis';
import { logger } from '../utils/logger';

interface DeletionRequest {
  id: string;
  userId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  requestedAt: Date;
  completedAt?: Date;
  error?: string;
}

export class DataDeletionService {
  constructor() {
    logger.info('DataDeletionService initialized (STUB MODE - No S3)');
  }

  async requestDeletion(userId: string): Promise<DeletionRequest> {
    const request: DeletionRequest = {
      id: `del_${Date.now()}_${userId}`,
      userId,
      status: 'pending',
      requestedAt: new Date(),
    };

    await redis.set(`deletion:${request.id}`, JSON.stringify(request), 'EX', 48 * 60 * 60);
    await redis.lpush('deletion:queue', request.id);

    logger.info('Account deletion requested', { userId, requestId: request.id });
    return request;
  }

  async getDeletionStatus(requestId: string): Promise<DeletionRequest | null> {
    const data = await redis.get(`deletion:${requestId}`);
    return data ? JSON.parse(data) : null;
  }

  async processDeletionRequest(requestId: string): Promise<void> {
    const request = await this.getDeletionStatus(requestId);
    if (!request || request.status !== 'pending') return;

    try {
      request.status = 'processing';
      await redis.set(`deletion:${requestId}`, JSON.stringify(request), 'EX', 48 * 60 * 60);

      logger.info('Processing account deletion (MOCK)', { userId: request.userId });

      // Simulate deletion
      await new Promise(resolve => setTimeout(resolve, 1000));

      request.status = 'completed';
      request.completedAt = new Date();
      await redis.set(`deletion:${requestId}`, JSON.stringify(request), 'EX', 48 * 60 * 60);

      logger.info('Account deletion completed (MOCK)', { userId: request.userId });
    } catch (error) {
      logger.error('Failed to process deletion request', { error, requestId });
      request.status = 'failed';
      request.error = error.message;
      await redis.set(`deletion:${requestId}`, JSON.stringify(request), 'EX', 48 * 60 * 60);
    }
  }

  async startDeletionWorker(): Promise<void> {
    setInterval(async () => {
      try {
        const requestId = await redis.rpop('deletion:queue');
        if (requestId) {
          await this.processDeletionRequest(requestId);
        }
      } catch (error) {
        logger.error('Error in deletion worker', { error });
      }
    }, 60000);
  }
}
