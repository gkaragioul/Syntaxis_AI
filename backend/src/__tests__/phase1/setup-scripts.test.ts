import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

describe('Development Setup Scripts (Lines 102-107)', () => {
  const rootDir = path.resolve(__dirname, '../../../..');
  const backendDir = path.join(rootDir, 'backend');
  const frontendDir = path.join(rootDir, 'frontend');

  describe('Task 1.3.1: npm run setup:dev script', () => {
    it('should have setup:dev script in root package.json', () => {
      const packageJsonPath = path.join(rootDir, 'package.json');
      expect(fs.existsSync(packageJsonPath)).toBe(true);

      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      expect(packageJson.scripts).toHaveProperty('setup:dev');
      expect(packageJson.scripts['setup:dev']).toBeTruthy();
    });

    it('should have setup:dev script that references setup script', () => {
      const packageJsonPath = path.join(rootDir, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      const setupScript = packageJson.scripts['setup:dev'];
      expect(setupScript).toContain('setup-dev.sh');
    });

    it('should have setup-dev.sh script file', () => {
      const setupScriptPath = path.join(rootDir, 'scripts', 'setup-dev.sh');
      expect(fs.existsSync(setupScriptPath)).toBe(true);
    });

    it('should have executable setup-dev.sh script', () => {
      const setupScriptPath = path.join(rootDir, 'scripts', 'setup-dev.sh');
      const stats = fs.statSync(setupScriptPath);
      expect(stats.mode & parseInt('111', 8)).toBeTruthy();
    });
  });

  describe('Task 1.3.2: npm run setup:test script', () => {
    it('should have setup:test script in root package.json', () => {
      const packageJsonPath = path.join(rootDir, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      expect(packageJson.scripts).toHaveProperty('setup:test');
      expect(packageJson.scripts['setup:test']).toBeTruthy();
    });

    it('should have setup:test script in backend package.json', () => {
      const packageJsonPath = path.join(backendDir, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      expect(packageJson.scripts).toHaveProperty('setup:test');
      expect(packageJson.scripts['setup:test']).toBeTruthy();
    });

    it('should have setup:test script in frontend package.json', () => {
      const packageJsonPath = path.join(frontendDir, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      expect(packageJson.scripts).toHaveProperty('setup:test');
      expect(packageJson.scripts['setup:test']).toBeTruthy();
    });

    it('should have test environment setup script', () => {
      const setupTestScriptPath = path.join(
        rootDir,
        'scripts',
        'setup-test.js',
      );
      expect(fs.existsSync(setupTestScriptPath)).toBe(true);
    });
  });

  describe('Task 1.3.3: npm run dev script', () => {
    it('should have dev script in root package.json', () => {
      const packageJsonPath = path.join(rootDir, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      expect(packageJson.scripts).toHaveProperty('dev');
      expect(packageJson.scripts.dev).toBeTruthy();
    });

    it('should use concurrently to start all services', () => {
      const packageJsonPath = path.join(rootDir, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      const devScript = packageJson.scripts.dev;
      expect(devScript).toContain('concurrently');
      expect(devScript).toContain('dev:frontend');
      expect(devScript).toContain('dev:backend');
    });

    it('should have dev:frontend and dev:backend scripts', () => {
      const packageJsonPath = path.join(rootDir, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      expect(packageJson.scripts).toHaveProperty('dev:frontend');
      expect(packageJson.scripts).toHaveProperty('dev:backend');
      expect(packageJson.scripts['dev:frontend']).toContain(
        'workspace=frontend',
      );
      expect(packageJson.scripts['dev:backend']).toContain('workspace=backend');
    });

    it('should have concurrently dependency', () => {
      const packageJsonPath = path.join(rootDir, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      const hasInDeps =
        packageJson.dependencies && packageJson.dependencies.concurrently;
      const hasInDevDeps =
        packageJson.devDependencies && packageJson.devDependencies.concurrently;
      expect(hasInDeps || hasInDevDeps).toBeTruthy();
    });
  });

  describe('Task 1.3.4: Setup documentation', () => {
    it('should have docs/development directory', () => {
      const docsPath = path.join(rootDir, 'docs', 'development');
      expect(fs.existsSync(docsPath)).toBe(true);
    });

    it('should have local-setup.md documentation', () => {
      const setupDocsPath = path.join(
        rootDir,
        'docs',
        'development',
        'local-setup.md',
      );
      expect(fs.existsSync(setupDocsPath)).toBe(true);
    });

    it('should have getting-started.md documentation', () => {
      const gettingStartedPath = path.join(
        rootDir,
        'docs',
        'development',
        'getting-started.md',
      );
      expect(fs.existsSync(gettingStartedPath)).toBe(true);
    });

    it('should have troubleshooting.md documentation', () => {
      const troubleshootingPath = path.join(
        rootDir,
        'docs',
        'development',
        'troubleshooting.md',
      );
      expect(fs.existsSync(troubleshootingPath)).toBe(true);
    });

    it('should have test-procedures.md documentation', () => {
      const testProceduresPath = path.join(
        rootDir,
        'docs',
        'development',
        'test-procedures.md',
      );
      expect(fs.existsSync(testProceduresPath)).toBe(true);
    });

    it('should have comprehensive setup documentation content', () => {
      const setupDocsPath = path.join(
        rootDir,
        'docs',
        'development',
        'local-setup.md',
      );
      const content = fs.readFileSync(setupDocsPath, 'utf-8');

      expect(content).toContain('PostgreSQL');
      expect(content).toContain('Redis');
      expect(content).toContain('npm install');
      expect(content).toContain('prisma migrate');
      expect(content).toContain('setup:dev');
    });
  });

  describe('Task 1.3.5: Environment files', () => {
    it('should have root .env.example file', () => {
      const envExamplePath = path.join(rootDir, '.env.example');
      expect(fs.existsSync(envExamplePath)).toBe(true);
    });

    it('should have backend .env.development file', () => {
      const backendEnvPath = path.join(backendDir, '.env.development');
      expect(fs.existsSync(backendEnvPath)).toBe(true);
    });

    it('should have frontend .env.development file', () => {
      const frontendEnvPath = path.join(frontendDir, '.env.development');
      expect(fs.existsSync(frontendEnvPath)).toBe(true);
    });

    it('should have required backend environment variables', () => {
      const backendEnvPath = path.join(backendDir, '.env.development');
      const content = fs.readFileSync(backendEnvPath, 'utf-8');

      const requiredVars = [
        'NODE_ENV',
        'PORT',
        'DATABASE_URL',
        'JWT_SECRET',
        'REDIS_URL',
        'CORS_ORIGIN',
      ];

      requiredVars.forEach((varName) => {
        expect(content).toContain(varName);
      });
    });

    it('should have required frontend environment variables', () => {
      const frontendEnvPath = path.join(frontendDir, '.env.development');
      const content = fs.readFileSync(frontendEnvPath, 'utf-8');

      const requiredVars = ['VITE_API_BASE_URL', 'VITE_API_TIMEOUT'];

      requiredVars.forEach((varName) => {
        expect(content).toContain(varName);
      });
    });

    it('should have comprehensive root .env.example content', () => {
      const envExamplePath = path.join(rootDir, '.env.example');
      const content = fs.readFileSync(envExamplePath, 'utf-8');

      expect(content).toContain('DATABASE_URL');
      expect(content).toContain('JWT_SECRET');
      expect(content).toContain('REDIS_URL');
      expect(content).toContain('NODE_ENV');
    });
  });

  describe('Integration Tests', () => {
    it('should have all required setup scripts working together', () => {
      const packageJsonPath = path.join(rootDir, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      // Check that all setup scripts exist
      const requiredScripts = [
        'setup:dev',
        'setup:test',
        'dev',
        'dev:frontend',
        'dev:backend',
      ];

      requiredScripts.forEach((script) => {
        expect(packageJson.scripts).toHaveProperty(script);
        expect(packageJson.scripts[script]).toBeTruthy();
      });
    });

    it('should have proper workspace configuration', () => {
      const packageJsonPath = path.join(rootDir, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      expect(packageJson.workspaces).toBeDefined();
      expect(packageJson.workspaces).toContain('frontend');
      expect(packageJson.workspaces).toContain('backend');
    });

    it('should have all documentation files with proper content structure', () => {
      const docFiles = [
        'local-setup.md',
        'getting-started.md',
        'troubleshooting.md',
        'test-procedures.md',
      ];

      docFiles.forEach((fileName) => {
        const filePath = path.join(rootDir, 'docs', 'development', fileName);
        expect(fs.existsSync(filePath)).toBe(true);

        const content = fs.readFileSync(filePath, 'utf-8');
        expect(content.length).toBeGreaterThan(100); // Should have substantial content
        expect(content).toContain('#'); // Should have markdown headers
      });
    });
  });
});
