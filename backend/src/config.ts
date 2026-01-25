import dotenv from 'dotenv';

dotenv.config();

export const config = {
  app: {
    url: process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:5173',
    apiUrl: process.env.API_BASE_URL || 'http://localhost:3001',
  },
  db: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/syntaxis_ai',
  },
  jwt: {
    jwtSecret: process.env.JWT_SECRET!,
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET!,
    accessTokenExpiry: process.env.JWT_EXPIRES_IN || '3600s',
    refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRES_IN || '2592000s',
  },
  notifications: {
    pollingInterval: 10000, // 10 seconds
    retentionDays: 30,
    maxNotificationsPerPage: 50,
  },

  email: {
    smtpHost: process.env.SMTP_HOST || 'smtp.example.com',
    smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
    smtpSecure: process.env.SMTP_SECURE === 'true',
    smtpUser: process.env.SMTP_USER || '',
    smtpPassword: process.env.SMTP_PASSWORD || '',
    fromAddress: process.env.EMAIL_FROM || 'notifications@example.com',
    templates: {
      jobStatus: {
        subject: 'Batch Job {status}: {batchJobId}',
        template: 'job-status.html',
      },
      errorNotification: {
        subject: 'Error in Batch Job: {batchJobId}',
        template: 'error-notification.html',
      },
    },
  },

  cleanup: {
    errorReportRetentionDays: 30,
    auditLogRetentionDays: 90,
    notificationRetentionDays: 30,
  },

  metrics: {
    collectionInterval: 3600000, // 1 hour
    retentionDays: 90,
    alertThresholds: {
      avgDeliveryTimeMs: 5000, // 5 seconds
      errorRate: 0.05, // 5%
      notificationFailureRate: 0.01, // 1%
    },
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    rateLimits: {
      notifications: {
        windowMs: 60000, // 1 minute
        max: 60, // 60 requests per minute
      },
      errorReports: {
        windowMs: 60000, // 1 minute
        max: 10, // 10 requests per minute
      },
      downloads: {
        windowMs: 60000, // 1 minute
        max: 5, // 5 downloads per minute
      },
    },
  },

  uploads: {
    dir: process.env.UPLOADS_DIR || 'uploads',
    maxFileSize: 100 * 1024 * 1024, // 100MB
    allowedTypes: ['application/pdf'],
    chunkSize: 5 * 1024 * 1024, // 5MB chunks for streaming uploads
    maxConcurrentUploads: 5,
    maxConcurrentProcessing: 10,
    tempDir: process.env.TEMP_DIR || 'temp',
    cleanupInterval: 3600000, // 1 hour
  },

  processing: {
    maxRetries: 3,
    retryDelay: 5000, // 5 seconds
    timeout: 300000, // 5 minutes per file
    batchSize: 10, // Process 10 files at a time
    progressUpdateInterval: 2000, // 2 seconds
  },

  performance: {
    rateLimits: {
      upload: {
        windowMs: 60000, // 1 minute
        max: 10, // 10 uploads per minute
      },
      batch: {
        windowMs: 300000, // 5 minutes
        max: 5, // 5 batch uploads per 5 minutes
      },
      processing: {
        windowMs: 60000, // 1 minute
        max: 100, // 100 processing requests per minute
      },
    },
    timeouts: {
      upload: 300000, // 5 minutes
      processing: 600000, // 10 minutes
      export: 300000, // 5 minutes
    },
    concurrency: {
      maxUploadWorkers: 5,
      maxProcessingWorkers: 10,
      maxExportWorkers: 5,
    },
  },

  monitoring: {
    metrics: {
      collectionInterval: 60000, // 1 minute
      retentionDays: 30,
      alertThresholds: {
        uploadTime: 60000, // 60 seconds
        processingTime: 300000, // 5 minutes
        exportTime: 10000, // 10 seconds
        errorRate: 0.05, // 5%
        queueSize: 1000,
      },
    },
    logging: {
      level: process.env.LOG_LEVEL || 'info',
      format: 'json',
      retentionDays: 90,
      performanceLogging: true,
    },
  },
} as const;
