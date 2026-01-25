#!/bin/bash

# Diagnose CI Issues - Check for common problems that cause hanging

echo "🔍 Diagnosing CI Issues"
echo "======================"

# Check for hanging processes
echo "1. Checking for hanging processes..."
if command -v lsof &> /dev/null; then
    echo "Open files by Node processes:"
    lsof -c node 2>/dev/null | head -10 || echo "No Node processes found"
else
    echo "lsof not available, skipping process check"
fi

echo ""

# Check Jest configuration
echo "2. Checking Jest configuration..."
if [ -f "backend/jest.config.js" ]; then
    echo "✅ Jest config found"
    if grep -q "forceExit.*true" backend/jest.config.js; then
        echo "✅ forceExit is enabled"
    else
        echo "⚠️ forceExit is not enabled"
    fi
    
    if grep -q "detectOpenHandles.*true" backend/jest.config.js; then
        echo "✅ detectOpenHandles is enabled"
    else
        echo "⚠️ detectOpenHandles is not enabled"
    fi
else
    echo "❌ Jest config not found"
fi

echo ""

# Check Vitest configuration
echo "3. Checking Vitest configuration..."
if [ -f "frontend/vitest.config.ts" ]; then
    echo "✅ Vitest config found"
    if grep -q "testTimeout" frontend/vitest.config.ts; then
        echo "✅ testTimeout is configured"
    else
        echo "⚠️ testTimeout is not configured"
    fi
else
    echo "❌ Vitest config not found"
fi

echo ""

# Check for problematic test patterns
echo "4. Checking for problematic test patterns..."

# Check for tests without timeouts
echo "Checking for tests that might hang..."
find backend/src/__tests__ -name "*.test.ts" -exec grep -l "setTimeout\|setInterval" {} \; 2>/dev/null | head -5
find frontend/src/__tests__ -name "*.test.ts" -exec grep -l "setTimeout\|setInterval" {} \; 2>/dev/null | head -5

# Check for real API calls in tests
echo "Checking for potential real API calls in tests..."
find backend/src/__tests__ -name "*.test.ts" -exec grep -l "http://\|https://" {} \; 2>/dev/null | head -5
find frontend/src/__tests__ -name "*.test.ts" -exec grep -l "http://\|https://" {} \; 2>/dev/null | head -5

echo ""

# Check database connections
echo "5. Checking database configuration..."
if [ -f "backend/src/__tests__/global-setup.ts" ]; then
    echo "✅ Global setup found"
    if grep -q "timeout" backend/src/__tests__/global-setup.ts; then
        echo "✅ Timeouts configured in global setup"
    else
        echo "⚠️ No timeouts in global setup"
    fi
else
    echo "❌ Global setup not found"
fi

echo ""

# Check for environment variables
echo "6. Checking environment variables..."
required_vars=("NODE_ENV" "DATABASE_URL" "REDIS_URL")
for var in "${required_vars[@]}"; do
    if [ -n "${!var}" ]; then
        echo "✅ $var is set"
    else
        echo "⚠️ $var is not set"
    fi
done

echo ""

# Check package.json scripts
echo "7. Checking package.json test scripts..."
if [ -f "package.json" ]; then
    if grep -q "forceExit\|detectOpenHandles" package.json; then
        echo "✅ Test scripts have timeout protection"
    else
        echo "⚠️ Test scripts may need timeout protection"
    fi
fi

echo ""

# Check for large test files that might be slow
echo "8. Checking for potentially slow test files..."
find . -name "*.test.ts" -size +10k -exec ls -lh {} \; 2>/dev/null | head -5

echo ""
echo "🏁 Diagnosis Complete"
echo "If you see warnings above, consider addressing them to prevent CI hangs."
