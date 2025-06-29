import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { authRoutes } from './routes/auth.routes';
import { fileRoutes } from './routes/file.routes';
import { ocrRoutes } from './routes/ocr.routes';
import { fieldRoutes } from './routes/field.routes';
import { buildErrorMessage } from './utils/errorMessageBuilder';
import { ErrorCodes } from './types/ErrorMessage';
import { LogSanitizer } from './utils/logSanitizer';
import { logger } from './utils/logger';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
export const prisma = new PrismaClient();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API version prefix
const API_PREFIX = '/api/v1';

// Routes
app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/files`, fileRoutes);
app.use(`${API_PREFIX}/ocr`, ocrRoutes);
app.use(`${API_PREFIX}/extraction`, fieldRoutes);

// Error handling middleware
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    // Sanitize and log the error
    const { logId, sanitizedData } = LogSanitizer.sanitizeAndLog(
      {
        error: {
          message: err.message,
          stack: err.stack,
          code: err.code || err.errorCode,
          statusCode: err.statusCode,
          userMessage: err.userMessage,
          nextSteps: err.nextSteps,
          helpUrl: err.helpUrl,
        },
        request: {
          method: req.method,
          url: req.url,
          headers: req.headers,
          body: req.body,
          query: req.query,
          params: req.params,
        },
      },
      'error',
      'Error handling middleware',
    );

    // Classify known error types
    let code = err.code || err.errorCode || ErrorCodes.UNKNOWN_ERROR;
    if (!Object.values(ErrorCodes).includes(code)) {
      code = ErrorCodes.UNKNOWN_ERROR;
    }

    // Build error message with log ID
    const errorMessage = buildErrorMessage({
      code,
      logId,
      userMessage: err.userMessage,
      nextSteps: err.nextSteps,
      helpUrl: err.helpUrl,
    });

    // Log additional context if available
    if (err.context) {
      LogSanitizer.sanitizeAndLog(
        { context: err.context },
        'info',
        `Additional context for error ${logId}`,
      );
    }

    res.status(err.statusCode || 500).json({ error: errorMessage });
  },
);

// Start server
const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Closing HTTP server...');
  server.close(async () => {
    console.log('HTTP server closed');
    await prisma.$disconnect();
    console.log('Database connection closed');
    process.exit(0);
  });
});

export { app, prisma };
