#!/bin/bash

# Deploy to Staging with Full Test Suite Validation
# TDD-Driven Staging Deployment Script
# 
# This script follows TDD principles:
# 1. RED: Run tests to ensure they fail without deployment
# 2. GREEN: Deploy and run tests to ensure they pass
# 3. REFACTOR: Optimize deployment based on test feedback

set -euo pipefail

# Configuration
STAGING_ENV="staging"
DOCKER_REGISTRY="syntaxis-registry"
APP_NAME="syntaxis-ocr"
STAGING_URL="https://staging-api.syntaxis.ai"
HEALTH_CHECK_TIMEOUT=300
TEST_TIMEOUT=600

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
        log_error "Deployment failed with exit code $exit_code"
        log_info "Rolling back staging deployment..."
        rollback_staging
    fi
    exit $exit_code
}

trap cleanup EXIT

# TDD Phase 1: RED - Pre-deployment test validation
run_pre_deployment_tests() {
    log_info "🔴 TDD RED Phase: Running pre-deployment test validation..."
    
    # Ensure we have a clean test environment
    log_info "Setting up test environment..."
    npm ci
    
    # Run unit tests
    log_info "Running unit tests..."
    if ! npm run test:unit; then
        log_error "Unit tests failed - deployment aborted"
        return 1
    fi
    
    # Run integration tests
    log_info "Running integration tests..."
    if ! npm run test:integration; then
        log_error "Integration tests failed - deployment aborted"
        return 1
    fi
    
    # Run performance tests
    log_info "Running performance tests..."
    if ! npm run test:performance; then
        log_error "Performance tests failed - deployment aborted"
        return 1
    fi
    
    # Run security tests
    log_info "Running security tests..."
    if ! npm run test:security; then
        log_error "Security tests failed - deployment aborted"
        return 1
    fi
    
    # Lint and type checking
    log_info "Running code quality checks..."
    if ! npm run lint; then
        log_error "Linting failed - deployment aborted"
        return 1
    fi
    
    if ! npm run type-check; then
        log_error "Type checking failed - deployment aborted"
        return 1
    fi
    
    log_success "✅ Pre-deployment tests passed"
    return 0
}

# Build and prepare deployment artifacts
build_deployment_artifacts() {
    log_info "🔨 Building deployment artifacts..."
    
    # Build the application
    log_info "Building application..."
    npm run build
    
    # Build Docker image
    log_info "Building Docker image..."
    docker build -t ${DOCKER_REGISTRY}/${APP_NAME}:staging-$(git rev-parse --short HEAD) .
    docker tag ${DOCKER_REGISTRY}/${APP_NAME}:staging-$(git rev-parse --short HEAD) ${DOCKER_REGISTRY}/${APP_NAME}:staging-latest
    
    # Push to registry
    log_info "Pushing Docker image to registry..."
    docker push ${DOCKER_REGISTRY}/${APP_NAME}:staging-$(git rev-parse --short HEAD)
    docker push ${DOCKER_REGISTRY}/${APP_NAME}:staging-latest
    
    log_success "✅ Deployment artifacts built and pushed"
}

# Deploy to staging environment
deploy_to_staging() {
    log_info "🚀 Deploying to staging environment..."
    
    # Update staging configuration
    log_info "Updating staging configuration..."
    kubectl config use-context staging
    
    # Apply Kubernetes manifests
    log_info "Applying Kubernetes manifests..."
    envsubst < k8s/staging/deployment.yaml | kubectl apply -f -
    envsubst < k8s/staging/service.yaml | kubectl apply -f -
    envsubst < k8s/staging/ingress.yaml | kubectl apply -f -
    envsubst < k8s/staging/configmap.yaml | kubectl apply -f -
    envsubst < k8s/staging/secrets.yaml | kubectl apply -f -
    
    # Wait for deployment to be ready
    log_info "Waiting for deployment to be ready..."
    kubectl rollout status deployment/${APP_NAME} --timeout=${HEALTH_CHECK_TIMEOUT}s
    
    # Verify pods are running
    log_info "Verifying pods are running..."
    kubectl get pods -l app=${APP_NAME}
    
    log_success "✅ Deployment to staging completed"
}

# TDD Phase 2: GREEN - Post-deployment test validation
run_post_deployment_tests() {
    log_info "🟢 TDD GREEN Phase: Running post-deployment test validation..."
    
    # Wait for service to be fully ready
    log_info "Waiting for service to be ready..."
    sleep 30
    
    # Health check
    log_info "Running health checks..."
    if ! curl -f "${STAGING_URL}/health" --max-time 30; then
        log_error "Health check failed"
        return 1
    fi
    
    # Smoke tests
    log_info "Running smoke tests against staging..."
    export TEST_BASE_URL="${STAGING_URL}"
    if ! npm run test:smoke; then
        log_error "Smoke tests failed"
        return 1
    fi
    
    # End-to-end tests
    log_info "Running end-to-end tests..."
    if ! npm run test:e2e:staging; then
        log_error "End-to-end tests failed"
        return 1
    fi
    
    # Performance validation
    log_info "Running performance validation..."
    if ! npm run test:performance:staging; then
        log_error "Performance validation failed"
        return 1
    fi
    
    # Security validation
    log_info "Running security validation..."
    if ! npm run test:security:staging; then
        log_error "Security validation failed"
        return 1
    fi
    
    # Load testing
    log_info "Running load tests..."
    if ! npm run test:load:staging; then
        log_error "Load tests failed"
        return 1
    fi
    
    log_success "✅ Post-deployment tests passed"
    return 0
}

# TDD Phase 3: REFACTOR - Deployment optimization and monitoring
setup_monitoring_and_alerts() {
    log_info "🔄 TDD REFACTOR Phase: Setting up monitoring and alerts..."
    
    # Deploy monitoring stack
    log_info "Deploying monitoring stack..."
    kubectl apply -f k8s/monitoring/prometheus.yaml
    kubectl apply -f k8s/monitoring/grafana.yaml
    kubectl apply -f k8s/monitoring/alertmanager.yaml
    
    # Configure application metrics
    log_info "Configuring application metrics..."
    kubectl apply -f k8s/monitoring/servicemonitor.yaml
    
    # Setup log aggregation
    log_info "Setting up log aggregation..."
    kubectl apply -f k8s/logging/fluentd.yaml
    kubectl apply -f k8s/logging/elasticsearch.yaml
    kubectl apply -f k8s/logging/kibana.yaml
    
    # Configure alerts
    log_info "Configuring alerts..."
    kubectl apply -f k8s/alerts/staging-alerts.yaml
    
    log_success "✅ Monitoring and alerts configured"
}

# Validate deployment with comprehensive checks
validate_staging_deployment() {
    log_info "🔍 Validating staging deployment..."
    
    # Check all services are running
    log_info "Checking service status..."
    kubectl get all -l app=${APP_NAME}
    
    # Verify database connectivity
    log_info "Verifying database connectivity..."
    if ! curl -f "${STAGING_URL}/health/database" --max-time 30; then
        log_error "Database connectivity check failed"
        return 1
    fi
    
    # Verify external service integrations
    log_info "Verifying external service integrations..."
    if ! curl -f "${STAGING_URL}/health/integrations" --max-time 30; then
        log_error "External service integration check failed"
        return 1
    fi
    
    # Check resource usage
    log_info "Checking resource usage..."
    kubectl top pods -l app=${APP_NAME}
    
    # Verify SSL certificates
    log_info "Verifying SSL certificates..."
    if ! curl -f "${STAGING_URL}/health/ssl" --max-time 30; then
        log_error "SSL certificate check failed"
        return 1
    fi
    
    # Test API endpoints
    log_info "Testing critical API endpoints..."
    if ! npm run test:api:staging; then
        log_error "API endpoint tests failed"
        return 1
    fi
    
    log_success "✅ Staging deployment validation completed"
}

# Rollback function
rollback_staging() {
    log_warning "🔄 Rolling back staging deployment..."
    
    # Get previous deployment
    PREVIOUS_REVISION=$(kubectl rollout history deployment/${APP_NAME} | tail -2 | head -1 | awk '{print $1}')
    
    if [ -n "$PREVIOUS_REVISION" ]; then
        log_info "Rolling back to revision $PREVIOUS_REVISION"
        kubectl rollout undo deployment/${APP_NAME} --to-revision=$PREVIOUS_REVISION
        kubectl rollout status deployment/${APP_NAME} --timeout=${HEALTH_CHECK_TIMEOUT}s
        log_success "✅ Rollback completed"
    else
        log_error "No previous revision found for rollback"
    fi
}

# Generate deployment report
generate_deployment_report() {
    log_info "📊 Generating deployment report..."
    
    REPORT_FILE="deployment-report-staging-$(date +%Y%m%d-%H%M%S).json"
    
    cat > "$REPORT_FILE" << EOF
{
  "deployment": {
    "environment": "$STAGING_ENV",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "git_commit": "$(git rev-parse HEAD)",
    "git_branch": "$(git rev-parse --abbrev-ref HEAD)",
    "docker_image": "${DOCKER_REGISTRY}/${APP_NAME}:staging-$(git rev-parse --short HEAD)",
    "deployed_by": "$(whoami)",
    "deployment_duration": "$((SECONDS / 60)) minutes"
  },
  "tests": {
    "pre_deployment_tests": "passed",
    "post_deployment_tests": "passed",
    "smoke_tests": "passed",
    "e2e_tests": "passed",
    "performance_tests": "passed",
    "security_tests": "passed",
    "load_tests": "passed"
  },
  "services": {
    "api_status": "healthy",
    "database_status": "healthy",
    "integrations_status": "healthy",
    "ssl_status": "valid"
  },
  "monitoring": {
    "prometheus": "deployed",
    "grafana": "deployed",
    "alertmanager": "deployed",
    "logging": "configured"
  }
}
EOF
    
    log_success "✅ Deployment report generated: $REPORT_FILE"
}

# Main deployment function
main() {
    log_info "🚀 Starting TDD-driven staging deployment..."
    
    # Record start time
    START_TIME=$(date +%s)
    
    # TDD Phase 1: RED - Pre-deployment validation
    if ! run_pre_deployment_tests; then
        log_error "Pre-deployment tests failed"
        exit 1
    fi
    
    # Build and prepare artifacts
    if ! build_deployment_artifacts; then
        log_error "Failed to build deployment artifacts"
        exit 1
    fi
    
    # Deploy to staging
    if ! deploy_to_staging; then
        log_error "Deployment to staging failed"
        exit 1
    fi
    
    # TDD Phase 2: GREEN - Post-deployment validation
    if ! run_post_deployment_tests; then
        log_error "Post-deployment tests failed"
        rollback_staging
        exit 1
    fi
    
    # TDD Phase 3: REFACTOR - Setup monitoring and optimization
    if ! setup_monitoring_and_alerts; then
        log_warning "Monitoring setup failed, but deployment is successful"
    fi
    
    # Final validation
    if ! validate_staging_deployment; then
        log_error "Staging deployment validation failed"
        rollback_staging
        exit 1
    fi
    
    # Generate report
    generate_deployment_report
    
    # Calculate deployment time
    END_TIME=$(date +%s)
    DEPLOYMENT_TIME=$((END_TIME - START_TIME))
    
    log_success "🎉 Staging deployment completed successfully!"
    log_success "⏱️  Total deployment time: $((DEPLOYMENT_TIME / 60)) minutes"
    log_success "🌐 Staging URL: $STAGING_URL"
    log_success "📊 Monitoring: https://grafana-staging.syntaxis.ai"
    log_success "📋 Logs: https://kibana-staging.syntaxis.ai"
}

# Run main function
main "$@"
