# SyntaxisAI API Documentation

## Overview
The SyntaxisAI API provides endpoints for invoice processing, user management, and data extraction. This documentation covers all available endpoints, authentication, and usage examples.

## Base URL
```
Development: http://localhost:3001
Production: https://api.syntaxis.ai
```

## Authentication
All API endpoints require authentication using JWT tokens.

### Headers
```
Authorization: Bearer <your_jwt_token>
Content-Type: application/json
```

### Getting a Token
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "your_password"
}
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "1",
    "email": "user@example.com",
    "name": "User Name",
    "role": "user"
  }
}
```

## Rate Limiting
- 1000 requests per minute per IP
- Rate limit headers included in responses:
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset`

## Endpoints

### Invoice Processing

#### Upload Invoice
```http
POST /api/invoices/upload
Content-Type: multipart/form-data

file: <pdf_file>
```

Response:
```json
{
  "id": "inv_123",
  "status": "processing",
  "filename": "invoice.pdf",
  "createdAt": "2024-02-20T12:00:00Z"
}
```

#### Get Invoice Status
```http
GET /api/invoices/:id/status
```

Response:
```json
{
  "id": "inv_123",
  "status": "completed",
  "progress": 100,
  "extractedData": {
    "invoiceNumber": "INV-001",
    "date": "2024-02-20",
    "total": 1000.00,
    "currency": "USD",
    "vendor": "Example Corp"
  }
}
```

#### List Invoices
```http
GET /api/invoices
Query Parameters:
  - page: number (default: 1)
  - limit: number (default: 10)
  - status: string (optional)
  - startDate: string (optional)
  - endDate: string (optional)
```

Response:
```json
{
  "data": [
    {
      "id": "inv_123",
      "filename": "invoice.pdf",
      "status": "completed",
      "createdAt": "2024-02-20T12:00:00Z",
      "extractedData": {
        "invoiceNumber": "INV-001",
        "total": 1000.00
      }
    }
  ],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 10,
    "pages": 10
  }
}
```

### User Management

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure_password",
  "name": "User Name"
}
```

#### Update User Profile
```http
PATCH /api/users/profile
Content-Type: application/json

{
  "name": "Updated Name",
  "preferences": {
    "notifications": true,
    "defaultCurrency": "USD"
  }
}
```

## Error Handling

All errors follow this format:
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {} // Optional additional error details
  }
}
```

Common Error Codes:
- `AUTH_REQUIRED`: Authentication required
- `INVALID_TOKEN`: Invalid or expired token
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `INVALID_FILE`: Invalid file format or size
- `PROCESSING_ERROR`: Error during invoice processing
- `NOT_FOUND`: Resource not found
- `VALIDATION_ERROR`: Invalid request data

## Webhooks

### Invoice Processing Webhook
```http
POST /api/webhooks/invoice-processing
Content-Type: application/json

{
  "invoiceId": "inv_123",
  "status": "completed",
  "extractedData": {
    "invoiceNumber": "INV-001",
    "total": 1000.00
  },
  "timestamp": "2024-02-20T12:00:00Z",
  "signature": "sha256=..."
}
```

### Webhook Security
- All webhooks are signed using HMAC-SHA256
- Verify webhook signature using your webhook secret
- Webhook URLs must be HTTPS in production

## SDKs and Examples

### Node.js Example
```javascript
import { SyntaxisAI } from '@syntaxis-ai/sdk';

const client = new SyntaxisAI({
  apiKey: 'your_api_key',
  baseUrl: 'https://api.syntaxis.ai'
});

// Upload invoice
const result = await client.invoices.upload({
  file: fs.createReadStream('invoice.pdf')
});

// Get status
const status = await client.invoices.getStatus(result.id);
```

### Python Example
```python
from syntaxis_ai import SyntaxisAI

client = SyntaxisAI(api_key='your_api_key')

# Upload invoice
with open('invoice.pdf', 'rb') as f:
    result = client.invoices.upload(file=f)

# Get status
status = client.invoices.get_status(result.id)
```

## Best Practices

1. **Error Handling**
   - Always check for error responses
   - Implement retry logic for transient errors
   - Handle rate limiting appropriately

2. **File Uploads**
   - Validate file size before upload
   - Use multipart/form-data for file uploads
   - Implement progress tracking for large files

3. **Authentication**
   - Store tokens securely
   - Implement token refresh logic
   - Never expose API keys in client-side code

4. **Rate Limiting**
   - Implement exponential backoff
   - Cache responses when appropriate
   - Monitor rate limit headers

## Support

For API support:
- Email: api-support@syntaxis.ai
- Documentation: https://docs.syntaxis.ai
- Status Page: https://status.syntaxis.ai

---

*Last Updated: [Current Date]*
*Version: 1.0.0* 