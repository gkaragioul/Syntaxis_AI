import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { authenticate } from './middleware/auth';
import {
  performanceMiddleware,
  uploadPerformanceMiddleware,
  processingPerformanceMiddleware,
  exportPerformanceMiddleware,
} from './middleware/performance';
import { enhancedResponseMiddleware } from './middleware/responseHeaders';
import {
  errorHandlerMiddleware,
  notFoundHandler as enhancedNotFoundHandler,
} from './middleware/errorHandler';
import { loggingMiddleware } from './middleware/logging';
import { logger } from './utils/logger';
import { config } from './config';
import { createHealthResponse } from './utils/response';

// Import routes
import authRoutes from './routes/auth.routes';
import { fileRoutes } from './routes/file.routes';
import invoiceRoutes from './routes/invoice.routes';
import systemRoutes from './routes/system';
import privacyRoutes from './routes/privacy';
import { helpRoutes } from './routes/help';
import debugRoutes from './routes/debug';
import wizardRoutes from './routes/wizard';
import detectColumnsRoutes from './routes/detect-columns';
// Removed broken Sequelize-based routes: fileUpload, chunkedUpload, deviceRoutes

const app = express();

// Enhanced response middleware (must be first)
app.use(enhancedResponseMiddleware);

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
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
app.use(
  express.json({
    limit: '100mb',
    type: 'application/json',
  }),
);
app.use(
  express.urlencoded({
    extended: true,
    limit: '100mb',
  }),
);

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/files', authenticate, fileRoutes);
app.use('/api/v1/system', systemRoutes);
app.use('/api/v1/privacy', privacyRoutes);
app.use('/api/v1/help', helpRoutes);
app.use('/api/v1/invoices', invoiceRoutes);
app.use('/api/v1/wizard', wizardRoutes);
app.use('/api', detectColumnsRoutes);
// upload routes are now part of fileRoutes or stubbed

// Debug routes (development only)
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/v1/debug', authenticate, debugRoutes);
}

// Root route for simple verification
app.get('/', (req, res) => {
  res.json({
    message: 'SyntaxisAI Backend API is running',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    documentation: '/api/v1/help/api-reference',
    health: '/health'
  });
});

// Enhanced health check endpoint (no auth required)
app.get('/health', (req, res) => {
  const healthResponse = createHealthResponse(
    'healthy',
    {
      api: { status: 'healthy' },
      database: { status: 'healthy' },
    },
    process.env.npm_package_version || '1.0.0',
    req.headers['x-request-id'] as string,
  );

  res.json(healthResponse);
});

// Enhanced 404 handler
app.use(enhancedNotFoundHandler);

// Enhanced error handling
app.use(errorHandlerMiddleware);

// export default app;
export { app }; 
