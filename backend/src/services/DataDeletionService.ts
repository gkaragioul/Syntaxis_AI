import { Redis } from 'ioredis';
import { S3 } from 'aws-sdk';
import { logger } from '../utils/logger';
import { config } from '../config';
import { User } from '../models/User';
import { BatchJob } from '../models/BatchJob';
import { Template } from '../models/Template';
import { License } from '../models/License';
import { Device } from '../models/Device';
import { NotificationService } from './NotificationService';

interface DeletionRequest {
  id: string;
  userId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  requestedAt: Date;
  completedAt?: Date;
  error?: string;
}

export class DataDeletionService {
  private redis: Redis;
  private s3: S3;
  private notificationService: NotificationService;

  constructor() {
    this.redis = new Redis(config.redis.url);
    this.s3 = new S3({
      accessKeyId: config.aws.accessKeyId,
      secretAccessKey: config.aws.secretAccessKey,
      region: config.aws.region,
    });
    this.notificationService = new NotificationService();
  }

  async requestDeletion(userId: string): Promise<DeletionRequest> {
    const request: DeletionRequest = {
      id: `del_${Date.now()}_${userId}`,
      userId,
      status: 'pending',
      requestedAt: new Date(),
    };

    // Store deletion request in Redis with 48-hour expiry
    await this.redis.set(
      `deletion:${request.id}`,
      JSON.stringify(request),
      'EX',
      48 * 60 * 60,
    );

    // Add to deletion queue
    await this.redis.lpush('deletion:queue', request.id);

    // Notify user
    await this.notificationService.sendNotification(userId, {
      type: 'deletion_requested',
      title: 'Account Deletion Requested',
      message:
        'Your account deletion request has been received. This process will be completed within 48 hours.',
      severity: 'info',
    });

    return request;
  }

  async getDeletionStatus(requestId: string): Promise<DeletionRequest | null> {
    const data = await this.redis.get(`deletion:${requestId}`);
    return data ? JSON.parse(data) : null;
  }

  async processDeletionRequest(requestId: string): Promise<void> {
    const request = await this.getDeletionStatus(requestId);
    if (!request || request.status !== 'pending') {
      return;
    }

    try {
      // Update status to processing
      request.status = 'processing';
      await this.redis.set(
        `deletion:${requestId}`,
        JSON.stringify(request),
        'EX',
        48 * 60 * 60,
      );

      // Get user data
      const user = await User.findById(request.userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Delete user's files from S3
      await this.deleteUserFiles(user.id);

      // Delete user's data from database
      await this.deleteUserData(user.id);

      // Update request status
      request.status = 'completed';
      request.completedAt = new Date();
      await this.redis.set(
        `deletion:${requestId}`,
        JSON.stringify(request),
        'EX',
        48 * 60 * 60,
      );

      // Notify user of completion
      await this.notificationService.sendNotification(user.id, {
        type: 'deletion_completed',
        title: 'Account Deletion Completed',
        message:
          'Your account and all associated data have been successfully deleted.',
        severity: 'success',
      });

      // Send email notification
      await this.notificationService.sendEmail(user.email, {
        subject: 'Account Deletion Completed',
        template: 'deletion-completed',
        data: {
          name: user.name,
          deletionDate: request.completedAt,
        },
      });
    } catch (error) {
      logger.error('Failed to process deletion request', {
        error,
        requestId,
        userId: request.userId,
      });

      // Update request status
      request.status = 'failed';
      request.error = error.message;
      await this.redis.set(
        `deletion:${requestId}`,
        JSON.stringify(request),
        'EX',
        48 * 60 * 60,
      );

      // Notify user of failure
      await this.notificationService.sendNotification(request.userId, {
        type: 'deletion_failed',
        title: 'Account Deletion Failed',
        message:
          'There was an error processing your account deletion request. Please contact support.',
        severity: 'error',
      });

      throw error;
    }
  }

  private async deleteUserFiles(userId: string): Promise<void> {
    // List all files in user's S3 prefix
    const files = await this.s3
      .listObjectsV2({
        Bucket: config.aws.bucket,
        Prefix: `users/${userId}/`,
      })
      .promise();

    if (files.Contents) {
      // Delete all files
      await this.s3
        .deleteObjects({
          Bucket: config.aws.bucket,
          Delete: {
            Objects: files.Contents.map((file) => ({
              Key: file.Key!,
            })),
          },
        })
        .promise();
    }
  }

  private async deleteUserData(userId: string): Promise<void> {
    // Delete user's batch jobs and associated data
    await BatchJob.deleteMany({ userId });

    // Delete user's templates
    await Template.deleteMany({ userId });

    // Delete user's licenses and devices
    const licenses = await License.find({ userId });
    for (const license of licenses) {
      await Device.deleteMany({ licenseId: license.id });
    }
    await License.deleteMany({ userId });

    // Delete user's audit logs
    await this.redis.del(`audit:user:${userId}`);

    // Finally, delete the user
    await User.findByIdAndDelete(userId);
  }

  async startDeletionWorker(): Promise<void> {
    // Process deletion queue
    setInterval(async () => {
      try {
        const requestId = await this.redis.rpop('deletion:queue');
        if (requestId) {
          await this.processDeletionRequest(requestId);
        }
      } catch (error) {
        logger.error('Error in deletion worker', { error });
      }
    }, 60000); // Check every minute
  }
}
