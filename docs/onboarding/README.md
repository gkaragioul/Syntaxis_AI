# Onboarding Flow Documentation

## Overview

The SyntaxisAI onboarding flow is a comprehensive, accessible, and analytics-driven system designed to guide new users through the platform's key features. The system is built with modularity, accessibility, and user experience as core principles.

## Architecture

### Frontend Components

```
src/components/Onboarding/
├── OnboardingFlow.tsx          # Main onboarding dialog component
├── steps/
│   ├── WelcomeStep.tsx        # Introduction and welcome
│   ├── UploadStep.tsx         # PDF upload tutorial
│   ├── ExtractionStep.tsx     # Table extraction demo
│   ├── TemplatesStep.tsx      # Template creation guide
│   ├── BatchStep.tsx          # Batch processing tutorial
│   └── ExportStep.tsx         # Export options guide
└── index.ts                   # Component exports
```

### Hooks and Services

```
src/hooks/
├── useOnboarding.ts           # Main onboarding state management
├── useOnboardingAnalytics.ts  # Analytics tracking
└── useAccessibility.ts        # Accessibility features

src/services/
├── HelpService.ts             # Onboarding API client
└── AnalyticsService.ts        # Analytics tracking service
```

### Backend Components

```
backend/src/
├── controllers/
│   ├── HelpController.ts      # Onboarding endpoints
│   └── AnalyticsController.ts # Analytics endpoints
├── services/
│   ├── HelpService.ts         # Onboarding business logic
│   └── AnalyticsService.ts    # Analytics processing
├── models/
│   ├── User.ts                # User model with onboarding fields
│   └── OnboardingEvent.ts     # Analytics event model
└── routes/
    ├── help.ts                # Onboarding routes
    └── analytics.ts           # Analytics routes
```

## Key Features

### 1. Progressive Disclosure
- Six-step guided tour covering all major features
- Each step builds upon previous knowledge
- Interactive demonstrations and examples

### 2. Accessibility First
- Full keyboard navigation support
- Screen reader compatibility with ARIA labels
- High contrast and reduced motion support
- Focus management and announcements

### 3. Analytics & Tracking
- Comprehensive event tracking
- User journey analysis
- Completion funnel metrics
- Real-time progress monitoring

### 4. Persistence & Recovery
- Progress saved across sessions
- Offline resilience with local storage fallback
- Error recovery mechanisms
- Resume from last completed step

### 5. Responsive Design
- Mobile-first approach
- Touch-friendly interactions
- Adaptive layouts for all screen sizes

## Step-by-Step Guide

### Step 1: Welcome
- Platform introduction
- Key benefits overview
- Getting started motivation

### Step 2: Upload PDFs
- File upload demonstration
- Supported formats explanation
- Best practices for file quality

### Step 3: Table Extraction
- AI extraction demonstration
- Confidence score explanation
- Manual correction workflow

### Step 4: Templates
- Template creation tutorial
- Reusability benefits
- Template gallery showcase

### Step 5: Batch Processing
- Multiple file processing
- Progress monitoring
- Queue management

### Step 6: Export Results
- Format selection guide
- Export options configuration
- Integration possibilities

## API Endpoints

### Onboarding Management

#### Get Onboarding Status
```http
GET /api/help/onboarding/status
Authorization: Bearer <token>
```

**Response:**
```json
{
  "completed": false,
  "currentStep": 2,
  "completedSteps": ["welcome"],
  "skipped": false
}
```

#### Update Step Progress
```http
POST /api/help/onboarding/step/:stepId
Authorization: Bearer <token>
Content-Type: application/json

{
  "completed": true
}
```

#### Skip Onboarding
```http
POST /api/help/onboarding/skip
Authorization: Bearer <token>
```

### Analytics Endpoints

#### Track Event
```http
POST /api/analytics/onboarding/events
Authorization: Bearer <token>
Content-Type: application/json

{
  "eventType": "step_completed",
  "stepId": "welcome",
  "stepName": "Welcome",
  "timeSpent": 45,
  "metadata": {
    "userAgent": "...",
    "viewport": { "width": 1920, "height": 1080 }
  }
}
```

#### Get Metrics (Admin)
```http
GET /api/analytics/onboarding/metrics?startDate=2024-01-01&endDate=2024-01-31
Authorization: Bearer <token>
```

## Usage Examples

### Basic Integration

```tsx
import { useOnboarding } from '../hooks/useOnboarding';
import { OnboardingFlow } from '../components/Onboarding';

function App() {
  const { isOpen, closeOnboarding } = useOnboarding();

  return (
    <div>
      {/* Your app content */}
      <OnboardingFlow 
        open={isOpen} 
        onClose={closeOnboarding} 
      />
    </div>
  );
}
```

### Manual Onboarding Trigger

```tsx
import { useOnboarding } from '../hooks/useOnboarding';

function HelpMenu() {
  const { openOnboarding } = useOnboarding();

  return (
    <MenuItem onClick={openOnboarding}>
      Show Onboarding
    </MenuItem>
  );
}
```

### Analytics Integration

```tsx
import { useOnboardingAnalytics } from '../hooks/useOnboardingAnalytics';

function CustomStep() {
  const { trackInteraction } = useOnboardingAnalytics();

  const handleButtonClick = () => {
    trackInteraction('button_click', 'demo-button', {
      feature: 'pdf-upload',
      context: 'tutorial'
    });
  };

  return (
    <Button onClick={handleButtonClick}>
      Try Demo
    </Button>
  );
}
```

## Configuration

### Environment Variables

```env
# Analytics
ANALYTICS_ENABLED=true
ANALYTICS_BATCH_SIZE=50
ANALYTICS_FLUSH_INTERVAL=30000

# Onboarding
ONBOARDING_AUTO_START=true
ONBOARDING_SKIP_ENABLED=true
ONBOARDING_PROGRESS_CACHE_TTL=3600
```

### Feature Flags

```typescript
interface OnboardingConfig {
  autoStart: boolean;
  skipEnabled: boolean;
  analyticsEnabled: boolean;
  accessibilityMode: 'standard' | 'enhanced';
  steps: string[];
}
```

## Testing

### Unit Tests
- Component rendering tests
- Hook behavior tests
- Service method tests
- Analytics tracking tests

### Integration Tests
- API endpoint tests
- Database interaction tests
- Authentication flow tests

### Accessibility Tests
- Screen reader compatibility
- Keyboard navigation
- Color contrast validation
- Focus management

### Example Test

```typescript
describe('OnboardingFlow', () => {
  it('should complete step and advance to next', async () => {
    const { result } = renderHook(() => useOnboarding());
    
    await act(async () => {
      await result.current.updateStep('welcome', true);
    });
    
    expect(mockAnalytics.trackStepComplete).toHaveBeenCalledWith(
      'welcome', 
      'Welcome'
    );
  });
});
```

## Deployment

### Database Migrations

```sql
-- Add onboarding fields to users table
ALTER TABLE users ADD COLUMN onboarding_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN onboarding_skipped BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN onboarding_step INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN completed_onboarding_steps TEXT[];

-- Create onboarding events table
CREATE TABLE onboarding_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  event_type VARCHAR(50) NOT NULL,
  step_id VARCHAR(50),
  step_name VARCHAR(100),
  time_spent INTEGER,
  metadata JSONB,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  session_id VARCHAR(100),
  user_agent TEXT,
  ip INET,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_onboarding_events_user_id ON onboarding_events(user_id);
CREATE INDEX idx_onboarding_events_timestamp ON onboarding_events(timestamp);
CREATE INDEX idx_onboarding_events_event_type ON onboarding_events(event_type);
CREATE INDEX idx_onboarding_events_step_id ON onboarding_events(step_id);
```

### Redis Configuration

```redis
# Onboarding cache configuration
CONFIG SET maxmemory-policy allkeys-lru
CONFIG SET maxmemory 256mb

# Set up key patterns
# onboarding:user:{userId} - User onboarding status
# onboarding_metrics:{date} - Daily metrics
```

## Monitoring

### Key Metrics
- Onboarding completion rate
- Step abandonment points
- Average completion time
- Help access frequency
- Error rates

### Alerts
- Completion rate drops below 70%
- High error rates in specific steps
- Unusual abandonment patterns
- API response time degradation

## Troubleshooting

### Common Issues

1. **Onboarding not starting automatically**
   - Check user authentication status
   - Verify onboarding status API response
   - Check browser console for errors

2. **Progress not saving**
   - Verify API connectivity
   - Check local storage fallback
   - Review error logs

3. **Analytics not tracking**
   - Confirm analytics service configuration
   - Check network requests
   - Verify user permissions

### Debug Mode

```typescript
// Enable debug logging
localStorage.setItem('onboarding_debug', 'true');

// View current state
console.log(useOnboarding.getState());

// Check analytics queue
console.log(AnalyticsService.getPendingEvents());
```

## Contributing

### Adding New Steps

1. Create step component in `src/components/Onboarding/steps/`
2. Add step to configuration in `OnboardingFlow.tsx`
3. Update backend step validation
4. Add analytics tracking
5. Write tests
6. Update documentation

### Modifying Analytics

1. Update event types in `AnalyticsService.ts`
2. Add new tracking methods
3. Update backend event processing
4. Add database migrations if needed
5. Update metrics calculations

## Security Considerations

- All onboarding data is user-scoped
- Analytics data is anonymized where possible
- Admin-only endpoints require proper authorization
- Rate limiting on analytics endpoints
- Input validation on all user data

## Performance

- Lazy loading of step components
- Efficient caching of onboarding status
- Batched analytics events
- Optimized database queries
- CDN delivery for static assets

## Future Enhancements

- A/B testing framework
- Personalized onboarding paths
- Video tutorials integration
- Multi-language support
- Advanced analytics dashboard
- Machine learning insights
