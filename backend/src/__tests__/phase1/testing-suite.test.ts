import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

describe('Testing Suite Setup', () => {
  describe('Jest Configuration', () => {
    const jestConfigPath = path.join(process.cwd(), 'jest.config.js');
    const jestConfig = require(jestConfigPath);

    it('should have proper Jest configuration', () => {
      expect(jestConfig).toBeDefined();
      expect(jestConfig.preset).toBe('ts-jest');
      expect(jestConfig.testEnvironment).toBe('node');
      expect(jestConfig.roots).toContain('<rootDir>/src');
    });

    it('should have proper test patterns', () => {
      expect(jestConfig.testMatch).toContain('**/__tests__/**/*.test.ts');
      expect(jestConfig.testMatch).toContain('**/?(*.)+(spec|test).ts');
      expect(jestConfig.testPathIgnorePatterns).toContain('node_modules');
      expect(jestConfig.testPathIgnorePatterns).toContain('dist');
    });

    it('should have proper coverage configuration', () => {
      expect(jestConfig.coverageDirectory).toBe('coverage');
      expect(jestConfig.coverageReporters).toContain('text');
      expect(jestConfig.coverageReporters).toContain('lcov');
      expect(jestConfig.coverageReporters).toContain('html');
      expect(jestConfig.coverageThreshold).toBeDefined();
    });

    it('should have proper module name mapper', () => {
      expect(jestConfig.moduleNameMapper).toBeDefined();
      expect(jestConfig.moduleNameMapper['^@/(.*)$']).toBe('<rootDir>/src/$1');
    });

    it('should have proper setup files', () => {
      expect(jestConfig.setupFilesAfterEnv).toContain(
        '<rootDir>/src/__tests__/setup.ts',
      );
    });
  });

  describe('Test Setup', () => {
    const setupPath = path.join(process.cwd(), 'src', '__tests__', 'setup.ts');

    it('should have test setup file', () => {
      expect(fs.existsSync(setupPath)).toBe(true);
    });

    it('should have proper test environment setup', () => {
      const setupContent = fs.readFileSync(setupPath, 'utf-8');
      expect(setupContent).toContain('beforeAll');
      expect(setupContent).toContain('afterAll');
      expect(setupContent).toContain('beforeEach');
    });

    it('should have proper test utilities', () => {
      const utilsPath = path.join(process.cwd(), 'src', '__tests__', 'utils');
      expect(fs.existsSync(utilsPath)).toBe(true);

      const testHelpersPath = path.join(utilsPath, 'testHelpers.ts');
      expect(fs.existsSync(testHelpersPath)).toBe(true);

      const content = fs.readFileSync(testHelpersPath, 'utf-8');
      expect(content).toContain('setupTestDatabase');
      expect(content).toContain('generateTestUser');
      expect(content).toContain('generateTestFile');
      expect(content).toContain('generateTestInvoice');
    });
  });

  describe('Test Fixtures', () => {
    const fixturesPath = path.join(
      process.cwd(),
      'src',
      '__tests__',
      'fixtures',
    );

    it('should have test fixtures directory', () => {
      expect(fs.existsSync(fixturesPath)).toBe(true);
    });

    it('should have proper test data', () => {
      const testDataPath = path.join(fixturesPath, 'test-data.json');
      expect(fs.existsSync(testDataPath)).toBe(true);

      const testData = JSON.parse(fs.readFileSync(testDataPath, 'utf-8'));
      expect(testData.users).toBeDefined();
      expect(testData.invoices).toBeDefined();
      expect(testData.templates).toBeDefined();
    });

    it('should have proper test files', () => {
      const filesPath = path.join(fixturesPath, 'files');
      expect(fs.existsSync(filesPath)).toBe(true);

      const files = fs.readdirSync(filesPath);
      expect(files).toContain('valid-invoice.pdf');
      expect(files).toContain('invalid-invoice.pdf');
      expect(files).toContain('valid-invoice.jpg');
    });
  });

  describe('Test Coverage', () => {
    it('should run tests with coverage', () => {
      expect(() => {
        execSync('npm run test:coverage', { stdio: 'ignore' });
      }).not.toThrow();

      const coveragePath = path.join(process.cwd(), 'coverage');
      expect(fs.existsSync(coveragePath)).toBe(true);
      expect(fs.existsSync(path.join(coveragePath, 'lcov-report'))).toBe(true);
      expect(
        fs.existsSync(path.join(coveragePath, 'coverage-final.json')),
      ).toBe(true);
    });

    it('should meet coverage thresholds', () => {
      const coverageSummaryPath = path.join(
        process.cwd(),
        'coverage',
        'coverage-summary.json',
      );
      expect(fs.existsSync(coverageSummaryPath)).toBe(true);

      const coverage = JSON.parse(
        fs.readFileSync(coverageSummaryPath, 'utf-8'),
      );
      const thresholds = {
        statements: 95,
        branches: 95,
        functions: 95,
        lines: 95,
      };

      Object.entries(thresholds).forEach(([key, threshold]) => {
        expect(coverage.total[key].pct).toBeGreaterThanOrEqual(threshold);
      });
    });
  });

  describe('Test Documentation', () => {
    it('should have testing documentation', () => {
      const docsPath = path.join(process.cwd(), 'docs', 'testing.md');
      expect(fs.existsSync(docsPath)).toBe(true);

      const content = fs.readFileSync(docsPath, 'utf-8');
      expect(content).toContain('Testing Strategy');
      expect(content).toContain('Test Types');
      expect(content).toContain('Running Tests');
      expect(content).toContain('Writing Tests');
    });

    it('should have test fixtures documentation', () => {
      const docsPath = path.join(
        process.cwd(),
        'docs',
        'testing',
        'fixtures.md',
      );
      expect(fs.existsSync(docsPath)).toBe(true);

      const content = fs.readFileSync(docsPath, 'utf-8');
      expect(content).toContain('Test Data');
      expect(content).toContain('Test Files');
      expect(content).toContain('Usage');
    });
  });

  describe('Test Utilities', () => {
    it('should have proper test database setup', () => {
      const dbPath = path.join(
        process.cwd(),
        'src',
        '__tests__',
        'utils',
        'testDatabase.ts',
      );
      expect(fs.existsSync(dbPath)).toBe(true);

      const content = fs.readFileSync(dbPath, 'utf-8');
      expect(content).toContain('PrismaClient');
      expect(content).toContain('setupTestDatabase');
      expect(content).toContain('cleanupTestDatabase');
    });

    it('should have proper test mocks', () => {
      const mocksPath = path.join(process.cwd(), 'src', '__tests__', 'mocks');
      expect(fs.existsSync(mocksPath)).toBe(true);

      const files = fs.readdirSync(mocksPath);
      expect(files).toContain('services.ts');
      expect(files).toContain('repositories.ts');
      expect(files).toContain('middleware.ts');
    });

    it('should have proper test helpers', () => {
      const helpersPath = path.join(
        process.cwd(),
        'src',
        '__tests__',
        'utils',
        'testHelpers.ts',
      );
      expect(fs.existsSync(helpersPath)).toBe(true);

      const content = fs.readFileSync(helpersPath, 'utf-8');
      expect(content).toContain('generateTestUser');
      expect(content).toContain('generateTestFile');
      expect(content).toContain('generateTestInvoice');
      expect(content).toContain('generateTestTemplate');
    });
  });

  describe('Test Types', () => {
    it('should have unit tests', () => {
      const unitTestsPath = path.join(
        process.cwd(),
        'src',
        '__tests__',
        'unit',
      );
      expect(fs.existsSync(unitTestsPath)).toBe(true);

      const files = fs.readdirSync(unitTestsPath);
      expect(files.some((file) => file.endsWith('.test.ts'))).toBe(true);
    });

    it('should have integration tests', () => {
      const integrationTestsPath = path.join(
        process.cwd(),
        'src',
        '__tests__',
        'integration',
      );
      expect(fs.existsSync(integrationTestsPath)).toBe(true);

      const files = fs.readdirSync(integrationTestsPath);
      expect(files.some((file) => file.endsWith('.test.ts'))).toBe(true);
    });

    it('should have e2e tests', () => {
      const e2eTestsPath = path.join(process.cwd(), 'src', '__tests__', 'e2e');
      expect(fs.existsSync(e2eTestsPath)).toBe(true);

      const files = fs.readdirSync(e2eTestsPath);
      expect(files.some((file) => file.endsWith('.test.ts'))).toBe(true);
    });
  });
});
