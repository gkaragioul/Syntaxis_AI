import { PrismaClient } from '@prisma/client';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import WebSocket from 'ws';

interface WebSocketConnection {
  connectionId: string;
  userId: string;
  socket: WebSocket;
  subscriptions: UserSubscriptions;
  lastHeartbeat: Date;
  isActive: boolean;
  throttling?: ThrottlingConfig;
}

interface UserSubscriptions {
  invoices: string[];
  queues: string[];
  systemNotifications: boolean;
  userNotifications: boolean;
}

interface ThrottlingConfig {
  maxUpdatesPerSecond: number;
  throttleWindow: number;
  updateCount: number;
  windowStart: number;
}

interface StatusUpdate {
  invoiceId: string;
  status: string;
  previousStatus?: string;
  timestamp: Date;
  metadata?: any;
}

interface ProcessingProgress {
  invoiceId: string;
  stage: string;
  progress: number;
  estimatedTimeRemaining?: number;
  currentStep?: string;
  totalSteps?: number;
  completedSteps?: number;
}

interface ValidationUpdate {
  invoiceId: string;
  validationStatus: string;
  validationResults: any;
}

interface ErrorNotification {
  invoiceId?: string;
  errorType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details?: any;
  timestamp: Date;
}

interface SystemNotification {
  type: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  actionRequired: boolean;
  dismissible: boolean;
  expiresAt?: Date;
}

interface MetricsUpdate {
  timestamp: Date;
  activeProcessing: number;
  queueLengths: { [queueName: string]: number };
  averageProcessingTime: number;
  successRate: number;
  systemLoad: {
    cpu: number;
    memory: number;
    disk: number;
  };
}

interface DashboardData {
  todayStats: {
    processed: number;
    pending: number;
    failed: number;
  };
  recentActivity: any[];
  alerts: any[];
}

interface BroadcastOptions {
  retryAttempts?: number;
  retryDelay?: number;
  priority?: 'low' | 'normal' | 'high';
}

interface QueuedMessage {
  type: string;
  data: any;
  timestamp: Date;
  priority: string;
}

export class RealTimeStatusService {
  private connections = new Map<string, WebSocketConnection>();
  private userConnections = new Map<string, string[]>(); // userId -> connectionIds
  private messageQueues = new Map<string, QueuedMessage[]>(); // userId -> queued messages
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(
    private prisma: PrismaClient,
    private eventEmitter: EventEmitter,
  ) {
    this.setupEventListeners();
    this.startHeartbeatMonitoring();
  }

  async registerConnection(userId: string, socket: WebSocket): Promise<string> {
    const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const connection: WebSocketConnection = {
      connectionId,
      userId,
      socket,
      subscriptions: {
        invoices: [],
        queues: [],
        systemNotifications: false,
        userNotifications: false,
      },
      lastHeartbeat: new Date(),
      isActive: true,
    };

    this.connections.set(connectionId, connection);

    // Track user connections
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, []);
    }
    this.userConnections.get(userId)!.push(connectionId);

    // Setup socket event handlers
    socket.on('close', () => this.handleConnectionClose(connectionId));
    socket.on('error', (error) =>
      this.handleConnectionError(connectionId, error),
    );
    socket.on('pong', () => this.updateHeartbeat(connectionId));

    // Deliver any queued messages
    await this.deliverQueuedMessages(userId);

    logger.info('WebSocket connection registered', { connectionId, userId });

    return connectionId;
  }

  async unregisterConnection(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Remove from user connections
    const userConnections = this.userConnections.get(connection.userId);
    if (userConnections) {
      const index = userConnections.indexOf(connectionId);
      if (index > -1) {
        userConnections.splice(index, 1);
      }
      if (userConnections.length === 0) {
        this.userConnections.delete(connection.userId);
      }
    }

    // Close socket if still open
    if (connection.socket.readyState === WebSocket.OPEN) {
      connection.socket.close();
    }

    this.connections.delete(connectionId);

    logger.info('WebSocket connection unregistered', { connectionId });
  }

  getActiveConnections(userId: string): WebSocketConnection[] {
    const connectionIds = this.userConnections.get(userId) || [];
    return connectionIds
      .map((id) => this.connections.get(id))
      .filter(
        (conn): conn is WebSocketConnection =>
          conn !== undefined && conn.isActive,
      );
  }

  async broadcastInvoiceStatusUpdate(
    userId: string,
    statusUpdate: StatusUpdate,
    options: BroadcastOptions = {},
  ): Promise<void> {
    const message = {
      type: 'invoice_status_update',
      data: statusUpdate,
    };

    await this.broadcastToUser(userId, message, options);

    // Persist status update
    await this.persistStatusUpdate({
      ...statusUpdate,
      userId,
    });
  }

  async broadcastProcessingProgress(
    userId: string,
    progressUpdate: ProcessingProgress,
    options: BroadcastOptions = {},
  ): Promise<void> {
    const message = {
      type: 'processing_progress',
      data: progressUpdate,
    };

    await this.broadcastToUser(userId, message, options);
  }

  async broadcastValidationUpdate(
    userId: string,
    validationUpdate: ValidationUpdate,
    options: BroadcastOptions = {},
  ): Promise<void> {
    const message = {
      type: 'validation_update',
      data: validationUpdate,
    };

    await this.broadcastToUser(userId, message, options);
  }

  async broadcastErrorNotification(
    userId: string,
    errorNotification: ErrorNotification,
    options: BroadcastOptions = {},
  ): Promise<void> {
    const message = {
      type: 'error_notification',
      data: errorNotification,
    };

    await this.broadcastToUser(userId, message, {
      ...options,
      priority: 'high',
    });
  }

  async broadcastSystemNotification(
    userId: string,
    systemNotification: SystemNotification,
    options: BroadcastOptions = {},
  ): Promise<void> {
    const message = {
      type: 'system_notification',
      data: systemNotification,
    };

    await this.broadcastToUser(userId, message, options);
  }

  async broadcastMetricsUpdate(
    userId: string,
    metricsUpdate: MetricsUpdate,
    options: BroadcastOptions = {},
  ): Promise<void> {
    const message = {
      type: 'metrics_update',
      data: metricsUpdate,
    };

    await this.broadcastToUser(userId, message, options);
  }

  async broadcastDashboardUpdate(
    userId: string,
    dashboardData: DashboardData,
    options: BroadcastOptions = {},
  ): Promise<void> {
    const message = {
      type: 'dashboard_update',
      data: dashboardData,
    };

    await this.broadcastToUser(userId, message, options);
  }

  async subscribeToInvoiceUpdates(
    connectionId: string,
    invoiceId: string,
  ): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    if (!connection.subscriptions.invoices.includes(invoiceId)) {
      connection.subscriptions.invoices.push(invoiceId);
    }
  }

  async unsubscribeFromInvoiceUpdates(
    connectionId: string,
    invoiceId: string,
  ): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const index = connection.subscriptions.invoices.indexOf(invoiceId);
    if (index > -1) {
      connection.subscriptions.invoices.splice(index, 1);
    }
  }

  async subscribeToQueueUpdates(
    connectionId: string,
    queueName: string,
  ): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    if (!connection.subscriptions.queues.includes(queueName)) {
      connection.subscriptions.queues.push(queueName);
    }
  }

  async subscribeToSystemNotifications(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    connection.subscriptions.systemNotifications = true;
  }

  async updateSubscriptions(
    connectionId: string,
    subscriptions: Partial<UserSubscriptions>,
  ): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    Object.assign(connection.subscriptions, subscriptions);
  }

  getSubscriptions(connectionId: string): UserSubscriptions {
    const connection = this.connections.get(connectionId);
    return (
      connection?.subscriptions || {
        invoices: [],
        queues: [],
        systemNotifications: false,
        userNotifications: false,
      }
    );
  }

  async persistStatusUpdate(statusUpdate: any): Promise<any> {
    try {
      return await this.prisma.statusUpdate.create({
        data: {
          ...statusUpdate,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      logger.error('Failed to persist status update', { error, statusUpdate });
      throw error;
    }
  }

  async getStatusHistory(
    invoiceId: string,
    limit: number = 50,
  ): Promise<any[]> {
    return this.prisma.statusUpdate.findMany({
      where: { invoiceId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  async getCurrentStatuses(invoiceIds: string[]): Promise<any[]> {
    // Mock implementation - would query latest status for each invoice
    return invoiceIds.map((invoiceId) => ({
      invoiceId,
      status: 'processed', // Mock status
      timestamp: new Date(),
    }));
  }

  async sendHeartbeat(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection || !connection.isActive) return;

    const heartbeatMessage = {
      type: 'heartbeat',
      timestamp: new Date().toISOString(),
    };

    await this.sendMessage(connection, heartbeatMessage);
  }

  async handleConnectionClose(connectionId: string): Promise<void> {
    await this.unregisterConnection(connectionId);
  }

  async handleConnectionTimeout(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.isActive = false;
      await this.unregisterConnection(connectionId);
    }
  }

  getQueuedMessages(userId: string): QueuedMessage[] {
    return this.messageQueues.get(userId) || [];
  }

  async enableThrottling(
    connectionId: string,
    config: Omit<ThrottlingConfig, 'updateCount' | 'windowStart'>,
  ): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    connection.throttling = {
      ...config,
      updateCount: 0,
      windowStart: Date.now(),
    };
  }

  private async broadcastToUser(
    userId: string,
    message: any,
    options: BroadcastOptions = {},
  ): Promise<void> {
    const connections = this.getActiveConnections(userId);

    if (connections.length === 0) {
      // Queue message for later delivery
      await this.queueMessage(userId, message, options);
      return;
    }

    const promises = connections.map((connection) =>
      this.sendMessageWithRetry(connection, message, options),
    );

    await Promise.allSettled(promises);
  }

  private async sendMessageWithRetry(
    connection: WebSocketConnection,
    message: any,
    options: BroadcastOptions,
  ): Promise<void> {
    const maxRetries = options.retryAttempts || 0;
    const retryDelay = options.retryDelay || 1000;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Check throttling
        if (this.shouldThrottle(connection)) {
          return;
        }

        await this.sendMessage(connection, message);
        return;
      } catch (error) {
        if (attempt === maxRetries) {
          logger.error('Failed to send message after retries', {
            connectionId: connection.connectionId,
            error,
            attempts: attempt + 1,
          });

          // Mark connection as inactive
          connection.isActive = false;
          await this.unregisterConnection(connection.connectionId);
          return;
        }

        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }
  }

  private async sendMessage(
    connection: WebSocketConnection,
    message: any,
  ): Promise<void> {
    if (connection.socket.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not open');
    }

    connection.socket.send(JSON.stringify(message));

    // Update throttling counter
    if (connection.throttling) {
      connection.throttling.updateCount++;
    }
  }

  private shouldThrottle(connection: WebSocketConnection): boolean {
    if (!connection.throttling) return false;

    const now = Date.now();
    const { throttling } = connection;

    // Reset window if expired
    if (now - throttling.windowStart >= throttling.throttleWindow) {
      throttling.updateCount = 0;
      throttling.windowStart = now;
    }

    return throttling.updateCount >= throttling.maxUpdatesPerSecond;
  }

  private async queueMessage(
    userId: string,
    message: any,
    options: BroadcastOptions,
  ): Promise<void> {
    if (!this.messageQueues.has(userId)) {
      this.messageQueues.set(userId, []);
    }

    const queuedMessage: QueuedMessage = {
      type: message.type,
      data: message.data,
      timestamp: new Date(),
      priority: options.priority || 'normal',
    };

    const queue = this.messageQueues.get(userId)!;
    queue.push(queuedMessage);

    // Limit queue size
    if (queue.length > 100) {
      queue.shift(); // Remove oldest message
    }
  }

  private async deliverQueuedMessages(userId: string): Promise<void> {
    const queue = this.messageQueues.get(userId);
    if (!queue || queue.length === 0) return;

    const connections = this.getActiveConnections(userId);
    if (connections.length === 0) return;

    // Sort by priority and timestamp
    queue.sort((a, b) => {
      const priorityOrder = { high: 3, normal: 2, low: 1 };
      const aPriority =
        priorityOrder[a.priority as keyof typeof priorityOrder] || 2;
      const bPriority =
        priorityOrder[b.priority as keyof typeof priorityOrder] || 2;

      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }

      return a.timestamp.getTime() - b.timestamp.getTime();
    });

    // Deliver messages
    for (const queuedMessage of queue) {
      const message = {
        type: queuedMessage.type,
        data: queuedMessage.data,
      };

      for (const connection of connections) {
        try {
          await this.sendMessage(connection, message);
        } catch (error) {
          logger.error('Failed to deliver queued message', {
            connectionId: connection.connectionId,
            error,
          });
        }
      }
    }

    // Clear queue
    this.messageQueues.delete(userId);
  }

  private setupEventListeners(): void {
    this.eventEmitter.on('invoice_status_changed', async (data) => {
      await this.broadcastInvoiceStatusUpdate(data.userId, data.statusUpdate);
    });

    this.eventEmitter.on('processing_progress', async (data) => {
      await this.broadcastProcessingProgress(data.userId, data.progressUpdate);
    });

    this.eventEmitter.on('validation_completed', async (data) => {
      await this.broadcastValidationUpdate(data.userId, data.validationUpdate);
    });

    this.eventEmitter.on('error_occurred', async (data) => {
      await this.broadcastErrorNotification(
        data.userId,
        data.errorNotification,
      );
    });
  }

  private startHeartbeatMonitoring(): void {
    this.heartbeatInterval = setInterval(async () => {
      const now = new Date();
      const timeoutThreshold = 30000; // 30 seconds

      for (const [connectionId, connection] of this.connections) {
        const timeSinceHeartbeat =
          now.getTime() - connection.lastHeartbeat.getTime();

        if (timeSinceHeartbeat > timeoutThreshold) {
          await this.handleConnectionTimeout(connectionId);
        } else {
          await this.sendHeartbeat(connectionId);
        }
      }
    }, 15000); // Check every 15 seconds
  }

  private updateHeartbeat(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.lastHeartbeat = new Date();
    }
  }

  private handleConnectionError(connectionId: string, error: Error): void {
    logger.error('WebSocket connection error', { connectionId, error });
    this.handleConnectionClose(connectionId);
  }

  destroy(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Close all connections
    for (const connection of this.connections.values()) {
      if (connection.socket.readyState === WebSocket.OPEN) {
        connection.socket.close();
      }
    }

    this.connections.clear();
    this.userConnections.clear();
    this.messageQueues.clear();
  }
}
