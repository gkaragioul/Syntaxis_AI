import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

interface RequiredEnvVar {
  name: string;
  description: string;
  validator?: (value: string) => boolean;
}

const REQUIRED_ENV_VARS: RequiredEnvVar[] = [
  {
    name: 'DATABASE_URL',
    description: 'PostgreSQL connection string',
    validator: (val) => val.startsWith('postgresql://'),
  },
  {
    name: 'JWT_SECRET',
    description: 'JWT signing secret (min 32 characters)',
    validator: (val) => val.length >= 32 && val !== 'your-super-secret-jwt-key' && val !== 'development-secret-key-32-charsx',
  },
  {
    name: 'JWT_REFRESH_SECRET',
    description: 'JWT refresh token secret (min 32 characters)',
    validator: (val) => val.length >= 32 && val !== 'your-super-secret-refresh-key',
  },
  {
    name: 'NODE_ENV',
    description: 'Node environment (development/production)',
    validator: (val) => ['development', 'production', 'test'].includes(val),
  },
];

const RECOMMENDED_ENV_VARS: RequiredEnvVar[] = [
  { name: 'PORT', description: 'Server port (default: 3001)' },
  { name: 'APP_URL', description: 'Application URL for emails and redirects' },
  { name: 'FRONTEND_URL', description: 'Frontend URL for CORS' },
  { name: 'EMAIL_SMTP_HOST', description: 'SMTP host for email delivery' },
  { name: 'EMAIL_SMTP_USER', description: 'SMTP username' },
  { name: 'EMAIL_FROM_ADDRESS', description: 'From address for emails' },
  { name: 'REDIS_URL', description: 'Redis connection URL (optional)' },
];

export function validateEnvironment(): void {
  const errors: string[] = [];
  const warnings: string[] = [];

  console.log('🔍 Validating environment configuration...\n');

  // Check required variables
  for (const envVar of REQUIRED_ENV_VARS) {
    const value = process.env[envVar.name];

    if (!value) {
      errors.push(`❌ Missing required environment variable: ${envVar.name}`);
      errors.push(`   Description: ${envVar.description}`);
      continue;
    }

    if (envVar.validator && !envVar.validator(value)) {
      errors.push(`❌ Invalid value for ${envVar.name}`);
      errors.push(`   Description: ${envVar.description}`);
      errors.push(`   Current value: ${value.substring(0, 20)}...`);
    } else {
      console.log(`✅ ${envVar.name}`);
    }
  }

  // Check recommended variables
  for (const envVar of RECOMMENDED_ENV_VARS) {
    const value = process.env[envVar.name];

    if (!value) {
      warnings.push(`⚠️  Missing recommended variable: ${envVar.name}`);
      warnings.push(`   Description: ${envVar.description}`);
    } else {
      console.log(`✅ ${envVar.name}`);
    }
  }

  console.log('');

  // Print warnings
  if (warnings.length > 0) {
    console.warn('⚠️  WARNINGS:\n');
    warnings.forEach((warning) => console.warn(warning));
    console.warn('');
  }

  // Print errors and exit if any critical issues
  if (errors.length > 0) {
    console.error('❌ ENVIRONMENT VALIDATION FAILED:\n');
    errors.forEach((error) => console.error(error));
    console.error('\n');
    console.error('Please check your .env file and ensure all required variables are set.');
    console.error('Refer to backend/env.production.template for examples.\n');
    
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    } else {
      console.warn('⚠️  Running in development mode with invalid configuration - this is not recommended!\n');
    }
  } else {
    console.log('✅ Environment validation passed\n');
  }
}

export default validateEnvironment;
