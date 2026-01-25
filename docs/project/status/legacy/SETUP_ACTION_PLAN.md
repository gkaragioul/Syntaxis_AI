# SyntaxisAI Setup Action Plan

## 🎯 Goal
Get the SyntaxisAI workspace fully operational and ready for development.

---

## Phase 1: Dependency Installation (5-10 minutes)

### Step 1.1: Install Root Dependencies
```bash
npm install
```
**What it does:**
- Installs root-level dev dependencies (ESLint, Prettier, TypeScript, etc.)
- Installs workspace management tools
- Links frontend and backend workspaces

**Expected output:**
- No errors
- `node_modules/` directory created at root
- `package-lock.json` updated

### Step 1.2: Verify Installation
```bash
npm list eslint
npm list typescript
npm list concurrently
```

**Expected output:**
- All packages listed with versions
- No "extraneous" warnings

---

## Phase 2: Environment Configuration (5 minutes)

### Step 2.1: Backend Environment
```bash
cd backend
cp .env.example .env
```

**Edit `backend/.env`:**
```env
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/syntaxis_ai
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key-here
GOOGLE_VISION_API_KEY=your-api-key
```

### Step 2.2: Frontend Environment
```bash
cd ../frontend
cp .env.example .env
```

**Edit `frontend/.env`:**
```env
VITE_API_URL=http://localhost:3001
VITE_APP_NAME=SyntaxisAI
```

---

## Phase 3: Database Setup (5 minutes)

### Step 3.1: Start Docker Services
```bash
docker-compose up -d
```

**Verify services:**
```bash
docker-compose ps
```

**Expected output:**
- postgres: running
- redis: running

### Step 3.2: Run Database Migrations
```bash
cd backend
npm run db:migrate
```

**Expected output:**
- Migrations applied successfully
- Database schema created

### Step 3.3: Seed Database (Optional)
```bash
npm run db:seed
```

---

## Phase 4: Build Verification (5-10 minutes)

### Step 4.1: Type Check
```bash
npm run type-check
```

**Expected output:**
- No TypeScript errors
- Completes successfully

### Step 4.2: Lint Check
```bash
npm run lint
```

**Expected output:**
- No linting errors
- All files pass ESLint rules

### Step 4.3: Build
```bash
npm run build
```

**Expected output:**
- Frontend: `frontend/dist/` created
- Backend: `backend/dist/` created
- No build errors

---

## Phase 5: Test Verification (10-15 minutes)

### Step 5.1: Run All Tests
```bash
npm test
```

**Expected output:**
- All tests pass
- Test coverage > 95%
- No failing tests

### Step 5.2: Run Specific Test Suites
```bash
# Backend tests
npm run test --workspace=backend

# Frontend tests
npm run test --workspace=frontend

# Unit tests only
npm run test:unit --workspace=backend
```

### Step 5.3: Generate Coverage Report
```bash
npm run test:coverage
```

---

## Phase 6: Development Environment (2-3 minutes)

### Step 6.1: Start Development Servers
```bash
npm run dev
```

**Expected output:**
- Frontend: http://localhost:5173
- Backend: http://localhost:3001
- Both servers running without errors

### Step 6.2: Verify Health Endpoints
```bash
# In another terminal
curl http://localhost:3001/health
```

**Expected response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "uptime": 123,
  "version": "1.0.0",
  "environment": "development"
}
```

---

## Phase 7: Validation Checklist

### ✅ Installation Complete
- [ ] `npm install` ran successfully
- [ ] No dependency conflicts
- [ ] All workspaces linked

### ✅ Environment Ready
- [ ] `.env` files created and configured
- [ ] Database credentials set
- [ ] API keys configured

### ✅ Database Ready
- [ ] Docker services running
- [ ] Migrations applied
- [ ] Database accessible

### ✅ Build Successful
- [ ] Type checking passes
- [ ] Linting passes
- [ ] Build completes without errors

### ✅ Tests Passing
- [ ] All tests pass
- [ ] Coverage > 95%
- [ ] No failing tests

### ✅ Development Ready
- [ ] Dev servers start
- [ ] Health endpoints respond
- [ ] Frontend accessible at http://localhost:5173
- [ ] Backend accessible at http://localhost:3001

---

## Troubleshooting

### Issue: `npm install` fails
**Solution:**
```bash
# Clear cache and retry
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### Issue: Port already in use
**Solution:**
```bash
# Find process using port
lsof -i :3001  # Backend
lsof -i :5173  # Frontend

# Kill process
kill -9 <PID>
```

### Issue: Database connection fails
**Solution:**
```bash
# Check Docker services
docker-compose ps

# Restart services
docker-compose restart

# Check logs
docker-compose logs postgres
```

### Issue: Tests fail
**Solution:**
```bash
# Clear test cache
npm test -- --clearCache

# Run specific test
npm test -- --testNamePattern="specific test"

# Run with verbose output
npm test -- --verbose
```

---

## Expected Timeline

| Phase | Task | Time |
|-------|------|------|
| 1 | Dependencies | 5-10 min |
| 2 | Environment | 5 min |
| 3 | Database | 5 min |
| 4 | Build | 5-10 min |
| 5 | Tests | 10-15 min |
| 6 | Dev Server | 2-3 min |
| **Total** | **Full Setup** | **30-45 min** |

---

## Next Steps After Setup

1. **Explore the codebase**
   - Review backend services in `backend/src/services/`
   - Review frontend components in `frontend/src/components/`

2. **Read documentation**
   - `docs/development/README.md` - Development guide
   - `docs/testing/README.md` - Testing guide
   - `docs/api/README.md` - API documentation

3. **Start development**
   - Create a feature branch
   - Follow TDD methodology
   - Write tests first, then implementation

4. **Run validation**
   - `npm run validate` - Full validation
   - `npm run lint:fix` - Auto-fix linting issues
   - `npm run format` - Format code

---

**Status**: Ready to begin setup! 🚀

