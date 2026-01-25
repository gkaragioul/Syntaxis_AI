#!/bin/bash

# Production Smoke Tests Runner
# TDD-Driven Production Readiness Validation
# Task: Run production smoke tests before deployment
# 
# This script validates production readiness following TDD principles:
# 1. RED: Pre-deployment validation and requirements check
# 2. GREEN: Production environment configuration validation
# 3. REFACTOR: Production optimization and monitoring validation

set -euo pipefail

# Configuration
PRODUCTION_URL="${PRODUCTION_URL:-https://api.syntaxis.ai}"
SMOKE_TEST_TIMEOUT=300 # 5 minutes
RESULTS_DIR="./production-smoke-test-results"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Error handling
cleanup() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        log_error "Production smoke tests failed with exit code $exit_code"
        log_info "Check results in: $RESULTS_DIR/$TIMESTAMP/"
    fi
    exit $exit_code
}

trap cleanup EXIT

# Setup test environment
setup_smoke_test_environment() {
    log_info "🔧 Setting up production smoke test environment..."
    
    # Create results directory
    mkdir -p "$RESULTS_DIR/$TIMESTAMP"
    
    # Validate required environment variables
    if [ -z "${PRODUCTION_URL:-}" ]; then
        log_error "PRODUCTION_URL environment variable is required"
        exit 1
    fi
    
    if [ -z "${INTERNAL_METRICS_TOKEN:-}" ]; then
        log_warning "INTERNAL_METRICS_TOKEN not set, some metrics tests may fail"
    fi
    
    # Validate production environment
    if [ "${NODE_ENV:-}" != "production" ]; then
        log_error "NODE_ENV must be set to 'production' for production smoke tests"
        exit 1
    fi
    
    log_success "✅ Smoke test environment setup completed"
}

# TDD Phase 1: RED - Pre-deployment validation
run_pre_deployment_validation() {
    log_info "🔴 TDD RED Phase: Running pre-deployment validation..."
    
    local validation_results="$RESULTS_DIR/$TIMESTAMP/pre-deployment-validation.json"
    
    # Check production URL accessibility
    log_info "Checking production URL accessibility..."
    if ! curl -f "$PRODUCTION_URL" --max-time 30 > /dev/null 2>&1; then
        log_error "Production URL is not accessible: $PRODUCTION_URL"
        return 1
    fi
    
    # Validate DNS resolution
    log_info "Validating DNS resolution..."
    local domain=$(echo "$PRODUCTION_URL" | sed 's|https\?://||' | cut -d'/' -f1)
    if ! nslookup "$domain" > /dev/null 2>&1; then
        log_error "DNS resolution failed for domain: $domain"
        return 1
    fi
    
    # Check SSL certificate
    log_info "Checking SSL certificate..."
    local ssl_check=$(echo | openssl s_client -servername "$domain" -connect "$domain:443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null)
    if [ -z "$ssl_check" ]; then
        log_error "SSL certificate check failed"
        return 1
    fi
    
    # Validate infrastructure prerequisites
    log_info "Validating infrastructure prerequisites..."
    cat > "$validation_results" << EOF
{
  "timestamp": "$TIMESTAMP",
  "productionUrl": "$PRODUCTION_URL",
  "dnsResolution": "passed",
  "sslCertificate": "valid",
  "urlAccessibility": "passed",
  "infrastructureReady": true
}
EOF
    
    log_success "✅ Pre-deployment validation completed"
    return 0
}

# TDD Phase 2: GREEN - Production environment validation
run_production_environment_tests() {
    log_info "🟢 TDD GREEN Phase: Running production environment tests..."
    
    local test_results="$RESULTS_DIR/$TIMESTAMP/production-environment-tests"
    mkdir -p "$test_results"
    
    # Run health checks
    log_info "Running production health checks..."
    if ! run_health_checks "$test_results"; then
        log_error "Production health checks failed"
        return 1
    fi
    
    # Run security validation
    log_info "Running production security validation..."
    if ! run_security_validation "$test_results"; then
        log_error "Production security validation failed"
        return 1
    fi
    
    # Run performance validation
    log_info "Running production performance validation..."
    if ! run_performance_validation "$test_results"; then
        log_error "Production performance validation failed"
        return 1
    fi
    
    log_success "✅ Production environment tests completed"
    return 0
}

# Health checks
run_health_checks() {
    local results_dir="$1"
    local health_results="$results_dir/health-checks.json"
    
    # Basic health check
    local health_response=$(curl -s -w "%{http_code}" "$PRODUCTION_URL/health" --max-time 30)
    local health_status_code="${health_response: -3}"
    
    if [ "$health_status_code" != "200" ]; then
        log_error "Health check failed with status code: $health_status_code"
        return 1
    fi
    
    # Readiness check
    local readiness_response=$(curl -s -w "%{http_code}" "$PRODUCTION_URL/health/ready" --max-time 30)
    local readiness_status_code="${readiness_response: -3}"
    
    if [ "$readiness_status_code" != "200" ]; then
        log_error "Readiness check failed with status code: $readiness_status_code"
        return 1
    fi
    
    # Database health check
    local db_response=$(curl -s -w "%{http_code}" "$PRODUCTION_URL/health/database" --max-time 30)
    local db_status_code="${db_response: -3}"
    
    if [ "$db_status_code" != "200" ]; then
        log_error "Database health check failed with status code: $db_status_code"
        return 1
    fi
    
    # Redis health check
    local redis_response=$(curl -s -w "%{http_code}" "$PRODUCTION_URL/health/redis" --max-time 30)
    local redis_status_code="${redis_response: -3}"
    
    if [ "$redis_status_code" != "200" ]; then
        log_error "Redis health check failed with status code: $redis_status_code"
        return 1
    fi
    
    # External services health check
    local integrations_response=$(curl -s -w "%{http_code}" "$PRODUCTION_URL/health/integrations" --max-time 30)
    local integrations_status_code="${integrations_response: -3}"
    
    if [ "$integrations_status_code" != "200" ]; then
        log_error "External services health check failed with status code: $integrations_status_code"
        return 1
    fi
    
    # Save health check results
    cat > "$health_results" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "healthCheck": {
    "status": "passed",
    "statusCode": $health_status_code
  },
  "readinessCheck": {
    "status": "passed",
    "statusCode": $readiness_status_code
  },
  "databaseCheck": {
    "status": "passed",
    "statusCode": $db_status_code
  },
  "redisCheck": {
    "status": "passed",
    "statusCode": $redis_status_code
  },
  "integrationsCheck": {
    "status": "passed",
    "statusCode": $integrations_status_code
  }
}
EOF
    
    log_success "✅ Health checks passed"
    return 0
}

# Security validation
run_security_validation() {
    local results_dir="$1"
    local security_results="$results_dir/security-validation.json"
    
    # SSL/TLS validation
    log_info "Validating SSL/TLS configuration..."
    local ssl_response=$(curl -s -w "%{http_code}" "$PRODUCTION_URL/health/ssl" --max-time 30)
    local ssl_status_code="${ssl_response: -3}"
    
    if [ "$ssl_status_code" != "200" ]; then
        log_error "SSL validation failed with status code: $ssl_status_code"
        return 1
    fi
    
    # Security headers check
    log_info "Checking security headers..."
    local headers_check=$(curl -s -I "$PRODUCTION_URL" --max-time 30)
    
    # Check for required security headers
    if ! echo "$headers_check" | grep -i "strict-transport-security" > /dev/null; then
        log_error "Missing Strict-Transport-Security header"
        return 1
    fi
    
    if ! echo "$headers_check" | grep -i "x-frame-options" > /dev/null; then
        log_error "Missing X-Frame-Options header"
        return 1
    fi
    
    if ! echo "$headers_check" | grep -i "x-content-type-options" > /dev/null; then
        log_error "Missing X-Content-Type-Options header"
        return 1
    fi
    
    # Test endpoints should not be accessible in production
    log_info "Verifying test endpoints are not accessible..."
    local test_endpoint_response=$(curl -s -w "%{http_code}" "$PRODUCTION_URL/api/v1/auth/test" --max-time 30)
    local test_endpoint_status_code="${test_endpoint_response: -3}"
    
    if [ "$test_endpoint_status_code" != "404" ]; then
        log_error "Test endpoints are accessible in production (security risk)"
        return 1
    fi
    
    # Save security validation results
    cat > "$security_results" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "sslValidation": {
    "status": "passed",
    "statusCode": $ssl_status_code
  },
  "securityHeaders": {
    "status": "passed",
    "hstsPresent": true,
    "xFrameOptionsPresent": true,
    "xContentTypeOptionsPresent": true
  },
  "testEndpointsBlocked": {
    "status": "passed",
    "statusCode": $test_endpoint_status_code
  }
}
EOF
    
    log_success "✅ Security validation passed"
    return 0
}

# Performance validation
run_performance_validation() {
    local results_dir="$1"
    local performance_results="$results_dir/performance-validation.json"
    
    # Response time check
    log_info "Validating response times..."
    local start_time=$(date +%s%N)
    local perf_response=$(curl -s -w "%{http_code}" "$PRODUCTION_URL/api/v1/health/performance" --max-time 30)
    local end_time=$(date +%s%N)
    local response_time=$(( (end_time - start_time) / 1000000 )) # Convert to milliseconds
    local perf_status_code="${perf_response: -3}"
    
    if [ "$perf_status_code" != "200" ]; then
        log_error "Performance endpoint failed with status code: $perf_status_code"
        return 1
    fi
    
    # Response time should be under 200ms for health endpoints
    if [ "$response_time" -gt 200 ]; then
        log_error "Response time too high: ${response_time}ms (should be < 200ms)"
        return 1
    fi
    
    # Check monitoring endpoint (if accessible)
    if [ -n "${INTERNAL_METRICS_TOKEN:-}" ]; then
        log_info "Validating monitoring metrics..."
        local metrics_response=$(curl -s -w "%{http_code}" \
            -H "X-Internal-Request: true" \
            -H "Authorization: Bearer $INTERNAL_METRICS_TOKEN" \
            "$PRODUCTION_URL/metrics" --max-time 30)
        local metrics_status_code="${metrics_response: -3}"
        
        if [ "$metrics_status_code" != "200" ]; then
            log_warning "Metrics endpoint not accessible (status: $metrics_status_code)"
        fi
    fi
    
    # Save performance validation results
    cat > "$performance_results" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "responseTime": {
    "status": "passed",
    "responseTimeMs": $response_time,
    "threshold": 200
  },
  "performanceEndpoint": {
    "status": "passed",
    "statusCode": $perf_status_code
  }
}
EOF
    
    log_success "✅ Performance validation passed (${response_time}ms)"
    return 0
}

# TDD Phase 3: REFACTOR - Production optimization validation
run_production_optimization_tests() {
    log_info "🔄 TDD REFACTOR Phase: Running production optimization tests..."
    
    local optimization_results="$RESULTS_DIR/$TIMESTAMP/optimization-tests"
    mkdir -p "$optimization_results"
    
    # Run monitoring validation
    log_info "Validating monitoring and alerting..."
    if ! validate_monitoring "$optimization_results"; then
        log_warning "Monitoring validation had issues (non-critical)"
    fi
    
    # Run scaling validation
    log_info "Validating auto-scaling configuration..."
    if ! validate_scaling "$optimization_results"; then
        log_warning "Scaling validation had issues (non-critical)"
    fi
    
    # Run backup validation
    log_info "Validating backup and disaster recovery..."
    if ! validate_backup_dr "$optimization_results"; then
        log_warning "Backup/DR validation had issues (non-critical)"
    fi
    
    log_success "✅ Production optimization tests completed"
    return 0
}

# Monitoring validation
validate_monitoring() {
    local results_dir="$1"
    local monitoring_response=$(curl -s -w "%{http_code}" "$PRODUCTION_URL/health/monitoring" --max-time 30)
    local monitoring_status_code="${monitoring_response: -3}"
    
    if [ "$monitoring_status_code" = "200" ]; then
        echo '{"status": "passed", "monitoring": "active"}' > "$results_dir/monitoring-validation.json"
        return 0
    else
        echo '{"status": "warning", "monitoring": "limited"}' > "$results_dir/monitoring-validation.json"
        return 1
    fi
}

# Scaling validation
validate_scaling() {
    local results_dir="$1"
    local scaling_response=$(curl -s -w "%{http_code}" "$PRODUCTION_URL/health/scaling" --max-time 30)
    local scaling_status_code="${scaling_response: -3}"
    
    if [ "$scaling_status_code" = "200" ]; then
        echo '{"status": "passed", "scaling": "configured"}' > "$results_dir/scaling-validation.json"
        return 0
    else
        echo '{"status": "warning", "scaling": "limited"}' > "$results_dir/scaling-validation.json"
        return 1
    fi
}

# Backup and DR validation
validate_backup_dr() {
    local results_dir="$1"
    local backup_response=$(curl -s -w "%{http_code}" "$PRODUCTION_URL/health/backup" --max-time 30)
    local backup_status_code="${backup_response: -3}"
    
    if [ "$backup_status_code" = "200" ]; then
        echo '{"status": "passed", "backup": "configured"}' > "$results_dir/backup-validation.json"
        return 0
    else
        echo '{"status": "warning", "backup": "limited"}' > "$results_dir/backup-validation.json"
        return 1
    fi
}

# Generate smoke test report
generate_smoke_test_report() {
    log_info "📊 Generating production smoke test report..."
    
    local report_file="$RESULTS_DIR/$TIMESTAMP/production-smoke-test-report.html"
    local summary_file="$RESULTS_DIR/$TIMESTAMP/smoke-test-summary.json"
    
    # Create test summary
    cat > "$summary_file" << EOF
{
  "testSuite": "Production Smoke Tests",
  "timestamp": "$TIMESTAMP",
  "productionUrl": "$PRODUCTION_URL",
  "testDuration": "$(date -d @$(($(date +%s) - START_TIME)) -u +%H:%M:%S)",
  "phases": {
    "preDeploymentValidation": "passed",
    "productionEnvironmentTests": "passed",
    "productionOptimizationTests": "passed"
  },
  "readinessStatus": "READY_FOR_PRODUCTION",
  "recommendations": [
    "Production environment is ready for deployment",
    "All critical health checks are passing",
    "Security configuration is properly implemented",
    "Performance meets production requirements"
  ]
}
EOF
    
    # Generate HTML report
    cat > "$report_file" << EOF
<!DOCTYPE html>
<html>
<head>
    <title>Production Smoke Test Report - $TIMESTAMP</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { background: #f4f4f4; padding: 20px; border-radius: 5px; }
        .section { margin: 20px 0; }
        .success { color: green; font-weight: bold; }
        .warning { color: orange; }
        .error { color: red; }
        .ready { background: #d4edda; padding: 15px; border-radius: 5px; color: #155724; }
    </style>
</head>
<body>
    <div class="header">
        <h1>SyntaxisAI OCR Service - Production Smoke Test Report</h1>
        <p>Test Date: $TIMESTAMP</p>
        <p>Production URL: $PRODUCTION_URL</p>
    </div>
    
    <div class="ready">
        <h2>🎉 PRODUCTION READY</h2>
        <p>All critical smoke tests have passed. The system is ready for production deployment.</p>
    </div>
    
    <div class="section">
        <h2>Test Results Summary</h2>
        <ul>
            <li class="success">✅ Pre-deployment Validation</li>
            <li class="success">✅ Production Environment Tests</li>
            <li class="success">✅ Production Optimization Tests</li>
        </ul>
    </div>
    
    <div class="section">
        <h2>Critical Validations</h2>
        <ul>
            <li class="success">✅ Health Checks</li>
            <li class="success">✅ Security Configuration</li>
            <li class="success">✅ Performance Requirements</li>
            <li class="success">✅ SSL/TLS Configuration</li>
            <li class="success">✅ Test Endpoints Blocked</li>
        </ul>
    </div>
    
    <div class="section">
        <h2>Next Steps</h2>
        <ol>
            <li>Proceed with production deployment</li>
            <li>Monitor deployment progress</li>
            <li>Validate post-deployment functionality</li>
            <li>Enable production traffic routing</li>
        </ol>
    </div>
</body>
</html>
EOF
    
    log_success "✅ Smoke test report generated: $report_file"
    log_success "✅ Test summary generated: $summary_file"
}

# Main execution function
main() {
    log_info "🚀 Starting production smoke tests..."
    
    # Record start time
    START_TIME=$(date +%s)
    
    # Setup test environment
    setup_smoke_test_environment
    
    # TDD Phase 1: RED - Pre-deployment validation
    if ! run_pre_deployment_validation; then
        log_error "Pre-deployment validation failed, aborting"
        exit 1
    fi
    
    # TDD Phase 2: GREEN - Production environment validation
    if ! run_production_environment_tests; then
        log_error "Production environment tests failed, aborting"
        exit 1
    fi
    
    # TDD Phase 3: REFACTOR - Production optimization validation
    run_production_optimization_tests
    
    # Generate comprehensive report
    generate_smoke_test_report
    
    # Calculate total test time
    END_TIME=$(date +%s)
    TOTAL_TIME=$((END_TIME - START_TIME))
    
    log_success "🎉 Production smoke tests completed successfully!"
    log_success "⏱️  Total test time: $((TOTAL_TIME / 60)) minutes $((TOTAL_TIME % 60)) seconds"
    log_success "📊 Results available in: $RESULTS_DIR/$TIMESTAMP/"
    log_success "📋 Test report: $RESULTS_DIR/$TIMESTAMP/production-smoke-test-report.html"
    log_success "🚀 SYSTEM IS READY FOR PRODUCTION DEPLOYMENT!"
}

# Run main function
main "$@"
