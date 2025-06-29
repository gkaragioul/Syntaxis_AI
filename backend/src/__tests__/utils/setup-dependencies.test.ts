import {
  DependencySetupManager,
  SetupResult,
} from '../../utils/setup-dependencies';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Mock external dependencies
jest.mock('child_process');
jest.mock('fs');

const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;
const mockFs = fs as jest.Mocked<typeof fs>;

describe('DependencySetupManager', () => {
  let setupManager: DependencySetupManager;
  const mockRootDir = '/mock/project';

  beforeEach(() => {
    setupManager = new DependencySetupManager(mockRootDir);
    jest.clearAllMocks();

    // Default mock implementations
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue('mock file content');
    mockFs.writeFileSync.mockImplementation(() => {});
    mockFs.copyFileSync.mockImplementation(() => {});
    mockExecSync.mockImplementation(() => Buffer.from('success'));
  });

  describe('Task 1.2.1: Backend Dependencies', () => {
    it('should install backend dependencies successfully', async () => {
      // Mock package.json exists
      mockFs.existsSync.mockImplementation((filePath: any) => {
        return (
          filePath.includes('package.json') || filePath.includes('node_modules')
        );
      });

      // Mock package.json content
      mockFs.readFileSync.mockImplementation((filePath: any) => {
        if (filePath.includes('package.json')) {
          return JSON.stringify({
            dependencies: { express: '^4.18.0' },
            devDependencies: { typescript: '^5.0.0' },
          });
        }
        return 'mock content';
      });

      const result = await setupManager.installBackendDependencies();

      expect(result.success).toBe(true);
      expect(result.message).toContain('Backend dependencies');
    });

    it('should handle missing package.json', async () => {
      mockFs.existsSync.mockImplementation((filePath: any) => {
        return !filePath.includes('backend/package.json');
      });

      const result = await setupManager.installBackendDependencies();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Backend package.json not found');
      expect(result.errors).toBeDefined();
    });

    it('should handle npm install failure', async () => {
      // Mock package.json exists but node_modules doesn't (to trigger installation)
      mockFs.existsSync.mockImplementation((filePath: any) => {
        if (filePath.includes('package.json')) return true;
        if (filePath.includes('node_modules')) return false;
        return false;
      });

      mockExecSync.mockImplementation(() => {
        throw new Error('npm install failed');
      });

      const result = await setupManager.installBackendDependencies();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to install backend dependencies');
      expect(result.errors).toContain('npm install failed');
    });

    it('should skip installation if dependencies are already valid', async () => {
      // Mock valid existing installation
      mockFs.existsSync.mockReturnValue(true);

      const result = await setupManager.installBackendDependencies();

      expect(result.success).toBe(true);
      expect(result.details).toContain(
        'Skipped installation - dependencies are up to date',
      );
    });
  });

  describe('Task 1.2.2: Frontend Dependencies', () => {
    it('should install frontend dependencies successfully', async () => {
      mockFs.existsSync.mockImplementation((filePath: any) => {
        return (
          filePath.includes('package.json') || filePath.includes('node_modules')
        );
      });

      mockFs.readFileSync.mockImplementation((filePath: any) => {
        if (filePath.includes('package.json')) {
          return JSON.stringify({
            dependencies: { react: '^18.0.0' },
            devDependencies: { vite: '^4.0.0' },
          });
        }
        return 'mock content';
      });

      const result = await setupManager.installFrontendDependencies();

      expect(result.success).toBe(true);
      expect(result.message).toContain('Frontend dependencies');
    });

    it('should handle missing frontend package.json', async () => {
      mockFs.existsSync.mockImplementation((filePath: any) => {
        return !filePath.includes('frontend/package.json');
      });

      const result = await setupManager.installFrontendDependencies();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Frontend package.json not found');
    });
  });

  describe('Task 1.2.3: Root Dependencies', () => {
    it('should install root dependencies successfully', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation((filePath: any) => {
        if (filePath.includes('package.json')) {
          return JSON.stringify({
            workspaces: ['frontend', 'backend'],
            devDependencies: { concurrently: '^7.0.0' },
          });
        }
        return 'mock content';
      });

      const result = await setupManager.installRootDependencies();

      expect(result.success).toBe(true);
      expect(result.message).toContain('Root dependencies');
    });

    it('should handle missing root package.json', async () => {
      mockFs.existsSync.mockImplementation((filePath: any) => {
        return !filePath.includes('/package.json');
      });

      const result = await setupManager.installRootDependencies();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Root package.json not found');
    });
  });

  describe('Task 1.2.4: Environment Variables', () => {
    it('should setup environment variables successfully', async () => {
      let filesCreated = false;

      // Mock environment files don't exist initially, but exist after creation
      mockFs.existsSync.mockImplementation((filePath: any) => {
        if (filePath.includes('.env.development')) {
          return filesCreated; // Return true after files are "created"
        }
        return filePath.includes('.env.example'); // Example file exists
      });

      // Mock file operations
      mockFs.copyFileSync.mockImplementation(() => {
        filesCreated = true;
      });
      mockFs.writeFileSync.mockImplementation(() => {
        filesCreated = true;
      });

      // Mock validation to return success after files are created
      mockFs.readFileSync.mockImplementation((filePath: any) => {
        if (filePath.includes('.env.development') && filesCreated) {
          return 'NODE_ENV=development\nPORT=3001\nDATABASE_URL=test\nJWT_SECRET=test\nVITE_API_BASE_URL=test';
        }
        return 'mock content';
      });

      const result = await setupManager.setupEnvironmentVariables();

      expect(result.success).toBe(true);
      expect(result.message).toContain('Environment variables setup completed');
      // Either copyFileSync or writeFileSync should be called (or both)
      expect(
        mockFs.copyFileSync.mock.calls.length +
          mockFs.writeFileSync.mock.calls.length,
      ).toBeGreaterThan(0);
    });

    it('should handle existing environment files', async () => {
      // Mock environment files already exist
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation((filePath: any) => {
        if (filePath.includes('.env.development')) {
          return 'NODE_ENV=development\nPORT=3001\nDATABASE_URL=test\nJWT_SECRET=test\nVITE_API_BASE_URL=test';
        }
        return 'mock content';
      });

      const result = await setupManager.setupEnvironmentVariables();

      expect(result.success).toBe(true);
      expect(result.details).toContain(
        'Backend .env.development already exists',
      );
      expect(result.details).toContain(
        'Frontend .env.development already exists',
      );
    });

    it('should validate environment file contents', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation((filePath: any) => {
        if (filePath.includes('backend/.env.development')) {
          return 'NODE_ENV=development'; // Missing required variables
        }
        if (filePath.includes('frontend/.env.development')) {
          return 'VITE_API_BASE_URL=http://localhost:3001';
        }
        return 'mock content';
      });

      const result = await setupManager.setupEnvironmentVariables();

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.some((error) => error.includes('Missing'))).toBe(
        true,
      );
    });
  });

  describe('Task 1.2.5: Prisma Migrations', () => {
    it('should run Prisma migrations successfully', async () => {
      mockFs.existsSync.mockReturnValue(true);

      const result = await setupManager.runPrismaMigrations();

      expect(result.success).toBe(true);
      expect(result.message).toBe('Prisma migrations completed successfully');
      expect(mockExecSync).toHaveBeenCalledWith(
        'npx prisma generate',
        expect.objectContaining({ cwd: expect.stringContaining('backend') }),
      );
      expect(mockExecSync).toHaveBeenCalledWith(
        'npx prisma migrate dev --name init',
        expect.objectContaining({ cwd: expect.stringContaining('backend') }),
      );
    });

    it('should handle missing Prisma schema', async () => {
      mockFs.existsSync.mockImplementation((filePath: any) => {
        return !filePath.includes('schema.prisma');
      });

      const result = await setupManager.runPrismaMigrations();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Prisma schema not found');
    });

    it('should handle Prisma command failures', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockExecSync.mockImplementation((command: string) => {
        if (command.includes('prisma')) {
          throw new Error('Prisma command failed');
        }
        return Buffer.from('success');
      });

      const result = await setupManager.runPrismaMigrations();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to run Prisma migrations');
      expect(result.errors).toContain('Prisma command failed');
    });
  });

  describe('Full Setup Integration', () => {
    it('should run all setup tasks in correct order', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation((filePath: any) => {
        if (filePath.includes('package.json')) {
          return JSON.stringify({
            workspaces: ['frontend', 'backend'],
            dependencies: { express: '^4.18.0', react: '^18.0.0' },
            devDependencies: { typescript: '^5.0.0', concurrently: '^7.0.0' },
          });
        }
        if (filePath.includes('.env.development')) {
          return 'NODE_ENV=development\nPORT=3001\nDATABASE_URL=test\nJWT_SECRET=test\nVITE_API_BASE_URL=test';
        }
        return 'mock content';
      });

      const result = await setupManager.runFullSetup();

      expect(result.success).toBe(true);
      expect(result.message).toBe(
        'All dependency setup tasks completed successfully',
      );
      expect(result.details).toBeDefined();
      expect(result.details!.length).toBeGreaterThan(0);
    });

    it('should handle partial failures gracefully', async () => {
      // Mock package.json files exist but node_modules don't (to trigger installation)
      mockFs.existsSync.mockImplementation((filePath: any) => {
        if (filePath.includes('package.json')) return true;
        if (filePath.includes('node_modules')) return false;
        if (filePath.includes('.env.example')) return true;
        return false;
      });

      mockFs.readFileSync.mockImplementation((filePath: any) => {
        if (filePath.includes('package.json')) {
          return JSON.stringify({
            workspaces: ['frontend', 'backend'],
            dependencies: { express: '^4.18.0', react: '^18.0.0' },
            devDependencies: { typescript: '^5.0.0', concurrently: '^7.0.0' },
          });
        }
        return 'mock content';
      });

      // Mock execSync to fail for frontend directory
      mockExecSync.mockImplementation((command: string, options: any) => {
        if (
          command.includes('npm install') &&
          options?.cwd?.includes('frontend')
        ) {
          throw new Error('Frontend install failed');
        }
        return Buffer.from('success');
      });

      const result = await setupManager.runFullSetup();

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(
        result.errors?.some((error) =>
          error.includes('Failed to install frontend dependencies'),
        ),
      ).toBe(true);
    });

    it('should skip Prisma migrations if backend setup fails', async () => {
      mockFs.existsSync.mockImplementation((filePath: any) => {
        return !filePath.includes('backend/package.json');
      });

      const result = await setupManager.runFullSetup();

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(
        result.errors?.some((error) =>
          error.includes('Skipped Prisma migrations'),
        ),
      ).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle file system errors gracefully', async () => {
      mockFs.existsSync.mockImplementation(() => {
        throw new Error('File system error');
      });

      const result = await setupManager.installBackendDependencies();

      expect(result.success).toBe(false);
      expect(result.errors).toContain('File system error');
    });

    it('should handle timeout errors', async () => {
      // Mock package.json exists but node_modules doesn't (to trigger installation)
      mockFs.existsSync.mockImplementation((filePath: any) => {
        if (filePath.includes('package.json')) return true;
        if (filePath.includes('node_modules')) return false;
        return false;
      });

      mockExecSync.mockImplementation(() => {
        throw new Error('Command timed out');
      });

      const result = await setupManager.installRootDependencies();

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Command timed out');
    });

    it('should provide detailed error information', async () => {
      const customError = new Error('Custom error with details');
      customError.stack = 'Error stack trace';

      mockExecSync.mockImplementation(() => {
        throw customError;
      });

      const result = await setupManager.runPrismaMigrations();

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Custom error with details');
    });
  });
});
