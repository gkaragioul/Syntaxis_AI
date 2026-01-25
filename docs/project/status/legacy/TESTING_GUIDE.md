# SyntaxisAI OCR Service - Testing Guide

## 🧪 How to Test the Complete System

This guide shows you how to test every component of the SyntaxisAI OCR Service following our TDD methodology.

## 📋 Prerequisites

Before testing, ensure you have:

```bash
# Required tools
- Node.js 18+
- Docker & Docker Compose
- kubectl (for Kubernetes testing)
- k6 (for load testing)
- PostgreSQL client
- Redis client

# Environment setup
npm install
docker-compose up -d  # Start local services
```

## 🔴 Phase 1: Unit & Integration Testing (RED/GREEN/REFACTOR)

### 1. Run All Unit Tests

```bash
# Run complete test suite
npm test

# Run with coverage
npm run test:coverage

# Run specific test suites
npm run test:unit              # Unit tests only
npm run test:integration       # Integration tests only
npm run test:e2e              # End-to-end tests
```

### 2. Test Core OCR Functionality

```bash
# Test file upload functionality
npm run test -- --testNamePattern="file upload"

# Test OCR processing
npm run test -- --testNamePattern="OCR processing"

# Test result storage
npm run test -- --testNamePattern="result storage"

# Test error handling
npm run test -- --testNamePattern="error handling"
```

### 3. Test Advanced Features

```bash
# Test batch processing
npm run test -- --testNamePattern="batch processing"

# Test caching layer
npm run test -- --testNamePattern="caching"

# Test rate limiting
npm run test -- --testNamePattern="rate limiting"

# Test monitoring
npm run test -- --testNamePattern="monitoring"
```

## 🟢 Phase 2: Local Development Testing

### 1. Start Local Development Environment

```bash
# Start all services
docker-compose up -d

# Start the application
npm run dev

# Verify services are running
curl http://localhost:3000/health
```

### 2. Test API Endpoints Manually

```bash
# Health check
curl -X GET http://localhost:3000/health

# Upload a file
curl -X POST http://localhost:3000/api/v1/files/upload \
  -H "Content-Type: multipart/form-data" \
  -F "file=@test-image.jpg" \
  -F "language=en"

# Process OCR
curl -X POST http://localhost:3000/api/v1/ocr/process \
  -H "Content-Type: application/json" \
  -d '{
    "fileId": "your-file-id",
    "language": "en",
    "options": {
      "enableFallback": true,
      "outputFormat": "json"
    }
  }'

# Check processing status
curl -X GET http://localhost:3000/api/v1/ocr/status/{processing-id}

# Get results
curl -X GET http://localhost:3000/api/v1/ocr/result/{processing-id}
```

### 3. Test with Sample Files

```bash
# Create test files directory
mkdir -p test-files

# Test with different file types
curl -X POST http://localhost:3000/api/v1/files/upload \
  -F "file=@test-files/sample.jpg" \
  -F "language=en"

curl -X POST http://localhost:3000/api/v1/files/upload \
  -F "file=@test-files/document.pdf" \
  -F "language=en"
```

## 🔄 Phase 3: Staging Environment Testing

### 1. Deploy to Staging

```bash
# Run staging deployment
./scripts/deploy-staging.sh

# Verify staging deployment
curl https://staging-api.syntaxis.ai/health
```

### 2. Run Staging Test Suite

```bash
# Set staging environment
export STAGING_BASE_URL="https://staging-api.syntaxis.ai"
export NODE_ENV="staging"

# Run staging-specific tests
npm run test:staging

# Run comprehensive staging validation
./scripts/run-staging-validation.sh
```

### 3. Load Testing on Staging

```bash
# Run comprehensive load tests
./scripts/run-load-tests.sh

# Run specific load test scenarios
k6 run --env BASE_URL="https://staging-api.syntaxis.ai" \
       --env TEST_TYPE="normal_load" \
       scripts/load-testing/k6-load-test.js

# Run stress testing
k6 run --env BASE_URL="https://staging-api.syntaxis.ai" \
       --env TEST_TYPE="stress_test" \
       scripts/load-testing/k6-load-test.js
```

## 🚀 Phase 4: Production Testing

### 1. Pre-Production Smoke Tests

```bash
# Run production smoke tests
export PRODUCTION_BASE_URL="https://api.syntaxis.ai"
./scripts/run-production-smoke-tests.sh
```

### 2. Production Deployment

```bash
# Deploy to production (with automated validation)
./scripts/deploy-production.sh
```

### 3. Post-Deployment Validation

```bash
# Run end-to-end production validation
export PRODUCTION_BASE_URL="https://api.syntaxis.ai"
export E2E_TEST_API_KEY="your-test-api-key"
./scripts/run-production-validation.sh

# Run production health monitoring
./scripts/production-health-monitor.sh
```

## 📊 Monitoring & Observability Testing

### 1. Test Monitoring Stack

```bash
# Check Prometheus metrics
curl http://localhost:9090/metrics

# Verify Grafana dashboards
open http://localhost:3001  # Grafana UI

# Test alerting
curl -X POST http://localhost:3000/api/v1/test/trigger-alert
```

### 2. Test Log Aggregation

```bash
# Check application logs
kubectl logs -f deployment/syntaxis-ocr -n staging

# Query Elasticsearch
curl -X GET "localhost:9200/_search?q=level:error"

# View logs in Kibana
open http://localhost:5601
```

## 🔍 Specific Feature Testing

### 1. Test OCR Engines

```bash
# Test Google Vision API
npm run test -- --testNamePattern="Google Vision"

# Test AWS Textract
npm run test -- --testNamePattern="AWS Textract"

# Test Tesseract fallback
npm run test -- --testNamePattern="Tesseract"
```

### 2. Test Batch Processing

```bash
# Upload multiple files
for i in {1..5}; do
  curl -X POST http://localhost:3000/api/v1/files/upload \
    -F "file=@test-files/sample-$i.jpg"
done

# Submit batch processing
curl -X POST http://localhost:3000/api/v1/ocr/batch \
  -H "Content-Type: application/json" \
  -d '{
    "fileIds": ["file1", "file2", "file3"],
    "language": "en"
  }'
```

### 3. Test Rate Limiting

```bash
# Test rate limiting
for i in {1..100}; do
  curl -X GET http://localhost:3000/api/v1/user/quota &
done
wait

# Should see 429 responses after hitting limits
```

## 🛡️ Security Testing

### 1. Test Authentication

```bash
# Test without API key (should fail)
curl -X POST http://localhost:3000/api/v1/ocr/process \
  -H "Content-Type: application/json" \
  -d '{"fileId": "test"}'

# Test with valid API key
curl -X POST http://localhost:3000/api/v1/ocr/process \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"fileId": "test"}'
```

### 2. Test Security Headers

```bash
# Check security headers
curl -I http://localhost:3000/health

# Should include:
# X-Frame-Options: DENY
# X-Content-Type-Options: nosniff
# Strict-Transport-Security: max-age=31536000
```

## 📈 Performance Testing

### 1. Response Time Testing

```bash
# Test response times
time curl http://localhost:3000/health

# Should be < 200ms for health endpoints
```

### 2. Throughput Testing

```bash
# Test concurrent requests
ab -n 1000 -c 10 http://localhost:3000/health

# Use k6 for more comprehensive testing
k6 run --vus 50 --duration 5m scripts/load-testing/k6-load-test.js
```

## 🔧 Troubleshooting Tests

### 1. Check Service Health

```bash
# Check all services
docker-compose ps

# Check application logs
docker-compose logs syntaxis-ocr

# Check database connection
docker-compose exec postgres psql -U postgres -d syntaxis_ocr -c "SELECT 1;"

# Check Redis connection
docker-compose exec redis redis-cli ping
```

### 2. Debug Failed Tests

```bash
# Run tests in debug mode
npm run test:debug

# Run specific failing test
npm test -- --testNamePattern="specific test name" --verbose

# Check test coverage
npm run test:coverage:report
```

## 📋 Test Checklist

### ✅ Development Testing
- [ ] All unit tests pass
- [ ] Integration tests pass
- [ ] Local API endpoints work
- [ ] File upload/processing works
- [ ] Database operations work
- [ ] Cache operations work

### ✅ Staging Testing
- [ ] Staging deployment successful
- [ ] Health checks pass
- [ ] Load tests pass
- [ ] Performance meets requirements
- [ ] Security tests pass

### ✅ Production Testing
- [ ] Smoke tests pass
- [ ] Production deployment successful
- [ ] End-to-end validation passes
- [ ] Monitoring is active
- [ ] Alerts are configured
- [ ] Business metrics are tracked

## 🎯 Expected Results

### Performance Benchmarks
- **Health endpoint**: < 200ms response time
- **File upload**: < 5s for files up to 10MB
- **OCR processing**: < 30s for typical documents
- **Batch processing**: < 2 minutes for 10 files
- **API throughput**: > 100 requests/second
- **Error rate**: < 1%
- **Uptime**: > 99.9%

### Test Coverage Targets
- **Unit tests**: > 95% coverage
- **Integration tests**: All API endpoints
- **E2E tests**: All user journeys
- **Load tests**: All performance scenarios
- **Security tests**: All attack vectors

## 🚀 Quick Start Testing

For a quick validation of the entire system:

```bash
# 1. Start local environment
docker-compose up -d
npm run dev

# 2. Run core tests
npm run test:core

# 3. Test main functionality
curl -X POST http://localhost:3000/api/v1/files/upload -F "file=@test.jpg"

# 4. Check health
curl http://localhost:3000/health

# 5. View metrics
curl http://localhost:3000/metrics
```

This comprehensive testing approach ensures every component works correctly following our TDD methodology! 🎉
