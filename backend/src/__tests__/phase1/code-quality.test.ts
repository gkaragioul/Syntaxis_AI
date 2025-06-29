import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

describe('Code Quality Tools', () => {
  describe('ESLint Configuration', () => {
    const eslintConfigPath = path.join(process.cwd(), '.eslintrc.js');
    const eslintConfig = require(eslintConfigPath);

    it('should have proper ESLint configuration', () => {
      expect(eslintConfig).toBeDefined();
      expect(eslintConfig.parser).toBe('@typescript-eslint/parser');
      expect(eslintConfig.plugins).toContain('@typescript-eslint');
      expect(eslintConfig.extends).toContain('eslint:recommended');
    });

    it('should have proper TypeScript ESLint configuration', () => {
      expect(eslintConfig.parserOptions).toBeDefined();
      expect(eslintConfig.parserOptions.ecmaVersion).toBe(2020);
      expect(eslintConfig.parserOptions.sourceType).toBe('module');
      expect(eslintConfig.parserOptions.project).toBe('./tsconfig.json');
    });

    it('should have proper rules configuration', () => {
      expect(eslintConfig.rules).toBeDefined();
      expect(
        eslintConfig.rules['@typescript-eslint/explicit-function-return-type'],
      ).toBeDefined();
      expect(
        eslintConfig.rules['@typescript-eslint/no-explicit-any'],
      ).toBeDefined();
      expect(
        eslintConfig.rules['@typescript-eslint/no-unused-vars'],
      ).toBeDefined();
    });

    it('should have proper ignore patterns', () => {
      const eslintIgnorePath = path.join(process.cwd(), '.eslintignore');
      expect(fs.existsSync(eslintIgnorePath)).toBe(true);

      const ignoreContent = fs.readFileSync(eslintIgnorePath, 'utf-8');
      expect(ignoreContent).toContain('node_modules');
      expect(ignoreContent).toContain('dist');
      expect(ignoreContent).toContain('coverage');
    });

    it('should run ESLint without errors', () => {
      expect(() => {
        execSync('npm run lint', { stdio: 'ignore' });
      }).not.toThrow();
    });
  });

  describe('Prettier Configuration', () => {
    const prettierConfigPath = path.join(process.cwd(), '.prettierrc');
    const prettierConfig = JSON.parse(
      fs.readFileSync(prettierConfigPath, 'utf-8'),
    );

    it('should have proper Prettier configuration', () => {
      expect(prettierConfig).toBeDefined();
      expect(prettierConfig.semi).toBeDefined();
      expect(prettierConfig.singleQuote).toBeDefined();
      expect(prettierConfig.trailingComma).toBeDefined();
      expect(prettierConfig.printWidth).toBeDefined();
      expect(prettierConfig.tabWidth).toBeDefined();
    });

    it('should have proper ignore patterns', () => {
      const prettierIgnorePath = path.join(process.cwd(), '.prettierignore');
      expect(fs.existsSync(prettierIgnorePath)).toBe(true);

      const ignoreContent = fs.readFileSync(prettierIgnorePath, 'utf-8');
      expect(ignoreContent).toContain('node_modules');
      expect(ignoreContent).toContain('dist');
      expect(ignoreContent).toContain('coverage');
    });

    it('should run Prettier without errors', () => {
      expect(() => {
        execSync('npm run format', { stdio: 'ignore' });
      }).not.toThrow();
    });
  });

  describe('TypeScript Configuration', () => {
    const tsConfigPath = path.join(process.cwd(), 'tsconfig.json');
    const tsConfig = JSON.parse(fs.readFileSync(tsConfigPath, 'utf-8'));

    it('should have proper TypeScript configuration', () => {
      expect(tsConfig).toBeDefined();
      expect(tsConfig.compilerOptions).toBeDefined();
      expect(tsConfig.include).toContain('src/**/*');
      expect(tsConfig.exclude).toContain('node_modules');
      expect(tsConfig.exclude).toContain('dist');
    });

    it('should have proper compiler options', () => {
      const options = tsConfig.compilerOptions;
      expect(options.target).toBe('es2020');
      expect(options.module).toBe('commonjs');
      expect(options.strict).toBe(true);
      expect(options.esModuleInterop).toBe(true);
      expect(options.skipLibCheck).toBe(true);
      expect(options.forceConsistentCasingInFileNames).toBe(true);
    });

    it('should run type checking without errors', () => {
      expect(() => {
        execSync('npm run typecheck', { stdio: 'ignore' });
      }).not.toThrow();
    });
  });

  describe('Jest Configuration', () => {
    const jestConfigPath = path.join(process.cwd(), 'jest.config.js');
    const jestConfig = require(jestConfigPath);

    it('should have proper Jest configuration', () => {
      expect(jestConfig).toBeDefined();
      expect(jestConfig.preset).toBe('ts-jest');
      expect(jestConfig.testEnvironment).toBe('node');
      expect(jestConfig.roots).toContain('<rootDir>/src');
    });

    it('should have proper coverage configuration', () => {
      expect(jestConfig.coverageDirectory).toBe('coverage');
      expect(jestConfig.coverageReporters).toContain('text');
      expect(jestConfig.coverageReporters).toContain('lcov');
      expect(jestConfig.coverageThreshold).toBeDefined();
    });

    it('should have proper test patterns', () => {
      expect(jestConfig.testMatch).toContain('**/__tests__/**/*.test.ts');
      expect(jestConfig.testMatch).toContain('**/?(*.)+(spec|test).ts');
    });

    it('should run tests with coverage', () => {
      expect(() => {
        execSync('npm run test:coverage', { stdio: 'ignore' });
      }).not.toThrow();

      const coveragePath = path.join(process.cwd(), 'coverage');
      expect(fs.existsSync(coveragePath)).toBe(true);
      expect(fs.existsSync(path.join(coveragePath, 'lcov-report'))).toBe(true);
    });
  });

  describe('Editor Configuration', () => {
    it('should have proper VS Code settings', () => {
      const vscodeSettingsPath = path.join(
        process.cwd(),
        '.vscode',
        'settings.json',
      );
      expect(fs.existsSync(vscodeSettingsPath)).toBe(true);

      const settings = JSON.parse(fs.readFileSync(vscodeSettingsPath, 'utf-8'));
      expect(settings['editor.formatOnSave']).toBe(true);
      expect(settings['editor.codeActionsOnSave']).toBeDefined();
      expect(settings['typescript.tsdk']).toBeDefined();
    });

    it('should have proper VS Code extensions', () => {
      const vscodeExtensionsPath = path.join(
        process.cwd(),
        '.vscode',
        'extensions.json',
      );
      expect(fs.existsSync(vscodeExtensionsPath)).toBe(true);

      const extensions = JSON.parse(
        fs.readFileSync(vscodeExtensionsPath, 'utf-8'),
      );
      expect(extensions.recommendations).toContain('dbaeumer.vscode-eslint');
      expect(extensions.recommendations).toContain('esbenp.prettier-vscode');
    });
  });

  describe('Documentation', () => {
    it('should have code quality documentation', () => {
      const docsPath = path.join(process.cwd(), 'docs', 'code-quality.md');
      expect(fs.existsSync(docsPath)).toBe(true);

      const content = fs.readFileSync(docsPath, 'utf-8');
      expect(content).toContain('Code Style');
      expect(content).toContain('Linting');
      expect(content).toContain('Formatting');
      expect(content).toContain('Type Checking');
      expect(content).toContain('Testing');
    });

    it('should have editor setup documentation', () => {
      const docsPath = path.join(process.cwd(), 'docs', 'editor-setup.md');
      expect(fs.existsSync(docsPath)).toBe(true);

      const content = fs.readFileSync(docsPath, 'utf-8');
      expect(content).toContain('VS Code Setup');
      expect(content).toContain('Recommended Extensions');
      expect(content).toContain('Editor Settings');
    });
  });
});
