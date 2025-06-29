import { CleanupService } from '../../services/CleanupService';
import { NotificationModel } from '../../models/Notification';
import { ErrorReportModel } from '../../models/ErrorReport';
import { AuditLogModel } from '../../models/AuditLog';
import { MonitoringService } from '../../services/MonitoringService';
import { config } from '../../config';
import fs from 'fs/promises';

jest.mock('../../models/Notification');
jest.mock('../../models/ErrorReport');
jest.mock('../../models/AuditLog');
jest.mock('../../services/MonitoringService');
jest.mock('fs/promises');

describe('CleanupService', () => {
  let cleanupService: CleanupService;
  let mockMonitoringService: jest.Mocked<MonitoringService>;

  beforeEach(() => {
    mockMonitoringService =
      new MonitoringService() as jest.Mocked<MonitoringService>;
    cleanupService = new CleanupService(mockMonitoringService);
    jest.clearAllMocks();
  });

  describe('runCleanup', () => {
    it('should run all cleanup tasks successfully', async () => {
      // Mock cleanup results
      jest
        .spyOn(NotificationModel, 'deleteOldNotifications')
        .mockResolvedValue(50);
      jest.spyOn(ErrorReportModel, 'deleteOldReports').mockResolvedValue(30);
      jest.spyOn(AuditLogModel, 'deleteOldLogs').mockResolvedValue(100);
      mockMonitoringService.cleanupOldMetrics.mockResolvedValue(200);
      (fs.unlink as jest.Mock).mockResolvedValue(undefined);

      const result = await cleanupService.runCleanup();

      expect(result).toEqual({
        notificationsDeleted: 50,
        errorReportsDeleted: 30,
        auditLogsDeleted: 100,
        metricsDeleted: 200,
        success: true,
        timestamp: expect.any(Date),
      });

      expect(NotificationModel.deleteOldNotifications).toHaveBeenCalledWith(
        config.cleanup.notificationRetentionDays,
      );
      expect(ErrorReportModel.deleteOldReports).toHaveBeenCalledWith(
        config.cleanup.errorReportRetentionDays,
      );
      expect(AuditLogModel.deleteOldLogs).toHaveBeenCalledWith(
        config.cleanup.auditLogRetentionDays,
      );
      expect(mockMonitoringService.cleanupOldMetrics).toHaveBeenCalled();
    });

    it('should handle partial cleanup failures', async () => {
      // Mock some successful and some failed cleanups
      jest
        .spyOn(NotificationModel, 'deleteOldNotifications')
        .mockResolvedValue(50);
      jest
        .spyOn(ErrorReportModel, 'deleteOldReports')
        .mockRejectedValue(new Error('Error report cleanup failed'));
      jest.spyOn(AuditLogModel, 'deleteOldLogs').mockResolvedValue(100);
      mockMonitoringService.cleanupOldMetrics.mockResolvedValue(200);

      const result = await cleanupService.runCleanup();

      expect(result).toEqual({
        notificationsDeleted: 50,
        errorReportsDeleted: 0,
        auditLogsDeleted: 100,
        metricsDeleted: 200,
        success: false,
        timestamp: expect.any(Date),
        errors: ['Error report cleanup failed'],
      });

      expect(NotificationModel.deleteOldNotifications).toHaveBeenCalled();
      expect(ErrorReportModel.deleteOldReports).toHaveBeenCalled();
      expect(AuditLogModel.deleteOldLogs).toHaveBeenCalled();
      expect(mockMonitoringService.cleanupOldMetrics).toHaveBeenCalled();
    });

    it('should handle all cleanup failures', async () => {
      // Mock all cleanup operations failing
      jest
        .spyOn(NotificationModel, 'deleteOldNotifications')
        .mockRejectedValue(new Error('Notification cleanup failed'));
      jest
        .spyOn(ErrorReportModel, 'deleteOldReports')
        .mockRejectedValue(new Error('Error report cleanup failed'));
      jest
        .spyOn(AuditLogModel, 'deleteOldLogs')
        .mockRejectedValue(new Error('Audit log cleanup failed'));
      mockMonitoringService.cleanupOldMetrics.mockRejectedValue(
        new Error('Metrics cleanup failed'),
      );

      const result = await cleanupService.runCleanup();

      expect(result).toEqual({
        notificationsDeleted: 0,
        errorReportsDeleted: 0,
        auditLogsDeleted: 0,
        metricsDeleted: 0,
        success: false,
        timestamp: expect.any(Date),
        errors: [
          'Notification cleanup failed',
          'Error report cleanup failed',
          'Audit log cleanup failed',
          'Metrics cleanup failed',
        ],
      });
    });
  });

  describe('cleanupErrorReportFiles', () => {
    it('should delete error report files successfully', async () => {
      const mockReports = [
        {
          id: 'report1',
          createdAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
        },
        {
          id: 'report2',
          createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        },
      ];

      jest
        .spyOn(ErrorReportModel, 'findOldReports')
        .mockResolvedValue(mockReports);
      (fs.unlink as jest.Mock).mockResolvedValue(undefined);

      const result = await cleanupService.cleanupErrorReportFiles();

      expect(result).toEqual({
        filesDeleted: 2,
        success: true,
        timestamp: expect.any(Date),
      });

      expect(ErrorReportModel.findOldReports).toHaveBeenCalledWith(
        config.cleanup.errorReportRetentionDays,
      );
      expect(fs.unlink).toHaveBeenCalledTimes(2);
    });

    it('should handle file deletion failures', async () => {
      const mockReports = [
        {
          id: 'report1',
          createdAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
        },
        {
          id: 'report2',
          createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        },
      ];

      jest
        .spyOn(ErrorReportModel, 'findOldReports')
        .mockResolvedValue(mockReports);
      (fs.unlink as jest.Mock)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('File deletion failed'));

      const result = await cleanupService.cleanupErrorReportFiles();

      expect(result).toEqual({
        filesDeleted: 1,
        success: false,
        timestamp: expect.any(Date),
        errors: ['File deletion failed'],
      });

      expect(fs.unlink).toHaveBeenCalledTimes(2);
    });

    it('should handle no old reports found', async () => {
      jest.spyOn(ErrorReportModel, 'findOldReports').mockResolvedValue([]);

      const result = await cleanupService.cleanupErrorReportFiles();

      expect(result).toEqual({
        filesDeleted: 0,
        success: true,
        timestamp: expect.any(Date),
      });

      expect(ErrorReportModel.findOldReports).toHaveBeenCalled();
      expect(fs.unlink).not.toHaveBeenCalled();
    });
  });

  describe('getCleanupHistory', () => {
    it('should return cleanup history within time range', async () => {
      const mockHistory = [
        {
          timestamp: new Date(),
          notificationsDeleted: 50,
          errorReportsDeleted: 30,
          auditLogsDeleted: 100,
          metricsDeleted: 200,
          success: true,
        },
      ];

      jest
        .spyOn(cleanupService as any, 'retrieveCleanupHistory')
        .mockResolvedValue(mockHistory);

      const result = await cleanupService.getCleanupHistory({
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
      });

      expect(result).toEqual(mockHistory);
      expect(cleanupService['retrieveCleanupHistory']).toHaveBeenCalledWith({
        startDate: expect.any(Date),
        endDate: expect.any(Date),
      });
    });

    it('should handle retrieval failures', async () => {
      jest
        .spyOn(cleanupService as any, 'retrieveCleanupHistory')
        .mockRejectedValue(new Error('Retrieval failed'));

      await expect(
        cleanupService.getCleanupHistory({
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-12-31'),
        }),
      ).rejects.toThrow('Retrieval failed');
    });
  });

  describe('cleanupHistory', () => {
    it('should delete cleanup history older than retention period', async () => {
      const mockDeletedCount = 50;
      jest
        .spyOn(cleanupService as any, 'deleteOldCleanupHistory')
        .mockResolvedValue(mockDeletedCount);

      const result = await cleanupService.cleanupHistory();

      expect(result).toBe(mockDeletedCount);
      expect(cleanupService['deleteOldCleanupHistory']).toHaveBeenCalledWith(
        config.cleanup.historyRetentionDays,
      );
    });

    it('should handle cleanup history deletion failures', async () => {
      jest
        .spyOn(cleanupService as any, 'deleteOldCleanupHistory')
        .mockRejectedValue(new Error('Cleanup failed'));

      await expect(cleanupService.cleanupHistory()).rejects.toThrow(
        'Cleanup failed',
      );
    });
  });
});
