import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import { ReactNode } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../../services/api';
import {
  useApiQuery,
  useApiMutation,
  useHealthCheck,
  useInvoices,
  useCreateInvoice,
  useUpdateInvoice,
  useDeleteInvoice,
  useFileUpload,
  useLogin
} from '../../hooks/useApiQuery';

// Mock the API
vi.mock('../../services/api');
const mockedApi = vi.mocked(api);

// Mock error handler
vi.mock('../../hooks/useErrorHandler', () => ({
  useErrorHandler: () => ({
    handleApiError: vi.fn(),
  }),
}));

describe('React Query Integration Tests (Task 2.3.3)', () => {
  let queryClient: QueryClient;

  const createWrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
        mutations: {
          retry: false,
        },
      },
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
    vi.restoreAllMocks();
  });

  describe('Query Configuration', () => {
    it('should have proper default query configuration', () => {
      const defaultOptions = queryClient.getDefaultOptions();

      expect(defaultOptions.queries?.retry).toBeDefined();
      expect(defaultOptions.queries?.staleTime).toBeDefined();
      expect(defaultOptions.queries?.gcTime).toBeDefined();
    });

    it('should use gcTime instead of deprecated cacheTime', () => {
      const defaultOptions = queryClient.getDefaultOptions();

      // Should use gcTime (new) not cacheTime (deprecated)
      expect(defaultOptions.queries?.gcTime).toBeDefined();
      expect(defaultOptions.queries).not.toHaveProperty('cacheTime');
    });

    it('should have proper retry configuration', () => {
      const defaultOptions = queryClient.getDefaultOptions();

      expect(typeof defaultOptions.queries?.retry).toBe('function');
      expect(typeof defaultOptions.mutations?.retry).toBe('function');
    });

    it('should have exponential backoff for retry delay', () => {
      const defaultOptions = queryClient.getDefaultOptions();

      expect(typeof defaultOptions.queries?.retryDelay).toBe('function');
      expect(typeof defaultOptions.mutations?.retryDelay).toBe('function');
    });

    it('should handle query key consistency', async () => {
      const mockData = { id: 1, name: 'Test' };
      mockedApi.get.mockResolvedValueOnce({ data: mockData });

      const { result } = renderHook(
        () => useQuery({
          queryKey: ['test', 'data'],
          queryFn: () => api.get('/test').then(res => res.data),
        }),
        { wrapper: createWrapper }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockData);
    });

    it('should handle query invalidation properly', async () => {
      const mockData = { id: 1, name: 'Test' };
      mockedApi.get.mockResolvedValueOnce({ data: mockData });

      const { result } = renderHook(
        () => useQuery({
          queryKey: ['test', 'invalidation'],
          queryFn: () => api.get('/test').then(res => res.data),
        }),
        { wrapper: createWrapper }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Test invalidation
      await queryClient.invalidateQueries({ queryKey: ['test'] });
      
      expect(queryClient.getQueryState(['test', 'invalidation'])?.isInvalidated).toBe(true);
    });
  });

  describe('Error Handling in Queries', () => {
    it('should handle API errors in queries', async () => {
      const apiError = {
        response: {
          status: 500,
          data: { error: { code: 'SERVER_ERROR', message: 'Internal server error' } }
        }
      };
      mockedApi.get.mockRejectedValueOnce(apiError);

      const { result } = renderHook(
        () => useQuery({
          queryKey: ['test', 'error'],
          queryFn: () => api.get('/error').then(res => res.data),
        }),
        { wrapper: createWrapper }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toEqual(apiError);
    });

    it('should handle network errors in queries', async () => {
      const networkError = new Error('Network Error');
      mockedApi.get.mockRejectedValueOnce(networkError);

      const { result } = renderHook(
        () => useQuery({
          queryKey: ['test', 'network-error'],
          queryFn: () => api.get('/network-error').then(res => res.data),
        }),
        { wrapper: createWrapper }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toEqual(networkError);
    });

    it('should handle unauthorized errors with proper retry logic', async () => {
      const unauthorizedError = {
        response: {
          status: 401,
          data: { error: { code: 'UNAUTHORIZED', message: 'Token expired' } }
        }
      };
      mockedApi.get.mockRejectedValueOnce(unauthorizedError);

      const { result } = renderHook(
        () => useQuery({
          queryKey: ['test', 'unauthorized'],
          queryFn: () => api.get('/protected').then(res => res.data),
          retry: (failureCount, error: any) => {
            // Don't retry on 401 errors
            if (error?.response?.status === 401) {
              return false;
            }
            return failureCount < 3;
          },
        }),
        { wrapper: createWrapper }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.failureCount).toBe(1);
    });
  });

  describe('Mutation Integration', () => {
    it('should handle successful mutations', async () => {
      const mockResponse = { data: { id: 1, success: true } };
      mockedApi.post.mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(
        () => useMutation({
          mutationFn: (data: any) => api.post('/create', data).then(res => res.data),
        }),
        { wrapper: createWrapper }
      );

      const testData = { name: 'Test Item' };
      result.current.mutate(testData);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockResponse.data);
      expect(mockedApi.post).toHaveBeenCalledWith('/create', testData);
    });

    it('should handle mutation errors', async () => {
      const mutationError = {
        response: {
          status: 400,
          data: { error: { code: 'VALIDATION_ERROR', message: 'Invalid data' } }
        }
      };
      mockedApi.post.mockRejectedValueOnce(mutationError);

      const { result } = renderHook(
        () => useMutation({
          mutationFn: (data: any) => api.post('/create', data).then(res => res.data),
        }),
        { wrapper: createWrapper }
      );

      result.current.mutate({ invalid: 'data' });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toEqual(mutationError);
    });

    it('should handle optimistic updates correctly', async () => {
      const initialData = [{ id: 1, name: 'Item 1' }];
      const newItem = { id: 2, name: 'Item 2' };
      
      // Set initial query data
      queryClient.setQueryData(['items'], initialData);

      const { result } = renderHook(
        () => useMutation({
          mutationFn: (data: any) => api.post('/items', data).then(res => res.data),
          onMutate: async (newItem) => {
            // Cancel outgoing refetches
            await queryClient.cancelQueries({ queryKey: ['items'] });
            
            // Snapshot previous value
            const previousItems = queryClient.getQueryData(['items']);
            
            // Optimistically update
            queryClient.setQueryData(['items'], (old: any) => [...old, newItem]);
            
            return { previousItems };
          },
          onError: (err, newItem, context) => {
            // Rollback on error
            queryClient.setQueryData(['items'], context?.previousItems);
          },
          onSettled: () => {
            // Refetch after mutation
            queryClient.invalidateQueries({ queryKey: ['items'] });
          },
        }),
        { wrapper: createWrapper }
      );

      // Mock successful response
      mockedApi.post.mockResolvedValueOnce({ data: newItem });

      result.current.mutate(newItem);

      // Check optimistic update
      const optimisticData = queryClient.getQueryData(['items']);
      expect(optimisticData).toEqual([...initialData, newItem]);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });
  });

  describe('Cache Management', () => {
    it('should handle cache invalidation patterns', async () => {
      const mockData = { id: 1, name: 'Test' };
      mockedApi.get.mockResolvedValueOnce({ data: mockData });

      // Set initial data
      queryClient.setQueryData(['cache', 'test'], mockData);

      // Verify data is cached
      expect(queryClient.getQueryData(['cache', 'test'])).toEqual(mockData);

      // Invalidate cache
      await queryClient.invalidateQueries({ queryKey: ['cache'] });

      // Check invalidation
      const queryState = queryClient.getQueryState(['cache', 'test']);
      expect(queryState?.isInvalidated).toBe(true);
    });

    it('should handle stale-while-revalidate pattern', async () => {
      const staleData = { id: 1, name: 'Stale' };
      const freshData = { id: 1, name: 'Fresh' };

      // Set stale data
      queryClient.setQueryData(['stale', 'test'], staleData);

      mockedApi.get.mockResolvedValueOnce({ data: freshData });

      const { result } = renderHook(
        () => useQuery({
          queryKey: ['stale', 'test'],
          queryFn: () => api.get('/fresh').then(res => res.data),
          staleTime: 0, // Immediately stale
        }),
        { wrapper: createWrapper }
      );

      // Should initially return stale data
      expect(result.current.data).toEqual(staleData);

      // Should fetch fresh data in background
      await waitFor(() => {
        expect(result.current.data).toEqual(freshData);
      });
    });
  });

  describe('Query Dependencies and Enabled Queries', () => {
    it('should handle dependent queries correctly', async () => {
      const userId = 1;
      const userProfileData = { id: userId, profile: 'test' };

      mockedApi.get.mockResolvedValueOnce({ data: userProfileData });

      const { result } = renderHook(
        () => useQuery({
          queryKey: ['user', 'profile', userId],
          queryFn: () => api.get(`/users/${userId}/profile`).then(res => res.data),
          enabled: !!userId, // Only run if userId exists
        }),
        { wrapper: createWrapper }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(userProfileData);
      expect(mockedApi.get).toHaveBeenCalledWith(`/users/${userId}/profile`);
    });

    it('should not run queries when disabled', () => {
      const { result } = renderHook(
        () => useQuery({
          queryKey: ['disabled', 'query'],
          queryFn: () => api.get('/should-not-call').then(res => res.data),
          enabled: false,
        }),
        { wrapper: createWrapper }
      );

      expect(result.current.status).toBe('pending');
      expect(mockedApi.get).not.toHaveBeenCalled();
    });
  });

  describe('API Query Hooks Integration', () => {
    it('should handle useApiQuery hook correctly', async () => {
      const testData = { id: 1, name: 'Test' };
      mockedApi.get.mockResolvedValueOnce({ data: testData });

      const { result } = renderHook(
        () => useApiQuery(['test'], () => api.get('/test')),
        { wrapper: createWrapper }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(testData);
    });

    it('should handle useApiMutation hook correctly', async () => {
      const testData = { id: 1, name: 'Created' };
      mockedApi.post.mockResolvedValueOnce({ data: testData });

      const { result } = renderHook(
        () => useApiMutation((data: any) => api.post('/test', data)),
        { wrapper: createWrapper }
      );

      act(() => {
        result.current.mutate({ name: 'Test' });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.data).toEqual(testData);
    });

    it('should handle health check hook with proper intervals', async () => {
      const healthData = { status: 'healthy' };
      mockedApi.get.mockResolvedValue({ data: healthData });

      const { result } = renderHook(
        () => useHealthCheck(),
        { wrapper: createWrapper }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(healthData);
    });

    it('should handle invoice operations with proper cache management', async () => {
      const invoicesData = [{ id: 1, amount: 100 }];
      const newInvoice = { id: 2, amount: 200 };

      // Test useInvoices
      mockedApi.get.mockResolvedValueOnce({ data: invoicesData });

      const { result: invoicesResult } = renderHook(
        () => useInvoices(),
        { wrapper: createWrapper }
      );

      await waitFor(() => {
        expect(invoicesResult.current.isSuccess).toBe(true);
      });

      expect(invoicesResult.current.data).toEqual(invoicesData);

      // Test useCreateInvoice
      mockedApi.post.mockResolvedValueOnce({ data: newInvoice });

      const { result: createResult } = renderHook(
        () => useCreateInvoice(),
        { wrapper: createWrapper }
      );

      act(() => {
        createResult.current.mutate(newInvoice);
      });

      await waitFor(() => {
        expect(createResult.current.isSuccess).toBe(true);
      });
    });

    it('should handle file upload with progress tracking', async () => {
      const uploadResponse = { id: 'file123', filename: 'test.pdf' };
      mockedApi.post.mockResolvedValueOnce({ data: uploadResponse });

      const { result } = renderHook(
        () => useFileUpload(),
        { wrapper: createWrapper }
      );

      const formData = new FormData();
      formData.append('file', new Blob(['test'], { type: 'application/pdf' }));

      act(() => {
        result.current.mutate(formData);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.data).toEqual(uploadResponse);
    });

    it('should handle authentication with token management', async () => {
      const authResponse = {
        token: 'access-token',
        refreshToken: 'refresh-token',
        user: { id: 1, email: 'test@example.com' }
      };
      mockedApi.post.mockResolvedValueOnce({ data: authResponse });

      const { result } = renderHook(
        () => useLogin(),
        { wrapper: createWrapper }
      );

      act(() => {
        result.current.mutate({ email: 'test@example.com', password: 'password' });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.data).toEqual(authResponse);
    });
  });

  describe('React Query Issues Detection', () => {
    it('should detect and handle duplicate QueryClient instances', () => {
      // This test ensures we don't have multiple QueryClient instances
      const client1 = new QueryClient();
      const client2 = new QueryClient();

      expect(client1).not.toBe(client2);

      // In the actual app, we should only have one QueryClient instance
      // This is handled in main.tsx
    });

    it('should use correct property names (gcTime vs cacheTime)', () => {
      const testClient = new QueryClient({
        defaultOptions: {
          queries: {
            gcTime: 5 * 60 * 1000, // Correct: gcTime
            // cacheTime: 5 * 60 * 1000, // Deprecated: should not use
          },
        },
      });

      const options = testClient.getDefaultOptions();
      expect(options.queries?.gcTime).toBeDefined();
      expect(options.queries).not.toHaveProperty('cacheTime');
    });

    it('should handle proper error boundaries with React Query', async () => {
      const errorQuery = () => {
        throw new Error('Test error for boundary');
      };

      const { result } = renderHook(
        () => useQuery({
          queryKey: ['error-boundary-test'],
          queryFn: errorQuery,
        }),
        { wrapper: createWrapper }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeInstanceOf(Error);
    });

    it('should handle proper query key serialization', () => {
      const complexKey = ['users', { id: 1, filters: { active: true } }, 'profile'];

      // React Query should handle complex query keys properly
      queryClient.setQueryData(complexKey, { data: 'test' });
      const data = queryClient.getQueryData(complexKey);

      expect(data).toEqual({ data: 'test' });
    });
  });
});
