# Onboarding Development Guide

## Getting Started

### Prerequisites
- Node.js 18+ and npm/yarn
- MongoDB 5.0+
- Redis 6.0+
- TypeScript knowledge
- React/Material-UI experience

### Local Development Setup

1. **Clone and Install Dependencies**
```bash
git clone https://github.com/georgekgr12/syntaxisai.git
cd syntaxisai

# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies
cd ../backend
npm install
```

2. **Environment Configuration**
```bash
# Frontend (.env.local)
REACT_APP_API_URL=http://localhost:3001/api
REACT_APP_ANALYTICS_ENABLED=true
REACT_APP_ONBOARDING_DEBUG=true

# Backend (.env)
MONGODB_URI=mongodb://localhost:27017/syntaxisai
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_jwt_secret
ANALYTICS_ENABLED=true
```

3. **Database Setup**
```bash
# Start MongoDB and Redis
brew services start mongodb-community
brew services start redis

# Run migrations
cd backend
npm run migrate
```

4. **Start Development Servers**
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm start
```

## Project Structure

### Frontend Architecture

```
src/
├── components/
│   └── Onboarding/
│       ├── OnboardingFlow.tsx      # Main dialog component
│       ├── steps/                  # Individual step components
│       │   ├── WelcomeStep.tsx
│       │   ├── UploadStep.tsx
│       │   ├── ExtractionStep.tsx
│       │   ├── TemplatesStep.tsx
│       │   ├── BatchStep.tsx
│       │   └── ExportStep.tsx
│       └── index.ts
├── hooks/
│   ├── useOnboarding.ts           # Main onboarding hook
│   ├── useOnboardingAnalytics.ts  # Analytics tracking
│   └── useAccessibility.ts        # Accessibility features
├── services/
│   ├── HelpService.ts             # API client
│   └── AnalyticsService.ts        # Analytics service
├── styles/
│   └── accessibility.css          # Accessibility styles
└── __tests__/                     # Test files
```

### Backend Architecture

```
src/
├── controllers/
│   ├── HelpController.ts          # Onboarding endpoints
│   └── AnalyticsController.ts     # Analytics endpoints
├── services/
│   ├── HelpService.ts             # Business logic
│   └── AnalyticsService.ts        # Analytics processing
├── models/
│   ├── User.ts                    # User model
│   └── OnboardingEvent.ts         # Analytics model
├── routes/
│   ├── help.ts                    # Onboarding routes
│   └── analytics.ts               # Analytics routes
├── middleware/
│   ├── auth.ts                    # Authentication
│   └── validation.ts              # Request validation
└── __tests__/                     # Test files
```

## Development Workflow

### Adding a New Onboarding Step

1. **Create Step Component**
```tsx
// src/components/Onboarding/steps/NewStep.tsx
import React from 'react';
import { Box, Typography, Button } from '@mui/material';

interface Props {
  onComplete: () => void;
  onBack: () => void;
  isLastStep?: boolean;
}

export const NewStep: React.FC<Props> = ({ onComplete, onBack, isLastStep }) => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        New Feature Tutorial
      </Typography>
      <Typography variant="body1" paragraph>
        Learn about this amazing new feature...
      </Typography>
      
      {/* Step content */}
      
      <Box display="flex" justifyContent="space-between" mt={4}>
        <Button onClick={onBack} variant="outlined">
          Back
        </Button>
        <Button onClick={onComplete} variant="contained">
          {isLastStep ? 'Complete' : 'Next'}
        </Button>
      </Box>
    </Box>
  );
};
```

2. **Update Step Configuration**
```tsx
// src/components/Onboarding/OnboardingFlow.tsx
const steps = [
  { id: 'welcome', label: 'Welcome', component: WelcomeStep },
  { id: 'upload', label: 'Upload PDFs', component: UploadStep },
  { id: 'extraction', label: 'Table Extraction', component: ExtractionStep },
  { id: 'templates', label: 'Templates', component: TemplatesStep },
  { id: 'batch', label: 'Batch Processing', component: BatchStep },
  { id: 'new-feature', label: 'New Feature', component: NewStep }, // Add here
  { id: 'export', label: 'Export Results', component: ExportStep },
];
```

3. **Update Backend Validation**
```typescript
// backend/src/services/HelpService.ts
private getStepOrder(stepId: string): number {
  const stepMap: Record<string, number> = {
    welcome: 1,
    upload: 2,
    extraction: 3,
    templates: 4,
    batch: 5,
    'new-feature': 6, // Add here
    export: 7, // Update order
  };
  return stepMap[stepId] || 1;
}
```

4. **Add Tests**
```tsx
// src/__tests__/components/Onboarding/steps/NewStep.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { NewStep } from '../../../components/Onboarding/steps/NewStep';

describe('NewStep', () => {
  const mockOnComplete = jest.fn();
  const mockOnBack = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render step content', () => {
    render(<NewStep onComplete={mockOnComplete} onBack={mockOnBack} />);
    
    expect(screen.getByText('New Feature Tutorial')).toBeInTheDocument();
  });

  it('should call onComplete when next button is clicked', () => {
    render(<NewStep onComplete={mockOnComplete} onBack={mockOnBack} />);
    
    fireEvent.click(screen.getByText('Next'));
    expect(mockOnComplete).toHaveBeenCalled();
  });
});
```

### Implementing Analytics Events

1. **Define Event Types**
```typescript
// src/services/AnalyticsService.ts
export interface OnboardingAnalyticsEvent {
  eventType: 'step_started' | 'step_completed' | 'feature_demo_clicked' | 'help_accessed';
  stepId?: string;
  featureId?: string;
  metadata?: Record<string, any>;
}
```

2. **Track Events in Components**
```tsx
// In your step component
import { useOnboardingAnalytics } from '../../../hooks/useOnboardingAnalytics';

export const NewStep: React.FC<Props> = ({ onComplete, onBack }) => {
  const { trackInteraction } = useOnboardingAnalytics();

  const handleDemoClick = () => {
    trackInteraction('feature_demo_clicked', 'new-feature-demo', {
      feature: 'new-feature',
      timestamp: new Date().toISOString(),
    });
  };

  return (
    <Box>
      <Button onClick={handleDemoClick}>
        Try Demo
      </Button>
    </Box>
  );
};
```

3. **Process Events in Backend**
```typescript
// backend/src/services/AnalyticsService.ts
async trackOnboardingEvent(event: OnboardingAnalyticsEvent): Promise<void> {
  // Validate event
  if (!this.isValidEventType(event.eventType)) {
    throw new Error('Invalid event type');
  }

  // Store in database
  await OnboardingEvent.create({
    userId: event.userId,
    eventType: event.eventType,
    stepId: event.stepId,
    metadata: event.metadata,
    timestamp: new Date(),
  });

  // Update real-time metrics
  await this.updateRealTimeMetrics(event);
}
```

### Accessibility Implementation

1. **Use Accessibility Hook**
```tsx
import { useAccessibility } from '../../../hooks/useAccessibility';

export const NewStep: React.FC<Props> = ({ onComplete, onBack }) => {
  const {
    announce,
    getStepAriaAttributes,
    handleKeyDown,
  } = useAccessibility();

  const stepAriaAttributes = getStepAriaAttributes(5, 7, 'New Feature');

  useEffect(() => {
    announce('Now learning about the new feature');
  }, [announce]);

  return (
    <Box
      {...stepAriaAttributes}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      {/* Step content */}
    </Box>
  );
};
```

2. **Add ARIA Labels**
```tsx
<Button
  onClick={onComplete}
  aria-label="Complete new feature tutorial and continue to next step"
  aria-describedby="new-feature-description"
>
  Next
</Button>
```

3. **Test Accessibility**
```tsx
// Use testing-library accessibility matchers
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

it('should have no accessibility violations', async () => {
  const { container } = render(<NewStep onComplete={jest.fn()} onBack={jest.fn()} />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

## Testing Strategy

### Unit Tests
```bash
# Run all tests
npm test

# Run specific test file
npm test -- NewStep.test.tsx

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

### Integration Tests
```bash
# Run integration tests
npm run test:integration

# Test specific API endpoints
npm run test:api -- --grep "onboarding"
```

### E2E Tests
```bash
# Run Cypress tests
npm run test:e2e

# Run specific test
npm run test:e2e -- --spec "cypress/integration/onboarding.spec.ts"
```

### Accessibility Tests
```bash
# Run accessibility tests
npm run test:a11y

# Test with screen reader simulation
npm run test:screen-reader
```

## Debugging

### Frontend Debugging

1. **Enable Debug Mode**
```javascript
// In browser console
localStorage.setItem('onboarding_debug', 'true');
```

2. **View Current State**
```javascript
// Access onboarding state
window.__ONBOARDING_DEBUG__ = {
  getState: () => useOnboarding.getState(),
  getAnalytics: () => AnalyticsService.getDebugInfo(),
};
```

3. **Mock API Responses**
```typescript
// In development
if (process.env.NODE_ENV === 'development') {
  // Mock successful responses
  HelpService.getOnboardingStatus = () => Promise.resolve({
    completed: false,
    currentStep: 2,
    completedSteps: ['welcome'],
  });
}
```

### Backend Debugging

1. **Enable Debug Logging**
```typescript
// In your service
import debug from 'debug';
const log = debug('onboarding:service');

log('Processing onboarding step: %s', stepId);
```

2. **Database Query Debugging**
```typescript
// Enable Mongoose debugging
mongoose.set('debug', true);

// Log specific queries
OnboardingEvent.find().explain('executionStats');
```

3. **Redis Debugging**
```typescript
// Monitor Redis commands
redis.monitor((time, args) => {
  console.log(time + ': ' + args);
});
```

## Performance Optimization

### Frontend Optimization

1. **Lazy Loading**
```tsx
// Lazy load step components
const WelcomeStep = lazy(() => import('./steps/WelcomeStep'));
const UploadStep = lazy(() => import('./steps/UploadStep'));

// Use Suspense
<Suspense fallback={<CircularProgress />}>
  <CurrentStepComponent />
</Suspense>
```

2. **Memoization**
```tsx
// Memoize expensive calculations
const stepProgress = useMemo(() => {
  return calculateProgress(completedSteps, totalSteps);
}, [completedSteps, totalSteps]);

// Memoize components
const MemoizedStep = memo(StepComponent);
```

3. **Analytics Batching**
```typescript
// Batch analytics events
const analyticsQueue = [];
const flushInterval = 30000; // 30 seconds

const flushAnalytics = () => {
  if (analyticsQueue.length > 0) {
    AnalyticsService.trackEventsBatch(analyticsQueue);
    analyticsQueue.length = 0;
  }
};

setInterval(flushAnalytics, flushInterval);
```

### Backend Optimization

1. **Database Indexing**
```javascript
// Create compound indexes
db.onboarding_events.createIndex({ userId: 1, timestamp: 1 });
db.onboarding_events.createIndex({ eventType: 1, stepId: 1 });
```

2. **Caching**
```typescript
// Cache onboarding status
const cacheKey = `onboarding:${userId}`;
const cached = await redis.get(cacheKey);

if (cached) {
  return JSON.parse(cached);
}

const status = await this.getOnboardingStatusFromDB(userId);
await redis.setex(cacheKey, 3600, JSON.stringify(status));
```

3. **Query Optimization**
```typescript
// Use aggregation pipelines for analytics
const metrics = await OnboardingEvent.aggregate([
  { $match: { timestamp: { $gte: startDate, $lte: endDate } } },
  { $group: { _id: '$eventType', count: { $sum: 1 } } },
  { $sort: { count: -1 } }
]);
```

## Deployment

### Build Process
```bash
# Frontend build
cd frontend
npm run build

# Backend build
cd backend
npm run build

# Run production
npm start
```

### Environment Variables
```bash
# Production environment
NODE_ENV=production
MONGODB_URI=mongodb://prod-cluster/syntaxisai
REDIS_URL=redis://prod-redis:6379
ANALYTICS_ENABLED=true
ONBOARDING_AUTO_START=true
```

### Health Checks
```typescript
// Health check endpoint
app.get('/health/onboarding', async (req, res) => {
  try {
    // Check database connection
    await OnboardingEvent.findOne().limit(1);
    
    // Check Redis connection
    await redis.ping();
    
    res.status(200).json({ status: 'healthy' });
  } catch (error) {
    res.status(500).json({ status: 'unhealthy', error: error.message });
  }
});
```

## Best Practices

### Code Quality
- Use TypeScript for type safety
- Follow ESLint and Prettier configurations
- Write comprehensive tests
- Use meaningful commit messages
- Document complex logic

### Performance
- Implement proper caching strategies
- Use database indexes effectively
- Batch analytics events
- Optimize bundle sizes
- Monitor performance metrics

### Security
- Validate all user inputs
- Use proper authentication
- Implement rate limiting
- Sanitize analytics data
- Follow OWASP guidelines

### Accessibility
- Test with screen readers
- Ensure keyboard navigation
- Maintain color contrast ratios
- Provide alternative text
- Use semantic HTML

### Monitoring
- Set up error tracking
- Monitor performance metrics
- Track user behavior
- Set up alerts for issues
- Regular health checks
