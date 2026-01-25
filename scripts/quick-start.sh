#!/bin/bash

# SyntaxisAI OCR Service - Quick Start Script
# This script sets up and runs the complete system for testing

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Check prerequisites
check_prerequisites() {
    log_info "🔍 Checking prerequisites..."
    
    local missing_tools=()
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        missing_tools+=("Node.js 18+")
    else
        local node_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$node_version" -lt 18 ]; then
            missing_tools+=("Node.js 18+ (current: $(node --version))")
        fi
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        missing_tools+=("npm")
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        missing_tools+=("Docker")
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        missing_tools+=("Docker Compose")
    fi
    
    # Check curl
    if ! command -v curl &> /dev/null; then
        missing_tools+=("curl")
    fi
    
    # Check jq (optional but recommended)
    if ! command -v jq &> /dev/null; then
        log_warning "jq is not installed (optional but recommended for JSON parsing)"
    fi
    
    if [ ${#missing_tools[@]} -gt 0 ]; then
        log_error "Missing required tools:"
        for tool in "${missing_tools[@]}"; do
            echo "  - $tool"
        done
        echo ""
        echo "Please install the missing tools and run this script again."
        exit 1
    fi
    
    log_success "✅ All prerequisites are installed"
}

# Setup environment
setup_environment() {
    log_info "🔧 Setting up environment..."
    
    # Create necessary directories
    mkdir -p logs
    mkdir -p uploads
    mkdir -p test-files
    mkdir -p demo-files
    
    # Create environment file if it doesn't exist
    if [ ! -f .env ]; then
        log_info "Creating .env file..."
        cat > .env << 'EOF'
# SyntaxisAI OCR Service Environment Configuration

# Application
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/syntaxis_ocr
DB_HOST=localhost
DB_PORT=5432
DB_NAME=syntaxis_ocr
DB_USER=postgres
DB_PASSWORD=password

# Redis
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

# External APIs (add your actual keys)
GOOGLE_VISION_API_KEY=your-google-vision-api-key
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1

# Security
JWT_SECRET=your-jwt-secret-key
API_KEY_SALT=your-api-key-salt

# Monitoring
SENTRY_DSN=your-sentry-dsn
ENABLE_METRICS=true

# File Upload
MAX_FILE_SIZE=100MB
UPLOAD_DIR=./uploads

# Rate Limiting
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX_REQUESTS=100
EOF
        log_success "✅ Created .env file (please update with your actual API keys)"
    else
        log_info "✅ .env file already exists"
    fi
    
    # Create Docker Compose file if it doesn't exist
    if [ ! -f docker-compose.yml ]; then
        log_info "Creating docker-compose.yml..."
        cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: syntaxis_ocr
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana

volumes:
  postgres_data:
  redis_data:
  grafana_data:
EOF
        log_success "✅ Created docker-compose.yml"
    else
        log_info "✅ docker-compose.yml already exists"
    fi
    
    # Create monitoring configuration
    mkdir -p monitoring
    if [ ! -f monitoring/prometheus.yml ]; then
        cat > monitoring/prometheus.yml << 'EOF'
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'syntaxis-ocr'
    static_configs:
      - targets: ['host.docker.internal:3000']
    metrics_path: '/metrics'
    scrape_interval: 15s
EOF
        log_success "✅ Created Prometheus configuration"
    fi
}

# Install dependencies
install_dependencies() {
    log_info "📦 Installing dependencies..."
    
    if [ ! -d node_modules ]; then
        npm install
        log_success "✅ Dependencies installed"
    else
        log_info "✅ Dependencies already installed"
    fi
}

# Start services
start_services() {
    log_info "🚀 Starting services..."
    
    # Start Docker services
    log_info "Starting Docker services (PostgreSQL, Redis, Prometheus, Grafana)..."
    docker-compose up -d
    
    # Wait for services to be ready
    log_info "Waiting for services to be ready..."
    sleep 10
    
    # Check if services are running
    local postgres_ready=false
    local redis_ready=false
    local attempts=0
    local max_attempts=30
    
    while [ $attempts -lt $max_attempts ] && { [ "$postgres_ready" = false ] || [ "$redis_ready" = false ]; }; do
        if ! $postgres_ready && docker-compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then
            postgres_ready=true
            log_success "✅ PostgreSQL is ready"
        fi
        
        if ! $redis_ready && docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; then
            redis_ready=true
            log_success "✅ Redis is ready"
        fi
        
        if [ "$postgres_ready" = false ] || [ "$redis_ready" = false ]; then
            echo -n "."
            sleep 2
            attempts=$((attempts + 1))
        fi
    done
    
    if [ "$postgres_ready" = false ] || [ "$redis_ready" = false ]; then
        log_error "Services failed to start within timeout"
        exit 1
    fi
    
    log_success "✅ All Docker services are running"
}

# Setup database
setup_database() {
    log_info "🗄️ Setting up database..."
    
    # Run database migrations (simulated)
    log_info "Running database migrations..."
    docker-compose exec -T postgres psql -U postgres -d syntaxis_ocr -c "
        CREATE TABLE IF NOT EXISTS files (
            id SERIAL PRIMARY KEY,
            filename VARCHAR(255) NOT NULL,
            file_path VARCHAR(500) NOT NULL,
            file_size INTEGER NOT NULL,
            mime_type VARCHAR(100) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS ocr_results (
            id SERIAL PRIMARY KEY,
            file_id INTEGER REFERENCES files(id),
            processing_id VARCHAR(255) UNIQUE NOT NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'pending',
            extracted_text TEXT,
            confidence DECIMAL(5,4),
            language VARCHAR(10),
            engine VARCHAR(50),
            processing_time DECIMAL(10,3),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            api_key VARCHAR(255) UNIQUE NOT NULL,
            subscription VARCHAR(50) DEFAULT 'free',
            quota_monthly INTEGER DEFAULT 1000,
            quota_used INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Insert test user
        INSERT INTO users (email, api_key, subscription, quota_monthly) 
        VALUES ('test@syntaxis.ai', 'test-api-key-123', 'premium', 10000)
        ON CONFLICT (email) DO NOTHING;
    " > /dev/null 2>&1
    
    log_success "✅ Database setup completed"
}

# Start application
start_application() {
    log_info "🚀 Starting SyntaxisAI OCR Service..."
    
    # Start the application in background
    npm run dev > logs/app.log 2>&1 &
    local app_pid=$!
    echo $app_pid > .app.pid
    
    # Wait for application to start
    local app_ready=false
    local attempts=0
    local max_attempts=30
    
    while [ $attempts -lt $max_attempts ] && [ "$app_ready" = false ]; do
        if curl -s http://localhost:3000/health > /dev/null 2>&1; then
            app_ready=true
            log_success "✅ SyntaxisAI OCR Service is running at http://localhost:3000"
        else
            echo -n "."
            sleep 2
            attempts=$((attempts + 1))
        fi
    done
    
    if [ "$app_ready" = false ]; then
        log_error "Application failed to start within timeout"
        log_info "Check logs/app.log for details"
        exit 1
    fi
}

# Show status
show_status() {
    log_info "📊 System Status:"
    echo ""
    echo "🌐 Services:"
    echo "  • SyntaxisAI OCR API: http://localhost:3000"
    echo "  • Health Check: http://localhost:3000/health"
    echo "  • Metrics: http://localhost:3000/metrics"
    echo "  • Grafana Dashboard: http://localhost:3001 (admin/admin)"
    echo "  • Prometheus: http://localhost:9090"
    echo ""
    echo "🗄️ Databases:"
    echo "  • PostgreSQL: localhost:5432 (postgres/password)"
    echo "  • Redis: localhost:6379"
    echo ""
    echo "📁 Important Files:"
    echo "  • Application logs: logs/app.log"
    echo "  • Environment config: .env"
    echo "  • Docker services: docker-compose.yml"
    echo ""
    echo "🧪 Testing:"
    echo "  • Run tests: npm test"
    echo "  • Interactive demo: ./scripts/demo-system.sh"
    echo "  • Load testing: ./scripts/run-load-tests.sh"
    echo ""
    echo "🛑 To stop services:"
    echo "  • Stop app: kill \$(cat .app.pid)"
    echo "  • Stop Docker: docker-compose down"
}

# Main function
main() {
    echo -e "${BLUE}🎉 SyntaxisAI OCR Service - Quick Start${NC}\n"
    
    check_prerequisites
    setup_environment
    install_dependencies
    start_services
    setup_database
    start_application
    
    echo ""
    log_success "🎉 Setup completed successfully!"
    echo ""
    show_status
    echo ""
    echo -e "${GREEN}Ready to test! Run: ./scripts/demo-system.sh${NC}"
    echo ""
}

# Cleanup function
cleanup() {
    log_info "Cleaning up..."
    if [ -f .app.pid ]; then
        kill $(cat .app.pid) 2>/dev/null || true
        rm .app.pid
    fi
}

trap cleanup EXIT

# Run main function
main "$@"
