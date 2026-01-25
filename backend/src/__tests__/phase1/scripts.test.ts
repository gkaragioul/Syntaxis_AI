import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

describe('Project Scripts', () => {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

  describe('Package.json Scripts', () => {
    it('should have all required scripts', () => {
      const requiredScripts = [
        'start',
        'dev',
        'build',
        'test',
        'test:watch',
        'test:coverage',
        'lint',
        'lint:fix',
        'format',
        'clean',
        'typecheck',
      ];

      requiredScripts.forEach((script) => {
        expect(packageJson.scripts).toHaveProperty(script);
      });
    });

    it('should have proper script commands', () => {
      const scripts = packageJson.scripts;

      // Start script
      expect(scripts.start).toMatch(/node dist\/index\.js/);

      // Dev script
      expect(scripts.dev).toMatch(/nodemon/);

      // Build script
      expect(scripts.build).toMatch(/tsc/);

      // Test scripts
      expect(scripts.test).toMatch(/jest/);
      expect(scripts['test:watch']).toMatch(/jest --watch/);
      expect(scripts['test:coverage']).toMatch(/jest --coverage/);

      // Lint scripts
      expect(scripts.lint).toMatch(/eslint/);
      expect(scripts['lint:fix']).toMatch(/eslint --fix/);

      // Format script
      expect(scripts.format).toMatch(/prettier/);

      // Clean script
      expect(scripts.clean).toMatch(/rimraf/);

      // Typecheck script
      expect(scripts.typecheck).toMatch(/tsc --noEmit/);
    });
  });

  describe('Script Execution', () => {
    it('should run typecheck without errors', () => {
      expect(() => {
        execSync('npm run typecheck', { stdio: 'ignore' });
      }).not.toThrow();
    });

    it('should run lint without errors', () => {
      expect(() => {
        execSync('npm run lint', { stdio: 'ignore' });
      }).not.toThrow();
    });

    it('should run tests successfully', () => {
      expect(() => {
        execSync('npm test', { stdio: 'ignore' });
      }).not.toThrow();
    });

    it('should build successfully', () => {
      // Clean first
      execSync('npm run clean', { stdio: 'ignore' });

      expect(() => {
        execSync('npm run build', { stdio: 'ignore' });
      }).not.toThrow();

      // Verify build output
      const distPath = path.join(process.cwd(), 'dist');
      expect(fs.existsSync(distPath)).toBe(true);
      expect(fs.existsSync(path.join(distPath, 'index.js'))).toBe(true);
    });
  });

  describe('Development Scripts', () => {
    it('should have proper dev dependencies', () => {
      const requiredDevDeps = [
        'typescript',
        'jest',
        'ts-jest',
        '@types/jest',
        'eslint',
        'prettier',
        'nodemon',
        'rimraf',
      ];

      requiredDevDeps.forEach((dep) => {
        expect(packageJson.devDependencies).toHaveProperty(dep);
      });
    });

    it('should have proper TypeScript configuration', () => {
      const tsConfigPath = path.join(process.cwd(), 'tsconfig.json');
      expect(fs.existsSync(tsConfigPath)).toBe(true);

      const tsConfig = JSON.parse(fs.readFileSync(tsConfigPath, 'utf-8'));
      expect(tsConfig.compilerOptions).toBeDefined();
      expect(tsConfig.include).toContain('src/**/*');
      expect(tsConfig.exclude).toContain('node_modules');
      expect(tsConfig.exclude).toContain('dist');
    });

    it('should have proper ESLint configuration', () => {
      const eslintConfigPath = path.join(process.cwd(), '.eslintrc.js');
      expect(fs.existsSync(eslintConfigPath)).toBe(true);

      const eslintConfig = require(eslintConfigPath);
      expect(eslintConfig.parser).toBe('@typescript-eslint/parser');
      expect(eslintConfig.plugins).toContain('@typescript-eslint');
      expect(eslintConfig.extends).toContain('eslint:recommended');
    });

    it('should have proper Prettier configuration', () => {
      const prettierConfigPath = path.join(process.cwd(), '.prettierrc');
      expect(fs.existsSync(prettierConfigPath)).toBe(true);

      const prettierConfig = JSON.parse(
        fs.readFileSync(prettierConfigPath, 'utf-8'),
      );
      expect(prettierConfig.semi).toBeDefined();
      expect(prettierConfig.singleQuote).toBeDefined();
      expect(prettierConfig.trailingComma).toBeDefined();
    });
  });

  describe('Documentation', () => {
    it('should have README with script documentation', () => {
      const readmePath = path.join(process.cwd(), 'README.md');
      expect(fs.existsSync(readmePath)).toBe(true);

      const content = fs.readFileSync(readmePath, 'utf-8');
      expect(content).toContain('## Scripts');
      expect(content).toContain('npm run dev');
      expect(content).toContain('npm run build');
      expect(content).toContain('npm test');
    });

    it('should have development documentation', () => {
      const devDocsPath = path.join(process.cwd(), 'docs', 'development.md');
      expect(fs.existsSync(devDocsPath)).toBe(true);

      const content = fs.readFileSync(devDocsPath, 'utf-8');
      expect(content).toContain('Development Setup');
      expect(content).toContain('Available Scripts');
      expect(content).toContain('Code Style');
    });
  });

  describe('Git Hooks', () => {
    it('should have proper husky configuration', () => {
      const huskyPath = path.join(process.cwd(), '.husky');
      expect(fs.existsSync(huskyPath)).toBe(true);

      // Check pre-commit hook
      const preCommitPath = path.join(huskyPath, 'pre-commit');
      expect(fs.existsSync(preCommitPath)).toBe(true);
      expect(fs.readFileSync(preCommitPath, 'utf-8')).toContain('npm run lint');
      expect(fs.readFileSync(preCommitPath, 'utf-8')).toContain(
        'npm run typecheck',
      );

      // Check pre-push hook
      const prePushPath = path.join(huskyPath, 'pre-push');
      expect(fs.existsSync(prePushPath)).toBe(true);
      expect(fs.readFileSync(prePushPath, 'utf-8')).toContain('npm test');
    });

    it('should have lint-staged configuration', () => {
      const lintStagedPath = path.join(process.cwd(), '.lintstagedrc');
      expect(fs.existsSync(lintStagedPath)).toBe(true);

      const lintStagedConfig = JSON.parse(
        fs.readFileSync(lintStagedPath, 'utf-8'),
      );
      expect(lintStagedConfig['*.{js,ts}']).toBeDefined();
      expect(lintStagedConfig['*.{json,md}']).toBeDefined();
    });
  });
});
