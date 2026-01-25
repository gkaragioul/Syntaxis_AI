import { prisma } from '../prisma';
import { Notification as PrismaNotification } from '@prisma/client';

export type Notification = PrismaNotification;

export const NotificationType = {
  STATUS: 'status',
  ERROR: 'error',
} as const;

export const NotificationStatus = {
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export class NotificationModel {
  static async create(data: {
    userId: string;
    batchJobId: string;
    type: string;
    status: string;
    message: string;
    metadata?: any;
  }) {
    return prisma.notification.create({
      data: {
        ...data,
        read: false,
      },
    });
  }

  static async findByUserId(
    userId: string,
    options: { limit?: number; offset?: number } = {},
  ) {
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: options.limit ?? 50,
      skip: options.offset ?? 0,
    });
  }

  static async markAsRead(id: string) {
    return prisma.notification.update({
      where: { id },
      data: { read: true },
    });
  }

  static async delete(id: string) {
    return prisma.notification.delete({
      where: { id },
    });
  }
}

export default NotificationModel;
