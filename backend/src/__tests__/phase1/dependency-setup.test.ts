import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

describe('Project Dependencies Setup (Lines 93-98)', () => {
  const rootDir = path.resolve(__dirname, '../../../../');
  const backendDir = path.join(rootDir, 'backend');
  const frontendDir = path.join(rootDir, 'frontend');

  describe('1.2.1 Backend Dependencies', () => {
    it('should have backend package.json with all required dependencies', () => {
      const packageJsonPath = path.join(backendDir, 'package.json');
      expect(fs.existsSync(packageJsonPath)).toBe(true);

      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      // Core backend dependencies
      const requiredDependencies = [
        'express',
        'prisma',
        '@prisma/client',
        'typescript',
        'ts-node',
        'nodemon',
        'jest',
        'ts-jest',
        '@types/jest',
        'bcryptjs',
        'jsonwebtoken',
        'cors',
        'helmet',
        'express-rate-limit',
        'bull',
        'ioredis',
        'multer',
        'tesseract.js',
        'winston',
        'nodemailer',
        'express-validator',
        'dotenv',
      ];

      requiredDependencies.forEach((dep) => {
        const hasInDeps =
          packageJson.dependencies && packageJson.dependencies[dep];
        const hasInDevDeps =
          packageJson.devDependencies && packageJson.devDependencies[dep];
        expect(hasInDeps || hasInDevDeps).toBeTruthy();
      });
    });

    it('should have backend node_modules directory', () => {
      const nodeModulesPath = path.join(backendDir, 'node_modules');
      expect(fs.existsSync(nodeModulesPath)).toBe(true);
    });

    it('should have all critical backend packages installed', () => {
      const criticalPackages = [
        'express',
        '@prisma/client',
        'typescript',
        'jest',
      ];

      criticalPackages.forEach((pkg) => {
        const packagePath = path.join(backendDir, 'node_modules', pkg);
        expect(fs.existsSync(packagePath)).toBe(true);
      });
    });

    it('should be able to run backend scripts', () => {
      const packageJsonPath = path.join(backendDir, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      const requiredScripts = [
        'dev',
        'build',
        'start',
        'test',
        'lint',
        'format',
        'migrate',
        'prisma:generate',
      ];

      requiredScripts.forEach((script) => {
        expect(packageJson.scripts).toHaveProperty(script);
        expect(packageJson.scripts[script]).toBeTruthy();
      });
    });
  });

  describe('1.2.2 Frontend Dependencies', () => {
    it('should have frontend package.json with all required dependencies', () => {
      const packageJsonPath = path.join(frontendDir, 'package.json');
      expect(fs.existsSync(packageJsonPath)).toBe(true);

      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      // Core frontend dependencies
      const requiredDependencies = [
        'react',
        'react-dom',
        'typescript',
        'vite',
        '@vitejs/plugin-react',
        'vitest',
        '@testing-library/react',
        '@testing-library/jest-dom',
        '@tanstack/react-query',
        'react-router-dom',
        '@mui/material',
        '@emotion/react',
        '@emotion/styled',
        'tailwindcss',
        'axios',
        'zustand',
        'react-dropzone',
        'react-hot-toast',
      ];

      requiredDependencies.forEach((dep) => {
        const hasInDeps =
          packageJson.dependencies && packageJson.dependencies[dep];
        const hasInDevDeps =
          packageJson.devDependencies && packageJson.devDependencies[dep];
        expect(hasInDeps || hasInDevDeps).toBeTruthy();
      });
    });

    it('should have frontend node_modules directory', () => {
      const nodeModulesPath = path.join(frontendDir, 'node_modules');
      expect(fs.existsSync(nodeModulesPath)).toBe(true);
    });

    it('should have all critical frontend packages installed', () => {
      const criticalPackages = ['react', 'react-dom', 'vite', 'typescript'];

      criticalPackages.forEach((pkg) => {
        const packagePath = path.join(frontendDir, 'node_modules', pkg);
        expect(fs.existsSync(packagePath)).toBe(true);
      });
    });

    it('should be able to run frontend scripts', () => {
      const packageJsonPath = path.join(frontendDir, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      const requiredScripts = [
        'dev',
        'build',
        'preview',
        'test',
        'lint',
        'format',
      ];

      requiredScripts.forEach((script) => {
        expect(packageJson.scripts).toHaveProperty(script);
        expect(packageJson.scripts[script]).toBeTruthy();
      });
    });
  });

  describe('1.2.3 Root Dependencies', () => {
    it('should have root package.json with workspace configuration', () => {
      const packageJsonPath = path.join(rootDir, 'package.json');
      expect(fs.existsSync(packageJsonPath)).toBe(true);

      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      expect(packageJson.workspaces).toBeDefined();
      expect(packageJson.workspaces).toContain('frontend');
      expect(packageJson.workspaces).toContain('backend');
    });

    it('should have root node_modules directory', () => {
      const nodeModulesPath = path.join(rootDir, 'node_modules');
      expect(fs.existsSync(nodeModulesPath)).toBe(true);
    });

    it('should have root development dependencies', () => {
      const packageJsonPath = path.join(rootDir, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      const requiredDevDeps = [
        'concurrently',
        'typescript',
        'eslint',
        'prettier',
        '@typescript-eslint/eslint-plugin',
        '@typescript-eslint/parser',
      ];

      requiredDevDeps.forEach((dep) => {
        expect(packageJson.devDependencies).toHaveProperty(dep);
      });
    });

    it('should have workspace management scripts', () => {
      const packageJsonPath = path.join(rootDir, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      const requiredScripts = [
        'dev',
        'dev:frontend',
        'dev:backend',
        'test',
        'build',
        'lint',
        'format',
        'setup:dev',
      ];

      requiredScripts.forEach((script) => {
        expect(packageJson.scripts).toHaveProperty(script);
        expect(packageJson.scripts[script]).toBeTruthy();
      });
    });
  });

  describe('1.2.4 Environment Variables Setup', () => {
    it('should have all required environment example files', () => {
      const envFiles = [
        path.join(rootDir, '.env.example'),
        path.join(backendDir, '.env.development'),
        path.join(frontendDir, '.env.development'),
      ];

      envFiles.forEach((file) => {
        expect(fs.existsSync(file)).toBe(true);
      });
    });

    it('should have properly configured backend environment', () => {
      const envPath = path.join(backendDir, '.env.development');
      const envContent = fs.readFileSync(envPath, 'utf-8');

      const requiredVars = [
        'NODE_ENV',
        'PORT',
        'DATABASE_URL',
        'JWT_SECRET',
        'REDIS_URL',
        'CORS_ORIGIN',
      ];

      requiredVars.forEach((varName) => {
        expect(envContent).toContain(varName);
      });
    });

    it('should have properly configured frontend environment', () => {
      const envPath = path.join(frontendDir, '.env.development');
      const envContent = fs.readFileSync(envPath, 'utf-8');

      const requiredVars = ['VITE_API_BASE_URL', 'VITE_API_TIMEOUT'];

      requiredVars.forEach((varName) => {
        expect(envContent).toContain(varName);
      });
    });
  });

  describe('1.2.5 Prisma Migrations', () => {
    it('should have Prisma schema file', () => {
      const schemaPath = path.join(backendDir, 'prisma', 'schema.prisma');
      expect(fs.existsSync(schemaPath)).toBe(true);
    });

    it('should have migrations directory', () => {
      const migrationsPath = path.join(backendDir, 'prisma', 'migrations');
      expect(fs.existsSync(migrationsPath)).toBe(true);
    });

    it('should have Prisma client generated', () => {
      const clientPath = path.join(
        backendDir,
        'node_modules',
        '.prisma',
        'client',
      );
      expect(fs.existsSync(clientPath)).toBe(true);
    });

    it('should have database migration scripts', () => {
      const packageJsonPath = path.join(backendDir, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      const migrationScripts = [
        'migrate',
        'migrate:prod',
        'prisma:generate',
        'db:seed',
        'db:reset',
      ];

      migrationScripts.forEach((script) => {
        expect(packageJson.scripts).toHaveProperty(script);
      });
    });
  });

  describe('Integration Tests', () => {
    it('should be able to run setup script successfully', () => {
      const setupScriptPath = path.join(rootDir, 'scripts', 'setup-dev.sh');
      expect(fs.existsSync(setupScriptPath)).toBe(true);

      // Check if script is executable
      const stats = fs.statSync(setupScriptPath);
      expect(stats.mode & parseInt('111', 8)).toBeTruthy();
    });

    it('should have all required directories created', () => {
      const requiredDirs = [
        path.join(backendDir, 'uploads'),
        path.join(backendDir, 'temp'),
        path.join(frontendDir, 'public'),
      ];

      requiredDirs.forEach((dir) => {
        expect(fs.existsSync(dir)).toBe(true);
      });
    });
  });
});
