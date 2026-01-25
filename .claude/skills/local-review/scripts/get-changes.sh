#!/bin/bash
# Get staged and unstaged changes for review

set -e

echo "============================================"
echo "GIT CHANGES SUMMARY"
echo "============================================"
echo ""

# Check if we're in a git repo
if ! git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
    echo "Error: Not in a git repository"
    exit 1
fi

# Get current branch
echo "Branch: $(git branch --show-current)"
echo ""

# Status summary
echo "=== Status ==="
git status --short
echo ""

# Count changes
STAGED_COUNT=$(git diff --cached --name-only | wc -l | tr -d ' ')
UNSTAGED_COUNT=$(git diff --name-only | wc -l | tr -d ' ')
UNTRACKED_COUNT=$(git ls-files --others --exclude-standard | wc -l | tr -d ' ')

echo "=== Summary ==="
echo "Staged files: $STAGED_COUNT"
echo "Unstaged changes: $UNSTAGED_COUNT"
echo "Untracked files: $UNTRACKED_COUNT"
echo ""

# List changed files by type
echo "=== Changed Files ==="
echo ""
echo "Staged:"
git diff --cached --name-only 2>/dev/null || echo "  (none)"
echo ""
echo "Unstaged:"
git diff --name-only 2>/dev/null || echo "  (none)"
echo ""

# TypeScript/JavaScript files changed
TS_FILES=$(git diff HEAD --name-only 2>/dev/null | grep -E '\.(ts|tsx|js|jsx)$' || true)
if [ -n "$TS_FILES" ]; then
    echo "=== TypeScript/JavaScript Files ==="
    echo "$TS_FILES"
    echo ""
fi

# Get diff stats
echo "=== Diff Statistics ==="
git diff HEAD --stat 2>/dev/null || echo "No changes"
echo ""

echo "============================================"
echo "Run 'git diff HEAD' for full diff content"
echo "============================================"
