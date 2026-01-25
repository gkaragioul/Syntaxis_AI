#!/bin/bash

# Test CI Locally - Simulate GitHub Actions environment
# This script helps debug CI issues locally before pushing

set -e

echo "🧪 Testing CI Pipeline Locally"
echo "================================"

# Set environment variables similar to CI
export NODE_ENV=test
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/syntaxis_test"
export DATABASE_TEST_URL="postgresql://postgres:postgres@localhost:5432/syntaxis_test"
export REDIS_URL="redis://localhost:6379"
export REDIS_TEST_URL="redis://localhost:6379/1"
export CI=true

echo "📋 Environment Variables Set:"
echo "NODE_ENV: $NODE_ENV"
echo "DATABASE_URL: $DATABASE_URL"
echo "REDIS_URL: $REDIS_URL"
echo ""

# Check if services are running
echo "🔍 Checking Services..."

# Check PostgreSQL
if ! pg_isready -h localhost -p 5432 -U postgres > /dev/null 2>&1; then
    echo "❌ PostgreSQL is not running on localhost:5432"
    echo "Please start PostgreSQL or run: docker-compose up -d postgres"
    exit 1
fi
echo "✅ PostgreSQL is running"

# Check Redis
if ! redis-cli -h localhost -p 6379 ping > /dev/null 2>&1; then
    echo "❌ Redis is not running on localhost:6379"
    echo "Please start Redis or run: docker-compose up -d redis"
    exit 1
fi
echo "✅ Redis is running"

echo ""

# Install dependencies with timeout
echo "📦 Installing Dependencies..."
timeout 300 npm ci || {
    echo "❌ Dependency installation timed out or failed"
    exit 1
}
echo "✅ Dependencies installed"

# Generate Prisma client
echo "🔧 Generating Prisma Client..."
cd backend
timeout 120 npx prisma generate || {
    echo "❌ Prisma generation timed out or failed"
    exit 1
}
echo "✅ Prisma client generated"

# Setup test database
echo "🗄️ Setting up Test Database..."
timeout 180 npx prisma db push --force-reset --accept-data-loss || {
    echo "❌ Database setup timed out or failed"
    exit 1
}
echo "✅ Test database ready"

cd ..

# Install frontend test dependencies
echo "🎨 Installing Frontend Test Dependencies..."
cd frontend
timeout 120 npm install @vitest/coverage-v8 --save-dev || {
    echo "❌ Frontend dependency installation timed out or failed"
    exit 1
}
echo "✅ Frontend test dependencies installed"

cd ..

# Run tests with timeout
echo "🧪 Running Tests with Coverage..."
timeout 480 npm run test --workspaces -- --coverage --forceExit --detectOpenHandles || {
    echo "❌ Tests timed out or failed"
    exit 1
}
echo "✅ Tests completed successfully"

# Check coverage
echo "📊 Checking Coverage..."
if [ -f backend/coverage/coverage-summary.json ]; then
    lines=$(jq '.total.lines.pct' backend/coverage/coverage-summary.json)
    echo "Backend coverage: ${lines}%"
    if (( $(echo "$lines < 95" | bc -l) )); then
        echo "⚠️ Coverage below threshold: $lines% (expected 95%)"
    else
        echo "✅ Coverage meets threshold"
    fi
else
    echo "⚠️ No backend coverage file found"
fi

echo ""
echo "🎉 CI Pipeline Test Completed Successfully!"
echo "You can now push your changes with confidence."
