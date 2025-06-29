# Local Development Setup Guide

## Overview

This guide walks you through setting up SyntaxisAI for local development, implementing Task 1.3.4 from the scratchpad with comprehensive setup instructions.

## Prerequisites

### System Requirements

- **Node.js**: Version 18.0.0 or higher
- **npm**: Version 8.0.0 or higher
- **PostgreSQL**: Version 15 or higher
- **Redis**: Version 6.0 or higher
- **Git**: Latest version

### Operating System Support

- **macOS**: Fully supported (recommended for development)
- **Linux**: Ubuntu 20.04+ or equivalent
- **Windows**: WSL2 recommended

## Installation Steps

### 1. Install System Dependencies

#### macOS (using Homebrew)

```bash
# Install Homebrew if not already installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install PostgreSQL
brew install postgresql@15

# Install Redis
brew install redis

# Start services
brew services start postgresql@15
brew services start redis
```

#### Ubuntu/Debian

```bash
# Update package list
sudo apt update

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# Install Redis
sudo apt install redis-server

# Start services
sudo systemctl start postgresql
sudo systemctl start redis-server
sudo systemctl enable postgresql
sudo systemctl enable redis-server
```

### 2. Clone and Setup Project

```bash
# Clone the repository
git clone <repository-url>
cd SyntaxisAI

# Install dependencies
npm install

# Install workspace dependencies
npm run setup:dependencies
```

### 3. Database Setup

```bash
# Create development database
createdb syntaxis_ai

# Create test database
createdb syntaxis_ai_test

# Run database migrations
cd backend && npm run migrate

# Seed development database (optional)
cd backend && npm run db:seed
```

### 4. Environment Configuration

```bash
# Setup environment variables
npm run setup:dependencies:env

# Or manually copy environment files
cp .env.example .env
cp backend/.env.development backend/.env
cp frontend/.env.development frontend/.env
```

### 5. Verify Installation

```bash
# Run tests to verify setup
npm run setup:test
npm test

# Start development servers
npm run dev
```

## Environment Variables

### Backend Environment (`.env.development`)

```env
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://postgres:password@localhost:5432/syntaxis_ai
JWT_SECRET=your-jwt-secret-key
REDIS_URL=redis://localhost:6379
CORS_ORIGIN=http://localhost:5173

# OCR Configuration
TESSERACT_WORKER_AMOUNT=2
OCR_CONFIDENCE_THRESHOLD=0.7

# File Upload Configuration
MAX_FILE_SIZE=104857600  # 100MB
UPLOAD_DIR=./uploads
TEMP_DIR=./temp

# Email Configuration (optional for development)
SMTP_HOST=localhost
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
FROM_EMAIL=noreply@syntaxis.ai

# Logging
LOG_LEVEL=debug
LOG_FILE=./logs/app.log
```

### Frontend Environment (`.env.development`)

```env
VITE_API_BASE_URL=http://localhost:3001
VITE_API_TIMEOUT=30000

# Feature Flags
VITE_ENABLE_MOCK_API=false
VITE_ENABLE_ANALYTICS=false

# Upload Configuration
VITE_MAX_FILE_SIZE=104857600
VITE_ALLOWED_FILE_TYPES=application/pdf
VITE_MAX_FILES_PER_BATCH=50

# Development Tools
VITE_ENABLE_DEVTOOLS=true
VITE_ENABLE_LOGGING=true
VITE_LOG_LEVEL=debug
```

## Development Workflow

### Starting Development

```bash
# Start all services
npm run dev

# Or start individually
npm run dev:backend    # Backend only
npm run dev:frontend   # Frontend only
```

### Running Tests

```bash
# Run all tests
npm test

# Run backend tests
cd backend && npm test

# Run frontend tests
cd frontend && npm test

# Run with coverage
cd backend && npm run test:coverage
```

### Code Quality

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Type check
npm run type-check

# Run all quality checks
npm run validate
```

## Troubleshooting

### Common Issues

#### PostgreSQL Connection Issues

```bash
# Check if PostgreSQL is running
brew services list | grep postgresql

# Restart PostgreSQL
brew services restart postgresql@15

# Check connection
psql -h localhost -p 5432 -U postgres -d syntaxis_ai
```

#### Redis Connection Issues

```bash
# Check if Redis is running
redis-cli ping

# Should return "PONG"

# Restart Redis
brew services restart redis
```

#### Port Conflicts

```bash
# Check what's using port 3001
lsof -i :3001

# Kill process if needed
kill -9 <PID>
```

#### Permission Issues

```bash
# Fix npm permissions
sudo chown -R $(whoami) ~/.npm

# Fix file permissions
chmod +x scripts/*.sh
```

### Database Issues

#### Reset Database

```bash
# Reset development database
cd backend && npm run db:reset

# Reset test database
cd backend && npm run test:db:reset
```

#### Migration Issues

```bash
# Check migration status
cd backend && npx prisma migrate status

# Reset and reapply migrations
cd backend && npx prisma migrate reset --force
```

### Node.js Issues

#### Clear Node Modules

```bash
# Remove all node_modules
rm -rf node_modules backend/node_modules frontend/node_modules

# Clear npm cache
npm cache clean --force

# Reinstall dependencies
npm install
```

#### Version Issues

```bash
# Check Node.js version
node --version

# Use nvm to manage Node.js versions
nvm install 18
nvm use 18
```

## IDE Setup

### VS Code Extensions

Recommended extensions for optimal development experience:

- **TypeScript**: Enhanced TypeScript support
- **Prettier**: Code formatting
- **ESLint**: Code linting
- **Prisma**: Database schema support
- **Thunder Client**: API testing
- **GitLens**: Git integration
- **Auto Rename Tag**: HTML/JSX tag renaming
- **Bracket Pair Colorizer**: Better bracket visualization

### VS Code Settings

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "typescript.preferences.importModuleSpecifier": "relative",
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.next": true
  }
}
```

## Performance Optimization

### Development Performance

```bash
# Use faster TypeScript compilation
npm run dev:fast

# Skip type checking during development
npm run dev:no-check

# Use development build optimizations
NODE_ENV=development npm run dev
```

### Memory Usage

```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"

# Monitor memory usage
npm run dev:memory
```

## Next Steps

After completing the local setup:

1. **Read the [Getting Started Guide](./getting-started.md)**
2. **Review [Test Procedures](./test-procedures.md)**
3. **Check [Troubleshooting Guide](./troubleshooting.md)**
4. **Explore the codebase structure**
5. **Run the test suite to ensure everything works**

## Quick Commands Reference

```bash
# Essential setup commands
npm run setup:dev          # Complete development setup
npm run setup:test         # Test environment setup
npm run setup:dependencies # Install all dependencies

# Development commands
npm run dev                 # Start all services
npm test                   # Run all tests
npm run lint               # Check code quality
npm run format             # Format code

# Database commands
cd backend && npm run migrate     # Run migrations
cd backend && npm run db:seed     # Seed database
cd backend && npm run db:studio   # Open Prisma Studio
```

This comprehensive setup guide ensures a smooth development experience for all team members working on SyntaxisAI.
