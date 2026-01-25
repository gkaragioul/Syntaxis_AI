import { prisma } from '../prisma';
import { ErrorReport as PrismaErrorReport } from '@prisma/client';

export type ErrorReport = PrismaErrorReport;

export class ErrorReportModel {
  static async create(data: {
    userId: string;
    batchJobId: string;
    errorType: string;
    errorCode: string;
    errorMessage: string;
    errorDetails?: any;
    troubleshootingTips: string[];
    stackTrace?: string;
  }) {
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
    reportFormat: string,
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

export default ErrorReportModel;
