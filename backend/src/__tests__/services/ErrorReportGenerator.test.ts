import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ErrorReportGenerator } from '../../services/ErrorReportGenerator';
import { ErrorReportModel } from '../../models/ErrorReport';
import { config } from '../../config';
import fs from 'fs/promises';
import path from 'path';

jest.mock('fs/promises');
jest.mock('../../models/ErrorReport');

describe('ErrorReportGenerator', () => {
  let errorReportGenerator: ErrorReportGenerator;
  const mockErrorReport = {
    id: 'report123',
    userId: 'user123',
    batchJobId: 'job123',
    errorType: 'EXTRACTION_ERROR',
    errorCode: 'E001',
    errorMessage: 'Failed to extract PDF',
    errorDetails: { page: 1, file: 'test.pdf' },
    troubleshootingTips: ['Check PDF format', 'Verify file permissions'],
    stackTrace: 'Error: PDF extraction failed...',
    downloadCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    errorReportGenerator = new ErrorReportGenerator();
    jest.clearAllMocks();
  });

  describe('generatePDF', () => {
    it('should generate PDF report and update download count', async () => {
      const mockPDFBuffer = Buffer.from('mock PDF content');
      jest
        .spyOn(errorReportGenerator as any, 'generatePDFContent')
        .mockResolvedValue(mockPDFBuffer);
      jest.spyOn(ErrorReportModel, 'incrementDownloadCount').mockResolvedValue({
        ...mockErrorReport,
        downloadCount: 1,
      });

      const result = await errorReportGenerator.generatePDF(mockErrorReport);

      expect(result).toEqual({
        buffer: mockPDFBuffer,
        filename: `error-report-${mockErrorReport.id}.pdf`,
        contentType: 'application/pdf',
      });
      expect(ErrorReportModel.incrementDownloadCount).toHaveBeenCalledWith(
        mockErrorReport.id,
      );
    });

    it('should handle PDF generation failure', async () => {
      jest
        .spyOn(errorReportGenerator as any, 'generatePDFContent')
        .mockRejectedValue(new Error('PDF generation failed'));

      await expect(
        errorReportGenerator.generatePDF(mockErrorReport),
      ).rejects.toThrow('PDF generation failed');
      expect(ErrorReportModel.incrementDownloadCount).not.toHaveBeenCalled();
    });
  });

  describe('generateCSV', () => {
    it('should generate CSV report and update download count', async () => {
      const mockCSVContent =
        'error_type,error_code,error_message,created_at\nEXTRACTION_ERROR,E001,Failed to extract PDF,2024-03-20';
      jest
        .spyOn(errorReportGenerator as any, 'generateCSVContent')
        .mockResolvedValue(mockCSVContent);
      jest.spyOn(ErrorReportModel, 'incrementDownloadCount').mockResolvedValue({
        ...mockErrorReport,
        downloadCount: 1,
      });

      const result = await errorReportGenerator.generateCSV(mockErrorReport);

      expect(result).toEqual({
        buffer: Buffer.from(mockCSVContent),
        filename: `error-report-${mockErrorReport.id}.csv`,
        contentType: 'text/csv',
      });
      expect(ErrorReportModel.incrementDownloadCount).toHaveBeenCalledWith(
        mockErrorReport.id,
      );
    });

    it('should handle CSV generation failure', async () => {
      jest
        .spyOn(errorReportGenerator as any, 'generateCSVContent')
        .mockRejectedValue(new Error('CSV generation failed'));

      await expect(
        errorReportGenerator.generateCSV(mockErrorReport),
      ).rejects.toThrow('CSV generation failed');
      expect(ErrorReportModel.incrementDownloadCount).not.toHaveBeenCalled();
    });
  });

  describe('cleanupOldReports', () => {
    it('should delete reports older than retention period', async () => {
      const mockReports = [
        {
          ...mockErrorReport,
          id: 'report1',
          createdAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
        },
        {
          ...mockErrorReport,
          id: 'report2',
          createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        },
      ];

      jest
        .spyOn(ErrorReportModel, 'findOldReports')
        .mockResolvedValue(mockReports);
      jest.spyOn(ErrorReportModel, 'delete').mockResolvedValue(true);
      (fs.unlink as jest.Mock).mockResolvedValue(undefined);

      await errorReportGenerator.cleanupOldReports();

      expect(ErrorReportModel.findOldReports).toHaveBeenCalledWith(
        config.cleanup.errorReportRetentionDays,
      );
      expect(ErrorReportModel.delete).toHaveBeenCalledTimes(2);
      expect(fs.unlink).toHaveBeenCalledTimes(2);
    });

    it('should handle cleanup failures gracefully', async () => {
      const mockReports = [
        {
          ...mockErrorReport,
          id: 'report1',
          createdAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
        },
      ];

      jest
        .spyOn(ErrorReportModel, 'findOldReports')
        .mockResolvedValue(mockReports);
      jest
        .spyOn(ErrorReportModel, 'delete')
        .mockRejectedValue(new Error('Delete failed'));
      (fs.unlink as jest.Mock).mockRejectedValue(
        new Error('File delete failed'),
      );

      await errorReportGenerator.cleanupOldReports();

      expect(ErrorReportModel.findOldReports).toHaveBeenCalled();
      expect(ErrorReportModel.delete).toHaveBeenCalled();
      expect(fs.unlink).toHaveBeenCalled();
    });
  });

  describe('private methods', () => {
    describe('generatePDFContent', () => {
      it('should generate PDF content with all error report details', async () => {
        const result = await (errorReportGenerator as any).generatePDFContent(
          mockErrorReport,
        );

        expect(result).toBeInstanceOf(Buffer);
        // Add more specific assertions about PDF content structure
      });
    });

    describe('generateCSVContent', () => {
      it('should generate CSV content with all error report details', async () => {
        const result = await (errorReportGenerator as any).generateCSVContent(
          mockErrorReport,
        );

        expect(result).toContain('error_type,error_code,error_message');
        expect(result).toContain(mockErrorReport.errorType);
        expect(result).toContain(mockErrorReport.errorCode);
        expect(result).toContain(mockErrorReport.errorMessage);
      });
    });

    describe('getReportFilePath', () => {
      it('should return correct file path for report', () => {
        const result = (errorReportGenerator as any).getReportFilePath(
          mockErrorReport.id,
          'pdf',
        );

        expect(result).toBe(
          path.join(
            config.uploads.directory,
            `error-reports/${mockErrorReport.id}.pdf`,
          ),
        );
      });
    });
  });
});
