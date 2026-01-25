# Integration Troubleshooting Guide

This comprehensive troubleshooting guide covers common integration issues and their solutions for SyntaxisAI, implementing Task 2.4.5 from the scratchpad.

## Table of Contents

1. [API Connection Issues](#api-connection-issues)
2. [Authentication Problems](#authentication-problems)
3. [React Query Issues](#react-query-issues)
4. [Error Handling Problems](#error-handling-problems)
5. [File Upload Issues](#file-upload-issues)
6. [System Monitoring Problems](#system-monitoring-problems)
7. [Performance Issues](#performance-issues)
8. [Development Tools](#development-tools)

## API Connection Issues

### Problem: Frontend can't connect to backend API

**Symptoms:**
- Network errors in browser console
- "Failed to fetch" errors
- CORS errors
- Connection refused errors

**Solutions:**

1. **Check API Base URL Configuration**
   ```typescript
   // frontend/src/config.ts
   export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';
   ```

2. **Verify Backend is Running**
   ```bash
   cd backend
   npm run dev
   # Should show: Server running on port 3001
   ```

3. **Check CORS Configuration**
   ```typescript
   // backend/src/index.ts
   app.use(cors({
     origin: process.env.FRONTEND_URL || 'http://localhost:3000',
     credentials: true,
   }));
   ```

4. **Test API Endpoint Manually**
   ```bash
   curl http://localhost:3001/api/v1/health
   ```

### Problem: API requests timing out

**Symptoms:**
- Requests taking longer than 30 seconds
- Timeout errors in console
- Slow response times

**Solutions:**

1. **Increase Timeout in API Service**
   ```typescript
   // frontend/src/services/api.ts
   export const api = axios.create({
     timeout: 60000, // Increase to 60 seconds
   });
   ```

2. **Check Backend Performance**
   ```bash
   # Monitor backend logs
   tail -f backend/logs/combined.log
   ```

3. **Optimize Database Queries**
   ```typescript
   // Add indexes to frequently queried fields
   // Check slow query logs
   ```

### Problem: Inconsistent API responses

**Symptoms:**
- Sometimes works, sometimes doesn't
- Intermittent errors
- Data inconsistencies

**Solutions:**

1. **Check Error Handling in API Service**
   ```typescript
   // Ensure proper error handling in interceptors
   api.interceptors.response.use(
     (response) => response,
     (error) => {
       console.error('API Error:', error);
       return Promise.reject(error);
     }
   );
   ```

2. **Implement Retry Logic**
   ```typescript
   // Use the retry utility from apiUtils
   const result = await apiUtils.retryRequest(
     () => api.get('/endpoint'),
     3, // max retries
     1000 // delay
   );
   ```

## Authentication Problems

### Problem: Token refresh not working

**Symptoms:**
- User gets logged out unexpectedly
- 401 errors after some time
- Token refresh requests failing

**Solutions:**

1. **Check Token Refresh Logic**
   ```typescript
   // Ensure refresh token is stored and used correctly
   const refreshToken = localStorage.getItem('syntaxisai_refresh_token');
   if (refreshToken) {
     const response = await axios.post('/api/v1/auth/refresh', { refreshToken });
     // Update tokens
   }
   ```

2. **Verify Backend Refresh Endpoint**
   ```bash
   curl -X POST http://localhost:3001/api/v1/auth/refresh \
     -H "Content-Type: application/json" \
     -d '{"refreshToken":"your-refresh-token"}'
   ```

3. **Check Token Expiration Times**
   ```typescript
   // Ensure tokens have reasonable expiration times
   const accessTokenExpiry = 15 * 60 * 1000; // 15 minutes
   const refreshTokenExpiry = 7 * 24 * 60 * 60 * 1000; // 7 days
   ```

### Problem: CORS issues with authentication

**Symptoms:**
- Authentication works in development but not production
- Cookies not being sent
- CORS preflight failures

**Solutions:**

1. **Configure CORS for Credentials**
   ```typescript
   app.use(cors({
     origin: true, // Or specific origins
     credentials: true,
   }));
   ```

2. **Set Axios to Include Credentials**
   ```typescript
   export const api = axios.create({
     withCredentials: true,
   });
   ```

## React Query Issues

### Problem: Queries not updating after mutations

**Symptoms:**
- UI shows stale data after updates
- Manual refresh required to see changes
- Cache not invalidating

**Solutions:**

1. **Implement Proper Cache Invalidation**
   ```typescript
   const updateMutation = useMutation({
     mutationFn: updateData,
     onSuccess: () => {
       queryClient.invalidateQueries(['data']);
     },
   });
   ```

2. **Use Optimistic Updates**
   ```typescript
   const mutation = useMutation({
     onMutate: async (newData) => {
       await queryClient.cancelQueries(['data']);
       const previousData = queryClient.getQueryData(['data']);
       queryClient.setQueryData(['data'], newData);
       return { previousData };
     },
     onError: (err, newData, context) => {
       queryClient.setQueryData(['data'], context?.previousData);
     },
   });
   ```

### Problem: Infinite loading states

**Symptoms:**
- Queries stuck in loading state
- Spinners never disappear
- isLoading always true

**Solutions:**

1. **Check Query Configuration**
   ```typescript
   const { data, isLoading, error } = useQuery({
     queryKey: ['data'],
     queryFn: fetchData,
     retry: 3, // Limit retries
     staleTime: 5 * 60 * 1000,
   });
   ```

2. **Handle Errors Properly**
   ```typescript
   const { data, isLoading, error } = useQuery({
     queryKey: ['data'],
     queryFn: fetchData,
     onError: (error) => {
       console.error('Query failed:', error);
       // Handle error appropriately
     },
   });
   ```

### Problem: Memory leaks with React Query

**Symptoms:**
- Increasing memory usage over time
- Browser becomes slow
- Cache growing indefinitely

**Solutions:**

1. **Configure Garbage Collection**
   ```typescript
   const queryClient = new QueryClient({
     defaultOptions: {
       queries: {
         gcTime: 5 * 60 * 1000, // 5 minutes
         staleTime: 1 * 60 * 1000, // 1 minute
       },
     },
   });
   ```

2. **Remove Queries When Appropriate**
   ```typescript
   // Remove specific queries
   queryClient.removeQueries(['old-data']);
   
   // Clear all cache
   queryClient.clear();
   ```

## Error Handling Problems

### Problem: Errors not being displayed to users

**Symptoms:**
- Silent failures
- No user feedback on errors
- Errors only visible in console

**Solutions:**

1. **Use Error Handler Hook**
   ```typescript
   const { handleApiError, error } = useErrorHandler();
   
   const mutation = useMutation({
     mutationFn: submitData,
     onError: (error) => {
       handleApiError(error, () => submitData());
     },
   });
   ```

2. **Display Error Messages**
   ```typescript
   {error && (
     <Alert severity="error">
       {error.userMessage}
       {error.canRetry && (
         <Button onClick={retryLastAction}>
           Retry
         </Button>
       )}
     </Alert>
   )}
   ```

### Problem: Error boundary not catching errors

**Symptoms:**
- App crashes instead of showing error UI
- White screen of death
- Unhandled promise rejections

**Solutions:**

1. **Wrap Components in Error Boundary**
   ```typescript
   <ErrorBoundary
     fallback={<ErrorFallback />}
     onError={(error, errorInfo) => {
       console.error('Error caught by boundary:', error);
     }}
   >
     <App />
   </ErrorBoundary>
   ```

2. **Handle Async Errors**
   ```typescript
   // Use try-catch in async functions
   const handleSubmit = async () => {
     try {
       await submitData();
     } catch (error) {
       handleApiError(error);
     }
   };
   ```

## File Upload Issues

### Problem: Large file uploads failing

**Symptoms:**
- Upload progress stops
- Timeout errors
- Memory issues

**Solutions:**

1. **Implement Chunked Upload**
   ```typescript
   const uploadFile = async (file: File) => {
     const chunkSize = 1024 * 1024; // 1MB chunks
     const chunks = Math.ceil(file.size / chunkSize);
     
     for (let i = 0; i < chunks; i++) {
       const start = i * chunkSize;
       const end = Math.min(start + chunkSize, file.size);
       const chunk = file.slice(start, end);
       
       await uploadChunk(chunk, i, chunks);
     }
   };
   ```

2. **Increase Server Limits**
   ```typescript
   // backend/src/index.ts
   app.use(express.json({ limit: '50mb' }));
   app.use(express.urlencoded({ limit: '50mb', extended: true }));
   ```

### Problem: File upload progress not updating

**Symptoms:**
- Progress bar stuck at 0%
- No upload feedback
- Users don't know if upload is working

**Solutions:**

1. **Implement Progress Tracking**
   ```typescript
   const uploadMutation = useMutation({
     mutationFn: (formData: FormData) => 
       api.post('/files/upload', formData, {
         onUploadProgress: (progressEvent) => {
           const progress = Math.round(
             (progressEvent.loaded * 100) / progressEvent.total
           );
           setUploadProgress(progress);
         },
       }),
   });
   ```

## System Monitoring Problems

### Problem: Health checks failing

**Symptoms:**
- System status shows unhealthy
- Monitoring alerts firing
- Services appear down

**Solutions:**

1. **Check Individual Services**
   ```bash
   # Test database connection
   curl http://localhost:3001/api/v1/health/detailed
   
   # Check Redis connection
   redis-cli ping
   
   # Verify file system access
   ls -la /tmp
   ```

2. **Review Health Check Logic**
   ```typescript
   // Ensure health checks have appropriate timeouts
   const healthCheck = async () => {
     try {
       await Promise.race([
         checkDatabase(),
         new Promise((_, reject) => 
           setTimeout(() => reject(new Error('Timeout')), 5000)
         )
       ]);
     } catch (error) {
       return { status: 'unhealthy', error: error.message };
     }
   };
   ```

## Performance Issues

### Problem: Slow API responses

**Symptoms:**
- Long loading times
- Poor user experience
- Timeout errors

**Solutions:**

1. **Optimize Database Queries**
   ```sql
   -- Add indexes for frequently queried fields
   CREATE INDEX idx_user_email ON users(email);
   CREATE INDEX idx_invoice_user_id ON invoices(user_id);
   ```

2. **Implement Caching**
   ```typescript
   // Use React Query caching
   const { data } = useQuery({
     queryKey: ['data'],
     queryFn: fetchData,
     staleTime: 5 * 60 * 1000, // Cache for 5 minutes
   });
   ```

3. **Use Pagination**
   ```typescript
   const { data } = useInfiniteQuery({
     queryKey: ['items'],
     queryFn: ({ pageParam = 0 }) => 
       fetchItems({ page: pageParam, limit: 20 }),
     getNextPageParam: (lastPage) => lastPage.nextPage,
   });
   ```

## Development Tools

### Debug Panel Usage

1. **Enable Debug Mode**
   ```typescript
   // In browser console
   window.syntaxisDebug.enableDebug();
   
   // Or add to URL
   http://localhost:3000?debug=true
   ```

2. **Access Debug Panel**
   - Press `Ctrl+Shift+D` to toggle debug panel
   - View console logs, API tests, query cache, and system info

3. **Backend Debug Endpoints**
   ```bash
   # System information
   curl http://localhost:3001/api/v1/debug/system
   
   # Database information
   curl http://localhost:3001/api/v1/debug/database
   
   # Application logs
   curl http://localhost:3001/api/v1/debug/logs
   ```

### Logging and Monitoring

1. **Check Application Logs**
   ```bash
   # View combined logs
   tail -f backend/logs/combined.log
   
   # View error logs only
   tail -f backend/logs/error.log
   ```

2. **Monitor Performance**
   ```bash
   # Check system resources
   top
   
   # Monitor network connections
   netstat -an | grep :3001
   ```

## Getting Help

If you're still experiencing issues after trying these solutions:

1. **Check the logs** for detailed error messages
2. **Use the debug panel** to gather system information
3. **Test API endpoints** manually with curl or Postman
4. **Review the integration patterns** documentation
5. **Contact the development team** with specific error messages and steps to reproduce

Remember to include:
- Error messages and stack traces
- Steps to reproduce the issue
- System information (OS, browser, Node.js version)
- Log entries related to the issue
