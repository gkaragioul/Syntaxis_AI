process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

import { app } from './app';
import { prisma } from './prisma';
import { logger } from './utils/logger';
import dotenv from 'dotenv';
import { validateEnvironment } from './utils/validateEnvironment';

dotenv.config();

// Validate environment variables before starting server
validateEnvironment();

const PORT = process.env.PORT || 3001;

async function bootstrap() {
  try {
    // Attempt to connect to the database, but don't block startup if it fails
    // This allows the "Stub Mode" to work for the MVP demo even without a DB.
    prisma.$connect()
      .then(() => {
        logger.info('Successfully connected to the database');
      })
      .catch((error) => {
        logger.warn('Database connection failed. Entering degraded mode.', {
          message: error.message,
          nextSteps: 'Ensure PostgreSQL is running and DATABASE_URL is correct.'
        });
      });

    const server = app.listen(PORT, () => {
      logger.info(`SyntaxisAI Backend running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Graceful shutdown
    const shutdown = async () => {
      logger.info('Shutting down server...');
      server.close(async () => {
        logger.info('HTTP server closed');
        await prisma.$disconnect();
        logger.info('Database connection closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    logger.error('Fatal error during startup', error);
    process.exit(1);
  }
}

bootstrap();

// export { prisma }; // Removed to prevent circular dependencies. Use import from ./prisma instead.
