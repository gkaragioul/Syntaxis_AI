---
name: local-review
description: |
  Reviews staged and unstaged git changes for bugs, security vulnerabilities, CLAUDE.md compliance, and TypeScript issues before committing. Invoke with /local-review to review your local changes.
allowed-tools:
  - Bash(git diff:*)
  - Bash(git status:*)
  - Bash(git log:*)
  - Read
  - Grep
  - Glob
---

# Local Code Review Skill

Reviews your staged and unstaged git changes for potential issues before committing. Inspired by Anthropic's official PR review plugin, but focused on local changes.

## How to Invoke

Use `/local-review` or ask naturally:
- "Review my local changes"
- "Check my staged changes for issues"
- "Review my git diff"

## Review Process

### Step 1: Gather Changes

First, collect all the changes to review:

```bash
# Get overview of changed files
git status --short

# Get the full diff of all changes (staged + unstaged)
git diff HEAD

# If there are only staged changes
git diff --staged
```

### Step 2: Analyze Each Changed File

For each file in the diff, perform these checks:

#### A. Bug Detection
Look for common bug patterns:
- **Null/undefined access**: Missing null checks before `.property` or `[index]`
- **Logic errors**: Incorrect conditionals, off-by-one errors
- **Resource leaks**: Unclosed connections, file handles, event listeners not removed
- **Race conditions**: Async operations without proper synchronization
- **Error swallowing**: Empty catch blocks or catch blocks that don't handle errors
- **Incorrect comparisons**: Using `==` instead of `===`, comparing objects by reference

#### B. Security Vulnerabilities (OWASP Top 10)

Check for these critical security issues - see [SECURITY_CHECKLIST.md](SECURITY_CHECKLIST.md):

1. **Injection** (A03:2021): SQL injection, command injection, XSS
2. **Broken Authentication**: Hardcoded credentials, weak session handling
3. **Sensitive Data Exposure**: Secrets in code, unencrypted sensitive data
4. **Security Misconfiguration**: Debug mode enabled, default credentials
5. **Insecure Dependencies**: Known vulnerable packages

#### C. TypeScript Issues

Check for type safety problems - see [TYPESCRIPT_CHECKS.md](TYPESCRIPT_CHECKS.md):

- Implicit `any` types
- Missing return type annotations
- Unsafe type assertions (`as any`, `as unknown as T`)
- Non-null assertions (`!`) without justification
- Unhandled Promise rejections
- Missing error types in catch blocks

#### D. CLAUDE.md Compliance

If a CLAUDE.md file exists, verify changes comply - see [CLAUDE_MD_VALIDATION.md](CLAUDE_MD_VALIDATION.md):

```bash
# Check if CLAUDE.md exists
cat CLAUDE.md 2>/dev/null || cat .claude/CLAUDE.md 2>/dev/null
```

Compare changes against documented:
- Coding standards and conventions
- Architecture patterns
- File organization rules
- Testing requirements

### Step 3: Filter False Positives

Before reporting, filter out false positives:

- **Intentional patterns**: Comments indicating deliberate choices (`// eslint-disable`, `// @ts-ignore` with explanation)
- **Test files**: More lenient on test files for mocking/stubbing
- **Type definitions**: `.d.ts` files have different rules
- **Generated code**: Skip auto-generated files
- **Configuration**: Config files may have different security rules

### Step 4: Generate Report

Output a structured report grouped by severity:

```
============================================
LOCAL CODE REVIEW REPORT
============================================

Files Reviewed: X
Issues Found: Y

CRITICAL (X)
------------
[file:line] Category: Description
  Context: <code snippet>
  Fix: <recommendation>

HIGH (X)
--------
[file:line] Category: Description
  Context: <code snippet>
  Fix: <recommendation>

MEDIUM (X)
----------
[file:line] Category: Description
  Context: <code snippet>
  Fix: <recommendation>

LOW (X)
-------
[file:line] Category: Description
  Context: <code snippet>
  Fix: <recommendation>

============================================
SUMMARY
============================================
- Critical issues must be fixed before commit
- High issues should be fixed before commit
- Medium issues should be addressed soon
- Low issues are suggestions for improvement

Ready to commit: [YES/NO]
```

## Severity Levels

| Level | Description | Examples |
|-------|-------------|----------|
| **CRITICAL** | Security vulnerabilities, data loss risks | Hardcoded secrets, SQL injection, unhandled errors that crash |
| **HIGH** | Bugs that will cause problems | Null pointer access, logic errors, type mismatches |
| **MEDIUM** | Code quality issues | Missing types, poor error handling, code smells |
| **LOW** | Style and best practices | Naming conventions, documentation, minor improvements |

## Example Review

```
============================================
LOCAL CODE REVIEW REPORT
============================================

Files Reviewed: 3
Issues Found: 5

CRITICAL (1)
------------
[src/api/auth.ts:42] SECURITY: Hardcoded API key detected
  Context: const API_KEY = "sk-1234567890abcdef"
  Fix: Move to environment variable: process.env.API_KEY

HIGH (2)
--------
[src/utils/parser.ts:15] BUG: Potential null reference
  Context: return data.items.map(...)
  Fix: Add null check: return data?.items?.map(...) ?? []

[src/services/user.ts:88] TYPESCRIPT: Unhandled promise rejection
  Context: fetchUser(id).then(setUser)
  Fix: Add error handler: fetchUser(id).then(setUser).catch(handleError)

MEDIUM (1)
----------
[src/components/Form.tsx:23] TYPESCRIPT: Implicit 'any' type
  Context: const handleSubmit = (e) => {
  Fix: Add type: const handleSubmit = (e: React.FormEvent) => {

LOW (1)
-------
[src/types/index.ts:5] STYLE: Consider using interface instead of type
  Context: type User = { ... }
  Fix: For object types, prefer: interface User { ... }

============================================
SUMMARY
============================================
- 1 critical issue must be fixed before commit
- 2 high issues should be fixed before commit
- 2 other issues can be addressed later

Ready to commit: NO
```

## Tips

- Run before every commit to catch issues early
- Focus on CRITICAL and HIGH issues first
- Use with `git add -p` to review changes incrementally
- Combine with TypeScript compiler (`npx tsc --noEmit`) for full type checking
