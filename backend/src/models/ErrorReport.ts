import { z } from 'zod';
import { prisma } from '../utils/prisma';

export const ErrorReportFormat = {
  PDF: 'pdf',
  CSV: 'csv',
} as const;

export type ErrorReportFormat =
  (typeof ErrorReportFormat)[keyof typeof ErrorReportFormat];

export const ErrorReportSchema = z.object({
  id: z.string(),
  userId: z.string(),
  batchJobId: z.string(),
  errorType: z.string(),
  errorCode: z.string(),
  errorMessage: z.string(),
  errorDetails: z.record(z.unknown()).optional(),
  troubleshootingTips: z.array(z.string()),
  stackTrace: z.string().optional(),
  reportPath: z.string().optional(),
  reportFormat: z
    .enum([ErrorReportFormat.PDF, ErrorReportFormat.CSV])
    .optional(),
  downloadCount: z.number().default(0),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type ErrorReport = z.infer<typeof ErrorReportSchema>;

export class ErrorReportModel {
  static async create(
    data: Omit<ErrorReport, 'id' | 'createdAt' | 'updatedAt' | 'downloadCount'>,
  ) {
    return prisma.errorReport.create({
      data: {
        ...data,
        downloadCount: 0,
      },
    });
  }

  static async findById(id: string) {
    return prisma.errorReport.findUnique({
      where: { id },
    });
  }

  static async findByBatchJobId(batchJobId: string) {
    return prisma.errorReport.findMany({
      where: { batchJobId },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async updateReportFile(
    id: string,
    reportPath: string,
    reportFormat: ErrorReportFormat,
  ) {
    return prisma.errorReport.update({
      where: { id },
      data: {
        reportPath,
        reportFormat,
      },
    });
  }

  static async incrementDownloadCount(id: string) {
    return prisma.errorReport.update({
      where: { id },
      data: {
        downloadCount: {
          increment: 1,
        },
      },
    });
  }
}
