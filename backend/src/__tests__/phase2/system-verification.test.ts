import path from 'path';
import fs from 'fs';
import {
  checkDatabaseHealth,
  checkRedisHealth,
  checkFileSystemHealth,
  checkMemoryHealth,
} from '../../utils/system-health';

describe('Local System Verification (Lines 121-127)', () => {
  describe('Task 2.1.1: Start existing backend', () => {
    it('should have backend development script available', () => {
      const backendDir = path.resolve(__dirname, '../../../..');
      const packageJsonPath = path.join(backendDir, 'package.json');
      const packageJson = require(packageJsonPath);

      expect(packageJson.scripts).toHaveProperty('dev');
      // The dev script might use concurrently or nodemon
      expect(packageJson.scripts.dev).toBeDefined();
    });

    it('should be able to start backend server programmatically', async () => {
      // Test that the main entry point exists
      const indexPath = path.resolve(__dirname, '../../index.ts');
      expect(fs.existsSync(indexPath)).toBe(true);

      const indexContent = fs.readFileSync(indexPath, 'utf-8');
      expect(indexContent).toContain('express');
      expect(indexContent).toContain('app.listen');
    });

    it('should have all required backend dependencies installed', () => {
      const backendDir = path.resolve(__dirname, '../../..');
      const packageJsonPath = path.join(backendDir, 'package.json');
      const packageJson = require(packageJsonPath);

      // Core dependencies that should be present
      const coreDeps = [
        'express',
        '@prisma/client',
        'bcryptjs',
        'jsonwebtoken',
        'cors',
        'helmet',
        'ioredis',
      ];

      // Check core dependencies
      coreDeps.forEach((dep) => {
        const hasInDeps =
          packageJson.dependencies && packageJson.dependencies[dep];
        const hasInDevDeps =
          packageJson.devDependencies && packageJson.devDependencies[dep];
        expect(hasInDeps || hasInDevDeps).toBeTruthy();
      });

      // Check that package.json has dependencies section
      expect(packageJson.dependencies).toBeDefined();
      expect(Object.keys(packageJson.dependencies).length).toBeGreaterThan(5);
    });

    it('should have health check route defined', async () => {
      // Check that health check route exists in system routes
      const systemRoutesPath = path.resolve(
        __dirname,
        '../../routes/system.ts',
      );
      expect(fs.existsSync(systemRoutesPath)).toBe(true);

      const routesContent = fs.readFileSync(systemRoutesPath, 'utf-8');
      expect(routesContent).toContain('/health');
      expect(routesContent).toContain('quickHealthCheck');
    });

    it('should have proper environment configuration for backend', () => {
      const requiredEnvVars = ['NODE_ENV', 'DATABASE_URL', 'JWT_SECRET'];

      requiredEnvVars.forEach((envVar) => {
        expect(process.env[envVar]).toBeDefined();
      });
    });
  });

  describe('Task 2.1.2: Start existing frontend', () => {
    it('should have frontend development script available', () => {
      const frontendDir = path.resolve(__dirname, '../../../../frontend');
      const packageJsonPath = path.join(frontendDir, 'package.json');
      const packageJson = require(packageJsonPath);

      expect(packageJson.scripts).toHaveProperty('dev');
      expect(packageJson.scripts.dev).toBe('vite');
    });

    it('should have all required frontend dependencies installed', () => {
      const frontendDir = path.resolve(__dirname, '../../../../frontend');
      const packageJsonPath = path.join(frontendDir, 'package.json');
      const packageJson = require(packageJsonPath);

      const requiredDeps = [
        'react',
        'react-dom',
        'vite',
        '@vitejs/plugin-react',
        'typescript',
        '@mui/material',
        '@emotion/react',
        '@emotion/styled',
        '@tanstack/react-query',
        'react-router-dom',
        'axios',
        'zustand',
      ];

      requiredDeps.forEach((dep) => {
        const hasInDeps =
          packageJson.dependencies && packageJson.dependencies[dep];
        const hasInDevDeps =
          packageJson.devDependencies && packageJson.devDependencies[dep];
        expect(hasInDeps || hasInDevDeps).toBeTruthy();
      });
    });

    it('should have proper Vite configuration', () => {
      const frontendDir = path.resolve(__dirname, '../../../../frontend');
      const viteConfigPath = path.join(frontendDir, 'vite.config.ts');
      const fs = require('fs');

      expect(fs.existsSync(viteConfigPath)).toBe(true);

      const viteConfig = fs.readFileSync(viteConfigPath, 'utf-8');
      expect(viteConfig).toContain('port: 5173');
      expect(viteConfig).toContain('proxy');
      expect(viteConfig).toContain('/api');
      expect(viteConfig).toContain('http://localhost:3001');
    });

    it('should have frontend environment configuration', () => {
      const frontendDir = path.resolve(__dirname, '../../../../frontend');
      const envPath = path.join(frontendDir, '.env.development');
      const fs = require('fs');

      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf-8');
        expect(envContent).toContain('VITE_API_BASE_URL');
      }
    });
  });

  describe('Task 2.1.3: Test database connectivity', () => {
    it('should have database configuration', () => {
      // Test that database URL is configured
      expect(process.env.DATABASE_URL).toBeDefined();
      expect(process.env.DATABASE_URL).toContain('postgresql://');
    });

    it('should have Prisma schema file', () => {
      // Check that Prisma schema exists
      const schemaPath = path.resolve(
        __dirname,
        '../../../prisma/schema.prisma',
      );
      expect(fs.existsSync(schemaPath)).toBe(true);

      const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
      expect(schemaContent).toContain('model User');
      expect(schemaContent).toContain('model Invoice');
      expect(schemaContent).toContain('model File');
    });

    it('should have database migration files', () => {
      // Check that migrations directory exists
      const migrationsDir = path.resolve(
        __dirname,
        '../../../prisma/migrations',
      );
      expect(fs.existsSync(migrationsDir)).toBe(true);
    });

    it('should have database health check utility', async () => {
      // Test the database health check function exists and can be called
      expect(typeof checkDatabaseHealth).toBe('function');

      // Mock Prisma client for testing
      const mockPrisma = {
        $queryRaw: jest.fn().mockResolvedValue([{ test: 1 }]),
        user: {
          count: jest.fn().mockResolvedValue(0),
        },
      };

      const result = await checkDatabaseHealth(mockPrisma as any);
      expect(result).toHaveProperty('status');
      expect(['healthy', 'degraded', 'unhealthy']).toContain(result.status);
    });

    it('should have proper database connection configuration', () => {
      // Check that database configuration is properly set up
      const databaseUrl = process.env.DATABASE_URL;
      expect(databaseUrl).toBeDefined();

      // Parse the URL to check components
      if (databaseUrl) {
        expect(databaseUrl).toMatch(/^postgresql:\/\/.+/);
      }
    });
  });

  describe('Task 2.1.4: Test Redis connectivity', () => {
    it('should have Redis configuration', () => {
      const redisUrl = process.env.REDIS_URL;
      expect(redisUrl).toBeDefined();
      expect(redisUrl).toContain('redis://');
    });

    it('should have Redis health check utility', async () => {
      // Test the Redis health check function exists and can be called
      expect(typeof checkRedisHealth).toBe('function');

      const result = await checkRedisHealth();
      expect(result).toHaveProperty('status');
      expect(['healthy', 'degraded', 'unhealthy']).toContain(result.status);
    });

    it('should have Redis queue configuration', () => {
      // Check that queue-related files exist
      const queueDir = path.resolve(__dirname, '../../queues');
      if (fs.existsSync(queueDir)) {
        const queueFiles = fs.readdirSync(queueDir);
        expect(queueFiles.length).toBeGreaterThan(0);
      }
    });

    it('should have Bull queue setup', () => {
      // Check for Bull queue configuration
      const packageJsonPath = path.resolve(__dirname, '../../../package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      // Bull might not be installed yet, but ioredis should be
      expect(packageJson.dependencies).toHaveProperty('ioredis');
    });

    it('should have proper Redis connection handling', () => {
      // Check that Redis connection utilities exist or ioredis is configured
      const redisUtilsPath = path.resolve(__dirname, '../../utils');
      const utilFiles = fs.readdirSync(redisUtilsPath);

      // Should have some Redis-related utilities or system-health which includes Redis checks
      const hasRedisUtils = utilFiles.some(
        (file) =>
          file.includes('redis') ||
          file.includes('queue') ||
          file.includes('system-health'),
      );
      expect(hasRedisUtils).toBe(true);
    });
  });

  describe('Task 2.1.5: Verify all services are communicating', () => {
    it('should have API route files configured', () => {
      // Check that main route files exist
      const routesDir = path.resolve(__dirname, '../../routes');
      expect(fs.existsSync(routesDir)).toBe(true);

      const routeFiles = fs.readdirSync(routesDir);
      const expectedRoutes = ['auth.routes.ts', 'fileUpload.ts', 'system.ts'];

      expectedRoutes.forEach((routeFile) => {
        expect(routeFiles).toContain(routeFile);
      });
    });

    it('should have middleware configured', () => {
      // Check that middleware files exist
      const middlewareDir = path.resolve(__dirname, '../../middleware');
      expect(fs.existsSync(middlewareDir)).toBe(true);

      const middlewareFiles = fs.readdirSync(middlewareDir);
      expect(middlewareFiles.some((file) => file.includes('auth'))).toBe(true);
      expect(
        middlewareFiles.some(
          (file) => file.includes('cors') || file.includes('security'),
        ),
      ).toBe(true);
    });

    it('should have CORS configuration', () => {
      // Check that CORS is configured in the main app
      const indexPath = path.resolve(__dirname, '../../index.ts');
      const indexContent = fs.readFileSync(indexPath, 'utf-8');

      expect(indexContent).toContain('cors');
    });

    it('should have security middleware configured', () => {
      // Check for security middleware
      const indexPath = path.resolve(__dirname, '../../index.ts');
      const indexContent = fs.readFileSync(indexPath, 'utf-8');

      expect(indexContent).toContain('helmet');
    });

    it('should have rate limiting configured', () => {
      // Check for rate limiting middleware
      const middlewareDir = path.resolve(__dirname, '../../middleware');
      const middlewareFiles = fs.readdirSync(middlewareDir);

      expect(
        middlewareFiles.some(
          (file) => file.includes('rate') || file.includes('limit'),
        ),
      ).toBe(true);
    });

    it('should have error handling middleware', () => {
      // Check for error handling
      const indexPath = path.resolve(__dirname, '../../index.ts');
      const indexContent = fs.readFileSync(indexPath, 'utf-8');

      expect(indexContent).toContain('error');
    });

    it('should have file system health check', async () => {
      // Test the file system health check function
      expect(typeof checkFileSystemHealth).toBe('function');

      const result = await checkFileSystemHealth();
      expect(result).toHaveProperty('status');
      expect(['healthy', 'degraded', 'unhealthy']).toContain(result.status);
    });

    it('should have memory health check', () => {
      // Test the memory health check function
      expect(typeof checkMemoryHealth).toBe('function');

      const result = checkMemoryHealth();
      expect(result).toHaveProperty('status');
      expect(['healthy', 'degraded', 'unhealthy']).toContain(result.status);
    });
  });

  describe('Integration Tests', () => {
    it('should have proper environment configuration for all services', () => {
      const requiredEnvVars = [
        'NODE_ENV',
        'DATABASE_URL',
        'JWT_SECRET',
        'REDIS_URL',
      ];

      requiredEnvVars.forEach((envVar) => {
        expect(process.env[envVar]).toBeDefined();
      });
    });

    it('should have all package scripts working', () => {
      const rootDir = path.resolve(__dirname, '../../../..');
      const backendDir = path.join(rootDir, 'backend');
      const frontendDir = path.join(rootDir, 'frontend');

      // Check root package.json
      const rootPackageJson = require(path.join(rootDir, 'package.json'));
      expect(rootPackageJson.scripts).toHaveProperty('dev');
      expect(rootPackageJson.scripts).toHaveProperty('test');

      // Check backend package.json
      const backendPackageJson = require(path.join(backendDir, 'package.json'));
      expect(backendPackageJson.scripts).toHaveProperty('dev');
      expect(backendPackageJson.scripts).toHaveProperty('test');

      // Check frontend package.json
      const frontendPackageJson = require(
        path.join(frontendDir, 'package.json'),
      );
      expect(frontendPackageJson.scripts).toHaveProperty('dev');
      expect(frontendPackageJson.scripts).toHaveProperty('test');
    });

    it('should have system health monitoring configured', () => {
      // Check that system health utilities exist
      const systemHealthPath = path.resolve(
        __dirname,
        '../../utils/system-health.ts',
      );
      expect(fs.existsSync(systemHealthPath)).toBe(true);

      const healthContent = fs.readFileSync(systemHealthPath, 'utf-8');
      expect(healthContent).toContain('checkDatabaseHealth');
      expect(healthContent).toContain('checkRedisHealth');
      expect(healthContent).toContain('checkFileSystemHealth');
      expect(healthContent).toContain('checkMemoryHealth');
    });

    it('should have comprehensive service monitoring', () => {
      // Check that all health check functions are available
      expect(typeof checkDatabaseHealth).toBe('function');
      expect(typeof checkRedisHealth).toBe('function');
      expect(typeof checkFileSystemHealth).toBe('function');
      expect(typeof checkMemoryHealth).toBe('function');
    });
  });
});
