import { jest } from '@jest/globals';
import { EmailService } from '../../services/EmailService';
import { StorageService } from '../../services/StorageService';
import { QueueService } from '../../services/QueueService';
import { LicenseService } from '../../services/LicenseService';
import { DeviceService } from '../../services/DeviceService';
import { NotificationService } from '../../services/NotificationService';
import { ValidationError } from '../../utils/errors';

// Email Service Mocks
const emailService = {
  sendJobStatusEmail: jest.fn().mockResolvedValue(true),
  sendErrorNotification: jest.fn().mockResolvedValue(true),
  sendWelcomeEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
} as jest.Mocked<EmailService>;

// Storage Service Mocks
const storageService = {
  uploadFile: jest
    .fn()
    .mockImplementation(async (file: Express.Multer.File) => ({
      path: `/uploads/${file.originalname}`,
      url: `https://storage.example.com/${file.originalname}`,
    })),
  deleteFile: jest.fn().mockResolvedValue(true),
  getFileUrl: jest
    .fn()
    .mockImplementation((path: string) => `https://storage.example.com${path}`),
  getFileStream: jest.fn().mockImplementation((path: string) => ({
    stream: Buffer.from('test'),
    contentType: 'application/pdf',
  })),
} as jest.Mocked<StorageService>;

// Queue Service Mocks
const queueService = {
  addJob: jest.fn().mockImplementation(async (queue: string, data: any) => ({
    id: 'test-job-id',
    queue,
    data,
    status: 'active',
  })),
  getJobStatus: jest.fn().mockImplementation(async (jobId: string) => ({
    id: jobId,
    status: 'completed',
    progress: 100,
    result: { success: true, data: {} },
  })),
  cancelJob: jest.fn().mockResolvedValue(true),
  retryJob: jest.fn().mockResolvedValue(true),
  getJobResult: jest.fn().mockImplementation(async (jobId: string) => ({
    success: true,
    data: {},
  })),
} as jest.Mocked<QueueService>;

// License Service Mocks
const licenseService = {
  validateLicense: jest.fn().mockResolvedValue(true),
  getLicenseInfo: jest.fn().mockImplementation(async (userId: string) => ({
    userId,
    status: 'active',
    type: 'premium',
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  })),
  updateLicense: jest.fn().mockResolvedValue(true),
  revokeLicense: jest.fn().mockResolvedValue(true),
} as jest.Mocked<LicenseService>;

// Device Service Mocks
const deviceService = {
  registerDevice: jest
    .fn()
    .mockImplementation(async (userId: string, deviceInfo: any) => ({
      id: 'test-device-id',
      userId,
      ...deviceInfo,
      status: 'active',
    })),
  validateDevice: jest.fn().mockResolvedValue(true),
  getDeviceInfo: jest.fn().mockImplementation(async (deviceId: string) => ({
    id: deviceId,
    userId: 'test-user-id',
    status: 'active',
    lastSeen: new Date(),
  })),
  updateDeviceStatus: jest.fn().mockResolvedValue(true),
} as jest.Mocked<DeviceService>;

// Notification Service Mocks
const notificationService = {
  createNotification: jest
    .fn()
    .mockImplementation(async (userId: string, data: any) => ({
      id: 'test-notification-id',
      userId,
      ...data,
      status: 'unread',
      createdAt: new Date(),
    })),
  getNotifications: jest.fn().mockImplementation(async (userId: string) => ({
    notifications: [
      {
        id: 'test-notification-id',
        userId,
        type: 'info',
        message: 'Test notification',
        status: 'unread',
        createdAt: new Date(),
      },
    ],
    total: 1,
  })),
  markAsRead: jest.fn().mockResolvedValue(true),
  deleteNotification: jest.fn().mockResolvedValue(true),
  getUserPreferences: jest.fn().mockImplementation(async (userId: string) => ({
    userId,
    emailNotifications: true,
    pushNotifications: true,
    notificationTypes: ['info', 'warning', 'error'],
  })),
  updateUserPreferences: jest.fn().mockResolvedValue(true),
} as jest.Mocked<NotificationService>;

// Export all mock services
export const mockServices = {
  email: emailService,
  storage: storageService,
  queue: queueService,
  license: licenseService,
  device: deviceService,
  notification: notificationService,
};
