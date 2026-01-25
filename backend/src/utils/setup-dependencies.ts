import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * Dependency Setup Utility
 * Implements lines 93-98 of scratchpad with TDD best practices
 */

export interface SetupResult {
  success: boolean;
  message: string;
  details?: string[];
  errors?: string[];
}

export interface DependencyCheckResult {
  installed: boolean;
  version?: string;
  path?: string;
}

export class DependencySetupManager {
  private rootDir: string;
  private backendDir: string;
  private frontendDir: string;

  constructor(rootDir?: string) {
    this.rootDir = rootDir || path.resolve(__dirname, '../../../..');
    this.backendDir = path.join(this.rootDir, 'backend');
    this.frontendDir = path.join(this.rootDir, 'frontend');
  }

  /**
   * Task 1.2.1: Install backend dependencies
   */
  async installBackendDependencies(): Promise<SetupResult> {
    try {
      const packageJsonPath = path.join(this.backendDir, 'package.json');

      if (!fs.existsSync(packageJsonPath)) {
        return {
          success: false,
          message: 'Backend package.json not found',
          errors: [`Package.json not found at ${packageJsonPath}`],
        };
      }

      // Check if node_modules already exists and is valid
      const nodeModulesPath = path.join(this.backendDir, 'node_modules');
      const packageLockPath = path.join(this.backendDir, 'package-lock.json');

      if (fs.existsSync(nodeModulesPath) && fs.existsSync(packageLockPath)) {
        const isValid = await this.validateBackendDependencies();
        if (isValid.success) {
          return {
            success: true,
            message: 'Backend dependencies already installed and valid',
            details: ['Skipped installation - dependencies are up to date'],
          };
        }
      }

      // Install dependencies
      console.log('Installing backend dependencies...');
      execSync('npm install', {
        cwd: this.backendDir,
        stdio: 'inherit',
        timeout: 300000, // 5 minutes timeout
      });

      // Validate installation
      const validation = await this.validateBackendDependencies();
      return validation;
    } catch (error) {
      return {
        success: false,
        message: 'Failed to install backend dependencies',
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  /**
   * Task 1.2.2: Install frontend dependencies
   */
  async installFrontendDependencies(): Promise<SetupResult> {
    try {
      const packageJsonPath = path.join(this.frontendDir, 'package.json');

      if (!fs.existsSync(packageJsonPath)) {
        return {
          success: false,
          message: 'Frontend package.json not found',
          errors: [`Package.json not found at ${packageJsonPath}`],
        };
      }

      // Check if node_modules already exists and is valid
      const nodeModulesPath = path.join(this.frontendDir, 'node_modules');
      const packageLockPath = path.join(this.frontendDir, 'package-lock.json');

      if (fs.existsSync(nodeModulesPath) && fs.existsSync(packageLockPath)) {
        const isValid = await this.validateFrontendDependencies();
        if (isValid.success) {
          return {
            success: true,
            message: 'Frontend dependencies already installed and valid',
            details: ['Skipped installation - dependencies are up to date'],
          };
        }
      }

      // Install dependencies
      console.log('Installing frontend dependencies...');
      execSync('npm install', {
        cwd: this.frontendDir,
        stdio: 'inherit',
        timeout: 300000, // 5 minutes timeout
      });

      // Validate installation
      const validation = await this.validateFrontendDependencies();
      return validation;
    } catch (error) {
      return {
        success: false,
        message: 'Failed to install frontend dependencies',
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  /**
   * Task 1.2.3: Install root dependencies
   */
  async installRootDependencies(): Promise<SetupResult> {
    try {
      const packageJsonPath = path.join(this.rootDir, 'package.json');

      if (!fs.existsSync(packageJsonPath)) {
        return {
          success: false,
          message: 'Root package.json not found',
          errors: [`Package.json not found at ${packageJsonPath}`],
        };
      }

      // Check if node_modules already exists and is valid
      const nodeModulesPath = path.join(this.rootDir, 'node_modules');
      const packageLockPath = path.join(this.rootDir, 'package-lock.json');

      if (fs.existsSync(nodeModulesPath) && fs.existsSync(packageLockPath)) {
        const isValid = await this.validateRootDependencies();
        if (isValid.success) {
          return {
            success: true,
            message: 'Root dependencies already installed and valid',
            details: ['Skipped installation - dependencies are up to date'],
          };
        }
      }

      // Install dependencies
      console.log('Installing root dependencies...');
      execSync('npm install', {
        cwd: this.rootDir,
        stdio: 'inherit',
        timeout: 300000, // 5 minutes timeout
      });

      // Validate installation
      const validation = await this.validateRootDependencies();
      return validation;
    } catch (error) {
      return {
        success: false,
        message: 'Failed to install root dependencies',
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  /**
   * Task 1.2.4: Set up environment variables
   */
  async setupEnvironmentVariables(): Promise<SetupResult> {
    try {
      const results: string[] = [];
      const errors: string[] = [];

      // Backend environment setup
      const backendEnvPath = path.join(this.backendDir, '.env.development');
      if (!fs.existsSync(backendEnvPath)) {
        const examplePath = path.join(this.rootDir, '.env.example');
        if (fs.existsSync(examplePath)) {
          fs.copyFileSync(examplePath, backendEnvPath);
          results.push('Created backend/.env.development from .env.example');
        } else {
          errors.push('Backend .env.example not found');
        }
      } else {
        results.push('Backend .env.development already exists');
      }

      // Frontend environment setup
      const frontendEnvPath = path.join(this.frontendDir, '.env.development');
      if (!fs.existsSync(frontendEnvPath)) {
        // Frontend has its own environment structure
        const frontendEnvContent = this.generateFrontendEnvContent();
        fs.writeFileSync(frontendEnvPath, frontendEnvContent);
        results.push('Created frontend/.env.development');
      } else {
        results.push('Frontend .env.development already exists');
      }

      // Validate environment files
      const validation = await this.validateEnvironmentFiles();
      if (!validation.success) {
        errors.push(...(validation.errors || []));
      }

      return {
        success: errors.length === 0,
        message:
          errors.length === 0
            ? 'Environment variables setup completed'
            : 'Environment setup completed with warnings',
        details: results,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to setup environment variables',
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  /**
   * Task 1.2.5: Run Prisma migrations
   */
  async runPrismaMigrations(): Promise<SetupResult> {
    try {
      const schemaPath = path.join(this.backendDir, 'prisma', 'schema.prisma');

      if (!fs.existsSync(schemaPath)) {
        return {
          success: false,
          message: 'Prisma schema not found',
          errors: [`Schema not found at ${schemaPath}`],
        };
      }

      const results: string[] = [];

      // Generate Prisma client
      console.log('Generating Prisma client...');
      execSync('npx prisma generate', {
        cwd: this.backendDir,
        stdio: 'inherit',
        timeout: 120000, // 2 minutes timeout
      });
      results.push('Prisma client generated');

      // Run migrations in development mode
      console.log('Running Prisma migrations...');
      execSync('npx prisma migrate dev --name init', {
        cwd: this.backendDir,
        stdio: 'inherit',
        timeout: 120000, // 2 minutes timeout
      });
      results.push('Database migrations completed');

      return {
        success: true,
        message: 'Prisma migrations completed successfully',
        details: results,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to run Prisma migrations',
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  /**
   * Run all setup tasks in sequence
   */
  async runFullSetup(): Promise<SetupResult> {
    const results: string[] = [];
    const errors: string[] = [];

    console.log('🚀 Starting full dependency setup...\n');

    // Task 1.2.3: Root dependencies first (for workspace management)
    console.log('📦 Installing root dependencies...');
    const rootResult = await this.installRootDependencies();
    if (rootResult.success) {
      results.push(rootResult.message);
      if (rootResult.details) results.push(...rootResult.details);
    } else {
      errors.push(rootResult.message);
      if (rootResult.errors) errors.push(...rootResult.errors);
    }

    // Task 1.2.1: Backend dependencies
    console.log('\n🔧 Installing backend dependencies...');
    const backendResult = await this.installBackendDependencies();
    if (backendResult.success) {
      results.push(backendResult.message);
      if (backendResult.details) results.push(...backendResult.details);
    } else {
      errors.push(backendResult.message);
      if (backendResult.errors) errors.push(...backendResult.errors);
    }

    // Task 1.2.2: Frontend dependencies
    console.log('\n⚛️ Installing frontend dependencies...');
    const frontendResult = await this.installFrontendDependencies();
    if (frontendResult.success) {
      results.push(frontendResult.message);
      if (frontendResult.details) results.push(...frontendResult.details);
    } else {
      errors.push(frontendResult.message);
      if (frontendResult.errors) errors.push(...frontendResult.errors);
    }

    // Task 1.2.4: Environment variables
    console.log('\n🔐 Setting up environment variables...');
    const envResult = await this.setupEnvironmentVariables();
    if (envResult.success) {
      results.push(envResult.message);
      if (envResult.details) results.push(...envResult.details);
    } else {
      errors.push(envResult.message);
      if (envResult.errors) errors.push(...envResult.errors);
    }

    // Task 1.2.5: Prisma migrations (only if backend setup succeeded)
    if (backendResult.success) {
      console.log('\n🗄️ Running Prisma migrations...');
      const migrationResult = await this.runPrismaMigrations();
      if (migrationResult.success) {
        results.push(migrationResult.message);
        if (migrationResult.details) results.push(...migrationResult.details);
      } else {
        errors.push(migrationResult.message);
        if (migrationResult.errors) errors.push(...migrationResult.errors);
      }
    } else {
      errors.push('Skipped Prisma migrations due to backend setup failure');
    }

    const success = errors.length === 0;
    console.log(
      success
        ? '\n✅ Setup completed successfully!'
        : '\n❌ Setup completed with errors',
    );

    return {
      success,
      message: success
        ? 'All dependency setup tasks completed successfully'
        : 'Setup completed with errors',
      details: results,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  // Private validation methods
  private async validateBackendDependencies(): Promise<SetupResult> {
    // Implementation for backend dependency validation
    const criticalPackages = [
      'express',
      '@prisma/client',
      'typescript',
      'jest',
    ];
    const missing: string[] = [];

    for (const pkg of criticalPackages) {
      const packagePath = path.join(this.backendDir, 'node_modules', pkg);
      if (!fs.existsSync(packagePath)) {
        missing.push(pkg);
      }
    }

    return {
      success: missing.length === 0,
      message:
        missing.length === 0
          ? 'Backend dependencies validated'
          : 'Missing backend dependencies',
      errors:
        missing.length > 0
          ? [`Missing packages: ${missing.join(', ')}`]
          : undefined,
    };
  }

  private async validateFrontendDependencies(): Promise<SetupResult> {
    // Implementation for frontend dependency validation
    const criticalPackages = ['react', 'react-dom', 'vite', 'typescript'];
    const missing: string[] = [];

    for (const pkg of criticalPackages) {
      const packagePath = path.join(this.frontendDir, 'node_modules', pkg);
      if (!fs.existsSync(packagePath)) {
        missing.push(pkg);
      }
    }

    return {
      success: missing.length === 0,
      message:
        missing.length === 0
          ? 'Frontend dependencies validated'
          : 'Missing frontend dependencies',
      errors:
        missing.length > 0
          ? [`Missing packages: ${missing.join(', ')}`]
          : undefined,
    };
  }

  private async validateRootDependencies(): Promise<SetupResult> {
    // Implementation for root dependency validation
    const criticalPackages = [
      'concurrently',
      'typescript',
      'eslint',
      'prettier',
    ];
    const missing: string[] = [];

    for (const pkg of criticalPackages) {
      const packagePath = path.join(this.rootDir, 'node_modules', pkg);
      if (!fs.existsSync(packagePath)) {
        missing.push(pkg);
      }
    }

    return {
      success: missing.length === 0,
      message:
        missing.length === 0
          ? 'Root dependencies validated'
          : 'Missing root dependencies',
      errors:
        missing.length > 0
          ? [`Missing packages: ${missing.join(', ')}`]
          : undefined,
    };
  }

  private async validateEnvironmentFiles(): Promise<SetupResult> {
    const errors: string[] = [];

    // Check backend environment
    const backendEnvPath = path.join(this.backendDir, '.env.development');
    if (fs.existsSync(backendEnvPath)) {
      const content = fs.readFileSync(backendEnvPath, 'utf-8');
      const requiredVars = ['NODE_ENV', 'PORT', 'DATABASE_URL', 'JWT_SECRET'];

      for (const varName of requiredVars) {
        if (!content.includes(varName)) {
          errors.push(`Missing ${varName} in backend environment`);
        }
      }
    } else {
      errors.push('Backend .env.development not found');
    }

    // Check frontend environment
    const frontendEnvPath = path.join(this.frontendDir, '.env.development');
    if (fs.existsSync(frontendEnvPath)) {
      const content = fs.readFileSync(frontendEnvPath, 'utf-8');
      const requiredVars = ['VITE_API_BASE_URL'];

      for (const varName of requiredVars) {
        if (!content.includes(varName)) {
          errors.push(`Missing ${varName} in frontend environment`);
        }
      }
    } else {
      errors.push('Frontend .env.development not found');
    }

    return {
      success: errors.length === 0,
      message:
        errors.length === 0
          ? 'Environment files validated'
          : 'Environment validation failed',
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  private generateFrontendEnvContent(): string {
    return `# API Configuration
VITE_API_BASE_URL=http://localhost:3001
VITE_API_TIMEOUT=30000

# Feature Flags
VITE_ENABLE_MOCK_API=false
VITE_ENABLE_ANALYTICS=false

# Upload Configuration
VITE_MAX_FILE_SIZE=104857600  # 100MB in bytes
VITE_ALLOWED_FILE_TYPES=application/pdf
VITE_MAX_FILES_PER_BATCH=50

# Development Tools
VITE_ENABLE_DEVTOOLS=true
VITE_ENABLE_LOGGING=true
VITE_LOG_LEVEL=debug

# Security
VITE_CORS_ORIGIN=http://localhost:5173
VITE_RATE_LIMIT_WINDOW_MS=60000
VITE_RATE_LIMIT_MAX=1000
`;
  }
}
