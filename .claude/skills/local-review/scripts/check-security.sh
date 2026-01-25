#!/bin/bash
# Quick security pattern check on changed files

set -e

echo "============================================"
echo "SECURITY PATTERN CHECK"
echo "============================================"
echo ""

# Get the diff content
DIFF=$(git diff HEAD 2>/dev/null)

if [ -z "$DIFF" ]; then
    echo "No changes to check"
    exit 0
fi

ISSUES_FOUND=0

# Function to check pattern
check_pattern() {
    local pattern="$1"
    local description="$2"
    local severity="$3"

    MATCHES=$(echo "$DIFF" | grep -n -E "$pattern" 2>/dev/null || true)
    if [ -n "$MATCHES" ]; then
        echo "[$severity] $description"
        echo "$MATCHES" | head -5
        echo ""
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
}

echo "Checking for security issues in diff..."
echo ""

# Hardcoded secrets
check_pattern "(password|passwd|pwd)\s*[:=]\s*[\"'][^\"']+[\"']" \
    "Potential hardcoded password" "CRITICAL"

check_pattern "(api[_-]?key|apikey)\s*[:=]\s*[\"'][^\"']+[\"']" \
    "Potential hardcoded API key" "CRITICAL"

check_pattern "(secret|token)\s*[:=]\s*[\"'][^\"']+[\"']" \
    "Potential hardcoded secret/token" "CRITICAL"

check_pattern "-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----" \
    "Private key in code" "CRITICAL"

# SQL Injection patterns
check_pattern "query\s*\(\s*[\"'\`].*\\\$\{" \
    "Potential SQL injection (template literal)" "CRITICAL"

check_pattern "query\s*\(\s*[\"'].*\s*\+\s*" \
    "Potential SQL injection (string concat)" "CRITICAL"

# Command injection
check_pattern "exec\s*\(\s*[\"'\`].*\\\$\{" \
    "Potential command injection" "CRITICAL"

check_pattern "child_process\.(exec|spawn)\s*\(" \
    "Child process usage - verify input sanitization" "HIGH"

# XSS patterns
check_pattern "innerHTML\s*=" \
    "innerHTML assignment - verify sanitization" "HIGH"

check_pattern "dangerouslySetInnerHTML" \
    "dangerouslySetInnerHTML usage - verify sanitization" "HIGH"

check_pattern "document\.write\s*\(" \
    "document.write usage" "HIGH"

# Eval usage
check_pattern "\beval\s*\(" \
    "eval() usage - security risk" "CRITICAL"

check_pattern "new\s+Function\s*\(" \
    "new Function() usage - security risk" "HIGH"

# Insecure configurations
check_pattern "secure:\s*false" \
    "Cookie secure flag disabled" "HIGH"

check_pattern "httpOnly:\s*false" \
    "Cookie httpOnly flag disabled" "HIGH"

check_pattern "cors\s*\(\s*\{\s*origin:\s*[\"']\*[\"']" \
    "Wildcard CORS origin" "MEDIUM"

# Debug/development code
check_pattern "console\.(log|debug|info)\s*\(" \
    "Console logging (review for sensitive data)" "LOW"

check_pattern "debugger" \
    "Debugger statement" "LOW"

echo "============================================"
echo "SUMMARY"
echo "============================================"
echo "Potential issues found: $ISSUES_FOUND"
echo ""

if [ $ISSUES_FOUND -gt 0 ]; then
    echo "Review the above patterns carefully."
    echo "Some may be false positives - verify each one."
fi
