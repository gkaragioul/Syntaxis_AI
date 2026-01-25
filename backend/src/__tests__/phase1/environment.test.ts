import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';

describe('Environment Configuration', () => {
  const envFiles = [
    '.env.example',
    '.env.development',
    '.env.test',
    '.env.production',
  ];

  const requiredEnvVars = [
    'NODE_ENV',
    'PORT',
    'DATABASE_URL',
    'REDIS_URL',
    'JWT_SECRET',
    'STORAGE_BUCKET',
    'EMAIL_FROM',
    'LOG_LEVEL',
  ];

  describe('Environment Files', () => {
    it('should have all required environment files', () => {
      envFiles.forEach((file) => {
        const filePath = path.join(process.cwd(), file);
        expect(fs.existsSync(filePath)).toBe(true);
      });
    });

    it('should have consistent structure across all env files', () => {
      envFiles.forEach((file) => {
        const filePath = path.join(process.cwd(), file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content
          .split('\n')
          .filter((line) => line.trim() && !line.startsWith('#'));

        // Check for proper KEY=VALUE format
        lines.forEach((line) => {
          expect(line).toMatch(/^[A-Z_]+=.+$/);
        });

        // Check for no duplicate keys
        const keys = lines.map((line) => line.split('=')[0]);
        const uniqueKeys = new Set(keys);
        expect(keys.length).toBe(uniqueKeys.size);
      });
    });

    it('should have all required variables in .env.example', () => {
      const examplePath = path.join(process.cwd(), '.env.example');
      const content = fs.readFileSync(examplePath, 'utf-8');
      const keys = content
        .split('\n')
        .filter((line) => line.trim() && !line.startsWith('#'))
        .map((line) => line.split('=')[0]);

      requiredEnvVars.forEach((varName) => {
        expect(keys).toContain(varName);
      });
    });

    it('should have proper documentation in .env.example', () => {
      const examplePath = path.join(process.cwd(), '.env.example');
      const content = fs.readFileSync(examplePath, 'utf-8');
      const lines = content.split('\n');

      // Check for documentation comments
      let hasDocumentation = false;
      lines.forEach((line) => {
        if (line.startsWith('#')) {
          hasDocumentation = true;
        }
      });
      expect(hasDocumentation).toBe(true);
    });
  });

  describe('Environment Variables', () => {
    beforeEach(() => {
      // Load test environment
      config({ path: '.env.test' });
    });

    it('should have all required variables set in test environment', () => {
      requiredEnvVars.forEach((varName) => {
        expect(process.env[varName]).toBeDefined();
      });
    });

    it('should have valid values for critical variables', () => {
      // Check NODE_ENV
      expect(['development', 'test', 'production']).toContain(
        process.env.NODE_ENV,
      );

      // Check PORT
      const port = parseInt(process.env.PORT || '');
      expect(port).toBeGreaterThan(0);
      expect(port).toBeLessThan(65536);

      // Check DATABASE_URL
      expect(process.env.DATABASE_URL).toMatch(/^postgresql:\/\/.+/);

      // Check REDIS_URL
      expect(process.env.REDIS_URL).toMatch(/^redis:\/\/.+/);

      // Check JWT_SECRET
      expect(process.env.JWT_SECRET).toHaveLength(32);

      // Check LOG_LEVEL
      expect(['error', 'warn', 'info', 'debug']).toContain(
        process.env.LOG_LEVEL,
      );
    });

    it('should have different values for different environments', () => {
      // Load development environment
      config({ path: '.env.development' });
      const devPort = process.env.PORT;
      const devDbUrl = process.env.DATABASE_URL;

      // Load test environment
      config({ path: '.env.test' });
      const testPort = process.env.PORT;
      const testDbUrl = process.env.DATABASE_URL;

      // Load production environment
      config({ path: '.env.production' });
      const prodPort = process.env.PORT;
      const prodDbUrl = process.env.DATABASE_URL;

      // Check for different values
      expect(devPort).not.toBe(testPort);
      expect(devPort).not.toBe(prodPort);
      expect(testPort).not.toBe(prodPort);

      expect(devDbUrl).not.toBe(testDbUrl);
      expect(devDbUrl).not.toBe(prodDbUrl);
      expect(testDbUrl).not.toBe(prodDbUrl);
    });
  });

  describe('Environment Documentation', () => {
    it('should have environment variables documented', () => {
      const docsPath = path.join(process.cwd(), 'docs', 'environment.md');
      expect(fs.existsSync(docsPath)).toBe(true);

      const content = fs.readFileSync(docsPath, 'utf-8');
      requiredEnvVars.forEach((varName) => {
        expect(content).toContain(varName);
      });
    });

    it('should document environment-specific configurations', () => {
      const docsPath = path.join(process.cwd(), 'docs', 'environment.md');
      const content = fs.readFileSync(docsPath, 'utf-8');

      // Check for environment-specific sections
      expect(content).toContain('Development Environment');
      expect(content).toContain('Test Environment');
      expect(content).toContain('Production Environment');
    });
  });
});
