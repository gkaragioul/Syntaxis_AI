# SyntaxisAI Troubleshooting Guide

This comprehensive troubleshooting guide helps developers and administrators diagnose and resolve common issues in the SyntaxisAI application.

## Table of Contents

1. [Quick Diagnostics](#quick-diagnostics)
2. [Common Issues](#common-issues)
3. [System Health Monitoring](#system-health-monitoring)
4. [Error Code Reference](#error-code-reference)
5. [Performance Issues](#performance-issues)
6. [Database Issues](#database-issues)
7. [Authentication Issues](#authentication-issues)
8. [File Processing Issues](#file-processing-issues)
9. [Development Tools](#development-tools)
10. [Getting Help](#getting-help)

## Quick Diagnostics

### Health Check Commands

```bash
# Quick system health check
curl http://localhost:3001/api/v1/system/health

# Detailed health check (requires authentication)
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:3001/api/v1/system/health/detailed

# Check specific services
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:3001/api/v1/system/health/database
```

### Log Analysis

```bash
# View recent logs
tail -f backend/logs/app.log

# Search for errors
grep "ERROR" backend/logs/app.log | tail -20

# Search by correlation ID
grep "corr_123456" backend/logs/app.log
```

### Environment Verification

```bash
# Check environment variables
npm run env:check

# Verify database connection
npm run db:check

# Test Redis connection
npm run redis:check
```

## Common Issues

### 1. Application Won't Start

**Symptoms:**
- Server fails to start
- Port already in use errors
- Database connection failures

**Diagnosis:**
```bash
# Check if port is in use
lsof -i :3001

# Verify environment variables
cat .env

# Check database status
npm run db:status
```

**Solutions:**
1. **Port in use:**
   ```bash
   # Kill process using port
   kill -9 $(lsof -t -i:3001)
   
   # Or change port in .env
   PORT=3002
   ```

2. **Database connection:**
   ```bash
   # Reset database
   npm run db:reset
   
   # Check database URL
   echo $DATABASE_URL
   ```

3. **Missing dependencies:**
   ```bash
   # Reinstall dependencies
   rm -rf node_modules package-lock.json
   npm install
   ```

### 2. Authentication Failures

**Symptoms:**
- 401 Unauthorized errors
- Token validation failures
- Login redirects

**Diagnosis:**
```bash
# Check JWT secret
echo $JWT_SECRET

# Verify token format
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:3001/api/v1/auth/me
```

**Solutions:**
1. **Invalid JWT secret:**
   ```bash
   # Generate new secret
   openssl rand -base64 32
   ```

2. **Expired tokens:**
   - Clear browser storage
   - Re-login to get new token

3. **Token format issues:**
   - Ensure Bearer prefix
   - Check for extra spaces

### 3. File Upload Issues

**Symptoms:**
- Upload timeouts
- File size errors
- Processing failures

**Diagnosis:**
```bash
# Check upload directory permissions
ls -la uploads/

# Verify file size limits
grep -r "LIMIT_FILE_SIZE" backend/

# Check disk space
df -h
```

**Solutions:**
1. **Permission issues:**
   ```bash
   chmod 755 uploads/
   chown -R $USER:$USER uploads/
   ```

2. **Size limits:**
   ```javascript
   // Increase in multer config
   limits: { fileSize: 50 * 1024 * 1024 } // 50MB
   ```

3. **Disk space:**
   ```bash
   # Clean up old files
   find uploads/ -type f -mtime +30 -delete
   ```

## System Health Monitoring

### Monitoring Dashboard

Access the system health dashboard at:
- **Development:** http://localhost:3000/admin/system-health
- **Production:** https://your-domain.com/admin/system-health

### Key Metrics to Monitor

1. **Memory Usage**
   - Heap usage > 80% (warning)
   - Heap usage > 90% (critical)

2. **Response Times**
   - API responses > 1s (slow)
   - API responses > 5s (critical)

3. **Error Rates**
   - Error rate > 5% (warning)
   - Error rate > 10% (critical)

4. **Database Performance**
   - Query time > 1s (slow)
   - Connection pool exhaustion

### Automated Alerts

Configure alerts for critical thresholds:

```javascript
// Example alert configuration
const alerts = {
  memory: { threshold: 90, action: 'restart' },
  errors: { threshold: 10, action: 'notify' },
  response: { threshold: 5000, action: 'scale' }
};
```

## Error Code Reference

### API Error Codes

| Code | Description | Common Causes | Solutions |
|------|-------------|---------------|-----------|
| `VALIDATION_ERROR` | Input validation failed | Invalid data format | Check request format |
| `AUTHENTICATION_ERROR` | Auth token invalid | Expired/malformed token | Re-authenticate |
| `AUTHORIZATION_ERROR` | Insufficient permissions | Wrong user role | Check user permissions |
| `RESOURCE_NOT_FOUND` | Resource doesn't exist | Wrong ID/deleted resource | Verify resource exists |
| `CONFLICT_ERROR` | Resource conflict | Duplicate data | Check for duplicates |
| `RATE_LIMIT_ERROR` | Too many requests | Exceeded rate limit | Implement backoff |
| `SERVICE_UNAVAILABLE` | Service down | Database/Redis offline | Check service status |
| `INTERNAL_ERROR` | Server error | Code bug/system issue | Check logs |

### HTTP Status Codes

- **400:** Bad Request - Check request format
- **401:** Unauthorized - Authentication required
- **403:** Forbidden - Insufficient permissions
- **404:** Not Found - Resource doesn't exist
- **409:** Conflict - Resource already exists
- **429:** Too Many Requests - Rate limited
- **500:** Internal Server Error - Server issue
- **503:** Service Unavailable - Service down

## Performance Issues

### Slow API Responses

**Diagnosis:**
1. Check response times in logs
2. Monitor database query performance
3. Analyze memory usage patterns

**Solutions:**
1. **Database optimization:**
   ```sql
   -- Add indexes for slow queries
   CREATE INDEX idx_invoices_user_id ON invoices(user_id);
   CREATE INDEX idx_files_created_at ON files(created_at);
   ```

2. **Caching:**
   ```javascript
   // Implement Redis caching
   const cached = await redis.get(cacheKey);
   if (cached) return JSON.parse(cached);
   ```

3. **Query optimization:**
   ```javascript
   // Use select to limit fields
   const users = await prisma.user.findMany({
     select: { id: true, email: true }
   });
   ```

### Memory Leaks

**Diagnosis:**
```bash
# Monitor memory usage
node --inspect backend/src/index.js

# Create heap snapshots
curl -X POST http://localhost:3001/api/v1/debug/memory/snapshot
```

**Solutions:**
1. **Event listener cleanup:**
   ```javascript
   // Remove listeners
   process.removeListener('SIGINT', handler);
   ```

2. **Close database connections:**
   ```javascript
   // Proper cleanup
   await prisma.$disconnect();
   ```

3. **Clear intervals/timeouts:**
   ```javascript
   clearInterval(intervalId);
   clearTimeout(timeoutId);
   ```

## Database Issues

### Connection Pool Exhaustion

**Symptoms:**
- "Too many connections" errors
- Slow database responses
- Connection timeouts

**Solutions:**
```javascript
// Optimize connection pool
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  
  // Connection pool settings
  connection_limit = 20
  pool_timeout = 30
}
```

### Migration Issues

**Common Problems:**
1. **Failed migrations:**
   ```bash
   # Reset and retry
   npx prisma migrate reset
   npx prisma migrate dev
   ```

2. **Schema drift:**
   ```bash
   # Generate new migration
   npx prisma migrate dev --name fix_schema
   ```

3. **Data loss prevention:**
   ```bash
   # Backup before migration
   pg_dump database_name > backup.sql
   ```

## Authentication Issues

### JWT Token Problems

**Diagnosis:**
```bash
# Decode JWT token
echo "YOUR_TOKEN" | base64 -d

# Check token expiration
node -e "console.log(new Date(JSON.parse(atob('TOKEN_PAYLOAD')).exp * 1000))"
```

**Solutions:**
1. **Token refresh:**
   ```javascript
   // Implement token refresh
   if (isTokenExpired(token)) {
     token = await refreshToken(refreshToken);
   }
   ```

2. **Secure storage:**
   ```javascript
   // Use httpOnly cookies
   res.cookie('token', jwt, { 
     httpOnly: true, 
     secure: true,
     sameSite: 'strict'
   });
   ```

## File Processing Issues

### PDF Processing Failures

**Common Issues:**
1. **Corrupted files:**
   ```bash
   # Validate PDF
   file uploaded_file.pdf
   ```

2. **OCR failures:**
   ```bash
   # Check Tesseract installation
   tesseract --version
   ```

3. **Memory issues:**
   ```javascript
   // Process in chunks
   const chunks = splitPdfIntoChunks(pdf, 10);
   ```

## Development Tools

### Debug Endpoints (Development Only)

```bash
# System information
curl http://localhost:3001/api/v1/debug/system

# Memory snapshot
curl -X POST http://localhost:3001/api/v1/debug/memory/snapshot

# Performance test
curl -X POST http://localhost:3001/api/v1/debug/test/performance \
     -H "Content-Type: application/json" \
     -d '{"delay": 100}'

# Database test
curl http://localhost:3001/api/v1/debug/test/database
```

### Logging Configuration

```javascript
// Enable debug logging
DEBUG=* npm run dev

// Specific module debugging
DEBUG=app:* npm run dev

// Log levels
LOG_LEVEL=debug npm run dev
```

### Performance Profiling

```bash
# CPU profiling
node --prof backend/src/index.js

# Memory profiling
node --inspect --inspect-brk backend/src/index.js
```

## Getting Help

### Log Analysis

When reporting issues, include:
1. **Error logs** with correlation IDs
2. **System health** status
3. **Request details** (method, URL, payload)
4. **Environment info** (Node version, OS)

### Support Channels

1. **GitHub Issues:** For bugs and feature requests
2. **Documentation:** Check docs/ directory
3. **Health Dashboard:** Monitor system status
4. **Debug Endpoints:** Use development tools

### Emergency Procedures

1. **Service Down:**
   ```bash
   # Quick restart
   pm2 restart all
   
   # Check logs
   pm2 logs
   ```

2. **Database Issues:**
   ```bash
   # Check connections
   SELECT * FROM pg_stat_activity;
   
   # Kill long-running queries
   SELECT pg_terminate_backend(pid);
   ```

3. **Memory Issues:**
   ```bash
   # Force garbage collection
   curl -X POST http://localhost:3001/api/v1/debug/gc
   
   # Restart if needed
   pm2 restart app
   ```

## Quick Reference Commands

### Development Setup
```bash
# Full reset and setup
npm run setup:dev

# Database reset
npm run db:reset && npm run db:seed

# Clear all caches
npm run cache:clear

# Restart all services
npm run services:restart
```

### Production Deployment
```bash
# Health check before deployment
npm run health:check

# Deploy with zero downtime
npm run deploy:production

# Rollback if needed
npm run deploy:rollback
```

### Monitoring Commands
```bash
# Real-time logs
npm run logs:tail

# System metrics
npm run metrics:show

# Performance report
npm run perf:report
```

---

For additional help, consult the specific troubleshooting guides in this directory:
- [API Issues](./api-issues.md)
- [Database Problems](./database-problems.md)
- [Performance Optimization](./performance-optimization.md)
- [Security Issues](./security-issues.md)
- [Development Setup](./development-setup.md)
