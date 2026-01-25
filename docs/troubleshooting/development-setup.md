# Development Setup Troubleshooting

This guide helps resolve common issues when setting up the SyntaxisAI development environment.

## Prerequisites Check

### Node.js Version
```bash
# Check Node.js version (requires 18+)
node --version

# If wrong version, use nvm
nvm install 18
nvm use 18
```

### Package Manager
```bash
# Check npm version
npm --version

# Update npm if needed
npm install -g npm@latest

# Or use yarn
yarn --version
```

### Database Setup
```bash
# Check PostgreSQL installation
psql --version

# Check if PostgreSQL is running
pg_isready

# Start PostgreSQL if not running
brew services start postgresql  # macOS
sudo systemctl start postgresql # Linux
```

### Redis Setup
```bash
# Check Redis installation
redis-cli --version

# Check if Redis is running
redis-cli ping

# Start Redis if not running
brew services start redis        # macOS
sudo systemctl start redis      # Linux
```

## Common Setup Issues

### 1. Environment Variables

**Problem:** Missing or incorrect environment variables

**Solution:**
```bash
# Copy example environment file
cp .env.example .env

# Required variables checklist:
# - DATABASE_URL
# - JWT_SECRET
# - REDIS_URL
# - NODE_ENV

# Generate JWT secret
openssl rand -base64 32

# Verify environment
npm run env:check
```

**Example .env file:**
```env
NODE_ENV=development
PORT=3001
DATABASE_URL="postgresql://user:password@localhost:5432/syntaxisai_dev"
JWT_SECRET="your-super-secret-jwt-key-here"
REDIS_URL="redis://localhost:6379"
UPLOAD_DIR="./uploads"
LOG_LEVEL="debug"
```

### 2. Database Connection Issues

**Problem:** Cannot connect to PostgreSQL

**Diagnosis:**
```bash
# Test connection manually
psql -h localhost -U your_username -d syntaxisai_dev

# Check if database exists
psql -l | grep syntaxisai

# Check connection from app
npm run db:check
```

**Solutions:**

1. **Database doesn't exist:**
   ```bash
   # Create database
   createdb syntaxisai_dev
   
   # Or using psql
   psql -c "CREATE DATABASE syntaxisai_dev;"
   ```

2. **Wrong credentials:**
   ```bash
   # Update DATABASE_URL in .env
   DATABASE_URL="postgresql://correct_user:correct_password@localhost:5432/syntaxisai_dev"
   ```

3. **PostgreSQL not running:**
   ```bash
   # macOS
   brew services start postgresql
   
   # Linux
   sudo systemctl start postgresql
   sudo systemctl enable postgresql
   
   # Windows
   net start postgresql-x64-14
   ```

4. **Permission issues:**
   ```bash
   # Create user with proper permissions
   sudo -u postgres createuser --interactive your_username
   sudo -u postgres psql -c "ALTER USER your_username CREATEDB;"
   ```

### 3. Prisma Migration Issues

**Problem:** Prisma migrations fail

**Diagnosis:**
```bash
# Check migration status
npx prisma migrate status

# Check schema
npx prisma db pull
```

**Solutions:**

1. **Reset and regenerate:**
   ```bash
   # Reset database (WARNING: destroys data)
   npx prisma migrate reset
   
   # Generate new migration
   npx prisma migrate dev --name init
   
   # Generate Prisma client
   npx prisma generate
   ```

2. **Schema drift:**
   ```bash
   # Push schema changes
   npx prisma db push
   
   # Generate client
   npx prisma generate
   ```

3. **Migration conflicts:**
   ```bash
   # Resolve manually
   npx prisma migrate resolve --applied "migration_name"
   
   # Or reset and start fresh
   npx prisma migrate reset
   ```

### 4. Redis Connection Issues

**Problem:** Cannot connect to Redis

**Diagnosis:**
```bash
# Test Redis connection
redis-cli ping

# Check Redis logs
redis-cli monitor

# Test from app
npm run redis:check
```

**Solutions:**

1. **Redis not running:**
   ```bash
   # macOS
   brew services start redis
   
   # Linux
   sudo systemctl start redis
   
   # Manual start
   redis-server
   ```

2. **Wrong Redis URL:**
   ```bash
   # Update REDIS_URL in .env
   REDIS_URL="redis://localhost:6379"
   
   # For Redis with password
   REDIS_URL="redis://:password@localhost:6379"
   ```

3. **Port conflicts:**
   ```bash
   # Check what's using port 6379
   lsof -i :6379
   
   # Use different port
   redis-server --port 6380
   REDIS_URL="redis://localhost:6380"
   ```

### 5. File Upload Directory Issues

**Problem:** File uploads fail

**Diagnosis:**
```bash
# Check upload directory
ls -la uploads/

# Check permissions
stat uploads/

# Test upload
curl -X POST -F "file=@test.pdf" http://localhost:3001/api/v1/files/upload
```

**Solutions:**

1. **Directory doesn't exist:**
   ```bash
   mkdir -p uploads
   chmod 755 uploads
   ```

2. **Permission issues:**
   ```bash
   # Fix permissions
   chmod 755 uploads/
   chown -R $USER:$USER uploads/
   
   # For production
   chown -R www-data:www-data uploads/
   ```

3. **Disk space:**
   ```bash
   # Check disk space
   df -h
   
   # Clean up old files
   find uploads/ -type f -mtime +30 -delete
   ```

### 6. Frontend Build Issues

**Problem:** Frontend won't build or start

**Diagnosis:**
```bash
# Check for build errors
cd frontend
npm run build

# Check dependencies
npm ls

# Check for peer dependency warnings
npm install --legacy-peer-deps
```

**Solutions:**

1. **Dependency conflicts:**
   ```bash
   # Clear node_modules
   rm -rf node_modules package-lock.json
   npm install
   
   # Or use yarn
   rm -rf node_modules yarn.lock
   yarn install
   ```

2. **TypeScript errors:**
   ```bash
   # Check TypeScript config
   npx tsc --noEmit
   
   # Fix type issues
   npm run type-check
   ```

3. **Memory issues:**
   ```bash
   # Increase Node.js memory
   export NODE_OPTIONS="--max-old-space-size=4096"
   npm run build
   ```

### 7. Port Conflicts

**Problem:** Ports already in use

**Diagnosis:**
```bash
# Check what's using ports
lsof -i :3000  # Frontend
lsof -i :3001  # Backend
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis
```

**Solutions:**

1. **Kill conflicting processes:**
   ```bash
   # Kill by port
   kill -9 $(lsof -t -i:3001)
   
   # Kill by process name
   pkill -f "node.*3001"
   ```

2. **Use different ports:**
   ```bash
   # Backend
   PORT=3002 npm run dev
   
   # Frontend
   cd frontend && PORT=3001 npm start
   ```

## Development Workflow

### Initial Setup Checklist

1. **Clone repository:**
   ```bash
   git clone <repository-url>
   cd SyntaxisAI
   ```

2. **Install dependencies:**
   ```bash
   # Backend
   npm install
   
   # Frontend
   cd frontend && npm install
   ```

3. **Setup environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

4. **Setup database:**
   ```bash
   npm run db:setup
   npm run db:seed
   ```

5. **Start development servers:**
   ```bash
   # Terminal 1: Backend
   npm run dev
   
   # Terminal 2: Frontend
   cd frontend && npm start
   ```

### Daily Development

```bash
# Pull latest changes
git pull origin main

# Update dependencies if needed
npm install
cd frontend && npm install

# Run migrations if any
npx prisma migrate dev

# Start development
npm run dev:all
```

### Testing Setup

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e

# Run tests with coverage
npm run test:coverage
```

## IDE Configuration

### VS Code Setup

**Required Extensions:**
- Prisma
- TypeScript and JavaScript Language Features
- ESLint
- Prettier
- REST Client

**Settings (.vscode/settings.json):**
```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.next": true
  }
}
```

### Environment-Specific Issues

**macOS:**
```bash
# Install Xcode command line tools
xcode-select --install

# Install Homebrew if needed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

**Linux (Ubuntu/Debian):**
```bash
# Install build essentials
sudo apt update
sudo apt install build-essential

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# Install Redis
sudo apt install redis-server
```

**Windows:**
```bash
# Use WSL2 for best experience
wsl --install

# Or install dependencies manually
# - Node.js from nodejs.org
# - PostgreSQL from postgresql.org
# - Redis from redis.io
```

## Getting Help

### Debug Information to Collect

When asking for help, include:

1. **System information:**
   ```bash
   node --version
   npm --version
   psql --version
   redis-cli --version
   ```

2. **Error logs:**
   ```bash
   # Backend logs
   tail -50 backend/logs/app.log
   
   # Frontend console errors
   # (Check browser developer tools)
   ```

3. **Environment details:**
   ```bash
   echo $NODE_ENV
   echo $DATABASE_URL
   echo $REDIS_URL
   ```

4. **Process status:**
   ```bash
   ps aux | grep node
   ps aux | grep postgres
   ps aux | grep redis
   ```

### Common Commands Reference

```bash
# Full reset (nuclear option)
npm run reset:all

# Check system health
npm run health:check

# View all logs
npm run logs:all

# Database operations
npm run db:reset
npm run db:seed
npm run db:studio

# Cache operations
npm run cache:clear
npm run cache:status
```
