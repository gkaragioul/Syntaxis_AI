# Developer Onboarding Guide

Welcome to the SyntaxisAI development team! This guide will help you get up and running quickly with our development environment and workflows.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Development Environment Setup](#development-environment-setup)
3. [Architecture Overview](#architecture-overview)
4. [Development Workflow](#development-workflow)
5. [Code Standards](#code-standards)
6. [Testing Guidelines](#testing-guidelines)
7. [Debugging and Troubleshooting](#debugging-and-troubleshooting)
8. [Deployment Process](#deployment-process)
9. [Resources and Documentation](#resources-and-documentation)

## Prerequisites

### Required Software

1. **Node.js 18+**
   ```bash
   # Install via nvm (recommended)
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
   nvm install 18
   nvm use 18
   ```

2. **PostgreSQL 14+**
   ```bash
   # macOS
   brew install postgresql@14
   brew services start postgresql@14
   
   # Ubuntu/Debian
   sudo apt install postgresql-14 postgresql-contrib-14
   ```

3. **Redis 6+**
   ```bash
   # macOS
   brew install redis
   brew services start redis
   
   # Ubuntu/Debian
   sudo apt install redis-server
   ```

4. **Git**
   ```bash
   git --version
   # Should be 2.30+
   ```

### Development Tools

1. **VS Code** (recommended IDE)
   - Install from [code.visualstudio.com](https://code.visualstudio.com/)
   - Install recommended extensions (see `.vscode/extensions.json`)

2. **Docker** (optional, for containerized development)
   ```bash
   # Install Docker Desktop
   # https://www.docker.com/products/docker-desktop
   ```

3. **Postman or Insomnia** (for API testing)

## Development Environment Setup

### 1. Clone and Setup Repository

```bash
# Clone the repository
git clone https://github.com/your-org/SyntaxisAI.git
cd SyntaxisAI

# Install dependencies
npm install
cd frontend && npm install && cd ..

# Copy environment configuration
cp .env.example .env
```

### 2. Configure Environment Variables

Edit `.env` file with your local settings:

```env
# Application
NODE_ENV=development
PORT=3001

# Database
DATABASE_URL="postgresql://username:password@localhost:5432/syntaxisai_dev"

# Authentication
JWT_SECRET="your-super-secret-jwt-key-here"
JWT_EXPIRES_IN="7d"

# Redis
REDIS_URL="redis://localhost:6379"

# File Storage
UPLOAD_DIR="./uploads"
MAX_FILE_SIZE="50MB"

# Logging
LOG_LEVEL="debug"

# External Services (optional for development)
OPENAI_API_KEY="your-openai-key"
GOOGLE_CLOUD_KEY_FILE="path/to/service-account.json"
```

### 3. Database Setup

```bash
# Create database
createdb syntaxisai_dev

# Run migrations
npx prisma migrate dev

# Seed database with test data
npm run db:seed

# Open Prisma Studio (optional)
npx prisma studio
```

### 4. Start Development Servers

```bash
# Option 1: Start all services
npm run dev:all

# Option 2: Start individually
# Terminal 1: Backend
npm run dev

# Terminal 2: Frontend
cd frontend && npm start

# Terminal 3: Watch tests (optional)
npm run test:watch
```

### 5. Verify Setup

```bash
# Check backend health
curl http://localhost:3001/api/v1/system/health

# Check frontend
open http://localhost:3000

# Run tests
npm test
```

## Architecture Overview

### Technology Stack

**Backend:**
- **Runtime:** Node.js 18+ with TypeScript
- **Framework:** Express.js with middleware architecture
- **Database:** PostgreSQL with Prisma ORM
- **Cache:** Redis for session storage and caching
- **Authentication:** JWT with refresh tokens
- **File Processing:** Multer for uploads, Tesseract for OCR
- **Logging:** Winston with structured logging
- **Testing:** Vitest for unit/integration tests

**Frontend:**
- **Framework:** React 18 with TypeScript
- **State Management:** React Query (TanStack Query) for server state
- **Routing:** React Router v6
- **UI Components:** Custom components with Tailwind CSS
- **Forms:** React Hook Form with Zod validation
- **Testing:** Vitest + React Testing Library

### Project Structure

```
SyntaxisAI/
├── backend/                 # Backend application
│   ├── src/
│   │   ├── controllers/     # Route handlers
│   │   ├── middleware/      # Express middleware
│   │   ├── routes/          # API route definitions
│   │   ├── services/        # Business logic
│   │   ├── utils/           # Utility functions
│   │   ├── types/           # TypeScript type definitions
│   │   └── __tests__/       # Test files
│   ├── prisma/              # Database schema and migrations
│   ├── logs/                # Application logs
│   └── uploads/             # File uploads
├── frontend/                # Frontend application
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── hooks/           # Custom React hooks
│   │   ├── pages/           # Page components
│   │   ├── services/        # API services
│   │   ├── utils/           # Utility functions
│   │   └── __tests__/       # Test files
│   └── public/              # Static assets
├── docs/                    # Documentation
├── scripts/                 # Build and deployment scripts
└── .github/                 # GitHub workflows
```

### Key Architectural Patterns

1. **Modular Architecture:** Each feature is self-contained with its own routes, services, and tests
2. **Middleware Pipeline:** Request processing through authentication, validation, logging, and error handling
3. **Service Layer:** Business logic separated from controllers
4. **Repository Pattern:** Data access abstracted through Prisma
5. **Event-Driven:** System events for logging, monitoring, and notifications

## Development Workflow

### Git Workflow

We use **Git Flow** with the following branches:

- `main` - Production-ready code
- `develop` - Integration branch for features
- `feature/*` - Feature development branches
- `hotfix/*` - Critical production fixes

### Feature Development Process

1. **Create Feature Branch**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/your-feature-name
   ```

2. **Development Cycle**
   ```bash
   # Make changes
   # Write tests
   # Run tests
   npm test
   
   # Check code quality
   npm run lint
   npm run type-check
   
   # Commit changes
   git add .
   git commit -m "feat: add new feature description"
   ```

3. **Push and Create PR**
   ```bash
   git push origin feature/your-feature-name
   # Create Pull Request on GitHub
   ```

### Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

feat(auth): add JWT refresh token functionality
fix(api): resolve validation error handling
docs(readme): update installation instructions
test(invoice): add integration tests for invoice processing
refactor(utils): improve error handling utilities
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

## Code Standards

### TypeScript Guidelines

1. **Strict Type Checking**
   ```typescript
   // Use explicit types
   interface User {
     id: string;
     email: string;
     createdAt: Date;
   }
   
   // Avoid 'any' - use proper types
   const processUser = (user: User): UserResponse => {
     // Implementation
   };
   ```

2. **Error Handling**
   ```typescript
   // Use Result pattern for error handling
   type Result<T, E = Error> = 
     | { success: true; data: T }
     | { success: false; error: E };
   
   const processInvoice = async (file: File): Promise<Result<Invoice>> => {
     try {
       const invoice = await invoiceService.process(file);
       return { success: true, data: invoice };
     } catch (error) {
       return { success: false, error: error as Error };
     }
   };
   ```

### API Design Standards

1. **RESTful Endpoints**
   ```
   GET    /api/v1/invoices           # List invoices
   POST   /api/v1/invoices           # Create invoice
   GET    /api/v1/invoices/:id       # Get invoice
   PUT    /api/v1/invoices/:id       # Update invoice
   DELETE /api/v1/invoices/:id       # Delete invoice
   ```

2. **Consistent Response Format**
   ```typescript
   // Success response
   {
     success: true,
     data: T,
     timestamp: string,
     requestId: string
   }
   
   // Error response
   {
     success: false,
     error: {
       code: string,
       userMessage: string,
       nextSteps: string,
       helpUrl: string
     },
     timestamp: string,
     requestId: string
   }
   ```

3. **Input Validation**
   ```typescript
   // Use Zod for validation
   const createInvoiceSchema = z.object({
     fileId: z.string().uuid(),
     templateId: z.string().uuid().optional(),
     options: z.object({
       engine: z.enum(['tesseract', 'google-vision']).optional(),
     }).optional(),
   });
   ```

### React Component Guidelines

1. **Component Structure**
   ```typescript
   interface ComponentProps {
     // Props interface
   }
   
   const Component: React.FC<ComponentProps> = ({ prop1, prop2 }) => {
     // Hooks
     // Event handlers
     // Render logic
     
     return (
       <div>
         {/* JSX */}
       </div>
     );
   };
   
   export default Component;
   ```

2. **Custom Hooks**
   ```typescript
   // Extract logic into custom hooks
   const useInvoiceData = (invoiceId: string) => {
     return useApiQuery(
       ['invoice', invoiceId],
       () => api.get(`/invoices/${invoiceId}`)
     );
   };
   ```

## Testing Guidelines

### Test Structure

```typescript
describe('Feature/Component Name', () => {
  beforeEach(() => {
    // Setup
  });
  
  afterEach(() => {
    // Cleanup
  });
  
  describe('specific functionality', () => {
    it('should do something specific', () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

### Testing Best Practices

1. **Unit Tests:** Test individual functions and components
2. **Integration Tests:** Test API endpoints and database interactions
3. **E2E Tests:** Test complete user workflows
4. **Test Coverage:** Aim for 80%+ coverage on critical paths

### Running Tests

```bash
# All tests
npm test

# Specific test file
npm test -- src/__tests__/auth.test.ts

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

## Debugging and Troubleshooting

### Development Tools

1. **Debug Endpoints** (development only)
   ```bash
   # System information
   curl http://localhost:3001/api/v1/debug/system
   
   # Performance test
   curl -X POST http://localhost:3001/api/v1/debug/test/performance
   ```

2. **Logging**
   ```typescript
   // Use structured logging
   import { loggerUtils } from '../utils/logger';
   
   loggerUtils.logUserAction('file-upload', userId, 'file', fileId);
   loggerUtils.logPerformance('invoice-processing', duration);
   ```

3. **Health Monitoring**
   - Backend: http://localhost:3001/api/v1/system/health
   - Frontend: http://localhost:3000/admin/system-health

### Common Issues

See [Troubleshooting Guide](../troubleshooting/README.md) for detailed solutions.

## Deployment Process

### Development Deployment

```bash
# Build and test
npm run build
npm run test:all

# Deploy to staging
npm run deploy:staging
```

### Production Deployment

```bash
# Create release branch
git checkout -b release/v1.2.0

# Update version
npm version minor

# Deploy to production
npm run deploy:production
```

## Resources and Documentation

### Internal Documentation

- [API Documentation](./api-reference.md)
- [Database Schema](./database-schema.md)
- [Integration Patterns](./api-integration-patterns.md)
- [React Query Guidelines](./react-query-guidelines.md)
- [Troubleshooting Guide](../troubleshooting/README.md)

### External Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [React Documentation](https://react.dev/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [Express.js Guide](https://expressjs.com/en/guide/)

### Team Communication

- **Slack:** #syntaxisai-dev
- **GitHub:** Issues and Pull Requests
- **Weekly Standup:** Mondays 9 AM
- **Code Review:** Required for all PRs

---

Welcome to the team! If you have any questions during onboarding, don't hesitate to reach out to your mentor or post in the #syntaxisai-dev Slack channel.
