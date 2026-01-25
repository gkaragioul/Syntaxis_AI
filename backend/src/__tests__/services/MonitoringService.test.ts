import { MonitoringService } from '../../services/MonitoringService';
import { NotificationModel } from '../../models/Notification';
import { ErrorReportModel } from '../../models/ErrorReport';
import { config } from '../../config';
import { NotificationStatus } from '../../models/Notification';

jest.mock('../../models/Notification');
jest.mock('../../models/ErrorReport');

describe('MonitoringService', () => {
  let monitoringService: MonitoringService;
  const mockMetrics = {
    timestamp: new Date(),
    notificationMetrics: {
      totalNotifications: 100,
      deliveredNotifications: 80,
      failedNotifications: 5,
      averageDeliveryTime: 1500, // ms
      notificationsByType: {
        STATUS: 60,
        ERROR: 40,
      },
      notificationsByStatus: {
        COMPLETED: 70,
        FAILED: 5,
        PROCESSING: 25,
      },
    },
    errorReportMetrics: {
      totalErrorReports: 40,
      downloadedErrorReports: 30,
      averageDownloadTime: 2000, // ms
      errorsByType: {
        EXTRACTION_ERROR: 25,
        VALIDATION_ERROR: 15,
      },
    },
  };

  beforeEach(() => {
    monitoringService = new MonitoringService();
    jest.clearAllMocks();
  });

  describe('collectMetrics', () => {
    it('should collect and store metrics', async () => {
      // Mock notification metrics
      jest.spyOn(NotificationModel, 'getMetrics').mockResolvedValue({
        total: 100,
        delivered: 80,
        failed: 5,
        averageDeliveryTime: 1500,
        byType: {
          STATUS: 60,
          ERROR: 40,
        },
        byStatus: {
          COMPLETED: 70,
          FAILED: 5,
          PROCESSING: 25,
        },
      });

      // Mock error report metrics
      jest.spyOn(ErrorReportModel, 'getMetrics').mockResolvedValue({
        total: 40,
        downloaded: 30,
        averageDownloadTime: 2000,
        byType: {
          EXTRACTION_ERROR: 25,
          VALIDATION_ERROR: 15,
        },
      });

      // Mock metrics storage
      jest
        .spyOn(monitoringService as any, 'storeMetrics')
        .mockResolvedValue(mockMetrics);

      const result = await monitoringService.collectMetrics();

      expect(result).toEqual(mockMetrics);
      expect(NotificationModel.getMetrics).toHaveBeenCalled();
      expect(ErrorReportModel.getMetrics).toHaveBeenCalled();
      expect(monitoringService['storeMetrics']).toHaveBeenCalledWith({
        timestamp: expect.any(Date),
        notificationMetrics: expect.any(Object),
        errorReportMetrics: expect.any(Object),
      });
    });

    it('should handle collection failures gracefully', async () => {
      jest
        .spyOn(NotificationModel, 'getMetrics')
        .mockRejectedValue(new Error('Collection failed'));

      await expect(monitoringService.collectMetrics()).rejects.toThrow(
        'Collection failed',
      );
    });
  });

  describe('checkAlertConditions', () => {
    it('should trigger alerts when thresholds are exceeded', async () => {
      const mockMetrics = {
        timestamp: new Date(),
        notificationMetrics: {
          totalNotifications: 100,
          deliveredNotifications: 70,
          failedNotifications: 10,
          averageDeliveryTime: 3000, // ms
          notificationsByType: {
            STATUS: 60,
            ERROR: 40,
          },
          notificationsByStatus: {
            COMPLETED: 70,
            FAILED: 10,
            PROCESSING: 20,
          },
        },
        errorReportMetrics: {
          totalErrorReports: 40,
          downloadedErrorReports: 30,
          averageDownloadTime: 2000,
          errorsByType: {
            EXTRACTION_ERROR: 25,
            VALIDATION_ERROR: 15,
          },
        },
      };

      const alerts = await monitoringService.checkAlertConditions(mockMetrics);

      expect(alerts).toContainEqual({
        type: 'HIGH_ERROR_RATE',
        message: 'Error rate (10%) exceeds threshold (5%)',
        severity: 'HIGH',
        timestamp: expect.any(Date),
      });

      expect(alerts).toContainEqual({
        type: 'SLOW_DELIVERY',
        message:
          'Average notification delivery time (3000ms) exceeds threshold (2000ms)',
        severity: 'MEDIUM',
        timestamp: expect.any(Date),
      });
    });

    it('should not trigger alerts when metrics are within thresholds', async () => {
      const mockMetrics = {
        timestamp: new Date(),
        notificationMetrics: {
          totalNotifications: 100,
          deliveredNotifications: 95,
          failedNotifications: 2,
          averageDeliveryTime: 1500,
          notificationsByType: {
            STATUS: 60,
            ERROR: 40,
          },
          notificationsByStatus: {
            COMPLETED: 95,
            FAILED: 2,
            PROCESSING: 3,
          },
        },
        errorReportMetrics: {
          totalErrorReports: 40,
          downloadedErrorReports: 30,
          averageDownloadTime: 2000,
          errorsByType: {
            EXTRACTION_ERROR: 25,
            VALIDATION_ERROR: 15,
          },
        },
      };

      const alerts = await monitoringService.checkAlertConditions(mockMetrics);

      expect(alerts).toHaveLength(0);
    });
  });

  describe('getMetricsHistory', () => {
    it('should return metrics within time range', async () => {
      const mockHistory = [mockMetrics];
      jest
        .spyOn(monitoringService as any, 'retrieveMetrics')
        .mockResolvedValue(mockHistory);

      const result = await monitoringService.getMetricsHistory({
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
      });

      expect(result).toEqual(mockHistory);
      expect(monitoringService['retrieveMetrics']).toHaveBeenCalledWith({
        startDate: expect.any(Date),
        endDate: expect.any(Date),
      });
    });

    it('should handle retrieval failures gracefully', async () => {
      jest
        .spyOn(monitoringService as any, 'retrieveMetrics')
        .mockRejectedValue(new Error('Retrieval failed'));

      await expect(
        monitoringService.getMetricsHistory({
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-12-31'),
        }),
      ).rejects.toThrow('Retrieval failed');
    });
  });

  describe('cleanupOldMetrics', () => {
    it('should delete metrics older than retention period', async () => {
      const mockDeletedCount = 100;
      jest
        .spyOn(monitoringService as any, 'deleteOldMetrics')
        .mockResolvedValue(mockDeletedCount);

      const result = await monitoringService.cleanupOldMetrics();

      expect(result).toBe(mockDeletedCount);
      expect(monitoringService['deleteOldMetrics']).toHaveBeenCalledWith(
        config.metrics.retentionDays,
      );
    });

    it('should handle cleanup failures gracefully', async () => {
      jest
        .spyOn(monitoringService as any, 'deleteOldMetrics')
        .mockRejectedValue(new Error('Cleanup failed'));

      await expect(monitoringService.cleanupOldMetrics()).rejects.toThrow(
        'Cleanup failed',
      );
    });
  });

  describe('getCurrentMetrics', () => {
    it('should return current metrics without storing', async () => {
      // Mock notification metrics
      jest.spyOn(NotificationModel, 'getMetrics').mockResolvedValue({
        total: 100,
        delivered: 80,
        failed: 5,
        averageDeliveryTime: 1500,
        byType: {
          STATUS: 60,
          ERROR: 40,
        },
        byStatus: {
          COMPLETED: 70,
          FAILED: 5,
          PROCESSING: 25,
        },
      });

      // Mock error report metrics
      jest.spyOn(ErrorReportModel, 'getMetrics').mockResolvedValue({
        total: 40,
        downloaded: 30,
        averageDownloadTime: 2000,
        byType: {
          EXTRACTION_ERROR: 25,
          VALIDATION_ERROR: 15,
        },
      });

      const result = await monitoringService.getCurrentMetrics();

      expect(result).toEqual({
        timestamp: expect.any(Date),
        notificationMetrics: expect.any(Object),
        errorReportMetrics: expect.any(Object),
      });
      expect(NotificationModel.getMetrics).toHaveBeenCalled();
      expect(ErrorReportModel.getMetrics).toHaveBeenCalled();
      expect(monitoringService['storeMetrics']).not.toHaveBeenCalled();
    });
  });
});
