import { NotificationService } from '../../services/NotificationService';
import { EmailService } from '../../services/EmailService';
import { NotificationModel } from '../../models/Notification';
import { ErrorReportModel } from '../../models/ErrorReport';
import {
  NotificationType,
  NotificationStatus,
} from '../../models/Notification';
import { mock, MockProxy } from 'jest-mock-extended';

describe('NotificationService', () => {
  let notificationService: NotificationService;
  let emailService: MockProxy<EmailService>;

  beforeEach(() => {
    emailService = mock<EmailService>();
    notificationService = new NotificationService(emailService);
  });

  describe('createJobStatusNotification', () => {
    const mockParams = {
      userId: 'user123',
      batchJobId: 'job123',
      status: NotificationStatus.COMPLETED,
      message: 'Job completed successfully',
      metadata: { filesProcessed: 10 },
    };

    it('should create a notification and send email for completed status', async () => {
      // Mock NotificationModel.create
      const mockNotification = {
        id: 'notif123',
        ...mockParams,
        type: NotificationType.STATUS,
        read: false,
        createdAt: new Date(),
      };
      jest
        .spyOn(NotificationModel, 'create')
        .mockResolvedValue(mockNotification);

      // Mock EmailService.sendJobStatusEmail
      emailService.sendJobStatusEmail.mockResolvedValue();

      const result =
        await notificationService.createJobStatusNotification(mockParams);

      expect(result).toEqual(mockNotification);
      expect(NotificationModel.create).toHaveBeenCalledWith({
        ...mockParams,
        type: NotificationType.STATUS,
      });
      expect(emailService.sendJobStatusEmail).toHaveBeenCalledWith(mockParams);
    });

    it('should not send email for processing status', async () => {
      const processingParams = {
        ...mockParams,
        status: NotificationStatus.PROCESSING,
      };

      const mockNotification = {
        id: 'notif123',
        ...processingParams,
        type: NotificationType.STATUS,
        read: false,
        createdAt: new Date(),
      };
      jest
        .spyOn(NotificationModel, 'create')
        .mockResolvedValue(mockNotification);

      const result =
        await notificationService.createJobStatusNotification(processingParams);

      expect(result).toEqual(mockNotification);
      expect(emailService.sendJobStatusEmail).not.toHaveBeenCalled();
    });

    it('should handle email sending failure gracefully', async () => {
      const mockNotification = {
        id: 'notif123',
        ...mockParams,
        type: NotificationType.STATUS,
        read: false,
        createdAt: new Date(),
      };
      jest
        .spyOn(NotificationModel, 'create')
        .mockResolvedValue(mockNotification);
      emailService.sendJobStatusEmail.mockRejectedValue(
        new Error('Email failed'),
      );

      const result =
        await notificationService.createJobStatusNotification(mockParams);

      expect(result).toEqual(mockNotification);
      expect(emailService.sendJobStatusEmail).toHaveBeenCalled();
    });
  });

  describe('createErrorNotification', () => {
    const mockParams = {
      userId: 'user123',
      batchJobId: 'job123',
      errorType: 'EXTRACTION_ERROR',
      errorCode: 'E001',
      errorMessage: 'Failed to extract PDF',
      errorDetails: { page: 1 },
      troubleshootingTips: ['Check PDF format', 'Verify file permissions'],
      stackTrace: 'Error: PDF extraction failed...',
    };

    it('should create error report and notification, and send email', async () => {
      // Mock ErrorReportModel.create
      const mockErrorReport = {
        id: 'report123',
        ...mockParams,
        downloadCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      jest.spyOn(ErrorReportModel, 'create').mockResolvedValue(mockErrorReport);

      // Mock NotificationModel.create
      const mockNotification = {
        id: 'notif123',
        userId: mockParams.userId,
        batchJobId: mockParams.batchJobId,
        type: NotificationType.ERROR,
        status: NotificationStatus.FAILED,
        message: `Error in batch job: ${mockParams.errorMessage}`,
        metadata: {
          errorReportId: mockErrorReport.id,
          errorType: mockParams.errorType,
          errorCode: mockParams.errorCode,
        },
        read: false,
        createdAt: new Date(),
      };
      jest
        .spyOn(NotificationModel, 'create')
        .mockResolvedValue(mockNotification);

      // Mock EmailService.sendErrorNotificationEmail
      emailService.sendErrorNotificationEmail.mockResolvedValue();

      const result =
        await notificationService.createErrorNotification(mockParams);

      expect(result).toEqual({
        notification: mockNotification,
        errorReport: mockErrorReport,
      });
      expect(ErrorReportModel.create).toHaveBeenCalledWith(mockParams);
      expect(NotificationModel.create).toHaveBeenCalled();
      expect(emailService.sendErrorNotificationEmail).toHaveBeenCalledWith({
        userId: mockParams.userId,
        batchJobId: mockParams.batchJobId,
        errorType: mockParams.errorType,
        errorMessage: mockParams.errorMessage,
        errorReportId: mockErrorReport.id,
      });
    });

    it('should handle email sending failure gracefully', async () => {
      const mockErrorReport = {
        id: 'report123',
        ...mockParams,
        downloadCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      jest.spyOn(ErrorReportModel, 'create').mockResolvedValue(mockErrorReport);

      const mockNotification = {
        id: 'notif123',
        userId: mockParams.userId,
        batchJobId: mockParams.batchJobId,
        type: NotificationType.ERROR,
        status: NotificationStatus.FAILED,
        message: `Error in batch job: ${mockParams.errorMessage}`,
        metadata: {
          errorReportId: mockErrorReport.id,
          errorType: mockParams.errorType,
          errorCode: mockParams.errorCode,
        },
        read: false,
        createdAt: new Date(),
      };
      jest
        .spyOn(NotificationModel, 'create')
        .mockResolvedValue(mockNotification);

      emailService.sendErrorNotificationEmail.mockRejectedValue(
        new Error('Email failed'),
      );

      const result =
        await notificationService.createErrorNotification(mockParams);

      expect(result).toEqual({
        notification: mockNotification,
        errorReport: mockErrorReport,
      });
      expect(emailService.sendErrorNotificationEmail).toHaveBeenCalled();
    });
  });

  describe('getUserNotifications', () => {
    it('should return user notifications with pagination', async () => {
      const mockNotifications = [
        {
          id: 'notif1',
          userId: 'user123',
          batchJobId: 'job123',
          type: NotificationType.STATUS,
          status: NotificationStatus.COMPLETED,
          message: 'Job completed',
          read: false,
          createdAt: new Date(),
        },
        {
          id: 'notif2',
          userId: 'user123',
          batchJobId: 'job456',
          type: NotificationType.ERROR,
          status: NotificationStatus.FAILED,
          message: 'Job failed',
          read: true,
          createdAt: new Date(),
        },
      ];

      jest
        .spyOn(NotificationModel, 'findByUserId')
        .mockResolvedValue(mockNotifications);

      const result = await notificationService.getUserNotifications('user123', {
        limit: 10,
        offset: 0,
      });

      expect(result).toEqual(mockNotifications);
      expect(NotificationModel.findByUserId).toHaveBeenCalledWith('user123', {
        limit: 10,
        offset: 0,
      });
    });
  });

  describe('markNotificationAsRead', () => {
    it('should mark notification as read', async () => {
      const mockNotification = {
        id: 'notif123',
        userId: 'user123',
        batchJobId: 'job123',
        type: NotificationType.STATUS,
        status: NotificationStatus.COMPLETED,
        message: 'Job completed',
        read: true,
        createdAt: new Date(),
      };

      jest
        .spyOn(NotificationModel, 'markAsRead')
        .mockResolvedValue(mockNotification);

      const result =
        await notificationService.markNotificationAsRead('notif123');

      expect(result).toEqual(mockNotification);
      expect(NotificationModel.markAsRead).toHaveBeenCalledWith('notif123');
    });
  });
});
