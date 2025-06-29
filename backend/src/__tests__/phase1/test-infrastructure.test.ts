import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

describe('Test Infrastructure Fixes (Lines 109-114)', () => {
  const rootDir = path.resolve(__dirname, '../../../..');
  const backendDir = path.join(rootDir, 'backend');
  const frontendDir = path.join(rootDir, 'frontend');

  describe('Task 1.4.1: Fix missing @vitest/ui dependency', () => {
    it('should have @vitest/ui in frontend devDependencies', () => {
      const packageJsonPath = path.join(frontendDir, 'package.json');
      expect(fs.existsSync(packageJsonPath)).toBe(true);

      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      expect(packageJson.devDependencies).toHaveProperty('@vitest/ui');
    });

    it('should have vitest in frontend devDependencies', () => {
      const packageJsonPath = path.join(frontendDir, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      expect(packageJson.devDependencies).toHaveProperty('vitest');
    });

    it('should have test:ui script in frontend package.json', () => {
      const packageJsonPath = path.join(frontendDir, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      expect(packageJson.scripts).toHaveProperty('test:ui');
      expect(packageJson.scripts['test:ui']).toContain('vitest --ui');
    });

    it('should have vitest configuration file', () => {
      const vitestConfigPath = path.join(frontendDir, 'vitest.config.ts');
      expect(fs.existsSync(vitestConfigPath)).toBe(true);
    });
  });

  describe('Task 1.4.2: Fix test database connection issues', () => {
    it('should have test database configuration', () => {
      const testEnvPath = path.join(backendDir, '.env.test');
      expect(fs.existsSync(testEnvPath)).toBe(true);
    });

    it('should have test database URL in test environment', () => {
      const testEnvPath = path.join(backendDir, '.env.test');
      const content = fs.readFileSync(testEnvPath, 'utf-8');

      expect(content).toContain('DATABASE_URL');
      expect(content).toContain('test');
    });

    it('should have test database setup script', () => {
      const setupTestDbPath = path.join(
        backendDir,
        'src/__tests__/setup-test-db.ts',
      );
      expect(fs.existsSync(setupTestDbPath)).toBe(true);
    });

    it('should have global test setup configuration', () => {
      const globalSetupPath = path.join(
        backendDir,
        'src/__tests__/global-setup.ts',
      );
      expect(fs.existsSync(globalSetupPath)).toBe(true);
    });

    it('should have global test teardown configuration', () => {
      const globalTeardownPath = path.join(
        backendDir,
        'src/__tests__/global-teardown.ts',
      );
      expect(fs.existsSync(globalTeardownPath)).toBe(true);
    });

    it('should have test database migration script', () => {
      const packageJsonPath = path.join(backendDir, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      expect(packageJson.scripts).toHaveProperty('test:db:migrate');
      expect(packageJson.scripts['test:db:migrate']).toContain(
        'prisma migrate',
      );
    });

    it('should have test database reset script', () => {
      const packageJsonPath = path.join(backendDir, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      expect(packageJson.scripts).toHaveProperty('test:db:reset');
      expect(packageJson.scripts['test:db:reset']).toContain(
        'prisma migrate reset',
      );
    });
  });

  describe('Task 1.4.3: Update Jest configuration', () => {
    it('should have main Jest configuration file', () => {
      const jestConfigPath = path.join(backendDir, 'jest.config.js');
      expect(fs.existsSync(jestConfigPath)).toBe(true);
    });

    it('should have unit test Jest configuration', () => {
      const jestUnitConfigPath = path.join(backendDir, 'jest.unit.config.js');
      expect(fs.existsSync(jestUnitConfigPath)).toBe(true);
    });

    it('should have integration test Jest configuration', () => {
      const jestIntegrationConfigPath = path.join(
        backendDir,
        'jest.integration.config.js',
      );
      expect(fs.existsSync(jestIntegrationConfigPath)).toBe(true);
    });

    it('should have e2e test Jest configuration', () => {
      const jestE2eConfigPath = path.join(backendDir, 'jest.e2e.config.js');
      expect(fs.existsSync(jestE2eConfigPath)).toBe(true);
    });

    it('should have proper Jest configuration structure', () => {
      const jestConfigPath = path.join(backendDir, 'jest.config.js');
      const content = fs.readFileSync(jestConfigPath, 'utf-8');

      expect(content).toContain("preset: 'ts-jest'");
      expect(content).toContain("testEnvironment: 'node'");
      expect(content).toContain('globalSetup');
      expect(content).toContain('globalTeardown');
    });

    it('should have proper test scripts in package.json', () => {
      const packageJsonPath = path.join(backendDir, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      const requiredTestScripts = [
        'test',
        'test:watch',
        'test:unit',
        'test:integration',
        'test:e2e',
        'test:coverage',
      ];

      requiredTestScripts.forEach((script) => {
        expect(packageJson.scripts).toHaveProperty(script);
        expect(packageJson.scripts[script]).toBeTruthy();
      });
    });

    it('should have proper coverage configuration', () => {
      const jestConfigPath = path.join(backendDir, 'jest.config.js');
      const content = fs.readFileSync(jestConfigPath, 'utf-8');

      expect(content).toContain('collectCoverageFrom');
      expect(content).toContain('coverageDirectory');
      expect(content).toContain('coverageReporters');
    });
  });

  describe('Task 1.4.4: Fix broken existing tests', () => {
    it('should have working test setup files', () => {
      const setupFiles = [
        path.join(backendDir, 'src/__tests__/setup.ts'),
        path.join(backendDir, 'src/__tests__/unit-setup.ts'),
      ];

      setupFiles.forEach((filePath) => {
        expect(fs.existsSync(filePath)).toBe(true);
      });
    });

    it('should have test utilities', () => {
      const testUtilsPath = path.join(backendDir, 'src/__tests__/utils');
      expect(fs.existsSync(testUtilsPath)).toBe(true);
    });

    it('should have test factories', () => {
      const testFactoriesPath = path.join(
        backendDir,
        'src/__tests__/factories',
      );
      expect(fs.existsSync(testFactoriesPath)).toBe(true);
    });

    it('should have test mocks', () => {
      const testMocksPath = path.join(backendDir, 'src/__tests__/mocks');
      expect(fs.existsSync(testMocksPath)).toBe(true);
    });

    it('should have proper test environment variables', () => {
      const unitSetupPath = path.join(
        backendDir,
        'src/__tests__/unit-setup.ts',
      );
      const content = fs.readFileSync(unitSetupPath, 'utf-8');

      expect(content).toContain('NODE_ENV');
      expect(content).toContain('test');
    });

    it('should have test database utilities', () => {
      const testDbUtilsPath = path.join(
        backendDir,
        'src/__tests__/utils/test-db.ts',
      );
      expect(fs.existsSync(testDbUtilsPath)).toBe(true);
    });
  });

  describe('Task 1.4.5: Document test running procedures', () => {
    it('should have test procedures documentation', () => {
      const testProceduresPath = path.join(
        rootDir,
        'docs',
        'development',
        'test-procedures.md',
      );
      expect(fs.existsSync(testProceduresPath)).toBe(true);
    });

    it('should have testing guide documentation', () => {
      const testingGuidePath = path.join(
        rootDir,
        'docs',
        'development',
        'testing-guide.md',
      );
      expect(fs.existsSync(testingGuidePath)).toBe(true);
    });

    it('should have comprehensive test documentation content', () => {
      const testProceduresPath = path.join(
        rootDir,
        'docs',
        'development',
        'test-procedures.md',
      );
      const content = fs.readFileSync(testProceduresPath, 'utf-8');

      expect(content).toContain('npm test');
      expect(content).toContain('unit tests');
      expect(content).toContain('integration tests');
      expect(content).toContain('coverage');
      expect(content).toContain('database');
    });

    it('should have testing best practices documentation', () => {
      const testingGuidePath = path.join(
        rootDir,
        'docs',
        'development',
        'testing-guide.md',
      );
      const content = fs.readFileSync(testingGuidePath, 'utf-8');

      expect(content).toContain('TDD');
      expect(content).toContain('mocking');
      expect(content).toContain('test structure');
      expect(content).toContain('best practices');
    });

    it('should have README with test instructions', () => {
      const readmePath = path.join(rootDir, 'README.md');
      expect(fs.existsSync(readmePath)).toBe(true);

      const content = fs.readFileSync(readmePath, 'utf-8');
      expect(content).toContain('test');
      expect(content).toContain('npm');
    });
  });

  describe('Integration Tests', () => {
    it('should have all test configurations working together', () => {
      const configFiles = [
        path.join(backendDir, 'jest.config.js'),
        path.join(backendDir, 'jest.unit.config.js'),
        path.join(backendDir, 'jest.integration.config.js'),
        path.join(frontendDir, 'vitest.config.ts'),
      ];

      configFiles.forEach((configPath) => {
        expect(fs.existsSync(configPath)).toBe(true);
      });
    });

    it('should have proper test environment setup', () => {
      const envFiles = [
        path.join(backendDir, '.env.test'),
        path.join(backendDir, '.env.development'),
        path.join(frontendDir, '.env.development'),
      ];

      envFiles.forEach((envPath) => {
        expect(fs.existsSync(envPath)).toBe(true);
      });
    });

    it('should have comprehensive test script coverage', () => {
      const backendPackageJsonPath = path.join(backendDir, 'package.json');
      const frontendPackageJsonPath = path.join(frontendDir, 'package.json');
      const rootPackageJsonPath = path.join(rootDir, 'package.json');

      const backendPackageJson = JSON.parse(
        fs.readFileSync(backendPackageJsonPath, 'utf-8'),
      );
      const frontendPackageJson = JSON.parse(
        fs.readFileSync(frontendPackageJsonPath, 'utf-8'),
      );
      const rootPackageJson = JSON.parse(
        fs.readFileSync(rootPackageJsonPath, 'utf-8'),
      );

      // Backend should have comprehensive test scripts
      expect(backendPackageJson.scripts).toHaveProperty('test');
      expect(backendPackageJson.scripts).toHaveProperty('test:unit');
      expect(backendPackageJson.scripts).toHaveProperty('test:integration');

      // Frontend should have test scripts
      expect(frontendPackageJson.scripts).toHaveProperty('test');
      expect(frontendPackageJson.scripts).toHaveProperty('test:ui');

      // Root should have workspace test script
      expect(rootPackageJson.scripts).toHaveProperty('test');
      expect(rootPackageJson.scripts).toHaveProperty('setup:test');
    });

    it('should have all documentation files properly structured', () => {
      const docFiles = [
        'test-procedures.md',
        'testing-guide.md',
        'local-setup.md',
        'getting-started.md',
      ];

      docFiles.forEach((fileName) => {
        const filePath = path.join(rootDir, 'docs', 'development', fileName);
        expect(fs.existsSync(filePath)).toBe(true);

        const content = fs.readFileSync(filePath, 'utf-8');
        expect(content.length).toBeGreaterThan(200); // Should have substantial content
        expect(content).toMatch(/^#/m); // Should have markdown headers
      });
    });
  });
});
