# API Integration Patterns

This document outlines the standardized patterns for API integration, error handling, and React Query usage in the SyntaxisAI application.

## Table of Contents

1. [API Response Standards](#api-response-standards)
2. [Error Handling Patterns](#error-handling-patterns)
3. [Validation Standards](#validation-standards)
4. [React Query Integration](#react-query-integration)
5. [Authentication Patterns](#authentication-patterns)
6. [Best Practices](#best-practices)

## API Response Standards

### Success Response Format

All successful API responses follow this standardized format:

```typescript
{
  success: true,
  data: any,           // The actual response data
  timestamp: string,   // ISO 8601 timestamp
  requestId: string,   // Unique request identifier for tracing
  meta?: {             // Optional metadata for pagination, etc.
    page?: number,
    limit?: number,
    total?: number,
    hasNext?: boolean,
    hasPrev?: boolean
  }
}
```

### Error Response Format

All error responses follow this standardized format:

```typescript
{
  success: false,
  error: {
    code: string,        // Error code (e.g., 'VALIDATION_ERROR')
    userMessage: string, // User-friendly error message
    nextSteps: string,   // Suggested actions for the user
    helpUrl: string,     // Link to relevant help documentation
    logId?: string,      // Server-side log ID for debugging
    details?: any        // Additional error details
  },
  timestamp: string,
  requestId: string
}
```

### Implementation

Use the standardized response utilities:

```typescript
import { createSuccessResponse, createErrorResponse } from '../utils/response';

// Success response
res.json(createSuccessResponse(
  data,
  'Operation completed successfully',
  requestId
));

// Error response
res.status(400).json(createErrorResponse(
  ErrorCode.VALIDATION_ERROR,
  'Invalid input provided',
  'Please check your input and try again',
  '/help/validation',
  logId,
  { field: 'email' },
  requestId
));
```

## Error Handling Patterns

### Error Categorization

Errors are categorized by type, severity, and retry behavior:

```typescript
interface ErrorCategory {
  type: 'client' | 'server' | 'network' | 'auth' | 'validation' | 'business';
  severity: 'low' | 'medium' | 'high' | 'critical';
  retryable: boolean;
}
```

### Backend Error Handling

Use the enhanced error handler middleware:

```typescript
import { errorHandlerMiddleware } from '../middleware/errorHandler';

app.use(errorHandlerMiddleware);
```

The middleware automatically:
- Categorizes errors by type and severity
- Provides appropriate HTTP status codes
- Includes retry information for retryable errors
- Logs errors with proper context
- Returns consistent error responses

### Frontend Error Handling

Use the error handler hook:

```typescript
import { useErrorHandler } from '../hooks/useErrorHandler';

const { handleApiError, error, retryLastAction } = useErrorHandler();

// Handle API errors with automatic retry
try {
  await apiCall();
} catch (error) {
  handleApiError(error, () => apiCall());
}
```

## Validation Standards

### Backend Validation

Use the standardized validation middleware:

```typescript
import { validateRequest, bodySchemas, paramSchemas } from '../middleware/standardValidation';

router.post('/endpoint',
  validateRequest({
    params: paramSchemas.id,
    body: bodySchemas.auth.login,
    query: querySchemas.pagination
  }),
  asyncHandler(async (req, res) => {
    // Request is automatically validated
    // req.params, req.body, req.query are type-safe
  })
);
```

### Standard Validation Schemas

Common validation schemas are provided:

```typescript
// UUID validation
paramSchemas.id           // { id: uuid }
paramSchemas.invoiceId    // { invoiceId: uuid }
paramSchemas.fileId       // { fileId: uuid }

// Query validation
querySchemas.pagination   // { page, limit, offset }
querySchemas.search      // { q, page, limit }
querySchemas.dateRange   // { startDate, endDate, page, limit }

// Body validation
bodySchemas.auth.login    // { email, password, rememberMe? }
bodySchemas.auth.register // { email, password, name, acceptTerms }
bodySchemas.invoice.create // { fileId, templateId?, options? }
```

### Custom Validation

Create custom schemas using Zod:

```typescript
import { z } from 'zod';
import { standardSchemas } from '../middleware/standardValidation';

const customSchema = z.object({
  email: standardSchemas.email,
  amount: standardSchemas.positiveNumber,
  date: standardSchemas.dateString,
});
```

## React Query Integration

### Query Hooks

Use the enhanced API query hooks:

```typescript
import { useApiQuery } from '../hooks/useApiQuery';

// Basic query
const { data, error, isLoading, refetch } = useApiQuery(
  ['invoices', filters],
  () => api.get('/invoices', { params: filters }),
  {
    staleTime: 5 * 60 * 1000,  // 5 minutes
    placeholderData: (prev) => prev,  // Keep previous data while loading
  }
);

// Dependent query
const { data: invoice } = useApiQuery(
  ['invoice', invoiceId],
  () => api.get(`/invoices/${invoiceId}`),
  {
    enabled: !!invoiceId,  // Only run if invoiceId exists
  }
);
```

### Mutation Hooks

Use the enhanced API mutation hooks:

```typescript
import { useApiMutation } from '../hooks/useApiQuery';

// Basic mutation
const createInvoice = useApiMutation(
  (data) => api.post('/invoices', data),
  {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  }
);

// Optimistic updates
const updateInvoice = useApiMutation(
  ({ id, data }) => api.put(`/invoices/${id}`, data),
  {
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['invoice', id] });
      const previous = queryClient.getQueryData(['invoice', id]);
      
      queryClient.setQueryData(['invoice', id], (old) => ({
        ...old,
        data: { ...old?.data, ...data }
      }));
      
      return { previous };
    },
    onError: (error, { id }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['invoice', id], context.previous);
      }
    },
    onSettled: ({ id }) => {
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
    },
  }
);
```

### Cache Management

Follow these patterns for cache management:

```typescript
// Invalidate related queries after mutations
queryClient.invalidateQueries({ queryKey: ['invoices'] });

// Update specific cache entries
queryClient.setQueryData(['invoice', id], newData);

// Remove from cache
queryClient.removeQueries({ queryKey: ['invoice', id] });

// Prefetch data
queryClient.prefetchQuery({
  queryKey: ['invoice', id],
  queryFn: () => api.get(`/invoices/${id}`),
});
```

## Authentication Patterns

### Backend Authentication

Use the standardized auth middleware:

```typescript
import { authenticate } from '../middleware/auth.middleware';

router.get('/protected', authenticate, asyncHandler(async (req, res) => {
  // req.user is available and type-safe
  const userId = req.user.id;
}));
```

### Frontend Authentication

Use the auth hooks:

```typescript
import { useLogin, useLogout } from '../hooks/useApiQuery';

const login = useLogin();
const logout = useLogout();

// Login
login.mutate({ email, password });

// Logout (clears all cached data)
logout.mutate();
```

### Token Management

Tokens are automatically managed:

```typescript
// Set token (done automatically on login)
apiUtils.setAuthToken(token);

// Clear token (done automatically on logout)
apiUtils.clearAuthToken();

// Check if user is authenticated
const isAuthenticated = !!localStorage.getItem('syntaxisai_token');
```

## Best Practices

### 1. Always Use Standardized Patterns

- Use `validateRequest` for all input validation
- Use `createSuccessResponse` and `createErrorResponse` for responses
- Use `useApiQuery` and `useApiMutation` for API calls
- Use `asyncHandler` for async route handlers

### 2. Error Handling

- Always provide user-friendly error messages
- Include next steps and help URLs
- Use appropriate HTTP status codes
- Log errors with sufficient context

### 3. Validation

- Validate all inputs at the API boundary
- Use type-safe validation schemas
- Provide clear validation error messages
- Validate UUIDs, emails, and other formats consistently

### 4. React Query

- Use appropriate stale times for different data types
- Implement optimistic updates for better UX
- Handle loading and error states consistently
- Invalidate related queries after mutations

### 5. Performance

- Use pagination for large datasets
- Implement proper caching strategies
- Use placeholder data to avoid loading states
- Prefetch data when appropriate

### 6. Security

- Always authenticate protected endpoints
- Validate and sanitize all inputs
- Use HTTPS in production
- Implement proper CORS policies

### 7. Monitoring

- Include request IDs for tracing
- Log important operations
- Monitor error rates and performance
- Set up alerts for critical issues

## Migration Guide

When updating existing endpoints to use these patterns:

1. **Add validation middleware**:
   ```typescript
   router.post('/endpoint',
     validateRequest({ body: schema }),
     // existing handler
   );
   ```

2. **Update response format**:
   ```typescript
   // Before
   res.json(data);
   
   // After
   res.json(createSuccessResponse(data, 'Success message', requestId));
   ```

3. **Update error handling**:
   ```typescript
   // Before
   res.status(400).json({ error: 'Bad request' });
   
   // After
   res.status(400).json(createErrorResponse(
     ErrorCode.VALIDATION_ERROR,
     'Invalid input',
     'Please check your input',
     '/help/validation',
     logId,
     details,
     requestId
   ));
   ```

4. **Update React Query hooks**:
   ```typescript
   // Before
   const { data } = useQuery(['key'], fetchFn);
   
   // After
   const { data } = useApiQuery(['key'], fetchFn);
   ```

This ensures consistency across the entire application and provides a better developer and user experience.
