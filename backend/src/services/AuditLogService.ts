import { prisma } from '../prisma';
import { logger } from '../utils/logger';

export type AuditAction =
  | 'notification.created'
  | 'notification.read'
  | 'error_report.created'
  | 'error_report.downloaded'
  | 'error_report.deleted';

export interface AuditLogEntry {
  id: string;
  userId: string;
  action: AuditAction;
  resourceType: string;
  resourceId: string;
  metadata: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
}

export class AuditLogService {
  async log(params: {
    userId: string;
    action: AuditAction;
    resourceType: string;
    resourceId: string;
    metadata?: Record<string, unknown>;
    ipAddress: string;
    userAgent: string;
  }): Promise<AuditLogEntry> {
    try {
      const entry = await prisma.auditLog.create({
        data: {
          userId: params.userId,
          action: params.action,
          resourceType: params.resourceType,
          resourceId: params.resourceId,
          metadata: params.metadata || {},
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
        },
      });

      logger.info('Audit log entry created', {
        action: params.action,
        userId: params.userId,
        resourceId: params.resourceId,
      });

      return entry;
    } catch (error) {
      logger.error('Failed to create audit log entry', {
        error,
        params,
      });
      throw error;
    }
  }

  async query(params: {
    userId?: string;
    action?: AuditAction;
    resourceType?: string;
    resourceId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ entries: AuditLogEntry[]; total: number }> {
    const where: any = {};

    if (params.userId) where.userId = params.userId;
    if (params.action) where.action = params.action;
    if (params.resourceType) where.resourceType = params.resourceType;
    if (params.resourceId) where.resourceId = params.resourceId;
    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) where.createdAt.gte = params.startDate;
      if (params.endDate) where.createdAt.lte = params.endDate;
    }

    const [entries, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: params.limit || 50,
        skip: params.offset || 0,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { entries, total };
  }

  async cleanupOldLogs(retentionDays: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const { count } = await prisma.auditLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    logger.info('Cleaned up old audit logs', {
      deletedCount: count,
      retentionDays,
    });

    return count;
  }
}
