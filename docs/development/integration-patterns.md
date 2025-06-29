# Integration Patterns Documentation

This document outlines the integration patterns and best practices for SyntaxisAI, implementing Task 2.3.5 from the scratchpad with TDD approach.

## Table of Contents

1. [API Integration Patterns](#api-integration-patterns)
2. [React Query Integration](#react-query-integration)
3. [Error Handling Patterns](#error-handling-patterns)
4. [Authentication Integration](#authentication-integration)
5. [File Upload Integration](#file-upload-integration)
6. [Real-time Updates](#real-time-updates)
7. [Testing Integration](#testing-integration)
8. [Performance Optimization](#performance-optimization)
9. [TDD Implementation Guidelines](#tdd-implementation-guidelines)
10. [API Consistency Standards](#api-consistency-standards)

## API Integration Patterns

### 1. Standardized API Responses

All API endpoints follow a consistent response format:

```typescript
// Success Response
{
  "success": true,
  "data": T,
  "message": "Optional success message",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "requestId": "req_1234567890_abc123"
}

// Error Response
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "userMessage": "User-friendly error message",
    "nextSteps": "What the user should do next",
    "helpUrl": "/help/specific-topic",
    "logId": "log_1234567890_def456",
    "details": { /* Additional error details */ }
  },
  "timestamp": "2024-01-01T00:00:00.000Z",
  "requestId": "req_1234567890_abc123"
}
```

### 2. API Service Configuration

```typescript
// Enhanced API service with proper error handling
import axios from 'axios';
import { API_BASE_URL } from '../config';

const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for authentication
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('syntaxisai_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Handle 401 errors with token refresh
    if (error.response?.status === 401) {
      // Implement token refresh logic
    }
    return Promise.reject(error);
  }
);
```

### 3. Environment-Specific Configuration

```typescript
// config.ts
const getBaseURL = (): string => {
  if (process.env.NODE_ENV === 'development') {
    return `${API_BASE_URL}/api/v1`;
  }
  return '/api/v1'; // Production uses relative URL
};
```

## React Query Integration

### 1. Enhanced Query Client Setup

```typescript
// main.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: (failureCount, error: any) => {
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
          return false; // Don't retry client errors
        }
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});
```

### 2. Custom Query Hooks

```typescript
// useApiQuery.ts
export function useApiQuery<TData = any>(
  queryKey: (string | number)[],
  queryFn: () => Promise<AxiosResponse<TData>>,
  options?: UseQueryOptions
) {
  const { handleApiError } = useErrorHandler();

  return useQuery({
    queryKey,
    queryFn,
    select: (data) => data.data, // Extract data from Axios response
    onError: (error) => {
      handleApiError(error, () => queryFn());
    },
    ...options,
  });
}
```

### 3. Optimistic Updates Pattern

```typescript
export const useUpdateInvoice = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }) => api.put(`/invoices/${id}`, data),
    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries(['invoice', id]);
      
      // Snapshot previous value
      const previousInvoice = queryClient.getQueryData(['invoice', id]);
      
      // Optimistically update
      queryClient.setQueryData(['invoice', id], (old) => ({ ...old, ...data }));
      
      return { previousInvoice };
    },
    onError: (err, { id }, context) => {
      // Rollback on error
      queryClient.setQueryData(['invoice', id], context?.previousInvoice);
    },
    onSettled: ({ id }) => {
      // Refetch after mutation
      queryClient.invalidateQueries(['invoice', id]);
    },
  });
};
```

## Error Handling Patterns

### 1. Centralized Error Handler

```typescript
// useErrorHandler.ts
export const useErrorHandler = () => {
  const [error, setError] = useState(null);
  const [canRetry, setCanRetry] = useState(false);

  const handleApiError = useCallback((apiError, retryAction) => {
    const isRetryable = apiUtils.isNetworkError(apiError) || 
                       apiUtils.isTimeoutError(apiError) || 
                       (apiError?.response?.status >= 500);
    
    setError({
      code: getErrorCode(apiError),
      userMessage: apiUtils.formatErrorMessage(apiError),
      nextSteps: getNextSteps(apiError),
      helpUrl: getHelpUrl(apiError),
    });
    
    setCanRetry(isRetryable);
    if (isRetryable && retryAction) {
      setLastAction(() => retryAction);
    }
  }, []);

  return { error, handleApiError, canRetry, retryLastAction };
};
```

### 2. Error Boundary Integration

```typescript
// App.tsx
import ErrorBoundary from './components/ErrorBoundary';

const App = () => (
  <ErrorBoundary
    fallback={<CustomErrorFallback />}
    onError={(error, errorInfo) => {
      // Send to monitoring service
      console.error('React Error:', { error, errorInfo });
    }}
  >
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          {/* Your routes */}
        </Routes>
      </Router>
    </QueryClientProvider>
  </ErrorBoundary>
);
```

## Authentication Integration

### 1. Token Management

```typescript
// Auth service integration
export const useLogin = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (credentials) => api.post('/auth/login', credentials),
    onSuccess: (response) => {
      const { token, refreshToken } = response.data;
      localStorage.setItem('syntaxisai_token', token);
      localStorage.setItem('syntaxisai_refresh_token', refreshToken);
      
      // Invalidate all queries to refetch with new auth
      queryClient.invalidateQueries();
    },
  });
};
```

### 2. Protected Route Pattern

```typescript
// ProtectedRoute.tsx
const ProtectedRoute = ({ children }) => {
  const { user, isLoading } = useAuth();
  
  if (isLoading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" />;
  
  return children;
};
```

## File Upload Integration

### 1. Chunked Upload Pattern

```typescript
export const useFileUpload = () => {
  return useMutation({
    mutationFn: (formData: FormData) => api.post('/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        const progress = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        // Update progress state
      },
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['files']);
    },
  });
};
```

### 2. File Processing Status

```typescript
export const useFileProcessingStatus = (fileId: string) => {
  return useQuery({
    queryKey: ['file', fileId, 'status'],
    queryFn: () => api.get(`/files/${fileId}/status`),
    refetchInterval: (data) => {
      // Stop polling when processing is complete
      return data?.status === 'completed' ? false : 2000;
    },
    enabled: !!fileId,
  });
};
```

## Real-time Updates

### 1. WebSocket Integration

```typescript
// useWebSocket.ts
export const useWebSocket = (url: string) => {
  const [socket, setSocket] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const ws = new WebSocket(url);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      // Update relevant queries based on message type
      if (data.type === 'invoice_updated') {
        queryClient.invalidateQueries(['invoice', data.invoiceId]);
      }
    };
    
    setSocket(ws);
    return () => ws.close();
  }, [url]);

  return socket;
};
```

## Testing Integration

### 1. Test Utilities

```typescript
// test/utils.tsx
export const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false, gcTime: 0 },
    mutations: { retry: false },
  },
});

export const renderWithProviders = (ui, { queryClient, ...options } = {}) => {
  const testQueryClient = queryClient || createTestQueryClient();
  
  const Wrapper = ({ children }) => (
    <QueryClientProvider client={testQueryClient}>
      <ThemeProvider theme={theme}>
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );

  return render(ui, { wrapper: Wrapper, ...options });
};
```

### 2. API Mocking

```typescript
// Mock API responses for testing
export const mockApiResponse = (data: any, delay = 0) => {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ data }), delay);
  });
};
```

## Performance Optimization

### 1. Query Optimization

```typescript
// Prefetch related data
export const usePrefetchInvoiceDetails = () => {
  const queryClient = useQueryClient();
  
  return useCallback((invoiceId: string) => {
    queryClient.prefetchQuery({
      queryKey: ['invoice', invoiceId],
      queryFn: () => api.get(`/invoices/${invoiceId}`),
      staleTime: 5 * 60 * 1000,
    });
  }, [queryClient]);
};
```

### 2. Background Sync

```typescript
// Background data synchronization
export const useBackgroundSync = () => {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    const interval = setInterval(() => {
      // Sync critical data in background
      queryClient.invalidateQueries(['health']);
      queryClient.invalidateQueries(['system', 'status']);
    }, 60000); // Every minute
    
    return () => clearInterval(interval);
  }, [queryClient]);
};
```

## Best Practices Summary

1. **Consistent API Responses**: Use standardized response formats
2. **Error Handling**: Implement centralized error handling with retry logic
3. **Authentication**: Secure token management with automatic refresh
4. **Caching**: Optimize with appropriate stale times and cache invalidation
5. **Real-time**: Use WebSockets for live updates when needed
6. **Testing**: Comprehensive test coverage with proper mocking
7. **Performance**: Prefetch data and implement background sync
8. **Monitoring**: Track errors and performance metrics

This integration pattern ensures maintainable, scalable, and robust frontend-backend communication.

## TDD Implementation Guidelines

### 1. Test-First Development Approach

Always write tests before implementing features:

```typescript
// 1. Write the test first
describe('API Connection', () => {
  it('should handle network errors gracefully', async () => {
    // Arrange
    const networkError = new Error('Network Error');
    mockedApi.get.mockRejectedValueOnce(networkError);

    // Act
    const result = await apiUtils.healthCheck();

    // Assert
    expect(result).toBe(false);
  });
});

// 2. Run the test (it should fail)
// 3. Implement the minimum code to make it pass
// 4. Refactor and improve
```

### 2. Integration Test Patterns

```typescript
// Test API endpoint consistency
describe('API Endpoints Consistency', () => {
  it('should return standardized response format', async () => {
    const response = await request(app)
      .get('/api/v1/invoices')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('requestId');
  });
});
```

### 3. Error Handling Test Patterns

```typescript
// Test error scenarios comprehensively
describe('Error Handling', () => {
  it('should categorize errors correctly', () => {
    const testCases = [
      { error: { code: 'NETWORK_ERROR' }, expected: 'NETWORK_ERROR' },
      { error: { response: { status: 401 } }, expected: 'UNAUTHORIZED' },
      { error: { response: { status: 500 } }, expected: 'SERVER_ERROR' },
    ];

    testCases.forEach(({ error, expected }) => {
      expect(apiUtils.getErrorCode(error)).toBe(expected);
    });
  });
});
```

### 4. React Query Test Patterns

```typescript
// Test React Query integration
describe('React Query Integration', () => {
  it('should handle cache invalidation correctly', async () => {
    const { result } = renderHook(() => useInvoices(), { wrapper });

    // Initial data load
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Trigger mutation that should invalidate cache
    const { result: mutationResult } = renderHook(() => useCreateInvoice(), { wrapper });

    act(() => {
      mutationResult.current.mutate(newInvoiceData);
    });

    // Verify cache was invalidated and data refetched
    await waitFor(() => expect(result.current.isFetching).toBe(true));
  });
});
```

## API Consistency Standards

### 1. Standardized Response Format

All API endpoints must follow this response format:

```typescript
// Success Response
interface SuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
  timestamp: string;
  requestId: string;
}

// Error Response
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    userMessage: string;
    nextSteps: string;
    helpUrl: string;
    logId?: string;
    details?: any;
  };
  timestamp: string;
  requestId: string;
}
```

### 2. HTTP Status Code Standards

```typescript
// Use consistent status codes
const HTTP_STATUS = {
  OK: 200,                    // Successful GET, PUT, PATCH
  CREATED: 201,               // Successful POST
  NO_CONTENT: 204,            // Successful DELETE
  BAD_REQUEST: 400,           // Validation errors
  UNAUTHORIZED: 401,          // Authentication required
  FORBIDDEN: 403,             // Authorization failed
  NOT_FOUND: 404,             // Resource not found
  CONFLICT: 409,              // Resource conflict
  UNPROCESSABLE_ENTITY: 422,  // Semantic errors
  TOO_MANY_REQUESTS: 429,     // Rate limiting
  INTERNAL_SERVER_ERROR: 500, // Server errors
  SERVICE_UNAVAILABLE: 503,   // Service down
} as const;
```

### 3. Error Code Standards

```typescript
// Standardized error codes
export enum ErrorCode {
  // Authentication & Authorization
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',

  // Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT = 'INVALID_FORMAT',

  // Resources
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  RESOURCE_CONFLICT = 'RESOURCE_CONFLICT',
  RESOURCE_LOCKED = 'RESOURCE_LOCKED',

  // System
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // Network
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
}
```

### 4. Request/Response Headers

```typescript
// Required headers for all API requests
const REQUIRED_HEADERS = {
  'Content-Type': 'application/json',
  'X-API-Version': 'v1',
  'X-Request-ID': 'unique-request-id',
};

// Standard response headers
const RESPONSE_HEADERS = {
  'X-API-Version': 'v1',
  'X-Request-ID': 'echoed-request-id',
  'X-Response-Time': 'timestamp',
  'X-Response-Time-Ms': 'duration-in-ms',
};
```

### 5. Pagination Standards

```typescript
// Consistent pagination format
interface PaginatedResponse<T> {
  success: true;
  data: {
    items: T[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  };
  timestamp: string;
  requestId: string;
}

// Query parameters
interface PaginationParams {
  page?: number;    // Default: 1
  limit?: number;   // Default: 20, Max: 100
  sort?: string;    // Default: 'createdAt'
  order?: 'asc' | 'desc'; // Default: 'desc'
}
```

### 6. Authentication Standards

```typescript
// JWT token format
interface JWTPayload {
  sub: string;      // User ID
  userId: string;   // User ID (duplicate for compatibility)
  email: string;    // User email
  iat: number;      // Issued at
  exp: number;      // Expires at
  type?: 'access' | 'refresh'; // Token type
}

// Authorization header format
const authHeader = `Bearer ${accessToken}`;

// Token refresh flow
const refreshFlow = {
  1: 'Client detects 401 response',
  2: 'Client sends refresh token to /auth/refresh',
  3: 'Server validates refresh token',
  4: 'Server returns new access token',
  5: 'Client retries original request with new token',
};
```

### 7. File Upload Standards

```typescript
// File upload response format
interface FileUploadResponse {
  id: string;
  filename: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  status: 'uploaded' | 'processing' | 'completed' | 'failed';
  uploadedAt: string;
  processedAt?: string;
  downloadUrl?: string;
}

// Chunked upload support
interface ChunkUploadResponse {
  chunkId: string;
  chunkNumber: number;
  totalChunks: number;
  uploadId: string;
  isComplete: boolean;
}
```

### 8. Validation Standards

```typescript
// Input validation patterns
const VALIDATION_PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  invoiceNumber: /^INV-\d{6,}$/,
  phoneNumber: /^\+?[\d\s\-\(\)]+$/,
};

// Validation error format
interface ValidationError {
  field: string;
  value: any;
  message: string;
  code: string;
}
```

## Best Practices Summary

1. **Always write tests first** - Follow TDD methodology
2. **Use standardized response formats** - Consistent API responses
3. **Implement proper error handling** - Comprehensive error categorization
4. **Follow HTTP standards** - Correct status codes and headers
5. **Validate all inputs** - Client and server-side validation
6. **Handle edge cases** - Network failures, timeouts, etc.
7. **Monitor performance** - Track response times and errors
8. **Document everything** - Clear API documentation
9. **Version your APIs** - Maintain backward compatibility
10. **Test thoroughly** - Unit, integration, and E2E tests

This comprehensive integration pattern ensures maintainable, scalable, and robust frontend-backend communication with full TDD coverage.
