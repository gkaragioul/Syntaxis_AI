# TypeScript Code Quality Checks

Reference for detecting TypeScript issues and type safety problems in code changes.

## Critical Type Issues

### 1. Implicit `any` Types (MEDIUM)

**Patterns to detect:**
```typescript
// PROBLEMATIC
function process(data) {  // parameter implicitly has 'any'
  return data.value
}

const handler = (e) => {  // event has implicit 'any'
  console.log(e.target.value)
}

// FIXED
function process(data: ProcessData): string {
  return data.value
}

const handler = (e: React.ChangeEvent<HTMLInputElement>) => {
  console.log(e.target.value)
}
```

**What to look for:**
- Function parameters without type annotations
- Variables declared without types that can't be inferred
- Callback parameters without types

### 2. Unsafe Type Assertions (HIGH)

**Patterns to detect:**
```typescript
// PROBLEMATIC
const user = data as User  // might not actually be User
const value = response as any  // defeats type checking
const item = obj as unknown as SpecificType  // double assertion

// BETTER
// Use type guards
function isUser(data: unknown): data is User {
  return typeof data === 'object' && data !== null && 'id' in data
}

if (isUser(data)) {
  // data is now typed as User
}

// Or use schema validation
const user = userSchema.parse(data)
```

**What to look for:**
- `as any` assertions
- `as unknown as T` double assertions
- Assertions without prior validation
- `@ts-ignore` or `@ts-expect-error` without explanation

### 3. Non-null Assertions Without Justification (MEDIUM)

**Patterns to detect:**
```typescript
// PROBLEMATIC
const element = document.getElementById('app')!
const user = users.find(u => u.id === id)!
const value = map.get(key)!

// BETTER
const element = document.getElementById('app')
if (!element) throw new Error('App element not found')

const user = users.find(u => u.id === id)
if (!user) throw new Error(`User ${id} not found`)

// Or use optional chaining with fallback
const value = map.get(key) ?? defaultValue
```

**What to look for:**
- `!` operator without null check or error handling
- Assumptions about existence without validation
- Bang operator after DOM queries or array finds

### 4. Unhandled Promise Rejections (HIGH)

**Patterns to detect:**
```typescript
// PROBLEMATIC
fetchData().then(setData)  // no catch
async function load() {
  const data = await fetchData()  // no try-catch
  setData(data)
}

// FIXED
fetchData()
  .then(setData)
  .catch(error => handleError(error))

async function load() {
  try {
    const data = await fetchData()
    setData(data)
  } catch (error) {
    handleError(error)
  }
}
```

**What to look for:**
- `.then()` without `.catch()`
- `await` without try-catch in user-facing code
- Event handlers with async operations
- Floating promises (promises not awaited or caught)

### 5. Missing Return Types (LOW)

**Patterns to detect:**
```typescript
// PROBLEMATIC
function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price, 0)
}

export async function fetchUser(id) {
  const response = await api.get(`/users/${id}`)
  return response.data
}

// FIXED
function calculateTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price, 0)
}

export async function fetchUser(id: string): Promise<User> {
  const response = await api.get<User>(`/users/${id}`)
  return response.data
}
```

**What to look for:**
- Exported functions without return types
- Public API methods without explicit returns
- Complex functions where return type isn't obvious

### 6. Incorrect Error Handling Types (MEDIUM)

**Patterns to detect:**
```typescript
// PROBLEMATIC
try {
  await riskyOperation()
} catch (error) {
  console.log(error.message)  // error is 'unknown'
}

// FIXED
try {
  await riskyOperation()
} catch (error) {
  if (error instanceof Error) {
    console.log(error.message)
  } else {
    console.log('Unknown error:', error)
  }
}

// Or use a helper
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}
```

**What to look for:**
- Accessing properties on `catch (error)` without type narrowing
- Assuming error is always an Error instance
- Missing error type guards

### 7. Unsafe Array/Object Access (MEDIUM)

**Patterns to detect:**
```typescript
// PROBLEMATIC
const first = items[0]  // might be undefined
const value = obj[key]  // might be undefined
const nested = response.data.user.name  // any level might be undefined

// BETTER
const first = items[0]
if (first === undefined) {
  throw new Error('Expected at least one item')
}

const value = obj[key] ?? defaultValue

const name = response?.data?.user?.name ?? 'Unknown'
```

**What to look for:**
- Array index access without bounds checking
- Object property access on potentially undefined
- Deep property access without optional chaining

### 8. Incorrect Generic Constraints (MEDIUM)

**Patterns to detect:**
```typescript
// PROBLEMATIC
function merge<T>(a: T, b: T): T {
  return { ...a, ...b }  // T might not be an object
}

// FIXED
function merge<T extends object>(a: T, b: Partial<T>): T {
  return { ...a, ...b }
}
```

**What to look for:**
- Generic functions assuming type capabilities
- Missing `extends` constraints
- Overly broad generics

## React-Specific Issues

### Event Handler Types
```typescript
// PROBLEMATIC
const handleClick = (e) => {}
const handleChange = (e) => {}

// FIXED
const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {}
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {}
```

### Component Props
```typescript
// PROBLEMATIC
function Button({ onClick, children }) {
  return <button onClick={onClick}>{children}</button>
}

// FIXED
interface ButtonProps {
  onClick: () => void
  children: React.ReactNode
}

function Button({ onClick, children }: ButtonProps) {
  return <button onClick={onClick}>{children}</button>
}
```

### Refs
```typescript
// PROBLEMATIC
const ref = useRef()
ref.current.focus()  // might be null

// FIXED
const ref = useRef<HTMLInputElement>(null)
ref.current?.focus()
```

## Quick Detection Patterns

```bash
# Find implicit any (functions without parameter types)
git diff HEAD | grep -E "function\s+\w+\s*\([^:)]+\)|=>\s*{"

# Find unsafe assertions
git diff HEAD | grep -E "as any|as unknown as"

# Find non-null assertions
git diff HEAD | grep -E "\w+!"

# Find unhandled promises
git diff HEAD | grep -E "\.then\([^)]+\)(?!\s*\.catch)"

# Find ts-ignore without explanation
git diff HEAD | grep -E "@ts-ignore(?!\s+--)"
```

## Severity Classification

| Issue | Severity | Action |
|-------|----------|--------|
| Unsafe type assertions | HIGH | Should fix |
| Unhandled promise rejections | HIGH | Should fix |
| Implicit any (public APIs) | MEDIUM | Should fix |
| Non-null assertions | MEDIUM | Review |
| Incorrect error handling | MEDIUM | Review |
| Missing return types | LOW | Consider |
| Implicit any (internal) | LOW | Consider |
