/**
 * Real-time Notification Service
 * 
 * TDD Phase: GREEN - Minimal implementation for real-time notifications
 * Enhancement: Real-time Processing with WebSockets
 */

export interface Notification {
  type: string;
  data: any;
  timestamp: Date;
  priority: 'low' | 'normal' | 'high' | 'critical';
}

export interface NotificationDelivery {
  connectionId: string;
  sessionId: string;
  deliveredAt: Date;
  acknowledged: boolean;
}

export interface BroadcastResult {
  userId: string;
  notificationType: string;
  deliveredTo: NotificationDelivery[];
  totalConnections: number;
  successfulDeliveries: number;
  failedDeliveries: number;
}

export interface GroupBroadcastResult {
  targetUsers: string[];
  notificationType: string;
  totalTargetUsers: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  deliveryDetails: Array<{
    userId: string;
    delivered: boolean;
    deliveredAt?: Date;
    error?: string;
  }>;
}

export class RealTimeNotificationService {
  private userNotifications: Map<string, Notification[]> = new Map();
  private notificationQueue: Map<string, Notification[]> = new Map(); // For disconnected users
  private isInitialized: boolean = false;

  async initialize(): Promise<void> {
    this.isInitialized = true;
  }

  async sendToUser(userId: string, notification: Notification): Promise<BroadcastResult> {
    // Store notification for user
    const userNotifications = this.userNotifications.get(userId) || [];
    userNotifications.push(notification);
    this.userNotifications.set(userId, userNotifications);

    // Keep only last 100 notifications per user
    if (userNotifications.length > 100) {
      this.userNotifications.set(userId, userNotifications.slice(-50));
    }

    // Simulate delivery to active connections
    // In real implementation, this would use WebSocketManager to get user connections
    const mockConnections = [
      {
        connectionId: `conn_${userId}_1`,
        sessionId: `session_${userId}_1`,
        deliveredAt: new Date(),
        acknowledged: true
      }
    ];

    return {
      userId,
      notificationType: notification.type,
      deliveredTo: mockConnections,
      totalConnections: 1,
      successfulDeliveries: 1,
      failedDeliveries: 0
    };
  }

  async sendToUserGroup(userIds: string[], notification: Notification): Promise<GroupBroadcastResult> {
    const deliveryDetails: GroupBroadcastResult['deliveryDetails'] = [];
    let successfulDeliveries = 0;
    let failedDeliveries = 0;

    for (const userId of userIds) {
      try {
        await this.sendToUser(userId, notification);
        deliveryDetails.push({
          userId,
          delivered: true,
          deliveredAt: new Date()
        });
        successfulDeliveries++;
      } catch (error) {
        deliveryDetails.push({
          userId,
          delivered: false,
          error: (error as Error).message
        });
        failedDeliveries++;
      }
    }

    return {
      targetUsers: userIds,
      notificationType: notification.type,
      totalTargetUsers: userIds.length,
      successfulDeliveries,
      failedDeliveries,
      deliveryDetails
    };
  }

  async getRecentNotifications(userId: string, limit: number = 10): Promise<Notification[]> {
    const notifications = this.userNotifications.get(userId) || [];
    return notifications.slice(-limit);
  }

  async queueNotificationForDisconnectedUser(userId: string, notification: Notification): Promise<void> {
    const queue = this.notificationQueue.get(userId) || [];
    queue.push(notification);
    this.notificationQueue.set(userId, queue);

    // Keep only last 50 queued notifications
    if (queue.length > 50) {
      this.notificationQueue.set(userId, queue.slice(-25));
    }
  }

  async getQueuedNotifications(userId: string): Promise<Notification[]> {
    const queued = this.notificationQueue.get(userId) || [];
    this.notificationQueue.delete(userId); // Clear queue after retrieval
    return queued;
  }

  async cleanup(): Promise<void> {
    this.userNotifications.clear();
    this.notificationQueue.clear();
    this.isInitialized = false;
  }
}

export default RealTimeNotificationService;
