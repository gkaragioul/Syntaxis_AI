# Onboarding API Reference

## Base URL
```
https://api.syntaxisai.com/api
```

## Authentication
All endpoints require Bearer token authentication:
```http
Authorization: Bearer <your_access_token>
```

## Onboarding Endpoints

### Get Onboarding Status

Retrieves the current onboarding status for the authenticated user.

**Endpoint:** `GET /help/onboarding/status`

**Response:**
```json
{
  "completed": boolean,
  "currentStep": number,
  "completedSteps": string[],
  "skipped": boolean
}
```

**Example:**
```bash
curl -X GET "https://api.syntaxisai.com/api/help/onboarding/status" \
  -H "Authorization: Bearer your_token_here"
```

**Response Example:**
```json
{
  "completed": false,
  "currentStep": 3,
  "completedSteps": ["welcome", "upload"],
  "skipped": false
}
```

### Update Onboarding Step

Updates the completion status of a specific onboarding step.

**Endpoint:** `POST /help/onboarding/step/:stepId`

**Parameters:**
- `stepId` (path): The ID of the step to update
  - Valid values: `welcome`, `upload`, `extraction`, `templates`, `batch`, `export`

**Request Body:**
```json
{
  "completed": boolean
}
```

**Response:**
```json
{
  "message": "Onboarding step updated"
}
```

**Example:**
```bash
curl -X POST "https://api.syntaxisai.com/api/help/onboarding/step/welcome" \
  -H "Authorization: Bearer your_token_here" \
  -H "Content-Type: application/json" \
  -d '{"completed": true}'
```

### Skip Onboarding

Marks the entire onboarding process as skipped for the authenticated user.

**Endpoint:** `POST /help/onboarding/skip`

**Response:**
```json
{
  "message": "Onboarding skipped"
}
```

**Example:**
```bash
curl -X POST "https://api.syntaxisai.com/api/help/onboarding/skip" \
  -H "Authorization: Bearer your_token_here"
```

## Analytics Endpoints

### Track Onboarding Event

Records a single onboarding analytics event.

**Endpoint:** `POST /analytics/onboarding/events`

**Request Body:**
```json
{
  "eventType": string,
  "stepId": string (optional),
  "stepName": string (optional),
  "timeSpent": number (optional),
  "metadata": object (optional),
  "sessionId": string (optional)
}
```

**Event Types:**
- `step_started`
- `step_completed`
- `step_skipped`
- `onboarding_started`
- `onboarding_completed`
- `onboarding_abandoned`
- `help_accessed`

**Response:**
```json
{
  "message": "Event tracked successfully"
}
```

**Example:**
```bash
curl -X POST "https://api.syntaxisai.com/api/analytics/onboarding/events" \
  -H "Authorization: Bearer your_token_here" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "step_completed",
    "stepId": "welcome",
    "stepName": "Welcome",
    "timeSpent": 45,
    "metadata": {
      "userAgent": "Mozilla/5.0...",
      "viewport": {"width": 1920, "height": 1080}
    }
  }'
```

### Track Batch Events

Records multiple onboarding analytics events in a single request.

**Endpoint:** `POST /analytics/onboarding/events/batch`

**Request Body:**
```json
{
  "events": [
    {
      "eventType": string,
      "stepId": string (optional),
      "stepName": string (optional),
      "timeSpent": number (optional),
      "metadata": object (optional),
      "sessionId": string (optional)
    }
  ]
}
```

**Response:**
```json
{
  "message": "Events tracked successfully",
  "count": number
}
```

### Get Onboarding Metrics (Admin Only)

Retrieves aggregated onboarding metrics for analysis.

**Endpoint:** `GET /analytics/onboarding/metrics`

**Query Parameters:**
- `startDate` (optional): ISO 8601 date string
- `endDate` (optional): ISO 8601 date string

**Response:**
```json
{
  "totalUsers": number,
  "completionRate": number,
  "averageTimeToComplete": number,
  "stepCompletionRates": {
    "welcome": number,
    "upload": number,
    "extraction": number,
    "templates": number,
    "batch": number,
    "export": number
  },
  "abandonmentPoints": {
    "welcome": number,
    "upload": number,
    "extraction": number,
    "templates": number,
    "batch": number,
    "export": number
  },
  "helpAccessCount": number,
  "commonIssues": [
    {
      "issue": string,
      "count": number,
      "stepId": string (optional)
    }
  ]
}
```

**Example:**
```bash
curl -X GET "https://api.syntaxisai.com/api/analytics/onboarding/metrics?startDate=2024-01-01&endDate=2024-01-31" \
  -H "Authorization: Bearer admin_token_here"
```

### Get User Onboarding Journey

Retrieves the complete onboarding journey for a specific user.

**Endpoint:** `GET /analytics/onboarding/journey/:userId?`

**Parameters:**
- `userId` (path, optional): User ID to retrieve journey for. If omitted, returns current user's journey.

**Response:**
```json
{
  "userId": string,
  "startedAt": string (ISO 8601),
  "completedAt": string (ISO 8601, optional),
  "currentStep": string,
  "stepsCompleted": string[],
  "timeSpentPerStep": {
    "welcome": number,
    "upload": number,
    "extraction": number,
    "templates": number,
    "batch": number,
    "export": number
  },
  "helpAccessedSteps": string[],
  "abandonedAt": string (ISO 8601, optional),
  "completionStatus": "in_progress" | "completed" | "abandoned" | "skipped"
}
```

### Get Onboarding Funnel (Admin Only)

Retrieves funnel analysis data for the onboarding process.

**Endpoint:** `GET /analytics/onboarding/funnel`

**Query Parameters:**
- `startDate` (optional): ISO 8601 date string
- `endDate` (optional): ISO 8601 date string

**Response:**
```json
{
  "steps": [
    {
      "stepId": string,
      "stepName": string,
      "started": number,
      "completed": number,
      "abandoned": number,
      "conversionRate": number,
      "averageTime": number
    }
  ],
  "overallConversion": number
}
```

### Export Onboarding Data (Admin Only)

Exports onboarding analytics data in various formats.

**Endpoint:** `GET /analytics/onboarding/export`

**Query Parameters:**
- `format` (optional): Export format (`csv`, `json`, `xlsx`). Default: `csv`
- `startDate` (optional): ISO 8601 date string
- `endDate` (optional): ISO 8601 date string

**Response:** File download with appropriate content type

**Example:**
```bash
curl -X GET "https://api.syntaxisai.com/api/analytics/onboarding/export?format=csv&startDate=2024-01-01" \
  -H "Authorization: Bearer admin_token_here" \
  -o onboarding_data.csv
```

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request
```json
{
  "error": "Validation error",
  "details": [
    {
      "field": "stepId",
      "message": "Invalid step ID"
    }
  ]
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing authentication token"
}
```

### 403 Forbidden
```json
{
  "error": "Forbidden",
  "message": "Admin access required"
}
```

### 404 Not Found
```json
{
  "error": "Not found",
  "message": "User not found"
}
```

### 429 Too Many Requests
```json
{
  "error": "Rate limit exceeded",
  "message": "Too many requests, please try again later",
  "retryAfter": 60
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error",
  "message": "An unexpected error occurred"
}
```

## Rate Limits

- **Onboarding endpoints**: 100 requests per minute per user
- **Analytics tracking**: 1000 events per minute per user
- **Analytics retrieval**: 10 requests per minute per user
- **Admin endpoints**: 100 requests per minute per admin user

## Data Types

### Step IDs
Valid step identifiers:
- `welcome`: Welcome and introduction step
- `upload`: PDF upload tutorial step
- `extraction`: Table extraction demonstration step
- `templates`: Template creation and management step
- `batch`: Batch processing tutorial step
- `export`: Export options and configuration step

### Event Types
Valid analytics event types:
- `step_started`: User began a specific step
- `step_completed`: User completed a specific step
- `step_skipped`: User skipped a specific step
- `onboarding_started`: User began the onboarding process
- `onboarding_completed`: User completed the entire onboarding
- `onboarding_abandoned`: User abandoned the onboarding process
- `help_accessed`: User accessed help during onboarding

### Completion Status
Valid completion status values:
- `in_progress`: Onboarding is currently in progress
- `completed`: Onboarding has been completed successfully
- `abandoned`: Onboarding was abandoned before completion
- `skipped`: Onboarding was intentionally skipped by the user

## SDK Examples

### JavaScript/TypeScript
```typescript
import { OnboardingAPI } from '@syntaxisai/sdk';

const api = new OnboardingAPI({
  baseURL: 'https://api.syntaxisai.com/api',
  token: 'your_access_token'
});

// Get onboarding status
const status = await api.getOnboardingStatus();

// Update step
await api.updateStep('welcome', true);

// Track event
await api.trackEvent({
  eventType: 'step_completed',
  stepId: 'welcome',
  timeSpent: 45
});
```

### Python
```python
from syntaxisai import OnboardingClient

client = OnboardingClient(
    base_url='https://api.syntaxisai.com/api',
    token='your_access_token'
)

# Get onboarding status
status = client.get_onboarding_status()

# Update step
client.update_step('welcome', completed=True)

# Track event
client.track_event(
    event_type='step_completed',
    step_id='welcome',
    time_spent=45
)
```

## Webhooks

### Onboarding Completion Webhook

Triggered when a user completes the onboarding process.

**Payload:**
```json
{
  "event": "onboarding.completed",
  "userId": string,
  "completedAt": string (ISO 8601),
  "totalTime": number,
  "stepsCompleted": string[]
}
```

### Onboarding Abandonment Webhook

Triggered when a user abandons the onboarding process.

**Payload:**
```json
{
  "event": "onboarding.abandoned",
  "userId": string,
  "abandonedAt": string (ISO 8601),
  "lastStep": string,
  "reason": string
}
```
