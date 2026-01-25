export type NotificationType = 'status' | 'error';

export type NotificationStatus = 'processing' | 'completed' | 'failed';

export interface Notification {
  id: string;
  userId: string;
  batchJobId: string;
  type: NotificationType;
  status: NotificationStatus;
  message: string;
  createdAt: string;
  read: boolean;
  metadata?: Record<string, unknown>;
}

export interface ErrorReport {
  id: string;
  userId: string;
  batchJobId: string;
  errorType: string;
  errorCode: string;
  errorMessage: string;
  errorDetails?: Record<string, unknown>;
  troubleshootingTips: string[];
  stackTrace?: string;
  reportPath?: string;
  reportFormat?: 'pdf' | 'csv';
  downloadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
}

export interface NotificationFilters {
  type?: NotificationType;
  status?: NotificationStatus;
  read?: boolean;
  startDate?: string;
  endDate?: string;
} 