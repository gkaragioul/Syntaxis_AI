# Security Vulnerability Checklist

Reference for detecting OWASP Top 10 and common security vulnerabilities in code changes.

## Critical Security Patterns

### 1. Hardcoded Secrets (CRITICAL)

**Patterns to detect:**
```
password\s*[:=]\s*["'][^"']+["']
api[_-]?key\s*[:=]\s*["'][^"']+["']
secret\s*[:=]\s*["'][^"']+["']
token\s*[:=]\s*["'][^"']+["']
private[_-]?key\s*[:=]
aws[_-]?(access|secret)
-----BEGIN (RSA |DSA |EC )?PRIVATE KEY-----
```

**What to look for:**
- API keys, tokens, passwords in source code
- Connection strings with credentials
- Private keys or certificates
- AWS/GCP/Azure credentials
- JWT secrets

**Fix:** Use environment variables or secret management service.

### 2. SQL Injection (CRITICAL)

**Patterns to detect:**
```typescript
// VULNERABLE
query(`SELECT * FROM users WHERE id = ${userId}`)
query("SELECT * FROM users WHERE name = '" + name + "'")

// SAFE
query('SELECT * FROM users WHERE id = $1', [userId])
query('SELECT * FROM users WHERE id = ?', [userId])
```

**What to look for:**
- String concatenation in SQL queries
- Template literals with user input in queries
- Missing parameterized queries

**Fix:** Always use parameterized queries or prepared statements.

### 3. Command Injection (CRITICAL)

**Patterns to detect:**
```typescript
// VULNERABLE
exec(`ls ${userInput}`)
spawn('sh', ['-c', userCommand])
child_process.exec(userInput)

// SAFE
execFile('ls', [sanitizedPath])
spawn('ls', ['-la', sanitizedPath])
```

**What to look for:**
- User input in `exec()`, `spawn()`, `execSync()`
- Shell command construction with variables
- Unsanitized paths in file operations

**Fix:** Use `execFile` with array arguments, validate/sanitize all inputs.

### 4. Cross-Site Scripting (XSS) (HIGH)

**Patterns to detect:**
```typescript
// VULNERABLE
element.innerHTML = userInput
dangerouslySetInnerHTML={{ __html: userInput }}
document.write(userInput)

// SAFE
element.textContent = userInput
<div>{userInput}</div>  // React auto-escapes
```

**What to look for:**
- `innerHTML` assignments with user data
- `dangerouslySetInnerHTML` without sanitization
- `document.write()` with variables
- Unescaped output in templates

**Fix:** Use `textContent`, React's auto-escaping, or sanitize with DOMPurify.

### 5. Path Traversal (HIGH)

**Patterns to detect:**
```typescript
// VULNERABLE
fs.readFile(`./uploads/${userFilename}`)
path.join(baseDir, userInput)

// SAFE
const safePath = path.resolve(baseDir, userInput)
if (!safePath.startsWith(baseDir)) throw new Error('Invalid path')
```

**What to look for:**
- User input in file paths without validation
- Missing check for `../` sequences
- Direct use of user-provided filenames

**Fix:** Validate resolved paths stay within intended directory.

### 6. Insecure Deserialization (HIGH)

**Patterns to detect:**
```typescript
// VULNERABLE
JSON.parse(untrustedData)  // when used to reconstruct objects with methods
eval(userInput)
new Function(userInput)
require(userProvidedPath)

// SAFE
JSON.parse(untrustedData)  // for plain data only
// Use schema validation (Zod, Joi) after parsing
```

**What to look for:**
- `eval()` with any variable input
- `new Function()` with user input
- Dynamic `require()` or `import()`
- Deserializing objects with executable code

**Fix:** Never eval user input, validate all deserialized data.

### 7. Broken Authentication (HIGH)

**Patterns to detect:**
```typescript
// VULNERABLE
if (password === storedPassword)  // plain text comparison
jwt.sign(payload, 'hardcoded-secret')
cookie: { secure: false }

// SAFE
await bcrypt.compare(password, hashedPassword)
jwt.sign(payload, process.env.JWT_SECRET)
cookie: { secure: true, httpOnly: true, sameSite: 'strict' }
```

**What to look for:**
- Plain text password storage/comparison
- Weak JWT secrets
- Missing secure cookie flags
- Session fixation vulnerabilities

**Fix:** Use bcrypt for passwords, secure cookie settings, strong secrets.

### 8. Sensitive Data Exposure (MEDIUM)

**Patterns to detect:**
```typescript
// VULNERABLE
console.log('User data:', user)
logger.info({ password, email })
res.json({ ...user, password })

// SAFE
console.log('User ID:', user.id)
logger.info({ email })  // exclude sensitive fields
res.json(sanitizeUser(user))
```

**What to look for:**
- Logging sensitive data (passwords, tokens, PII)
- Returning sensitive fields in API responses
- Error messages exposing internal details
- Stack traces sent to client

**Fix:** Sanitize logs and responses, use allowlists for exposed fields.

### 9. Security Misconfiguration (MEDIUM)

**Patterns to detect:**
```typescript
// VULNERABLE
cors({ origin: '*' })
app.use(helmet({ contentSecurityPolicy: false }))
DEBUG=true in production
NODE_ENV !== 'production' checks missing

// SAFE
cors({ origin: allowedOrigins })
app.use(helmet())
```

**What to look for:**
- Overly permissive CORS
- Disabled security headers
- Debug mode in production
- Default credentials

**Fix:** Use restrictive defaults, proper environment configuration.

### 10. Insufficient Input Validation (MEDIUM)

**Patterns to detect:**
```typescript
// VULNERABLE
const { userId } = req.body  // used directly
parseInt(userInput)  // no NaN check

// SAFE
const schema = z.object({ userId: z.string().uuid() })
const { userId } = schema.parse(req.body)
```

**What to look for:**
- Missing input validation on API endpoints
- Type coercion without validation
- Missing length/format checks
- Trusting client-side validation only

**Fix:** Validate all inputs server-side with schema validation.

## Quick Grep Commands

```bash
# Find hardcoded secrets
git diff HEAD | grep -iE "(password|secret|api.?key|token)\s*[:=]\s*[\"'][^\"']+[\"']"

# Find potential SQL injection
git diff HEAD | grep -E "query\s*\(.*\$\{|query\s*\(.*\+"

# Find potential XSS
git diff HEAD | grep -E "innerHTML|dangerouslySetInnerHTML|document\.write"

# Find eval usage
git diff HEAD | grep -E "\beval\s*\(|\bnew Function\s*\("

# Find insecure cookies
git diff HEAD | grep -E "secure:\s*false|httpOnly:\s*false"
```

## Severity Classification

| Pattern | Severity | Immediate Action |
|---------|----------|------------------|
| Hardcoded secrets | CRITICAL | Block commit |
| SQL/Command injection | CRITICAL | Block commit |
| XSS vulnerabilities | HIGH | Should fix |
| Path traversal | HIGH | Should fix |
| Broken auth | HIGH | Should fix |
| Data exposure | MEDIUM | Review needed |
| Misconfigurations | MEDIUM | Review needed |
| Input validation | MEDIUM | Review needed |
