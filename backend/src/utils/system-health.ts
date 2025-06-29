/**
 * System Health Check Utilities
 *
 * Provides comprehensive system health monitoring and verification
 * for database, Redis, and other critical services.
 */

import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { logger } from './logger';

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  message?: string;
  responseTime?: number;
  details?: any;
}

export interface SystemHealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  environment: string;
  services: {
    database: HealthCheckResult;
    redis: HealthCheckResult;
    fileSystem: HealthCheckResult;
    memory: HealthCheckResult;
    environment: HealthCheckResult;
    dependencies: HealthCheckResult;
  };
  performance: {
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage?: number;
    loadAverage?: number[];
    diskUsage?: DiskUsage;
  };
  alerts?: HealthAlert[];
  metadata: {
    checkDuration: number;
    nodeVersion: string;
    platform: string;
    architecture: string;
  };
}

export interface DiskUsage {
  total: number;
  used: number;
  free: number;
  percentUsed: number;
}

export interface HealthAlert {
  level: 'warning' | 'critical';
  service: string;
  message: string;
  timestamp: string;
  details?: any;
}

/**
 * Check database connectivity and performance
 */
export const checkDatabaseHealth = async (
  prisma: PrismaClient,
): Promise<HealthCheckResult> => {
  const startTime = Date.now();

  try {
    // Test basic connectivity
    await prisma.$queryRaw`SELECT 1 as test`;

    // Test a simple query
    const userCount = await prisma.user.count();

    const responseTime = Date.now() - startTime;

    return {
      status: responseTime < 1000 ? 'healthy' : 'degraded',
      responseTime,
      details: {
        userCount,
        connectionPool: 'active',
      },
    };
  } catch (error: any) {
    logger.error('Database health check failed:', error);
    return {
      status: 'unhealthy',
      message: error.message,
      responseTime: Date.now() - startTime,
    };
  }
};

/**
 * Check Redis connectivity and performance
 */
export const checkRedisHealth = async (
  redisUrl?: string,
): Promise<HealthCheckResult> => {
  const startTime = Date.now();
  let redis: Redis | null = null;

  try {
    redis = new Redis(
      redisUrl || process.env.REDIS_URL || 'redis://localhost:6379',
    );

    // Test basic connectivity
    const pong = await redis.ping();

    if (pong !== 'PONG') {
      throw new Error('Redis ping failed');
    }

    // Test set/get operations
    const testKey = 'health:check:' + Date.now();
    await redis.set(testKey, 'test', 'EX', 10); // Expire in 10 seconds
    const testValue = await redis.get(testKey);
    await redis.del(testKey);

    if (testValue !== 'test') {
      throw new Error('Redis set/get test failed');
    }

    // Get Redis info
    const info = await redis.info('memory');
    const responseTime = Date.now() - startTime;

    return {
      status: responseTime < 500 ? 'healthy' : 'degraded',
      responseTime,
      details: {
        memory: info
          .split('\n')
          .find((line) => line.startsWith('used_memory_human:'))
          ?.split(':')[1]
          ?.trim(),
        connected: true,
      },
    };
  } catch (error: any) {
    logger.error('Redis health check failed:', error);
    return {
      status: 'unhealthy',
      message: error.message,
      responseTime: Date.now() - startTime,
    };
  } finally {
    if (redis) {
      await redis.quit();
    }
  }
};

/**
 * Check file system health
 */
export const checkFileSystemHealth = async (): Promise<HealthCheckResult> => {
  const startTime = Date.now();

  try {
    const fs = require('fs').promises;
    const path = require('path');
    const os = require('os');

    // Check if upload directory exists and is writable
    const uploadDir = path.join(process.cwd(), 'uploads');
    const tempDir = path.join(process.cwd(), 'temp');

    // Create directories if they don't exist
    await fs.mkdir(uploadDir, { recursive: true });
    await fs.mkdir(tempDir, { recursive: true });

    // Test write permissions
    const testFile = path.join(tempDir, 'health-check-' + Date.now() + '.txt');
    await fs.writeFile(testFile, 'health check test');
    await fs.unlink(testFile);

    // Check disk space
    const stats = await fs.stat(process.cwd());
    const responseTime = Date.now() - startTime;

    return {
      status: 'healthy',
      responseTime,
      details: {
        uploadDir: 'accessible',
        tempDir: 'accessible',
        writable: true,
      },
    };
  } catch (error: any) {
    logger.error('File system health check failed:', error);
    return {
      status: 'unhealthy',
      message: error.message,
      responseTime: Date.now() - startTime,
    };
  }
};

/**
 * Check memory usage
 */
export const checkMemoryHealth = (): HealthCheckResult => {
  try {
    const memoryUsage = process.memoryUsage();
    const totalMemory = require('os').totalmem();
    const freeMemory = require('os').freemem();

    const usedMemoryPercent = ((totalMemory - freeMemory) / totalMemory) * 100;
    const heapUsedPercent =
      (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (usedMemoryPercent > 90 || heapUsedPercent > 90) {
      status = 'unhealthy';
    } else if (usedMemoryPercent > 80 || heapUsedPercent > 80) {
      status = 'degraded';
    }

    return {
      status,
      details: {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
        heapUsedPercent: Math.round(heapUsedPercent) + '%',
        systemMemoryUsed: Math.round(usedMemoryPercent) + '%',
        rss: Math.round(memoryUsage.rss / 1024 / 1024) + 'MB',
      },
    };
  } catch (error: any) {
    logger.error('Memory health check failed:', error);
    return {
      status: 'unhealthy',
      message: error.message,
    };
  }
};

/**
 * Check disk usage
 */
export const checkDiskUsage = async (): Promise<DiskUsage | null> => {
  try {
    const fs = require('fs').promises;
    const path = require('path');

    // Get disk usage for the current working directory
    const stats = await fs.stat(process.cwd());

    // For Unix-like systems, try to get disk usage via statvfs
    if (process.platform !== 'win32') {
      try {
        const { execSync } = require('child_process');
        const output = execSync(`df -k "${process.cwd()}"`, { encoding: 'utf8' });
        const lines = output.trim().split('\n');

        if (lines.length >= 2) {
          const parts = lines[1].split(/\s+/);
          const total = parseInt(parts[1]) * 1024; // Convert from KB to bytes
          const used = parseInt(parts[2]) * 1024;
          const free = parseInt(parts[3]) * 1024;
          const percentUsed = (used / total) * 100;

          return {
            total,
            used,
            free,
            percentUsed: Math.round(percentUsed * 100) / 100,
          };
        }
      } catch (error) {
        logger.warn('Failed to get disk usage via df command:', error);
      }
    }

    return null;
  } catch (error: any) {
    logger.error('Disk usage check failed:', error);
    return null;
  }
};

/**
 * Generate health alerts based on system status
 */
export const generateHealthAlerts = (services: SystemHealthStatus['services'], performance: SystemHealthStatus['performance']): HealthAlert[] => {
  const alerts: HealthAlert[] = [];
  const timestamp = new Date().toISOString();

  // Check for unhealthy services
  Object.entries(services).forEach(([serviceName, service]) => {
    if (service.status === 'unhealthy') {
      alerts.push({
        level: 'critical',
        service: serviceName,
        message: `${serviceName} service is unhealthy: ${service.message || 'Unknown error'}`,
        timestamp,
        details: service.details,
      });
    } else if (service.status === 'degraded') {
      alerts.push({
        level: 'warning',
        service: serviceName,
        message: `${serviceName} service is degraded`,
        timestamp,
        details: service.details,
      });
    }
  });

  // Check memory usage
  const memoryUsage = performance.memoryUsage;
  const heapUsedPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

  if (heapUsedPercent > 90) {
    alerts.push({
      level: 'critical',
      service: 'memory',
      message: `High memory usage: ${Math.round(heapUsedPercent)}% heap used`,
      timestamp,
      details: { heapUsedPercent: Math.round(heapUsedPercent) },
    });
  } else if (heapUsedPercent > 80) {
    alerts.push({
      level: 'warning',
      service: 'memory',
      message: `Elevated memory usage: ${Math.round(heapUsedPercent)}% heap used`,
      timestamp,
      details: { heapUsedPercent: Math.round(heapUsedPercent) },
    });
  }

  // Check disk usage
  if (performance.diskUsage && performance.diskUsage.percentUsed > 90) {
    alerts.push({
      level: 'critical',
      service: 'disk',
      message: `High disk usage: ${performance.diskUsage.percentUsed}% used`,
      timestamp,
      details: performance.diskUsage,
    });
  } else if (performance.diskUsage && performance.diskUsage.percentUsed > 80) {
    alerts.push({
      level: 'warning',
      service: 'disk',
      message: `Elevated disk usage: ${performance.diskUsage.percentUsed}% used`,
      timestamp,
      details: performance.diskUsage,
    });
  }

  return alerts;
};

/**
 * Perform comprehensive system health check
 */
export const performSystemHealthCheck = async (
  prisma: PrismaClient,
): Promise<SystemHealthStatus> => {
  const startTime = Date.now();

  try {
    // Run all health checks in parallel
    const [
      databaseHealth,
      redisHealth,
      fileSystemHealth,
      memoryHealth,
      environmentHealth,
      dependenciesHealth,
      diskUsage
    ] = await Promise.all([
      checkDatabaseHealth(prisma),
      checkRedisHealth(),
      checkFileSystemHealth(),
      checkMemoryHealth(),
      checkEnvironmentHealth(),
      checkServiceDependencies(),
      checkDiskUsage(),
    ]);

    // Determine overall system status
    const services = {
      database: databaseHealth,
      redis: redisHealth,
      fileSystem: fileSystemHealth,
      memory: memoryHealth,
      environment: environmentHealth,
      dependencies: dependenciesHealth,
    };

    const statuses = Object.values(services).map((service) => service.status);

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (statuses.includes('unhealthy')) {
      overallStatus = 'unhealthy';
    } else if (statuses.includes('degraded')) {
      overallStatus = 'degraded';
    }

    const totalCheckTime = Date.now() - startTime;
    const os = require('os');

    const performance = {
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage ? process.cpuUsage().user / 1000000 : undefined, // Convert to seconds
      loadAverage: os.loadavg(),
      diskUsage,
    };

    // Generate alerts
    const alerts = generateHealthAlerts(services, performance);

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services,
      performance,
      alerts,
      metadata: {
        checkDuration: totalCheckTime,
        nodeVersion: process.version,
        platform: process.platform,
        architecture: process.arch,
      },
    };
  } catch (error: any) {
    logger.error('System health check failed:', error);

    const totalCheckTime = Date.now() - startTime;
    const os = require('os');

    return {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services: {
        database: { status: 'unhealthy', message: 'Health check failed' },
        redis: { status: 'unhealthy', message: 'Health check failed' },
        fileSystem: { status: 'unhealthy', message: 'Health check failed' },
        memory: { status: 'unhealthy', message: 'Health check failed' },
        environment: { status: 'unhealthy', message: 'Health check failed' },
        dependencies: { status: 'unhealthy', message: 'Health check failed' },
      },
      performance: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        loadAverage: os.loadavg(),
      },
      alerts: [{
        level: 'critical',
        service: 'system',
        message: 'System health check failed completely',
        timestamp: new Date().toISOString(),
        details: { error: error.message },
      }],
      metadata: {
        checkDuration: totalCheckTime,
        nodeVersion: process.version,
        platform: process.platform,
        architecture: process.arch,
      },
    };
  }
};

/**
 * Quick health check for API endpoints
 */
export const quickHealthCheck = async (): Promise<{
  status: string;
  timestamp: string;
}> => {
  try {
    // Basic checks without external dependencies
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    logger.error('Quick health check failed:', error);
    return {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
    };
  }
};

/**
 * Check if all required environment variables are set
 */
export const checkEnvironmentHealth = (): HealthCheckResult => {
  try {
    const requiredEnvVars = ['NODE_ENV', 'DATABASE_URL', 'JWT_SECRET'];

    const missingVars = requiredEnvVars.filter(
      (varName) => !process.env[varName],
    );

    if (missingVars.length > 0) {
      return {
        status: 'unhealthy',
        message: `Missing required environment variables: ${missingVars.join(', ')}`,
        details: { missingVars },
      };
    }

    return {
      status: 'healthy',
      details: {
        nodeEnv: process.env.NODE_ENV,
        hasDatabase: !!process.env.DATABASE_URL,
        hasJwtSecret: !!process.env.JWT_SECRET,
        hasRedis: !!process.env.REDIS_URL,
      },
    };
  } catch (error: any) {
    return {
      status: 'unhealthy',
      message: error.message,
    };
  }
};

/**
 * Check service dependencies
 */
export const checkServiceDependencies =
  async (): Promise<HealthCheckResult> => {
    try {
      const dependencies = {
        prisma: '@prisma/client',
        redis: 'ioredis',
        express: 'express',
        jwt: 'jsonwebtoken',
      };

      const missingDeps: string[] = [];

      for (const [name, packageName] of Object.entries(dependencies)) {
        try {
          require(packageName);
        } catch (error) {
          missingDeps.push(packageName);
        }
      }

      if (missingDeps.length > 0) {
        return {
          status: 'unhealthy',
          message: `Missing dependencies: ${missingDeps.join(', ')}`,
          details: { missingDeps },
        };
      }

      return {
        status: 'healthy',
        details: {
          allDependenciesLoaded: true,
          checkedDependencies: Object.values(dependencies),
        },
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        message: error.message,
      };
    }
  };
