#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting development environment setup...${NC}"

# Check for required tools
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Error: Docker Compose is not installed${NC}"
    exit 1
fi

# Create necessary directories
echo -e "${YELLOW}Creating required directories...${NC}"
mkdir -p backend/uploads
mkdir -p backend/temp
mkdir -p frontend/public

# Create environment files if they don't exist
echo -e "${YELLOW}Setting up environment files...${NC}"

# Backend environment
if [ ! -f backend/.env.development ]; then
    echo "Creating backend/.env.development..."
    cat > backend/.env.development << EOL
# Server Configuration
PORT=3001
NODE_ENV=development

# Database Configuration
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/syntaxis_ai_dev

# JWT Configuration
JWT_SECRET=dev-jwt-secret-change-in-production
JWT_EXPIRES_IN=24h

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Email Configuration
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=noreply@syntaxis.ai

# OCR Workers
OCR_WORKER_COUNT=2
OCR_WORKER_TIMEOUT=300000

# Upload Configuration
UPLOADS_DIR=./uploads
TEMP_DIR=./temp
MAX_FILE_SIZE=104857600
ALLOWED_FILE_TYPES=application/pdf

# Logging
LOG_LEVEL=debug
LOG_FORMAT=dev

# Security
CORS_ORIGIN=http://localhost:5173
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=1000

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9090
EOL
fi

# Frontend environment
if [ ! -f frontend/.env.development ]; then
    echo "Creating frontend/.env.development..."
    cat > frontend/.env.development << EOL
# API Configuration
VITE_API_BASE_URL=http://localhost:3001
VITE_API_TIMEOUT=30000

# Feature Flags
VITE_ENABLE_MOCK_API=false
VITE_ENABLE_ANALYTICS=false

# Upload Configuration
VITE_MAX_FILE_SIZE=104857600  # 100MB in bytes
VITE_ALLOWED_FILE_TYPES=application/pdf
VITE_MAX_FILES_PER_BATCH=50

# Development Tools
VITE_ENABLE_DEVTOOLS=true
VITE_ENABLE_LOGGING=true
VITE_LOG_LEVEL=debug

# Security
VITE_CORS_ORIGIN=http://localhost:5173
VITE_RATE_LIMIT_WINDOW_MS=60000
VITE_RATE_LIMIT_MAX=1000
EOL
fi

# Start Docker services
echo -e "${YELLOW}Starting Docker services...${NC}"
docker-compose up -d

# Wait for services to be ready
echo -e "${YELLOW}Waiting for services to be ready...${NC}"
sleep 10

# Install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
npm install

# Run database migrations
echo -e "${YELLOW}Running database migrations...${NC}"
cd backend && npx prisma migrate deploy && npx prisma generate && cd ..

echo -e "${GREEN}Development environment setup complete!${NC}"
echo -e "${YELLOW}You can now start the development servers with:${NC}"
echo -e "  npm run dev" 