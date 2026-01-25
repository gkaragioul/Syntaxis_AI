# CLAUDE.md Compliance Validation

Reference for checking code changes against project standards documented in CLAUDE.md.

## What is CLAUDE.md?

CLAUDE.md is a project-level configuration file that documents:
- Project architecture and structure
- Coding standards and conventions
- File organization rules
- Testing requirements
- Build and deployment guidelines

## Validation Process

### Step 1: Locate CLAUDE.md

Check these locations in order:
1. `./CLAUDE.md` (project root)
2. `./.claude/CLAUDE.md`
3. `./docs/CLAUDE.md`

```bash
# Find CLAUDE.md
find . -name "CLAUDE.md" -type f 2>/dev/null | head -5
```

### Step 2: Extract Project Rules

If CLAUDE.md exists, extract key sections:

#### Architecture Rules
- Directory structure requirements
- Module organization patterns
- Dependency rules (what can import what)
- Layer boundaries (e.g., services can't import from routes)

#### Coding Standards
- Naming conventions (files, functions, variables)
- Code style preferences
- Comment requirements
- Error handling patterns

#### Testing Requirements
- Test file locations
- Test naming conventions
- Coverage requirements
- Types of tests required (unit, integration, e2e)

#### File Organization
- Where new files should go
- File naming patterns
- Maximum file size/complexity

### Step 3: Compare Changes Against Rules

For each changed file, verify:

1. **File Location**
   - Is the file in the correct directory?
   - Does the path match expected patterns?
   ```
   Example: Components should be in src/components/
   Changed file: src/utils/Button.tsx
   Issue: Component in wrong directory
   ```

2. **Naming Convention**
   - Does the filename match patterns?
   - Are exports named correctly?
   ```
   Example: Components should be PascalCase
   Changed file: src/components/userCard.tsx
   Issue: Should be UserCard.tsx
   ```

3. **Import Rules**
   - Are imports from allowed locations?
   - No circular dependencies?
   ```
   Example: Services shouldn't import from routes
   Changed: import { handler } from '../routes/user'
   Issue: Service importing from routes layer
   ```

4. **Code Patterns**
   - Using required patterns (error handling, logging)?
   - Following documented practices?
   ```
   Example: All API calls must use the apiClient wrapper
   Changed: fetch('/api/users')
   Issue: Direct fetch instead of apiClient
   ```

5. **Testing**
   - Does change require tests?
   - Are tests in correct location?
   - Test naming correct?

## Common Compliance Issues

### LOW: Documentation Updates Needed

When changes affect documented behavior:
- New feature without CLAUDE.md update
- Changed architecture not reflected
- New conventions introduced

```
Issue: Added new /services/notifications/ directory
CLAUDE.md documents services but not this subdirectory
Recommendation: Update CLAUDE.md to document notification services
```

### LOW: Naming Convention Deviations

```
Issue: File named getUserData.ts
Convention: Files should be kebab-case (get-user-data.ts)
Recommendation: Rename to follow convention
```

### MEDIUM: Structural Violations

```
Issue: Business logic in route handler
Convention: Routes should only handle HTTP, delegate to services
Recommendation: Extract logic to service layer
```

### MEDIUM: Missing Required Patterns

```
Issue: API endpoint without input validation
Convention: All endpoints must validate input with Zod
Recommendation: Add schema validation
```

### HIGH: Architecture Violations

```
Issue: Frontend component importing directly from backend
Convention: Frontend/backend must communicate via API only
Recommendation: Create API endpoint, use fetch in frontend
```

## No CLAUDE.md? Suggest Creating One

If no CLAUDE.md exists, recommend creating one with:

```markdown
# Project Name

## Architecture

Brief description of project structure and key directories.

## Coding Standards

- Language: TypeScript
- Style: [Prettier/ESLint config reference]
- Naming: [conventions]

## File Organization

```
src/
├── components/    # React components
├── services/      # Business logic
├── utils/         # Utility functions
└── types/         # TypeScript types
```

## Testing

- Framework: Jest/Vitest
- Location: `__tests__/` or `*.test.ts`
- Requirements: [coverage targets]

## Development

```bash
npm run dev    # Start development
npm test       # Run tests
npm run build  # Build for production
```
```

## Compliance Report Format

```
CLAUDE.md Compliance Check
==========================

CLAUDE.md Location: ./CLAUDE.md
Status: Found / Not Found

Violations Found: X

HIGH (X)
--------
[file] Violation: Description
  Rule: "Quote from CLAUDE.md"
  Fix: Recommendation

MEDIUM (X)
----------
[file] Violation: Description
  Rule: "Quote from CLAUDE.md"
  Fix: Recommendation

LOW (X)
-------
[file] Suggestion: Description
  Related: Section of CLAUDE.md
  Action: Optional improvement

Recommendations:
- Update CLAUDE.md if conventions have evolved
- Consider adding missing documentation
```

## Integration with Review

When performing local review:

1. **Always check** if CLAUDE.md exists
2. **Read and parse** documented rules
3. **Compare** each changed file against rules
4. **Report** violations with specific rule references
5. **Suggest** CLAUDE.md updates if needed

This ensures code changes maintain consistency with documented project standards.
