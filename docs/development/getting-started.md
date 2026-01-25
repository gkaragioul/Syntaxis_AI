# Getting Started with SyntaxisAI Development

## Welcome to SyntaxisAI

This guide helps you get up and running with SyntaxisAI development quickly and efficiently.

## Quick Start

### 1. Prerequisites Check

Before starting, ensure you have completed the [Local Setup](./local-setup.md):

```bash
# Verify installations
node --version    # Should be 18.0.0+
npm --version     # Should be 8.0.0+
psql --version    # Should be PostgreSQL 15+
redis-cli ping    # Should return "PONG"
```

### 2. First-Time Setup

```bash
# Clone and setup
git clone <repository-url>
cd SyntaxisAI

# Complete setup
npm run setup:dev

# Verify everything works
npm test
npm run dev
```

### 3. Verify Installation

Visit these URLs to confirm everything is working:

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001/api/health
- **Database**: `cd backend && npx prisma studio`

## Project Structure

```
SyntaxisAI/
├── backend/                 # Node.js + Express API
│   ├── src/
│   │   ├── controllers/     # API route handlers
│   │   ├── services/        # Business logic
│   │   ├── models/          # Database models
│   │   ├── middleware/      # Express middleware
│   │   ├── utils/           # Utility functions
│   │   └── __tests__/       # Test files
│   ├── prisma/              # Database schema & migrations
│   └── uploads/             # File upload storage
├── frontend/                # React + TypeScript UI
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/           # Page components
│   │   ├── services/        # API services
│   │   ├── hooks/           # Custom React hooks
│   │   ├── contexts/        # React contexts
│   │   └── __tests__/       # Test files
├── docs/                    # Documentation
├── scripts/                 # Setup and utility scripts
└── docker/                  # Docker configuration
```

## Development Workflow

### Daily Development

```bash
# Start your day
git pull origin main
npm install                  # Update dependencies if needed
npm run dev                  # Start development servers

# During development
npm run lint                 # Check code quality
npm test                     # Run tests
npm run format               # Format code

# Before committing
npm run validate             # Run all checks
git add .
git commit -m "feat: your changes"
git push
```

### Feature Development

1. **Create Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Write Tests First (TDD)**
   ```bash
   # Create test file
   touch backend/src/__tests__/your-feature.test.ts
   
   # Write failing test
   # Implement feature
   # Make test pass
   ```

3. **Implement Feature**
   ```bash
   # Backend: Add to src/
   # Frontend: Add to src/
   # Tests: Add to __tests__/
   ```

4. **Test and Validate**
   ```bash
   npm test
   npm run lint
   npm run type-check
   ```

5. **Submit for Review**
   ```bash
   git push origin feature/your-feature-name
   # Create pull request
   ```

## Key Technologies

### Backend Stack

- **Node.js + Express**: Web server and API
- **TypeScript**: Type-safe JavaScript
- **Prisma**: Database ORM and migrations
- **PostgreSQL**: Primary database
- **Redis**: Caching and job queues
- **Jest**: Testing framework
- **Bull**: Job queue processing

### Frontend Stack

- **React**: UI framework
- **TypeScript**: Type-safe JavaScript
- **Vite**: Build tool and dev server
- **Material-UI**: Component library
- **Tailwind CSS**: Utility-first CSS
- **React Query**: Data fetching and caching
- **Zustand**: State management
- **Vitest**: Testing framework

### Development Tools

- **ESLint**: Code linting
- **Prettier**: Code formatting
- **Husky**: Git hooks
- **Docker**: Containerization
- **GitHub Actions**: CI/CD

## Common Tasks

### Database Operations

```bash
# View database
cd backend && npx prisma studio

# Create migration
cd backend && npx prisma migrate dev --name your-migration

# Reset database
cd backend && npx prisma migrate reset

# Seed database
cd backend && npm run db:seed
```

### Testing

```bash
# Run all tests
npm test

# Run specific test suites
cd backend && npm run test:unit
cd backend && npm run test:integration
cd frontend && npm run test:ui

# Run with coverage
cd backend && npm run test:coverage
```

### API Development

```bash
# Test API endpoints
curl http://localhost:3001/api/health

# View API documentation
open http://localhost:3001/api/docs

# Monitor API logs
cd backend && npm run dev:logs
```

### Frontend Development

```bash
# Start with hot reload
cd frontend && npm run dev

# Build for production
cd frontend && npm run build

# Preview production build
cd frontend && npm run preview
```

## Debugging

### Backend Debugging

```bash
# Debug mode
cd backend && npm run dev:debug

# View logs
tail -f backend/logs/app.log

# Database queries
cd backend && npx prisma studio
```

### Frontend Debugging

```bash
# React DevTools (browser extension)
# Redux DevTools (browser extension)

# Console debugging
console.log('Debug info:', data)

# Network tab for API calls
# Sources tab for breakpoints
```

### Common Debug Commands

```bash
# Check running processes
lsof -i :3001  # Backend port
lsof -i :5173  # Frontend port

# Check database connection
cd backend && npx prisma db pull

# Check Redis connection
redis-cli ping

# View environment variables
cd backend && node -e "console.log(process.env)"
```

## Code Style Guidelines

### TypeScript Best Practices

```typescript
// Use explicit types
interface User {
  id: string;
  email: string;
  name: string;
}

// Use async/await over promises
async function getUser(id: string): Promise<User> {
  const user = await userService.findById(id);
  return user;
}

// Use proper error handling
try {
  const result = await riskyOperation();
  return { success: true, data: result };
} catch (error) {
  logger.error('Operation failed:', error);
  return { success: false, error: error.message };
}
```

### React Best Practices

```tsx
// Use functional components with hooks
const UserProfile: React.FC<{ userId: string }> = ({ userId }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, [userId]);

  const loadUser = async () => {
    try {
      const userData = await userService.getUser(userId);
      setUser(userData);
    } catch (error) {
      console.error('Failed to load user:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Spinner />;
  if (!user) return <div>User not found</div>;

  return <div>{user.name}</div>;
};
```

### Testing Best Practices

```typescript
// Use descriptive test names
describe('UserService', () => {
  describe('createUser', () => {
    it('should create user with valid email and password', async () => {
      // Arrange
      const userData = { email: 'test@example.com', password: 'password123' };
      
      // Act
      const result = await userService.createUser(userData);
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.user.email).toBe(userData.email);
    });
  });
});
```

## Performance Tips

### Development Performance

```bash
# Use TypeScript project references
npm run build:incremental

# Skip type checking in development
npm run dev:fast

# Use development optimizations
NODE_ENV=development npm run dev
```

### Code Splitting

```typescript
// Lazy load components
const LazyComponent = React.lazy(() => import('./LazyComponent'));

// Use Suspense
<Suspense fallback={<Loading />}>
  <LazyComponent />
</Suspense>
```

## Getting Help

### Documentation

- **API Documentation**: http://localhost:3001/api/docs
- **Database Schema**: `cd backend && npx prisma studio`
- **Test Coverage**: `cd backend && npm run test:coverage`

### Debugging Resources

- **Backend Logs**: `backend/logs/app.log`
- **Frontend Console**: Browser DevTools
- **Database**: Prisma Studio
- **Redis**: `redis-cli monitor`

### Team Communication

- **Issues**: GitHub Issues for bugs and features
- **Discussions**: GitHub Discussions for questions
- **Code Review**: Pull Request reviews
- **Documentation**: Update docs with changes

## Next Steps

1. **Complete a small feature** to familiarize yourself with the codebase
2. **Read the [Test Procedures](./test-procedures.md)** to understand testing
3. **Review [Troubleshooting Guide](./troubleshooting.md)** for common issues
4. **Explore the existing code** to understand patterns and conventions
5. **Join team discussions** and ask questions

## Quick Reference

```bash
# Setup
npm run setup:dev

# Development
npm run dev
npm test
npm run lint

# Database
cd backend && npx prisma studio
cd backend && npm run migrate

# Debugging
npm run dev:debug
tail -f backend/logs/app.log

# Quality
npm run validate
npm run format
```

Welcome to the SyntaxisAI development team! 🚀
