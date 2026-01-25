/**
 * Push Notification Service
 * 
 * TDD Phase: GREEN - Minimal implementation for push notifications
 * Enhancement: Mobile App Support
 */

export interface NotificationRecipient {
  deviceId: string;
  platform: 'ios' | 'android';
  pushToken: string;
  userId?: string;
}

export interface NotificationContent {
  title: string;
  body: string;
  category: string;
  priority: 'low' | 'normal' | 'high';
  data: Record<string, any>;
  actions?: Array<{
    id: string;
    title: string;
    type: 'foreground' | 'background';
  }>;
  media?: {
    type: 'image' | 'video';
    url: string;
    altText: string;
  };
}

export interface NotificationScheduling {
  sendAt: Date;
  timezone: string;
  respectQuietHours: boolean;
  quietHours: {
    start: string;
    end: string;
  };
}

export interface NotificationRequest {
  recipients: NotificationRecipient[];
  notification: NotificationContent;
  scheduling?: NotificationScheduling;
}

export interface PushResult {
  notificationId: string;
  sentAt: Date;
  totalRecipients: number;
  platformResults: Record<string, {
    recipientCount: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    filteredDeliveries?: number;
    filterReason?: string;
    deliveryDetails: Array<{
      deviceId: string;
      status: string;
      messageId: string;
      sentAt: Date;
      platformSpecificData: Record<string, any>;
    }>;
  }>;
  schedulingInfo?: {
    scheduled: boolean;
    scheduledFor: Date;
    timezoneApplied: string;
    quietHoursRespected: boolean;
  };
}

export interface NotificationPreferences {
  globalEnabled: boolean;
  categories: Record<string, {
    enabled: boolean;
    sound: boolean;
    vibration: boolean;
  }>;
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
    timezone: string;
  };
  frequency: {
    maxNotificationsPerHour: number;
    batchSimilarNotifications: boolean;
    minimumInterval: number;
  };
}

export interface PreferencesResult {
  userId: string;
  preferencesUpdated: boolean;
  updatedAt: Date;
  appliedSettings: {
    globalEnabled: boolean;
    enabledCategories: string[];
    disabledCategories: string[];
    quietHoursActive: boolean;
    rateLimitingEnabled: boolean;
  };
  consentStatus: {
    pushNotifications: string;
    analytics: string;
    marketing: string;
    lastUpdated: Date;
  };
}

export interface NotificationAnalytics {
  notificationId: string;
  summary: {
    totalSent: number;
    totalDelivered: number;
    totalOpened: number;
    totalActionsPerformed: number;
    deliveryRate: number;
    openRate: number;
    actionRate: number;
    averageDeliveryTime: number;
    averageOpenTime: number;
  };
  platformBreakdown: Record<string, {
    sent: number;
    delivered: number;
    opened: number;
    actions: number;
    deliveryRate: number;
    openRate: number;
  }>;
  actionBreakdown: Record<string, number>;
  timeline: Array<{
    event: string;
    timestamp: Date;
    deviceCount: number;
  }>;
  insights: Array<{
    type: string;
    message: string;
    recommendation: string;
  }>;
}

export class PushNotificationService {
  private notifications: Map<string, any> = new Map();
  private userPreferences: Map<string, NotificationPreferences> = new Map();
  private notificationEvents: Map<string, any[]> = new Map();
  private isInitialized: boolean = false;

  async initialize(): Promise<void> {
    this.isInitialized = true;
  }

  async sendNotification(request: NotificationRequest): Promise<PushResult> {
    const notificationId = this.generateNotificationId();
    const sentAt = new Date();

    // Process each platform separately
    const platformResults: Record<string, any> = {};
    
    const iosRecipients = request.recipients.filter(r => r.platform === 'ios');
    const androidRecipients = request.recipients.filter(r => r.platform === 'android');

    if (iosRecipients.length > 0) {
      platformResults.ios = await this.sendToiOS(iosRecipients, request.notification);
    }

    if (androidRecipients.length > 0) {
      platformResults.android = await this.sendToAndroid(androidRecipients, request.notification);
    }

    // Handle scheduling
    const schedulingInfo = request.scheduling ? {
      scheduled: true,
      scheduledFor: request.scheduling.sendAt,
      timezoneApplied: request.scheduling.timezone,
      quietHoursRespected: request.scheduling.respectQuietHours
    } : undefined;

    const result: PushResult = {
      notificationId,
      sentAt,
      totalRecipients: request.recipients.length,
      platformResults,
      schedulingInfo
    };

    this.notifications.set(notificationId, result);
    return result;
  }

  async updateNotificationPreferences(userId: string, preferences: NotificationPreferences): Promise<PreferencesResult> {
    this.userPreferences.set(userId, preferences);

    const enabledCategories = Object.entries(preferences.categories)
      .filter(([, config]) => config.enabled)
      .map(([category]) => category);

    const disabledCategories = Object.entries(preferences.categories)
      .filter(([, config]) => !config.enabled)
      .map(([category]) => category);

    return {
      userId,
      preferencesUpdated: true,
      updatedAt: new Date(),
      appliedSettings: {
        globalEnabled: preferences.globalEnabled,
        enabledCategories,
        disabledCategories,
        quietHoursActive: preferences.quietHours.enabled,
        rateLimitingEnabled: preferences.frequency.maxNotificationsPerHour > 0
      },
      consentStatus: {
        pushNotifications: preferences.globalEnabled ? 'granted' : 'denied',
        analytics: 'granted',
        marketing: disabledCategories.includes('marketing') ? 'denied' : 'granted',
        lastUpdated: new Date()
      }
    };
  }

  async trackNotificationEvent(notificationId: string, event: any): Promise<void> {
    if (!this.notificationEvents.has(notificationId)) {
      this.notificationEvents.set(notificationId, []);
    }
    
    const events = this.notificationEvents.get(notificationId)!;
    events.push(event);
  }

  async getNotificationAnalytics(notificationId: string): Promise<NotificationAnalytics> {
    const events = this.notificationEvents.get(notificationId) || [];
    
    const sentEvents = events.filter(e => e.type === 'sent');
    const deliveredEvents = events.filter(e => e.type === 'delivered');
    const openedEvents = events.filter(e => e.type === 'opened');
    const actionEvents = events.filter(e => e.type === 'action_taken');

    const summary = {
      totalSent: sentEvents.length,
      totalDelivered: deliveredEvents.length,
      totalOpened: openedEvents.length,
      totalActionsPerformed: actionEvents.length,
      deliveryRate: sentEvents.length > 0 ? deliveredEvents.length / sentEvents.length : 0,
      openRate: deliveredEvents.length > 0 ? openedEvents.length / deliveredEvents.length : 0,
      actionRate: openedEvents.length > 0 ? actionEvents.length / openedEvents.length : 0,
      averageDeliveryTime: 1000, // Mock 1 second
      averageOpenTime: 4000 // Mock 4 seconds
    };

    const platformBreakdown = {
      ios: {
        sent: sentEvents.length,
        delivered: deliveredEvents.length,
        opened: openedEvents.length,
        actions: actionEvents.length,
        deliveryRate: summary.deliveryRate,
        openRate: summary.openRate
      }
    };

    const actionBreakdown = actionEvents.reduce((acc, event) => {
      acc[event.action] = (acc[event.action] || 0) + 1;
      return acc;
    }, {});

    const timeline = [
      { event: 'sent', timestamp: new Date(), deviceCount: sentEvents.length },
      { event: 'delivered', timestamp: new Date(), deviceCount: deliveredEvents.length },
      { event: 'opened', timestamp: new Date(), deviceCount: openedEvents.length }
    ];

    const insights = [
      {
        type: 'performance',
        message: `Notification achieved ${(summary.openRate * 100).toFixed(1)}% open rate`,
        recommendation: summary.openRate < 0.1 ? 'Consider improving notification content' : 'Good engagement'
      }
    ];

    return {
      notificationId,
      summary,
      platformBreakdown,
      actionBreakdown,
      timeline,
      insights
    };
  }

  private async sendToiOS(recipients: NotificationRecipient[], notification: NotificationContent): Promise<any> {
    const deliveryDetails = recipients.map(recipient => ({
      deviceId: recipient.deviceId,
      status: 'sent',
      messageId: `apns_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      sentAt: new Date(),
      platformSpecificData: {
        apnsId: `apns_${Date.now()}`,
        priority: notification.priority === 'high' ? 10 : 5,
        sound: 'default',
        badge: 1
      }
    }));

    return {
      recipientCount: recipients.length,
      successfulDeliveries: recipients.length,
      failedDeliveries: 0,
      deliveryDetails
    };
  }

  private async sendToAndroid(recipients: NotificationRecipient[], notification: NotificationContent): Promise<any> {
    const deliveryDetails = recipients.map(recipient => ({
      deviceId: recipient.deviceId,
      status: 'sent',
      messageId: `fcm_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      sentAt: new Date(),
      platformSpecificData: {
        fcmMessageId: `fcm_${Date.now()}`,
        priority: notification.priority,
        ttl: 86400 // 24 hours
      }
    }));

    return {
      recipientCount: recipients.length,
      successfulDeliveries: recipients.length,
      failedDeliveries: 0,
      deliveryDetails
    };
  }

  private generateNotificationId(): string {
    return `notification_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }

  async cleanup(): Promise<void> {
    this.notifications.clear();
    this.userPreferences.clear();
    this.notificationEvents.clear();
    this.isInitialized = false;
  }
}

export default PushNotificationService;
