import { z } from 'zod';
import { prisma } from '../utils/prisma';

export const NotificationType = {
  STATUS: 'status',
  ERROR: 'error',
} as const;

export type NotificationType =
  (typeof NotificationType)[keyof typeof NotificationType];

export const NotificationStatus = {
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export type NotificationStatus =
  (typeof NotificationStatus)[keyof typeof NotificationStatus];

export const NotificationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  batchJobId: z.string(),
  type: z.enum([NotificationType.STATUS, NotificationType.ERROR]),
  status: z.enum([
    NotificationStatus.PROCESSING,
    NotificationStatus.COMPLETED,
    NotificationStatus.FAILED,
  ]),
  message: z.string(),
  createdAt: z.date(),
  read: z.boolean().default(false),
  metadata: z.record(z.unknown()).optional(),
});

export type Notification = z.infer<typeof NotificationSchema>;

export class NotificationModel {
  static async create(data: Omit<Notification, 'id' | 'createdAt' | 'read'>) {
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
