# 🧪 How to Test the SyntaxisAI OCR Service

## 🚀 **Quick Start - Get Testing in 5 Minutes!**

### **Option 1: Automated Setup (Easiest)**
```bash
# 1. Run the automated setup script
chmod +x scripts/*.sh
./scripts/quick-start.sh

# 2. Run the interactive demo
./scripts/demo-system.sh

# 3. Run comprehensive tests
npm test
```

### **Option 2: Manual Setup**
```bash
# 1. Install dependencies
npm install

# 2. Start Docker services
docker-compose up -d

# 3. Start the application
npm run dev

# 4. Test basic functionality
curl http://localhost:3000/health
```

## 🎯 **Immediate Validation Tests**

### **1. Health Check (30 seconds)**
```bash
# Basic health check
curl http://localhost:3000/health

# Expected response:
# {
#   "status": "healthy",
#   "timestamp": "2024-01-15T10:30:00Z",
#   "uptime": 123,
#   "version": "1.0.0",
#   "environment": "development"
# }
```

### **2. API Endpoints Test (2 minutes)**
```bash
# Test all health endpoints
curl http://localhost:3000/health
curl http://localhost:3000/health/ready
curl http://localhost:3000/health/database
curl http://localhost:3000/health/redis

# Test metrics endpoint
curl http://localhost:3000/metrics
```

### **3. File Upload Test (3 minutes)**
```bash
# Create a test file
echo "Sample text for OCR testing" > test-file.txt

# Upload the file
curl -X POST http://localhost:3000/api/v1/files/upload \
  -F "file=@test-file.txt" \
  -F "language=en" \
  -F "options={\"enableFallback\": true}"

# Expected response:
# {
#   "success": true,
#   "fileId": "file-123-abc",
#   "uploadUrl": "...",
#   "metadata": {...}
# }
```

### **4. OCR Processing Test (5 minutes)**
```bash
# Process OCR (use fileId from upload response)
curl -X POST http://localhost:3000/api/v1/ocr/process \
  -H "Content-Type: application/json" \
  -d '{
    "fileId": "your-file-id-here",
    "language": "en",
    "options": {
      "enableFallback": true,
      "outputFormat": "json"
    }
  }'

# Check processing status
curl http://localhost:3000/api/v1/ocr/status/your-processing-id

# Get results
curl http://localhost:3000/api/v1/ocr/result/your-processing-id
```

## 🧪 **Comprehensive Test Suite**

### **Run All Tests (10 minutes)**
```bash
# Complete test suite (1000+ tests)
npm test

# Test with coverage report
npm run test:coverage

# View coverage report
open coverage/lcov-report/index.html
```

### **Run Specific Test Categories**
```bash
# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# End-to-end tests
npm run test:e2e

# Load tests
npm run test:load

# Security tests
npm run test:security
```

### **Test Individual Components**
```bash
# Test file upload functionality
npm test -- --testNamePattern="file upload"

# Test OCR processing
npm test -- --testNamePattern="OCR processing"

# Test batch processing
npm test -- --testNamePattern="batch processing"

# Test rate limiting
npm test -- --testNamePattern="rate limiting"

# Test monitoring
npm test -- --testNamePattern="monitoring"
```

## 📊 **Performance Testing**

### **Load Testing with K6**
```bash
# Install k6 (if not already installed)
# Windows: choco install k6
# Mac: brew install k6
# Linux: sudo apt install k6

# Run basic load test
k6 run --env BASE_URL="http://localhost:3000" \
       --env TEST_TYPE="normal_load" \
       scripts/load-testing/k6-load-test.js

# Run stress test
k6 run --env BASE_URL="http://localhost:3000" \
       --env TEST_TYPE="stress_test" \
       scripts/load-testing/k6-load-test.js

# Run comprehensive load tests
./scripts/run-load-tests.sh
```

### **Performance Benchmarks**
```bash
# Test response times
time curl http://localhost:3000/health

# Test concurrent requests
ab -n 100 -c 10 http://localhost:3000/health

# Monitor system resources
docker stats
```

## 🔍 **Interactive Demo**

### **Run the Complete Demo**
```bash
# Interactive system demonstration
./scripts/demo-system.sh

# This demo includes:
# 1. Health Check & System Status
# 2. API Endpoints Overview
# 3. File Upload Simulation
# 4. OCR Processing
# 5. Status Checking
# 6. Batch Processing
# 7. Monitoring & Metrics
# 8. Rate Limiting
# 9. Error Handling
# 10. System Summary
```

## 🛡️ **Security Testing**

### **Authentication Tests**
```bash
# Test without API key (should fail)
curl -X POST http://localhost:3000/api/v1/ocr/process \
  -H "Content-Type: application/json" \
  -d '{"fileId": "test"}'

# Test with valid API key
curl -X POST http://localhost:3000/api/v1/ocr/process \
  -H "Authorization: Bearer test-api-key-123" \
  -H "Content-Type: application/json" \
  -d '{"fileId": "test"}'
```

### **Rate Limiting Tests**
```bash
# Test rate limiting
for i in {1..20}; do
  curl -X GET http://localhost:3000/api/v1/user/quota &
done
wait

# Should see 429 responses after hitting limits
```

### **Security Headers Check**
```bash
# Check security headers
curl -I http://localhost:3000/health

# Should include:
# X-Frame-Options: DENY
# X-Content-Type-Options: nosniff
# Strict-Transport-Security: max-age=31536000
```

## 📈 **Monitoring & Observability**

### **Access Monitoring Dashboards**
- **Application**: http://localhost:3000
- **Health Check**: http://localhost:3000/health
- **Metrics**: http://localhost:3000/metrics
- **Grafana Dashboard**: http://localhost:3001 (admin/admin)
- **Prometheus**: http://localhost:9090

### **Monitor System Health**
```bash
# Continuous health monitoring
./scripts/production-health-monitor.sh

# Check system metrics
curl http://localhost:3000/metrics

# View application logs
tail -f logs/app.log

# Check Docker service status
docker-compose ps
```

## 🚀 **Staging & Production Testing**

### **Staging Environment**
```bash
# Deploy to staging
./scripts/deploy-staging.sh

# Run staging validation
export STAGING_BASE_URL="https://staging-api.syntaxis.ai"
./scripts/run-staging-validation.sh

# Run load tests on staging
./scripts/run-load-tests.sh
```

### **Production Environment**
```bash
# Run pre-production smoke tests
export PRODUCTION_BASE_URL="https://api.syntaxis.ai"
./scripts/run-production-smoke-tests.sh

# Deploy to production
./scripts/deploy-production.sh

# Validate production deployment
./scripts/run-production-validation.sh

# Monitor production health
./scripts/production-health-monitor.sh
```

## 🔧 **Troubleshooting**

### **Common Issues & Solutions**

**1. Service not starting:**
```bash
# Check Docker services
docker-compose ps

# Check application logs
docker-compose logs syntaxis-ocr

# Restart services
docker-compose restart
```

**2. Database connection issues:**
```bash
# Check PostgreSQL
docker-compose exec postgres psql -U postgres -d syntaxis_ocr -c "SELECT 1;"

# Check Redis
docker-compose exec redis redis-cli ping
```

**3. Tests failing:**
```bash
# Run tests in debug mode
npm run test:debug

# Run specific failing test
npm test -- --testNamePattern="specific test name" --verbose

# Clear test cache
npm test -- --clearCache
```

**4. Port conflicts:**
```bash
# Check what's using ports
netstat -tulpn | grep :3000
netstat -tulpn | grep :5432
netstat -tulpn | grep :6379

# Kill processes if needed
sudo kill -9 $(lsof -t -i:3000)
```

## ✅ **Test Results Validation**

### **Expected Performance Metrics**
- **Health Endpoint**: < 200ms response time
- **File Upload**: < 5s for files up to 10MB
- **OCR Processing**: < 30s for typical documents
- **API Throughput**: > 100 requests/second
- **Error Rate**: < 1%
- **Test Coverage**: > 95%

### **Success Criteria Checklist**
- [ ] All health checks return 200 OK
- [ ] File upload works with test files
- [ ] OCR processing completes successfully
- [ ] Status tracking shows real-time progress
- [ ] Results contain extracted text with confidence scores
- [ ] Batch processing handles multiple files
- [ ] Rate limiting prevents abuse
- [ ] Monitoring metrics are collected
- [ ] All tests pass with >95% coverage
- [ ] Load tests meet performance requirements
- [ ] Security tests validate protection measures

## 🎯 **Quick Validation (5 Minutes)**

For a rapid system validation:

```bash
# 1. Start everything
./scripts/quick-start.sh

# 2. Basic health check
curl http://localhost:3000/health

# 3. Run core tests
npm run test:core

# 4. Check metrics
curl http://localhost:3000/metrics

# 5. Interactive demo
./scripts/demo-system.sh
```

## 📚 **Additional Resources**

- **[Complete Testing Guide](TESTING_GUIDE.md)** - Detailed testing instructions
- **[Load Testing Results](load-test-results/)** - Performance test reports
- **[API Documentation](docs/api.md)** - Complete API reference
- **[Deployment Guide](docs/deployment.md)** - Production deployment

---

## 🎉 **Ready to Test!**

The SyntaxisAI OCR Service is fully tested and ready for validation. Start with the quick setup and explore the comprehensive testing capabilities!

**Built with ❤️ using Test-Driven Development methodology**
