import { prisma } from '../prisma';
import { AuditLog as PrismaAuditLog } from '@prisma/client';

export type AuditLog = PrismaAuditLog;

export class AuditLogModel {
  static async create(data: {
    userId: string;
    action: string;
    resourceType: string;
    resourceId: string;
    metadata: any;
    ipAddress: string;
    userAgent: string;
  }) {
    return prisma.auditLog.create({
      data: {
        ...data,
      },
    });
  }

  static async findMany(filters?: {
    userId?: string;
    action?: string;
    resourceType?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};

    if (filters?.userId) where.userId = filters.userId;
    if (filters?.action) where.action = { contains: filters.action, mode: 'insensitive' };
    if (filters?.resourceType) where.resourceType = filters.resourceType;

    return prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 100,
      skip: filters?.offset || 0,
    });
  }

  static async findById(id: string) {
    return prisma.auditLog.findUnique({
      where: { id },
    });
  }

  static async deleteOlderThan(date: Date) {
    return prisma.auditLog.deleteMany({
      where: {
        createdAt: {
          lt: date,
        },
      },
    });
  }
}

export default AuditLogModel;
