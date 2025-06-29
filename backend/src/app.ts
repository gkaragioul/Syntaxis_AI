import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { authMiddleware } from './middleware/auth';
import { rateLimiter } from './middleware/rateLimiter';
import {
  performanceMiddleware,
  uploadPerformanceMiddleware,
  processingPerformanceMiddleware,
  exportPerformanceMiddleware,
} from './middleware/performance';
import { enhancedResponseMiddleware } from './middleware/responseHeaders';
import { errorHandlerMiddleware, notFoundHandler as enhancedNotFoundHandler } from './middleware/errorHandler';
import { loggingMiddleware } from './middleware/logging';
import { logger } from './utils/logger';
import { config } from './config';
import { createHealthResponse } from './utils/response';

// Import routes
import authRoutes from './routes/auth';
import fileUploadRoutes from './routes/fileUpload';
import chunkedUploadRoutes from './routes/chunkedUpload';
import batchJobRoutes from './routes/batchJob';
import deviceRoutes from './routes/device';
import systemRoutes from './routes/system';
import privacyRoutes from './routes/privacy';
import { helpRoutes } from './routes/help';
import invoiceRoutes from './routes/invoice.routes';
import { fileRoutes } from './routes/file.routes';
import debugRoutes from './routes/debug';

const app = express();

// Enhanced response middleware (must be first)
app.use(enhancedResponseMiddleware);

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: config.frontend.url,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  }),
);

// Logging middleware
app.use(loggingMiddleware);

// Performance middleware
app.use(compression());
app.use(performanceMiddleware);
app.use(uploadPerformanceMiddleware);
app.use(processingPerformanceMiddleware);
app.use(exportPerformanceMiddleware);

// Request parsing with enhanced error handling
app.use(express.json({
  limit: '100mb',
  type: 'application/json',
}));
app.use(express.urlencoded({
  extended: true,
  limit: '100mb',
}));

// Rate limiting
app.use(rateLimiter);

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/files', authMiddleware, fileRoutes);
app.use('/api/v1/uploads', authMiddleware, fileUploadRoutes);
app.use('/api/v1/uploads', authMiddleware, chunkedUploadRoutes);
app.use('/api/v1/batch', authMiddleware, batchJobRoutes);
app.use('/api/v1/devices', authMiddleware, deviceRoutes);
app.use('/api/v1/system', authMiddleware, systemRoutes);
app.use('/api/v1/privacy', privacyRoutes);
app.use('/api/v1/help', authMiddleware, helpRoutes);
app.use('/api/v1/invoices', authMiddleware, invoiceRoutes);

// Debug routes (development only)
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/v1/debug', authMiddleware, debugRoutes);
}

// Enhanced health check endpoint (no auth required)
app.get('/health', (req, res) => {
  const healthResponse = createHealthResponse(
    'healthy',
    {
      api: { status: 'healthy' },
      database: { status: 'healthy' },
    },
    process.env.npm_package_version || '1.0.0',
    req.headers['x-request-id'] as string
  );

  res.json(healthResponse);
});

// Enhanced 404 handler
app.use(enhancedNotFoundHandler);

// Enhanced error handling
app.use(errorHandlerMiddleware);

// Start server
const PORT = config.server.port;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

export default app;
