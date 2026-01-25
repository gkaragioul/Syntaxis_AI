#!/bin/bash

# Production Health Monitor
# TDD-Driven Continuous Production Monitoring
# Task: Monitor production with test-driven health checks
# 
# This script implements continuous production monitoring following TDD principles:
# 1. RED: Define health check requirements and failure detection
# 2. GREEN: Implement health checks and monitoring
# 3. REFACTOR: Optimize monitoring performance and reliability

set -euo pipefail

# Configuration
PRODUCTION_URL="${PRODUCTION_URL:-https://api.syntaxis.ai}"
MONITORING_INTERVAL="${MONITORING_INTERVAL:-30}" # seconds
HEALTH_CHECK_TIMEOUT=10
ALERT_THRESHOLD_FAILURES=3
METRICS_RETENTION_DAYS=30
LOG_DIR="./monitoring-logs"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_DIR/monitor.log"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_DIR/monitor.log"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_DIR/monitor.log"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_DIR/monitor.log"
}

# Initialize monitoring
initialize_monitoring() {
    log_info "🔧 Initializing production health monitoring..."
    
    # Create log directory
    mkdir -p "$LOG_DIR"
    
    # Initialize monitoring state
    cat > "$LOG_DIR/monitoring-state.json" << EOF
{
  "monitoringStarted": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "productionUrl": "$PRODUCTION_URL",
  "monitoringInterval": $MONITORING_INTERVAL,
  "components": {
    "api_gateway": {"status": "unknown", "consecutiveFailures": 0, "lastCheck": null},
    "database": {"status": "unknown", "consecutiveFailures": 0, "lastCheck": null},
    "redis_cache": {"status": "unknown", "consecutiveFailures": 0, "lastCheck": null},
    "external_services": {"status": "unknown", "consecutiveFailures": 0, "lastCheck": null},
    "file_storage": {"status": "unknown", "consecutiveFailures": 0, "lastCheck": null}
  },
  "metrics": {
    "totalChecks": 0,
    "successfulChecks": 0,
    "failedChecks": 0,
    "alertsGenerated": 0
  }
}
EOF
    
    log_success "✅ Monitoring initialized"
}

# TDD Phase 1: RED - Health check requirements and failure detection
perform_health_checks() {
    log_info "🔴 TDD RED Phase: Performing comprehensive health checks..."
    
    local check_timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    local overall_health="healthy"
    local failed_components=()
    
    # API Gateway Health Check
    if ! check_api_gateway; then
        overall_health="degraded"
        failed_components+=("api_gateway")
        update_component_status "api_gateway" "unhealthy"
    else
        update_component_status "api_gateway" "healthy"
    fi
    
    # Database Health Check
    if ! check_database; then
        overall_health="degraded"
        failed_components+=("database")
        update_component_status "database" "unhealthy"
    else
        update_component_status "database" "healthy"
    fi
    
    # Redis Cache Health Check
    if ! check_redis_cache; then
        overall_health="degraded"
        failed_components+=("redis_cache")
        update_component_status "redis_cache" "unhealthy"
    else
        update_component_status "redis_cache" "healthy"
    fi
    
    # External Services Health Check
    if ! check_external_services; then
        overall_health="degraded"
        failed_components+=("external_services")
        update_component_status "external_services" "unhealthy"
    else
        update_component_status "external_services" "healthy"
    fi
    
    # File Storage Health Check
    if ! check_file_storage; then
        overall_health="degraded"
        failed_components+=("file_storage")
        update_component_status "file_storage" "unhealthy"
    else
        update_component_status "file_storage" "healthy"
    fi
    
    # Update metrics
    update_metrics_counter "totalChecks"
    if [ "$overall_health" = "healthy" ]; then
        update_metrics_counter "successfulChecks"
        log_success "✅ All health checks passed"
    else
        update_metrics_counter "failedChecks"
        log_warning "⚠️ Health check failures detected: ${failed_components[*]}"
        
        # Check if alerts should be triggered
        for component in "${failed_components[@]}"; do
            check_alert_threshold "$component"
        done
    fi
    
    # Log health check results
    cat >> "$LOG_DIR/health-checks.log" << EOF
{
  "timestamp": "$check_timestamp",
  "overallHealth": "$overall_health",
  "failedComponents": [$(printf '"%s",' "${failed_components[@]}" | sed 's/,$//')]
}
EOF
}

# Individual health check functions
check_api_gateway() {
    local start_time=$(date +%s%N)
    local response=$(curl -s -w "%{http_code}:%{time_total}" "$PRODUCTION_URL/health" --max-time $HEALTH_CHECK_TIMEOUT 2>/dev/null || echo "000:0")
    local end_time=$(date +%s%N)
    
    local status_code=$(echo "$response" | cut -d':' -f1)
    local response_time=$(echo "$response" | cut -d':' -f2)
    local total_time=$(( (end_time - start_time) / 1000000 )) # Convert to milliseconds
    
    log_info "API Gateway check: Status=$status_code, ResponseTime=${response_time}s"
    
    if [ "$status_code" = "200" ] && (( $(echo "$response_time < 2.0" | bc -l) )); then
        return 0
    else
        log_error "API Gateway health check failed: Status=$status_code, ResponseTime=${response_time}s"
        return 1
    fi
}

check_database() {
    local response=$(curl -s -w "%{http_code}" "$PRODUCTION_URL/health/database" --max-time $HEALTH_CHECK_TIMEOUT 2>/dev/null || echo "000")
    
    log_info "Database check: Status=$response"
    
    if [ "$response" = "200" ]; then
        return 0
    else
        log_error "Database health check failed: Status=$response"
        return 1
    fi
}

check_redis_cache() {
    local response=$(curl -s -w "%{http_code}" "$PRODUCTION_URL/health/redis" --max-time $HEALTH_CHECK_TIMEOUT 2>/dev/null || echo "000")
    
    log_info "Redis cache check: Status=$response"
    
    if [ "$response" = "200" ]; then
        return 0
    else
        log_error "Redis cache health check failed: Status=$response"
        return 1
    fi
}

check_external_services() {
    local response=$(curl -s -w "%{http_code}" "$PRODUCTION_URL/health/integrations" --max-time $HEALTH_CHECK_TIMEOUT 2>/dev/null || echo "000")
    
    log_info "External services check: Status=$response"
    
    if [ "$response" = "200" ]; then
        return 0
    else
        log_warning "External services health check failed: Status=$response"
        return 1
    fi
}

check_file_storage() {
    local response=$(curl -s -w "%{http_code}" "$PRODUCTION_URL/health/storage" --max-time $HEALTH_CHECK_TIMEOUT 2>/dev/null || echo "000")
    
    log_info "File storage check: Status=$response"
    
    if [ "$response" = "200" ]; then
        return 0
    else
        log_error "File storage health check failed: Status=$response"
        return 1
    fi
}

# TDD Phase 2: GREEN - Implement monitoring and alerting
collect_performance_metrics() {
    log_info "🟢 TDD GREEN Phase: Collecting performance metrics..."
    
    local metrics_timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    
    # Collect system metrics
    local cpu_usage=$(kubectl top nodes --no-headers | awk '{sum+=$3} END {print sum/NR}' | sed 's/%//' || echo "0")
    local memory_usage=$(kubectl top nodes --no-headers | awk '{sum+=$5} END {print sum/NR}' | sed 's/%//' || echo "0")
    
    # Collect application metrics
    local pod_count=$(kubectl get pods -n production --no-headers | wc -l || echo "0")
    local ready_pods=$(kubectl get pods -n production --no-headers | grep "Running" | grep "1/1" | wc -l || echo "0")
    
    # Collect business metrics (if metrics endpoint is accessible)
    local total_requests=0
    local error_rate=0
    local avg_response_time=0
    
    if [ -n "${INTERNAL_METRICS_TOKEN:-}" ]; then
        local metrics_response=$(curl -s \
            -H "Authorization: Bearer $INTERNAL_METRICS_TOKEN" \
            "$PRODUCTION_URL/metrics" \
            --max-time $HEALTH_CHECK_TIMEOUT 2>/dev/null || echo "")
        
        if [ -n "$metrics_response" ]; then
            # Parse Prometheus metrics (simplified)
            total_requests=$(echo "$metrics_response" | grep "http_requests_total" | tail -1 | awk '{print $2}' || echo "0")
            error_rate=$(echo "$metrics_response" | grep "http_request_errors_rate" | tail -1 | awk '{print $2}' || echo "0")
            avg_response_time=$(echo "$metrics_response" | grep "http_request_duration_seconds_avg" | tail -1 | awk '{print $2}' || echo "0")
        fi
    fi
    
    # Log metrics
    cat >> "$LOG_DIR/performance-metrics.log" << EOF
{
  "timestamp": "$metrics_timestamp",
  "infrastructure": {
    "cpuUsage": $cpu_usage,
    "memoryUsage": $memory_usage,
    "podCount": $pod_count,
    "readyPods": $ready_pods
  },
  "application": {
    "totalRequests": $total_requests,
    "errorRate": $error_rate,
    "avgResponseTime": $avg_response_time
  }
}
EOF
    
    # Check thresholds and generate alerts
    check_performance_thresholds "$cpu_usage" "$memory_usage" "$error_rate" "$avg_response_time"
    
    log_info "Performance metrics collected: CPU=${cpu_usage}%, Memory=${memory_usage}%, Pods=${ready_pods}/${pod_count}"
}

check_performance_thresholds() {
    local cpu_usage=$1
    local memory_usage=$2
    local error_rate=$3
    local avg_response_time=$4
    
    # CPU threshold check
    if (( $(echo "$cpu_usage > 80" | bc -l) )); then
        generate_alert "high_cpu_usage" "critical" "CPU usage is ${cpu_usage}% (threshold: 80%)"
    fi
    
    # Memory threshold check
    if (( $(echo "$memory_usage > 85" | bc -l) )); then
        generate_alert "high_memory_usage" "critical" "Memory usage is ${memory_usage}% (threshold: 85%)"
    fi
    
    # Error rate threshold check
    if (( $(echo "$error_rate > 0.01" | bc -l) )); then
        generate_alert "high_error_rate" "high" "Error rate is ${error_rate} (threshold: 0.01)"
    fi
    
    # Response time threshold check
    if (( $(echo "$avg_response_time > 2.0" | bc -l) )); then
        generate_alert "high_response_time" "warning" "Average response time is ${avg_response_time}s (threshold: 2.0s)"
    fi
}

# TDD Phase 3: REFACTOR - Optimize monitoring and implement intelligent features
implement_intelligent_monitoring() {
    log_info "🔄 TDD REFACTOR Phase: Implementing intelligent monitoring features..."
    
    # Trend analysis
    analyze_trends
    
    # Predictive alerting
    predictive_analysis
    
    # Auto-remediation
    check_auto_remediation_opportunities
    
    log_info "Intelligent monitoring features updated"
}

analyze_trends() {
    # Analyze trends from the last 24 hours of data
    local trend_file="$LOG_DIR/trends-$(date +%Y%m%d).json"
    
    # Simple trend analysis (in production, this would be more sophisticated)
    local recent_failures=$(tail -100 "$LOG_DIR/health-checks.log" | grep -c '"overallHealth": "degraded"' || echo "0")
    local total_recent_checks=$(tail -100 "$LOG_DIR/health-checks.log" | wc -l || echo "1")
    local failure_rate=$(echo "scale=4; $recent_failures / $total_recent_checks" | bc -l || echo "0")
    
    cat > "$trend_file" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "trends": {
    "failureRate": $failure_rate,
    "recentFailures": $recent_failures,
    "totalChecks": $total_recent_checks,
    "trend": "$(if (( $(echo "$failure_rate > 0.1" | bc -l) )); then echo "degrading"; else echo "stable"; fi)"
  }
}
EOF
    
    if (( $(echo "$failure_rate > 0.1" | bc -l) )); then
        generate_alert "degrading_trend" "warning" "System reliability trend is degrading (failure rate: ${failure_rate})"
    fi
}

predictive_analysis() {
    # Simple predictive analysis based on patterns
    local prediction_file="$LOG_DIR/predictions-$(date +%Y%m%d).json"
    
    # Analyze patterns (simplified)
    local current_hour=$(date +%H)
    local historical_issues=0
    
    # Check if this hour typically has issues (simplified pattern matching)
    if [ "$current_hour" -ge 9 ] && [ "$current_hour" -le 17 ]; then
        historical_issues=1 # Business hours typically have more load
    fi
    
    cat > "$prediction_file" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "predictions": {
    "riskLevel": "$(if [ $historical_issues -eq 1 ]; then echo "medium"; else echo "low"; fi)",
    "recommendedActions": [
      "$(if [ $historical_issues -eq 1 ]; then echo "Monitor closely during business hours"; else echo "Continue normal monitoring"; fi)"
    ]
  }
}
EOF
}

check_auto_remediation_opportunities() {
    # Check for common issues that can be auto-remediated
    local state_file="$LOG_DIR/monitoring-state.json"
    
    if [ -f "$state_file" ]; then
        # Check for pods that might need restart (simplified)
        local unhealthy_pods=$(kubectl get pods -n production --no-headers | grep -v "Running\|Completed" | wc -l || echo "0")
        
        if [ "$unhealthy_pods" -gt 0 ]; then
            log_warning "Found $unhealthy_pods unhealthy pods - auto-remediation opportunity detected"
            
            # In production, this would trigger actual remediation
            cat >> "$LOG_DIR/auto-remediation.log" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "opportunity": "restart_unhealthy_pods",
  "count": $unhealthy_pods,
  "action": "would_restart_pods"
}
EOF
        fi
    fi
}

# Utility functions
update_component_status() {
    local component=$1
    local status=$2
    local state_file="$LOG_DIR/monitoring-state.json"
    
    if [ -f "$state_file" ]; then
        # Update component status (simplified - in production would use jq)
        local current_failures=$(grep -o "\"$component\".*\"consecutiveFailures\": [0-9]*" "$state_file" | grep -o '[0-9]*$' || echo "0")
        
        if [ "$status" = "unhealthy" ]; then
            current_failures=$((current_failures + 1))
        else
            current_failures=0
        fi
        
        # Log status update
        echo "Component $component status: $status (consecutive failures: $current_failures)" >> "$LOG_DIR/component-status.log"
    fi
}

update_metrics_counter() {
    local counter=$1
    local state_file="$LOG_DIR/monitoring-state.json"
    
    if [ -f "$state_file" ]; then
        # Increment counter (simplified)
        echo "Incremented $counter at $(date)" >> "$LOG_DIR/metrics-counters.log"
    fi
}

check_alert_threshold() {
    local component=$1
    local state_file="$LOG_DIR/monitoring-state.json"
    
    # Check if component has exceeded failure threshold
    local current_failures=$(grep -o "\"$component\".*\"consecutiveFailures\": [0-9]*" "$state_file" | grep -o '[0-9]*$' || echo "0")
    
    if [ "$current_failures" -ge "$ALERT_THRESHOLD_FAILURES" ]; then
        generate_alert "component_failure" "critical" "Component $component has failed $current_failures consecutive times"
    fi
}

generate_alert() {
    local alert_type=$1
    local severity=$2
    local message=$3
    local alert_timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    
    log_error "ALERT [$severity]: $alert_type - $message"
    
    # Log alert
    cat >> "$LOG_DIR/alerts.log" << EOF
{
  "timestamp": "$alert_timestamp",
  "type": "$alert_type",
  "severity": "$severity",
  "message": "$message"
}
EOF
    
    # Send notifications (if configured)
    send_alert_notification "$alert_type" "$severity" "$message"
    
    # Update alert counter
    update_metrics_counter "alertsGenerated"
}

send_alert_notification() {
    local alert_type=$1
    local severity=$2
    local message=$3
    
    # Slack notification
    if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
        local emoji="⚠️"
        if [ "$severity" = "critical" ]; then
            emoji="🚨"
        elif [ "$severity" = "warning" ]; then
            emoji="⚠️"
        fi
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"$emoji Production Alert [$severity]: $message\"}" \
            "$SLACK_WEBHOOK_URL" > /dev/null 2>&1 || true
    fi
    
    # Email notification (if configured)
    if [ -n "${ALERT_EMAIL:-}" ]; then
        echo "Production Alert [$severity]: $message" | mail -s "SyntaxisAI Production Alert" "$ALERT_EMAIL" > /dev/null 2>&1 || true
    fi
}

# Cleanup old logs
cleanup_old_logs() {
    find "$LOG_DIR" -name "*.log" -mtime +$METRICS_RETENTION_DAYS -delete 2>/dev/null || true
    find "$LOG_DIR" -name "*.json" -mtime +$METRICS_RETENTION_DAYS -delete 2>/dev/null || true
}

# Main monitoring loop
run_monitoring_loop() {
    log_info "🚀 Starting continuous production monitoring..."
    log_info "Monitoring URL: $PRODUCTION_URL"
    log_info "Check interval: ${MONITORING_INTERVAL} seconds"
    
    while true; do
        # Perform health checks
        perform_health_checks
        
        # Collect performance metrics
        collect_performance_metrics
        
        # Implement intelligent monitoring
        implement_intelligent_monitoring
        
        # Cleanup old logs
        cleanup_old_logs
        
        # Wait for next check
        sleep $MONITORING_INTERVAL
    done
}

# Signal handlers
cleanup() {
    log_info "Monitoring stopped"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Main execution
main() {
    initialize_monitoring
    run_monitoring_loop
}

# Run main function
main "$@"
