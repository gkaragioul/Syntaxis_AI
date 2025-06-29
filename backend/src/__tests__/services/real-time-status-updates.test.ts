import { RealTimeStatusService } from '../../services/real-time-status.service';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

// Mock WebSocket and EventEmitter
const createMockWebSocket = () => ({
  send: jest.fn(),
  readyState: 1, // OPEN
  close: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  removeAllListeners: jest.fn(),
});

const mockWebSocket = createMockWebSocket();

const mockEventEmitter = {
  emit: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  removeAllListeners: jest.fn(),
};

// Mock PrismaClient
const mockPrisma = {
  invoice: {
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  statusUpdate: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
} as unknown as PrismaClient;

describe('Real-Time Status Updates Service', () => {
  let statusService: RealTimeStatusService;
  let testUserId: string;
  let testInvoiceId: string;

  beforeEach(() => {
    jest.clearAllMocks();
    statusService = new RealTimeStatusService(mockPrisma, mockEventEmitter as any);
    testUserId = uuidv4();
    testInvoiceId = uuidv4();
  });

  describe('WebSocket Connection Management', () => {
    it('should register WebSocket connection for user', async () => {
      const connectionId = await statusService.registerConnection(testUserId, mockWebSocket as any);

      expect(connectionId).toBeDefined();
      expect(typeof connectionId).toBe('string');
      
      const connections = statusService.getActiveConnections(testUserId);
      expect(connections).toHaveLength(1);
      expect(connections[0].connectionId).toBe(connectionId);
    });

    it('should handle multiple connections for same user', async () => {
      const mockWebSocket2 = createMockWebSocket();

      const connectionId1 = await statusService.registerConnection(testUserId, mockWebSocket as any);
      const connectionId2 = await statusService.registerConnection(testUserId, mockWebSocket2 as any);

      expect(connectionId1).not.toBe(connectionId2);
      
      const connections = statusService.getActiveConnections(testUserId);
      expect(connections).toHaveLength(2);
    });

    it('should unregister WebSocket connection', async () => {
      const connectionId = await statusService.registerConnection(testUserId, mockWebSocket as any);
      
      await statusService.unregisterConnection(connectionId);
      
      const connections = statusService.getActiveConnections(testUserId);
      expect(connections).toHaveLength(0);
    });

    it('should handle connection cleanup on WebSocket close', async () => {
      const connectionId = await statusService.registerConnection(testUserId, mockWebSocket as any);
      
      // Simulate WebSocket close event
      await statusService.handleConnectionClose(connectionId);
      
      const connections = statusService.getActiveConnections(testUserId);
      expect(connections).toHaveLength(0);
    });

    it('should send heartbeat to maintain connections', async () => {
      const connectionId = await statusService.registerConnection(testUserId, mockWebSocket as any);
      
      await statusService.sendHeartbeat(connectionId);
      
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'heartbeat',
          timestamp: expect.any(String),
        })
      );
    });
  });

  describe('Status Update Broadcasting', () => {
    it('should broadcast invoice status update to connected users', async () => {
      const connectionId = await statusService.registerConnection(testUserId, mockWebSocket as any);
      
      const statusUpdate = {
        invoiceId: testInvoiceId,
        status: 'processed',
        previousStatus: 'pending',
        timestamp: new Date(),
        metadata: {
          processingTime: 1500,
          confidence: 0.95,
        },
      };

      await statusService.broadcastInvoiceStatusUpdate(testUserId, statusUpdate);

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'invoice_status_update',
          data: statusUpdate,
        })
      );
    });

    it('should broadcast processing progress updates', async () => {
      const connectionId = await statusService.registerConnection(testUserId, mockWebSocket as any);
      
      const progressUpdate = {
        invoiceId: testInvoiceId,
        stage: 'field_extraction',
        progress: 75,
        estimatedTimeRemaining: 30,
        currentStep: 'Extracting vendor information',
        totalSteps: 5,
        completedSteps: 3,
      };

      await statusService.broadcastProcessingProgress(testUserId, progressUpdate);

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'processing_progress',
          data: progressUpdate,
        })
      );
    });

    it('should broadcast validation result updates', async () => {
      const connectionId = await statusService.registerConnection(testUserId, mockWebSocket as any);
      
      const validationUpdate = {
        invoiceId: testInvoiceId,
        validationStatus: 'completed',
        validationResults: {
          overallScore: 0.92,
          fieldValidations: {
            invoiceNumber: { isValid: true, confidence: 0.98 },
            totalAmount: { isValid: true, confidence: 0.95 },
            vendorName: { isValid: false, confidence: 0.65, errors: ['Low confidence'] },
          },
          businessRuleValidations: {
            passed: 8,
            failed: 1,
            warnings: 2,
          },
        },
      };

      await statusService.broadcastValidationUpdate(testUserId, validationUpdate);

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'validation_update',
          data: validationUpdate,
        })
      );
    });

    it('should broadcast error notifications', async () => {
      const connectionId = await statusService.registerConnection(testUserId, mockWebSocket as any);
      
      const errorNotification = {
        invoiceId: testInvoiceId,
        errorType: 'processing_error',
        severity: 'high',
        message: 'Failed to extract invoice data',
        details: {
          stage: 'ocr_processing',
          errorCode: 'OCR_001',
          retryable: true,
        },
        timestamp: new Date(),
      };

      await statusService.broadcastErrorNotification(testUserId, errorNotification);

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'error_notification',
          data: errorNotification,
        })
      );
    });

    it('should broadcast system notifications', async () => {
      const connectionId = await statusService.registerConnection(testUserId, mockWebSocket as any);
      
      const systemNotification = {
        type: 'system_maintenance',
        title: 'Scheduled Maintenance',
        message: 'System will be down for maintenance in 30 minutes',
        severity: 'warning',
        actionRequired: false,
        dismissible: true,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      };

      await statusService.broadcastSystemNotification(testUserId, systemNotification);

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'system_notification',
          data: systemNotification,
        })
      );
    });
  });

  describe('Subscription Management', () => {
    it('should subscribe user to invoice updates', async () => {
      const connectionId = await statusService.registerConnection(testUserId, mockWebSocket as any);
      
      await statusService.subscribeToInvoiceUpdates(connectionId, testInvoiceId);
      
      const subscriptions = statusService.getSubscriptions(connectionId);
      expect(subscriptions.invoices).toContain(testInvoiceId);
    });

    it('should unsubscribe user from invoice updates', async () => {
      const connectionId = await statusService.registerConnection(testUserId, mockWebSocket as any);
      
      await statusService.subscribeToInvoiceUpdates(connectionId, testInvoiceId);
      await statusService.unsubscribeFromInvoiceUpdates(connectionId, testInvoiceId);
      
      const subscriptions = statusService.getSubscriptions(connectionId);
      expect(subscriptions.invoices).not.toContain(testInvoiceId);
    });

    it('should subscribe to processing queue updates', async () => {
      const connectionId = await statusService.registerConnection(testUserId, mockWebSocket as any);
      
      await statusService.subscribeToQueueUpdates(connectionId, 'human-review');
      
      const subscriptions = statusService.getSubscriptions(connectionId);
      expect(subscriptions.queues).toContain('human-review');
    });

    it('should subscribe to system-wide notifications', async () => {
      const connectionId = await statusService.registerConnection(testUserId, mockWebSocket as any);
      
      await statusService.subscribeToSystemNotifications(connectionId);
      
      const subscriptions = statusService.getSubscriptions(connectionId);
      expect(subscriptions.systemNotifications).toBe(true);
    });

    it('should handle bulk subscription updates', async () => {
      const connectionId = await statusService.registerConnection(testUserId, mockWebSocket as any);
      
      const subscriptionUpdate = {
        invoices: [testInvoiceId, uuidv4()],
        queues: ['human-review', 'auto-approval'],
        systemNotifications: true,
        userNotifications: true,
      };

      await statusService.updateSubscriptions(connectionId, subscriptionUpdate);
      
      const subscriptions = statusService.getSubscriptions(connectionId);
      expect(subscriptions.invoices).toEqual(subscriptionUpdate.invoices);
      expect(subscriptions.queues).toEqual(subscriptionUpdate.queues);
      expect(subscriptions.systemNotifications).toBe(true);
      expect(subscriptions.userNotifications).toBe(true);
    });
  });

  describe('Status History and Persistence', () => {
    it('should persist status updates to database', async () => {
      const statusUpdate = {
        invoiceId: testInvoiceId,
        userId: testUserId,
        status: 'processed',
        previousStatus: 'pending',
        metadata: {
          processingTime: 1500,
          confidence: 0.95,
        },
      };

      const mockPersistedUpdate = {
        id: uuidv4(),
        ...statusUpdate,
        timestamp: new Date(),
      };

      mockPrisma.statusUpdate.create.mockResolvedValue(mockPersistedUpdate);

      const result = await statusService.persistStatusUpdate(statusUpdate);

      expect(result).toEqual(mockPersistedUpdate);
      expect(mockPrisma.statusUpdate.create).toHaveBeenCalledWith({
        data: {
          ...statusUpdate,
          timestamp: expect.any(Date),
        },
      });
    });

    it('should retrieve status history for invoice', async () => {
      const mockStatusHistory = [
        {
          id: uuidv4(),
          invoiceId: testInvoiceId,
          status: 'processed',
          previousStatus: 'pending',
          timestamp: new Date(),
          metadata: {},
        },
        {
          id: uuidv4(),
          invoiceId: testInvoiceId,
          status: 'pending',
          previousStatus: 'uploaded',
          timestamp: new Date(Date.now() - 60000),
          metadata: {},
        },
      ];

      mockPrisma.statusUpdate.findMany.mockResolvedValue(mockStatusHistory);

      const result = await statusService.getStatusHistory(testInvoiceId);

      expect(result).toEqual(mockStatusHistory);
      expect(mockPrisma.statusUpdate.findMany).toHaveBeenCalledWith({
        where: { invoiceId: testInvoiceId },
        orderBy: { timestamp: 'desc' },
        take: 50,
      });
    });

    it('should get current status for multiple invoices', async () => {
      const invoiceIds = [testInvoiceId, uuidv4()];
      const mockCurrentStatuses = [
        {
          invoiceId: testInvoiceId,
          status: 'processed',
          timestamp: new Date(),
        },
        {
          invoiceId: invoiceIds[1],
          status: 'pending',
          timestamp: new Date(),
        },
      ];

      const result = await statusService.getCurrentStatuses(invoiceIds);

      expect(result).toHaveLength(2);
      expect(result[0].invoiceId).toBe(testInvoiceId);
      expect(result[1].invoiceId).toBe(invoiceIds[1]);
    });
  });

  describe('Real-time Metrics and Analytics', () => {
    it('should broadcast real-time processing metrics', async () => {
      const connectionId = await statusService.registerConnection(testUserId, mockWebSocket as any);
      
      const metricsUpdate = {
        timestamp: new Date(),
        activeProcessing: 15,
        queueLengths: {
          'auto-approval': 5,
          'human-review': 8,
          'expert-review': 2,
        },
        averageProcessingTime: 1200,
        successRate: 0.94,
        systemLoad: {
          cpu: 45,
          memory: 62,
          disk: 23,
        },
      };

      await statusService.broadcastMetricsUpdate(testUserId, metricsUpdate);

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'metrics_update',
          data: metricsUpdate,
        })
      );
    });

    it('should provide real-time dashboard data', async () => {
      const connectionId = await statusService.registerConnection(testUserId, mockWebSocket as any);
      
      const dashboardData = {
        todayStats: {
          processed: 145,
          pending: 23,
          failed: 3,
        },
        recentActivity: [
          {
            invoiceId: testInvoiceId,
            action: 'processed',
            timestamp: new Date(),
          },
        ],
        alerts: [
          {
            type: 'high_queue_length',
            message: 'Human review queue is getting long',
            severity: 'warning',
          },
        ],
      };

      await statusService.broadcastDashboardUpdate(testUserId, dashboardData);

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'dashboard_update',
          data: dashboardData,
        })
      );
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle WebSocket send failures gracefully', async () => {
      const failingWebSocket = {
        ...mockWebSocket,
        send: jest.fn().mockImplementation(() => {
          throw new Error('WebSocket send failed');
        }),
      };

      const connectionId = await statusService.registerConnection(testUserId, failingWebSocket as any);
      
      const statusUpdate = {
        invoiceId: testInvoiceId,
        status: 'processed',
        previousStatus: 'pending',
        timestamp: new Date(),
      };

      // Should not throw error
      await expect(
        statusService.broadcastInvoiceStatusUpdate(testUserId, statusUpdate)
      ).resolves.not.toThrow();

      // Connection should be marked as failed
      const connections = statusService.getActiveConnections(testUserId);
      expect(connections).toHaveLength(0);
    });

    it('should retry failed message delivery', async () => {
      const connectionId = await statusService.registerConnection(testUserId, mockWebSocket as any);
      
      const statusUpdate = {
        invoiceId: testInvoiceId,
        status: 'processed',
        previousStatus: 'pending',
        timestamp: new Date(),
      };

      // First call fails, second succeeds
      mockWebSocket.send
        .mockImplementationOnce(() => {
          throw new Error('Network error');
        })
        .mockImplementationOnce(() => {});

      await statusService.broadcastInvoiceStatusUpdate(testUserId, statusUpdate, {
        retryAttempts: 1,
        retryDelay: 100,
      });

      expect(mockWebSocket.send).toHaveBeenCalledTimes(2);
    });

    it('should handle connection timeout and cleanup', async () => {
      const connectionId = await statusService.registerConnection(testUserId, mockWebSocket as any);
      
      // Simulate connection timeout
      await statusService.handleConnectionTimeout(connectionId);
      
      const connections = statusService.getActiveConnections(testUserId);
      expect(connections).toHaveLength(0);
    });

    it('should queue messages when no active connections', async () => {
      const statusUpdate = {
        invoiceId: testInvoiceId,
        status: 'processed',
        previousStatus: 'pending',
        timestamp: new Date(),
      };

      // No connections registered
      await statusService.broadcastInvoiceStatusUpdate(testUserId, statusUpdate);

      // Message should be queued
      const queuedMessages = statusService.getQueuedMessages(testUserId);
      expect(queuedMessages).toHaveLength(1);
      expect(queuedMessages[0].data).toEqual(statusUpdate);
    });

    it('should deliver queued messages when connection is established', async () => {
      const statusUpdate = {
        invoiceId: testInvoiceId,
        status: 'processed',
        previousStatus: 'pending',
        timestamp: new Date(),
      };

      // Send message with no connections (gets queued)
      await statusService.broadcastInvoiceStatusUpdate(testUserId, statusUpdate);

      // Register connection
      const connectionId = await statusService.registerConnection(testUserId, mockWebSocket as any);

      // Queued message should be delivered
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'invoice_status_update',
          data: statusUpdate,
        })
      );
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle high-frequency updates efficiently', async () => {
      const connectionId = await statusService.registerConnection(testUserId, mockWebSocket as any);
      
      const updates = Array.from({ length: 100 }, (_, i) => ({
        invoiceId: testInvoiceId,
        status: 'processing',
        progress: i,
        timestamp: new Date(),
      }));

      const startTime = Date.now();
      
      for (const update of updates) {
        await statusService.broadcastProcessingProgress(testUserId, update);
      }
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      // Should process 100 updates in reasonable time (< 1 second)
      expect(processingTime).toBeLessThan(1000);
      expect(mockWebSocket.send).toHaveBeenCalledTimes(100);
    });

    it('should throttle rapid updates to prevent spam', async () => {
      const connectionId = await statusService.registerConnection(testUserId, mockWebSocket as any);
      
      // Enable throttling
      await statusService.enableThrottling(connectionId, {
        maxUpdatesPerSecond: 10,
        throttleWindow: 1000,
      });

      // Send 20 rapid updates
      const updates = Array.from({ length: 20 }, (_, i) => ({
        invoiceId: testInvoiceId,
        status: 'processing',
        progress: i,
        timestamp: new Date(),
      }));

      for (const update of updates) {
        await statusService.broadcastProcessingProgress(testUserId, update);
      }

      // Should throttle to max 10 updates
      expect(mockWebSocket.send).toHaveBeenCalledTimes(10);
    });
  });
});
