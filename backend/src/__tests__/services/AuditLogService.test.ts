import { AuditLogService } from '../../services/AuditLogService';
import { AuditLogModel } from '../../models/AuditLog';
import { config } from '../../config';

jest.mock('../../models/AuditLog');

describe('AuditLogService', () => {
  let auditLogService: AuditLogService;
  const mockUser = {
    id: 'user123',
    email: 'test@example.com',
  };
  const mockAction = {
    type: 'DOWNLOAD_ERROR_REPORT',
    resourceId: 'report123',
    resourceType: 'ErrorReport',
    details: { format: 'PDF' },
  };

  beforeEach(() => {
    auditLogService = new AuditLogService();
    jest.clearAllMocks();
  });

  describe('logAction', () => {
    it('should create audit log entry with user and action details', async () => {
      const mockAuditLog = {
        id: 'log123',
        userId: mockUser.id,
        userEmail: mockUser.email,
        actionType: mockAction.type,
        resourceId: mockAction.resourceId,
        resourceType: mockAction.resourceType,
        details: mockAction.details,
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        createdAt: new Date(),
      };

      jest.spyOn(AuditLogModel, 'create').mockResolvedValue(mockAuditLog);

      const result = await auditLogService.logAction(mockUser, mockAction, {
        ip: '127.0.0.1',
        headers: { 'user-agent': 'Mozilla/5.0' },
      } as any);

      expect(result).toEqual(mockAuditLog);
      expect(AuditLogModel.create).toHaveBeenCalledWith({
        userId: mockUser.id,
        userEmail: mockUser.email,
        actionType: mockAction.type,
        resourceId: mockAction.resourceId,
        resourceType: mockAction.resourceType,
        details: mockAction.details,
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
      });
    });

    it('should handle missing user agent', async () => {
      const mockAuditLog = {
        id: 'log123',
        userId: mockUser.id,
        userEmail: mockUser.email,
        actionType: mockAction.type,
        resourceId: mockAction.resourceId,
        resourceType: mockAction.resourceType,
        details: mockAction.details,
        ipAddress: '127.0.0.1',
        userAgent: null,
        createdAt: new Date(),
      };

      jest.spyOn(AuditLogModel, 'create').mockResolvedValue(mockAuditLog);

      const result = await auditLogService.logAction(mockUser, mockAction, {
        ip: '127.0.0.1',
        headers: {},
      } as any);

      expect(result).toEqual(mockAuditLog);
      expect(AuditLogModel.create).toHaveBeenCalledWith({
        userId: mockUser.id,
        userEmail: mockUser.email,
        actionType: mockAction.type,
        resourceId: mockAction.resourceId,
        resourceType: mockAction.resourceType,
        details: mockAction.details,
        ipAddress: '127.0.0.1',
        userAgent: null,
      });
    });

    it('should handle X-Forwarded-For header', async () => {
      const mockAuditLog = {
        id: 'log123',
        userId: mockUser.id,
        userEmail: mockUser.email,
        actionType: mockAction.type,
        resourceId: mockAction.resourceId,
        resourceType: mockAction.resourceType,
        details: mockAction.details,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        createdAt: new Date(),
      };

      jest.spyOn(AuditLogModel, 'create').mockResolvedValue(mockAuditLog);

      const result = await auditLogService.logAction(mockUser, mockAction, {
        ip: '127.0.0.1',
        headers: {
          'user-agent': 'Mozilla/5.0',
          'x-forwarded-for': '192.168.1.1, 10.0.0.1',
        },
      } as any);

      expect(result).toEqual(mockAuditLog);
      expect(AuditLogModel.create).toHaveBeenCalledWith({
        userId: mockUser.id,
        userEmail: mockUser.email,
        actionType: mockAction.type,
        resourceId: mockAction.resourceId,
        resourceType: mockAction.resourceType,
        details: mockAction.details,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      });
    });
  });

  describe('getUserAuditLogs', () => {
    it('should return paginated audit logs for user', async () => {
      const mockLogs = [
        {
          id: 'log1',
          userId: mockUser.id,
          actionType: 'DOWNLOAD_ERROR_REPORT',
          createdAt: new Date(),
        },
        {
          id: 'log2',
          userId: mockUser.id,
          actionType: 'VIEW_ERROR_REPORT',
          createdAt: new Date(),
        },
      ];

      jest.spyOn(AuditLogModel, 'findByUserId').mockResolvedValue(mockLogs);

      const result = await auditLogService.getUserAuditLogs(mockUser.id, {
        limit: 10,
        offset: 0,
      });

      expect(result).toEqual(mockLogs);
      expect(AuditLogModel.findByUserId).toHaveBeenCalledWith(mockUser.id, {
        limit: 10,
        offset: 0,
      });
    });
  });

  describe('getResourceAuditLogs', () => {
    it('should return paginated audit logs for resource', async () => {
      const mockLogs = [
        {
          id: 'log1',
          resourceId: 'report123',
          resourceType: 'ErrorReport',
          actionType: 'DOWNLOAD_ERROR_REPORT',
          createdAt: new Date(),
        },
        {
          id: 'log2',
          resourceId: 'report123',
          resourceType: 'ErrorReport',
          actionType: 'VIEW_ERROR_REPORT',
          createdAt: new Date(),
        },
      ];

      jest.spyOn(AuditLogModel, 'findByResource').mockResolvedValue(mockLogs);

      const result = await auditLogService.getResourceAuditLogs(
        mockAction.resourceId,
        mockAction.resourceType,
        {
          limit: 10,
          offset: 0,
        },
      );

      expect(result).toEqual(mockLogs);
      expect(AuditLogModel.findByResource).toHaveBeenCalledWith(
        mockAction.resourceId,
        mockAction.resourceType,
        {
          limit: 10,
          offset: 0,
        },
      );
    });
  });

  describe('cleanupOldLogs', () => {
    it('should delete logs older than retention period', async () => {
      const mockDeletedCount = 100;
      jest
        .spyOn(AuditLogModel, 'deleteOldLogs')
        .mockResolvedValue(mockDeletedCount);

      const result = await auditLogService.cleanupOldLogs();

      expect(result).toBe(mockDeletedCount);
      expect(AuditLogModel.deleteOldLogs).toHaveBeenCalledWith(
        config.cleanup.auditLogRetentionDays,
      );
    });

    it('should handle cleanup failures gracefully', async () => {
      jest
        .spyOn(AuditLogModel, 'deleteOldLogs')
        .mockRejectedValue(new Error('Cleanup failed'));

      await expect(auditLogService.cleanupOldLogs()).rejects.toThrow(
        'Cleanup failed',
      );
    });
  });

  describe('searchAuditLogs', () => {
    it('should search logs with filters', async () => {
      const mockLogs = [
        {
          id: 'log1',
          userId: mockUser.id,
          actionType: 'DOWNLOAD_ERROR_REPORT',
          createdAt: new Date(),
        },
      ];

      const searchParams = {
        userId: mockUser.id,
        actionType: 'DOWNLOAD_ERROR_REPORT',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        limit: 10,
        offset: 0,
      };

      jest.spyOn(AuditLogModel, 'search').mockResolvedValue(mockLogs);

      const result = await auditLogService.searchAuditLogs(searchParams);

      expect(result).toEqual(mockLogs);
      expect(AuditLogModel.search).toHaveBeenCalledWith(searchParams);
    });

    it('should handle search with partial filters', async () => {
      const mockLogs = [
        {
          id: 'log1',
          actionType: 'DOWNLOAD_ERROR_REPORT',
          createdAt: new Date(),
        },
      ];

      const searchParams = {
        actionType: 'DOWNLOAD_ERROR_REPORT',
        limit: 10,
        offset: 0,
      };

      jest.spyOn(AuditLogModel, 'search').mockResolvedValue(mockLogs);

      const result = await auditLogService.searchAuditLogs(searchParams);

      expect(result).toEqual(mockLogs);
      expect(AuditLogModel.search).toHaveBeenCalledWith(searchParams);
    });
  });
});
