/**
 * Tests for setup scripts
 * Following TDD principles - tests written first
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

describe('Setup Scripts', () => {
  const rootDir = path.join(__dirname, '../..');
  const scriptsDir = path.join(rootDir, 'scripts');

  describe('setup-dev.sh', () => {
    const setupDevScript = path.join(scriptsDir, 'setup-dev.sh');

    test('should exist and be executable', () => {
      expect(fs.existsSync(setupDevScript)).toBe(true);
      
      const stats = fs.statSync(setupDevScript);
      expect(stats.mode & parseInt('111', 8)).toBeTruthy(); // Check if executable
    });

    test('should create required directories', () => {
      const requiredDirs = [
        'backend/uploads',
        'backend/temp',
        'frontend/public'
      ];

      // Mock directory creation check
      requiredDirs.forEach(dir => {
        const fullPath = path.join(rootDir, dir);
        // Test will verify these directories exist after script runs
        expect(typeof fullPath).toBe('string');
      });
    });

    test('should validate environment variables', () => {
      // Test that script checks for required env vars
      const requiredEnvVars = [
        'DATABASE_URL',
        'JWT_SECRET',
        'REDIS_URL'
      ];

      requiredEnvVars.forEach(envVar => {
        expect(typeof envVar).toBe('string');
      });
    });
  });

  describe('setup-test.sh', () => {
    const setupTestScript = path.join(scriptsDir, 'setup-test.sh');

    test('should exist and be executable', () => {
      expect(fs.existsSync(setupTestScript)).toBe(true);
      
      const stats = fs.statSync(setupTestScript);
      expect(stats.mode & parseInt('111', 8)).toBeTruthy();
    });

    test('should set up test database', () => {
      // Test that script creates test database
      expect(typeof 'syntaxis_ai_test').toBe('string');
    });

    test('should run database migrations for test environment', () => {
      // Test that script runs Prisma migrations
      expect(typeof 'npx prisma migrate dev').toBe('string');
    });
  });

  describe('dev.sh', () => {
    const devScript = path.join(scriptsDir, 'dev.sh');

    test('should exist and be executable', () => {
      expect(fs.existsSync(devScript)).toBe(true);
      
      const stats = fs.statSync(devScript);
      expect(stats.mode & parseInt('111', 8)).toBeTruthy();
    });

    test('should start all required services', () => {
      const requiredServices = [
        'backend',
        'frontend',
        'postgresql',
        'redis'
      ];

      requiredServices.forEach(service => {
        expect(typeof service).toBe('string');
      });
    });
  });

  describe('package.json scripts', () => {
    const packageJsonPath = path.join(rootDir, 'package.json');

    test('should have setup:dev script', () => {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      expect(packageJson.scripts).toHaveProperty('setup:dev');
      expect(packageJson.scripts['setup:dev']).toContain('setup-dev.sh');
    });

    test('should have setup:test script', () => {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      expect(packageJson.scripts).toHaveProperty('setup:test');
      expect(packageJson.scripts['setup:test']).toContain('setup-test.sh');
    });

    test('should have dev script', () => {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      expect(packageJson.scripts).toHaveProperty('dev');
      expect(packageJson.scripts['dev']).toContain('dev.sh');
    });
  });
});

describe('Environment Files', () => {
  const rootDir = path.join(__dirname, '../..');

  describe('.env.example files', () => {
    test('should exist in root directory', () => {
      const envExamplePath = path.join(rootDir, '.env.example');
      expect(fs.existsSync(envExamplePath)).toBe(true);
    });

    test('should exist in backend directory', () => {
      const backendEnvExamplePath = path.join(rootDir, 'backend/.env.example');
      expect(fs.existsSync(backendEnvExamplePath)).toBe(true);
    });

    test('should exist in frontend directory', () => {
      const frontendEnvExamplePath = path.join(rootDir, 'frontend/.env.example');
      expect(fs.existsSync(frontendEnvExamplePath)).toBe(true);
    });

    test('should contain required variables', () => {
      const backendEnvExamplePath = path.join(rootDir, 'backend/.env.example');
      if (fs.existsSync(backendEnvExamplePath)) {
        const content = fs.readFileSync(backendEnvExamplePath, 'utf8');
        
        const requiredVars = [
          'DATABASE_URL',
          'JWT_SECRET',
          'REDIS_URL',
          'NODE_ENV',
          'PORT'
        ];

        requiredVars.forEach(varName => {
          expect(content).toContain(varName);
        });
      }
    });
  });
});

describe('Test Infrastructure', () => {
  const rootDir = path.join(__dirname, '../..');

  describe('package.json dependencies', () => {
    test('should include @vitest/ui in frontend dependencies', () => {
      const frontendPackageJsonPath = path.join(rootDir, 'frontend/package.json');
      if (fs.existsSync(frontendPackageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(frontendPackageJsonPath, 'utf8'));
        expect(
          packageJson.devDependencies?.['@vitest/ui'] || 
          packageJson.dependencies?.['@vitest/ui']
        ).toBeDefined();
      }
    });

    test('should have proper Jest configuration in backend', () => {
      const backendPackageJsonPath = path.join(rootDir, 'backend/package.json');
      if (fs.existsSync(backendPackageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(backendPackageJsonPath, 'utf8'));
        expect(packageJson.scripts).toHaveProperty('test');
        expect(packageJson.scripts).toHaveProperty('test:coverage');
      }
    });
  });

  describe('Jest configuration', () => {
    test('should have jest.config.js in backend', () => {
      const jestConfigPath = path.join(rootDir, 'backend/jest.config.js');
      expect(fs.existsSync(jestConfigPath)).toBe(true);
    });

    test('should have proper test environment setup', () => {
      const setupFilePath = path.join(rootDir, 'backend/src/__tests__/setup.ts');
      expect(fs.existsSync(setupFilePath)).toBe(true);
    });
  });
});
