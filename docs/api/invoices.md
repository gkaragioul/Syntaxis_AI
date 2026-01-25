# Invoice Processing API

## Overview
The Invoice Processing API provides endpoints for processing, managing, and retrieving invoice data. It supports both single invoice processing and batch operations.

## Endpoints

### Process Single Invoice
Process a single invoice file that has been previously uploaded.

```http
POST /invoices/process/:fileId
```

#### Path Parameters
- `fileId` (string, required): ID of the uploaded file to process

#### Request Body
```json
{
  "options": {
    "priority": "high" | "normal" | "low",
    "templateId": "string",
    "extractionRules": {
      "vendor": {
        "required": true,
        "validation": "string"
      },
      "amount": {
        "required": true,
        "validation": "number"
      }
    }
  }
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "jobId": "job_123",
    "fileId": "file_456",
    "status": "queued",
    "estimatedTime": "30s",
    "createdAt": "2024-03-20T10:00:00Z"
  }
}
```

### Process Multiple Invoices
Process multiple invoice files in a batch operation.

```http
POST /invoices/batch
```

#### Request Body
```json
{
  "fileIds": ["file_1", "file_2", "file_3"],
  "options": {
    "priority": "high" | "normal" | "low",
    "templateId": "string",
    "concurrency": 3,
    "notifyOnComplete": true,
    "extractionRules": {
      "vendor": {
        "required": true,
        "validation": "string"
      },
      "amount": {
        "required": true,
        "validation": "number"
      }
    }
  }
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "batchId": "batch_123",
    "jobs": [
      {
        "jobId": "job_1",
        "fileId": "file_1",
        "status": "queued"
      },
      {
        "jobId": "job_2",
        "fileId": "file_2",
        "status": "queued"
      }
    ],
    "totalJobs": 2,
    "createdAt": "2024-03-20T10:00:00Z"
  }
}
```

### Get Processing Job Status
Retrieve the current status of an invoice processing job.

```http
GET /invoices/process/:jobId
```

#### Path Parameters
- `jobId` (string, required): ID of the processing job

#### Response
```json
{
  "success": true,
  "data": {
    "jobId": "job_123",
    "fileId": "file_456",
    "status": "processing",
    "progress": 75,
    "currentStep": "extraction",
    "startedAt": "2024-03-20T10:00:00Z",
    "updatedAt": "2024-03-20T10:00:30Z",
    "estimatedCompletion": "2024-03-20T10:01:00Z",
    "result": {
      "success": true,
      "invoice": {
        "id": "inv_789",
        "vendor": "Example Corp",
        "invoiceNumber": "INV-001",
        "date": "2024-03-01",
        "dueDate": "2024-04-01",
        "amount": 1000.00,
        "currency": "USD",
        "status": "PROCESSED",
        "confidence": 0.95
      }
    }
  }
}
```

### List Invoices
Retrieve a list of processed invoices with filtering and pagination.

```http
GET /invoices
```

#### Query Parameters
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 10, max: 100)
- `status` (string, optional): Filter by status
- `startDate` (string, optional): Filter by start date (ISO format)
- `endDate` (string, optional): Filter by end date (ISO format)
- `vendor` (string, optional): Filter by vendor name
- `minAmount` (number, optional): Filter by minimum amount
- `maxAmount` (number, optional): Filter by maximum amount
- `sortBy` (string, optional): Sort field (default: "createdAt")
- `sortOrder` (string, optional): Sort order ("asc" or "desc", default: "desc")

#### Response
```json
{
  "success": true,
  "data": {
    "invoices": [
      {
        "id": "inv_789",
        "fileId": "file_456",
        "vendor": "Example Corp",
        "invoiceNumber": "INV-001",
        "date": "2024-03-01",
        "dueDate": "2024-04-01",
        "amount": 1000.00,
        "currency": "USD",
        "status": "PROCESSED",
        "confidence": 0.95,
        "createdAt": "2024-03-20T10:00:00Z",
        "updatedAt": "2024-03-20T10:01:00Z"
      }
    ]
  },
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 100,
      "pages": 10
    }
  }
}
```

### Get Invoice Details
Retrieve detailed information about a specific invoice.

```http
GET /invoices/:id
```

#### Path Parameters
- `id` (string, required): Invoice ID

#### Response
```json
{
  "success": true,
  "data": {
    "id": "inv_789",
    "fileId": "file_456",
    "vendor": {
      "name": "Example Corp",
      "address": "123 Business St",
      "taxId": "TAX123456",
      "email": "billing@example.com"
    },
    "invoiceNumber": "INV-001",
    "date": "2024-03-01",
    "dueDate": "2024-04-01",
    "amount": 1000.00,
    "currency": "USD",
    "taxAmount": 100.00,
    "totalAmount": 1100.00,
    "status": "PROCESSED",
    "confidence": 0.95,
    "lineItems": [
      {
        "description": "Product A",
        "quantity": 2,
        "unitPrice": 400.00,
        "amount": 800.00
      },
      {
        "description": "Service B",
        "quantity": 1,
        "unitPrice": 200.00,
        "amount": 200.00
      }
    ],
    "paymentTerms": "Net 30",
    "notes": "Thank you for your business",
    "createdAt": "2024-03-20T10:00:00Z",
    "updatedAt": "2024-03-20T10:01:00Z",
    "processingHistory": [
      {
        "step": "upload",
        "status": "completed",
        "timestamp": "2024-03-20T10:00:00Z"
      },
      {
        "step": "ocr",
        "status": "completed",
        "timestamp": "2024-03-20T10:00:15Z"
      },
      {
        "step": "extraction",
        "status": "completed",
        "timestamp": "2024-03-20T10:00:45Z"
      }
    ]
  }
}
```

### Update Invoice
Update invoice details or status.

```http
PUT /invoices/:id
```

#### Path Parameters
- `id` (string, required): Invoice ID

#### Request Body
```json
{
  "vendor": {
    "name": "Updated Corp",
    "address": "456 Business Ave"
  },
  "invoiceNumber": "INV-002",
  "date": "2024-03-02",
  "dueDate": "2024-04-02",
  "amount": 1200.00,
  "status": "APPROVED",
  "notes": "Updated notes"
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "id": "inv_789",
    "updatedAt": "2024-03-20T11:00:00Z",
    "changes": {
      "vendor.name": ["Example Corp", "Updated Corp"],
      "amount": [1000.00, 1200.00],
      "status": ["PROCESSED", "APPROVED"]
    }
  }
}
```

### Delete Invoice
Delete an invoice and its associated data.

```http
DELETE /invoices/:id
```

#### Path Parameters
- `id` (string, required): Invoice ID

#### Response
```json
{
  "success": true,
  "data": {
    "id": "inv_789",
    "deletedAt": "2024-03-20T12:00:00Z"
  }
}
```

## Processing Status Codes
- `queued`: Job is waiting to be processed
- `processing`: Job is currently being processed
- `completed`: Job completed successfully
- `failed`: Job failed during processing
- `cancelled`: Job was cancelled by user
- `stalled`: Job processing has stalled

## Error Codes
- `INVALID_FILE_ID`: File ID does not exist or is not accessible
- `PROCESSING_ERROR`: Error during invoice processing
- `VALIDATION_ERROR`: Invalid request data
- `NOT_FOUND`: Invoice not found
- `PERMISSION_DENIED`: Insufficient permissions
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `BATCH_LIMIT_EXCEEDED`: Too many files in batch request

## Webhooks
Invoice processing events can be sent to your webhook URL. See [Webhook Documentation](../webhooks.md) for details.

## Best Practices
1. Always check job status after processing
2. Implement proper error handling
3. Use batch processing for multiple files
4. Set appropriate priority levels
5. Monitor processing status
6. Handle webhook events for real-time updates

## Rate Limits
- Single processing: 10 requests per minute
- Batch processing: 5 requests per minute
- Status checks: 60 requests per minute
- List/Get operations: 100 requests per minute

## Examples

### Node.js
```javascript
const { SyntaxisAI } = require('@syntaxis-ai/sdk');

const client = new SyntaxisAI({
  apiKey: 'your_api_key'
});

// Process single invoice
async function processInvoice(fileId) {
  const job = await client.invoices.process(fileId, {
    priority: 'high',
    templateId: 'default'
  });

  // Poll for status
  while (true) {
    const status = await client.invoices.getJobStatus(job.jobId);
    if (status.status === 'completed') {
      return status.result.invoice;
    }
    if (status.status === 'failed') {
      throw new Error(status.error.message);
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

// Process batch
async function processBatch(fileIds) {
  const batch = await client.invoices.processBatch(fileIds, {
    concurrency: 3,
    notifyOnComplete: true
  });

  return batch.jobs.map(job => job.jobId);
}
```

### Python
```python
from syntaxis_ai import SyntaxisAI

client = SyntaxisAI(api_key='your_api_key')

# Process single invoice
async def process_invoice(file_id):
    job = await client.invoices.process(
        file_id,
        priority='high',
        template_id='default'
    )
    
    # Poll for status
    while True:
        status = await client.invoices.get_job_status(job.job_id)
        if status.status == 'completed':
            return status.result.invoice
        if status.status == 'failed':
            raise Exception(status.error.message)
        await asyncio.sleep(1)

# Process batch
async def process_batch(file_ids):
    batch = await client.invoices.process_batch(
        file_ids,
        concurrency=3,
        notify_on_complete=True
    )
    
    return [job.job_id for job in batch.jobs]
```

## Support
For additional help:
- Email: api-support@syntaxisai.com
- Documentation: https://docs.syntaxisai.com
- Status Page: https://status.syntaxisai.com 