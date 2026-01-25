import { prisma } from '../prisma';
import { ExportJob as PrismaExportJob } from '@prisma/client';

/**
 * @deprecated This model references a non-existent 'Export' table in Prisma.
 * Use ExportJob model from Prisma instead: prisma.exportJob
 * The ExportJob table exists in schema.prisma with all necessary fields.
 */

export type Export = PrismaExportJob;

export enum ExportStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  EXPIRED = 'expired',
}

export enum ExportFormat {
  CSV = 'csv',
  XLSX = 'xlsx',
  JSON = 'json',
  PDF = 'pdf',
}

export enum ExportEventType {
  CREATED = 'created',
  STARTED = 'started',
  PROGRESS = 'progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  DOWNLOADED = 'downloaded',
  EXPIRED = 'expired',
}

export interface CreateExportInput {
  userId: string;
  format: string;
  options?: any;
  metadata?: any;
}

export interface UpdateExportInput {
  status?: string;
  progress?: number;
  totalRecords?: number;
  processedRecords?: number;
  recordCount?: number;
  fileSize?: number;
  downloadUrl?: string;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export class ExportError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'ExportError';
  }
}

/**
 * @deprecated Use prisma.exportJob directly instead
 * Example: await prisma.exportJob.create({ data: { ... } })
 */
export class ExportModel {
  static async create(data: CreateExportInput): Promise<PrismaExportJob> {
    return await prisma.exportJob.create({
      data: {
        ...data,
        status: ExportStatus.PENDING,
        progress: 0,
        processedRecords: 0,
      },
    });
  }

  static async findById(id: string): Promise<PrismaExportJob | null> {
    return await prisma.exportJob.findUnique({
      where: { id },
    });
  }

  static async findAll(filters?: {
    userId?: string;
    status?: string;
    format?: string;
  }): Promise<PrismaExportJob[]> {
    return await prisma.exportJob.findMany({
      where: filters,
      orderBy: { createdAt: 'desc' },
    });
  }

  static async update(id: string, data: UpdateExportInput): Promise<PrismaExportJob> {
    return await prisma.exportJob.update({
      where: { id },
      data,
    });
  }

  static async delete(id: string): Promise<PrismaExportJob> {
    return await prisma.exportJob.delete({
      where: { id },
    });
  }
}

export default ExportModel;
