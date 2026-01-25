# Troubleshooting Guide

## Overview

This guide helps you resolve common issues encountered during SyntaxisAI development.

## Quick Diagnostics

### Health Check Commands

```bash
# Check all services
npm run health-check

# Check individual services
node --version          # Node.js
npm --version          # npm
psql --version         # PostgreSQL
redis-cli ping         # Redis (should return "PONG")

# Check ports
lsof -i :3001          # Backend
lsof -i :5173          # Frontend
lsof -i :5432          # PostgreSQL
lsof -i :6379          # Redis
```

## Common Issues

### 1. Installation Problems

#### Node.js Version Issues

**Problem**: Wrong Node.js version
```bash
Error: This project requires Node.js 18.0.0 or higher
```

**Solution**:
```bash
# Install correct Node.js version
nvm install 18
nvm use 18
nvm alias default 18

# Verify version
node --version
```

#### npm Permission Issues

**Problem**: Permission denied during npm install
```bash
Error: EACCES: permission denied
```

**Solution**:
```bash
# Fix npm permissions
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /usr/local/lib/node_modules

# Or use nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
```

#### Dependency Installation Failures

**Problem**: npm install fails with network or dependency errors

**Solution**:
```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Use different registry if needed
npm install --registry https://registry.npmjs.org/
```

### 2. Database Issues

#### PostgreSQL Connection Failed

**Problem**: Cannot connect to PostgreSQL
```bash
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution**:
```bash
# Check if PostgreSQL is running
brew services list | grep postgresql

# Start PostgreSQL
brew services start postgresql@15

# Check connection
psql -h localhost -p 5432 -U postgres

# If database doesn't exist
createdb syntaxis_ai
createdb syntaxis_ai_test
```

#### Database Migration Errors

**Problem**: Prisma migration fails
```bash
Error: Migration failed to apply
```

**Solution**:
```bash
# Check migration status
cd backend && npx prisma migrate status

# Reset database (WARNING: loses data)
cd backend && npx prisma migrate reset --force

# Apply migrations manually
cd backend && npx prisma db push

# Generate Prisma client
cd backend && npx prisma generate
```

#### Database Permission Issues

**Problem**: Permission denied for database operations

**Solution**:
```bash
# Connect as superuser
sudo -u postgres psql

# Grant permissions
GRANT ALL PRIVILEGES ON DATABASE syntaxis_ai TO your_user;
GRANT ALL PRIVILEGES ON DATABASE syntaxis_ai_test TO your_user;

# Or create user with proper permissions
CREATE USER your_user WITH PASSWORD 'your_password';
ALTER USER your_user CREATEDB;
```

### 3. Redis Issues

#### Redis Connection Failed

**Problem**: Cannot connect to Redis
```bash
Error: Redis connection failed
```

**Solution**:
```bash
# Check if Redis is running
redis-cli ping

# Start Redis
brew services start redis

# Check Redis configuration
redis-cli config get "*"

# Test connection
redis-cli
> ping
PONG
```

#### Redis Memory Issues

**Problem**: Redis out of memory

**Solution**:
```bash
# Check Redis memory usage
redis-cli info memory

# Clear Redis cache
redis-cli flushall

# Increase memory limit in redis.conf
maxmemory 256mb
maxmemory-policy allkeys-lru
```

### 4. Development Server Issues

#### Port Already in Use

**Problem**: Port 3001 or 5173 already in use
```bash
Error: listen EADDRINUSE :::3001
```

**Solution**:
```bash
# Find process using port
lsof -i :3001

# Kill process
kill -9 <PID>

# Or use different port
PORT=3002 npm run dev
```

#### Hot Reload Not Working

**Problem**: Changes not reflected in browser

**Solution**:
```bash
# Check file watchers limit (Linux)
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# Clear browser cache
# Restart development server
npm run dev

# Check for TypeScript errors
npm run type-check
```

### 5. Build Issues

#### TypeScript Compilation Errors

**Problem**: TypeScript build fails
```bash
Error: Type 'string' is not assignable to type 'number'
```

**Solution**:
```bash
# Check TypeScript configuration
npx tsc --noEmit

# Fix type errors
# Update tsconfig.json if needed

# Clear TypeScript cache
rm -rf node_modules/.cache
```

#### Missing Dependencies

**Problem**: Module not found errors
```bash
Error: Cannot resolve module 'some-package'
```

**Solution**:
```bash
# Install missing dependency
npm install some-package

# Check if it's a dev dependency
npm install --save-dev some-package

# Update package-lock.json
npm install
```

### 6. Test Issues

#### Tests Failing

**Problem**: Tests fail unexpectedly

**Solution**:
```bash
# Run tests with verbose output
npm test -- --verbose

# Run specific test
npm test -- --testNamePattern="specific test"

# Clear test cache
npm test -- --clearCache

# Check test database
cd backend && npm run test:db:reset
```

#### Test Database Issues

**Problem**: Test database connection fails

**Solution**:
```bash
# Create test database
createdb syntaxis_ai_test

# Set test environment
export NODE_ENV=test

# Run test setup
npm run setup:test

# Check test environment file
cat backend/.env.test
```

### 7. API Issues

#### API Endpoints Not Working

**Problem**: API returns 404 or 500 errors

**Solution**:
```bash
# Check backend logs
tail -f backend/logs/app.log

# Test API directly
curl http://localhost:3001/api/health

# Check route definitions
grep -r "router\." backend/src/routes/

# Verify middleware
npm run dev:debug
```

#### CORS Issues

**Problem**: CORS policy blocks requests

**Solution**:
```bash
# Check CORS configuration in backend
# Update CORS_ORIGIN in .env
CORS_ORIGIN=http://localhost:5173

# Restart backend server
cd backend && npm run dev
```

### 8. File Upload Issues

#### Upload Directory Permissions

**Problem**: Cannot write to upload directory

**Solution**:
```bash
# Create upload directories
mkdir -p backend/uploads backend/temp

# Set permissions
chmod 755 backend/uploads backend/temp

# Check disk space
df -h
```

#### File Size Limits

**Problem**: File upload fails for large files

**Solution**:
```bash
# Check file size limits in .env
MAX_FILE_SIZE=104857600  # 100MB

# Update nginx/proxy settings if needed
client_max_body_size 100M;
```

### 9. Performance Issues

#### Slow Development Server

**Problem**: Development server is slow

**Solution**:
```bash
# Use faster TypeScript compilation
npm run dev:fast

# Disable source maps temporarily
GENERATE_SOURCEMAP=false npm run dev

# Check system resources
top
htop
```

#### Memory Leaks

**Problem**: High memory usage

**Solution**:
```bash
# Monitor memory usage
node --inspect backend/src/index.ts

# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"

# Check for memory leaks in tests
npm test -- --detectOpenHandles --forceExit
```

### 10. Environment Issues

#### Environment Variables Not Loading

**Problem**: Environment variables undefined

**Solution**:
```bash
# Check .env files exist
ls -la backend/.env*
ls -la frontend/.env*

# Verify environment loading
cd backend && node -e "console.log(process.env.DATABASE_URL)"

# Check for syntax errors in .env
cat backend/.env.development
```

#### Wrong Environment

**Problem**: Running in wrong environment

**Solution**:
```bash
# Check current environment
echo $NODE_ENV

# Set correct environment
export NODE_ENV=development

# Verify environment in code
console.log('Environment:', process.env.NODE_ENV);
```

## Advanced Debugging

### Debug Mode

```bash
# Backend debug mode
cd backend && npm run dev:debug

# Frontend debug mode
cd frontend && npm run dev -- --debug

# Node.js inspector
node --inspect-brk backend/src/index.ts
```

### Logging

```bash
# Enable debug logging
DEBUG=* npm run dev

# Backend logs
tail -f backend/logs/app.log

# Database query logs
cd backend && npx prisma studio
```

### Network Debugging

```bash
# Check network connectivity
ping localhost
telnet localhost 3001
telnet localhost 5432

# Monitor network traffic
sudo tcpdump -i lo0 port 3001
```

## Getting Help

### Log Files

- **Backend**: `backend/logs/app.log`
- **Frontend**: Browser console
- **Database**: PostgreSQL logs
- **System**: `/var/log/` (Linux) or Console.app (macOS)

### Diagnostic Commands

```bash
# System information
uname -a
node --version
npm --version

# Process information
ps aux | grep node
ps aux | grep postgres

# Network information
netstat -an | grep LISTEN
lsof -i -P -n | grep LISTEN
```

### Reset Everything

If all else fails, complete reset:

```bash
# Stop all services
brew services stop postgresql@15
brew services stop redis

# Remove all dependencies
rm -rf node_modules backend/node_modules frontend/node_modules
rm -f package-lock.json backend/package-lock.json frontend/package-lock.json

# Clear caches
npm cache clean --force
rm -rf ~/.npm

# Reset database
dropdb syntaxis_ai syntaxis_ai_test
createdb syntaxis_ai
createdb syntaxis_ai_test

# Restart services
brew services start postgresql@15
brew services start redis

# Reinstall everything
npm run setup:dev
```

## Prevention Tips

### Regular Maintenance

```bash
# Update dependencies monthly
npm update
npm audit fix

# Clean up regularly
npm run clean
docker system prune

# Backup database
pg_dump syntaxis_ai > backup.sql
```

### Best Practices

1. **Always use version control**
2. **Keep dependencies updated**
3. **Monitor logs regularly**
4. **Test in clean environment**
5. **Document environment setup**

This troubleshooting guide covers the most common issues. For specific problems not covered here, check the logs and create an issue with detailed information.
