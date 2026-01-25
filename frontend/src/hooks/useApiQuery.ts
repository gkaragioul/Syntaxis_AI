// @ts-nocheck
import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { useErrorHandler } from './useErrorHandler';
import { api, apiUtils } from '../services/api';
import { AxiosResponse } from 'axios';
import { useEffect } from 'react';

// Enhanced useQuery hook with integrated error handling and proper React Query v5 patterns
export function useApiQuery<TData = any, TError = any>(
  queryKey: (string | number)[],
  queryFn: () => Promise<AxiosResponse<TData>>,
  options?: Omit<UseQueryOptions<AxiosResponse<TData>, TError, TData>, 'queryKey' | 'queryFn'>
) {
  const { handleApiError } = useErrorHandler();

  const query = useQuery({
    queryKey,
    queryFn,
    select: (data) => data.data, // Extract data from Axios response
    retry: (failureCount, error: any) => {
      // Don't retry on client errors (except 401)
      if (error?.response?.status >= 400 && error?.response?.status < 500 && error?.response?.status !== 401) {
        return false;
      }
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    staleTime: 5 * 60 * 1000, // Default 5 minutes
    gcTime: 10 * 60 * 1000, // Default 10 minutes (formerly cacheTime)
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    ...options,
  });

  // Handle errors using useEffect to avoid deprecated onError callback
  useEffect(() => {
    if (query.error) {
      handleApiError(query.error, () => query.refetch());
    }
  }, [query.error, handleApiError, query.refetch]);

  return query;
}

// Enhanced useMutation hook with integrated error handling and proper React Query v5 patterns
export function useApiMutation<TData = any, TError = any, TVariables = any>(
  mutationFn: (variables: TVariables) => Promise<AxiosResponse<TData>>,
  options?: Omit<UseMutationOptions<AxiosResponse<TData>, TError, TVariables>, 'mutationFn'>
) {
  const { handleApiError } = useErrorHandler();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn,
    retry: (failureCount, error: any) => {
      // Don't retry mutations on client errors
      if (error?.response?.status >= 400 && error?.response?.status < 500) {
        return false;
      }
      // Retry up to 2 times for server errors
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    onSuccess: (data, variables, context) => {
      // Call custom onSuccess if provided
      if (options?.onSuccess) {
        options.onSuccess(data, variables, context);
      }
    },
    onError: (error, variables, context) => {
      // Handle error
      handleApiError(error, () => mutationFn(variables));

      // Call custom onError if provided
      if (options?.onError) {
        options.onError(error, variables, context);
      }
    },
    ...options,
  });

  return mutation;
}

// Specific hooks for common API operations
export const useHealthCheck = () => {
  return useApiQuery(
    ['health'],
    () => api.get('/health'),
    {
      staleTime: 30 * 1000, // 30 seconds
      refetchInterval: 60 * 1000, // Refetch every minute
      retry: 5, // Retry more for health checks
    }
  );
};

export const useUserProfile = (userId?: string) => {
  return useApiQuery(
    ['user', 'profile', userId],
    () => api.get(`/users/${userId}/profile`),
    {
      enabled: !!userId,
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );
};

export const useInvoices = (filters?: Record<string, any>) => {
  return useApiQuery(
    ['invoices', filters],
    () => api.get('/invoices', { params: filters }),
    {
      staleTime: 2 * 60 * 1000, // 2 minutes
      placeholderData: (previousData) => previousData, // Keep previous data while fetching new (replaces keepPreviousData)
    }
  );
};

export const useInvoice = (invoiceId?: string) => {
  return useApiQuery(
    ['invoice', invoiceId],
    () => api.get(`/invoices/${invoiceId}`),
    {
      enabled: !!invoiceId,
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );
};

export const useCreateInvoice = () => {
  const queryClient = useQueryClient();
  
  return useApiMutation(
    (data: any) => api.post('/invoices', data),
    {
      onSuccess: () => {
        // Invalidate and refetch invoices list
        queryClient.invalidateQueries({ queryKey: ['invoices'] });
      },
    }
  );
};

export const useUpdateInvoice = () => {
  const queryClient = useQueryClient();

  return useApiMutation(
    ({ id, data }: { id: string; data: any }) => api.put(`/invoices/${id}`, data),
    {
      // Optimistic update
      onMutate: async ({ id, data }) => {
        // Cancel any outgoing refetches
        await queryClient.cancelQueries({ queryKey: ['invoice', id] });
        await queryClient.cancelQueries({ queryKey: ['invoices'] });

        // Snapshot the previous value
        const previousInvoice = queryClient.getQueryData(['invoice', id]);
        const previousInvoices = queryClient.getQueryData(['invoices']);

        // Optimistically update to the new value
        queryClient.setQueryData(['invoice', id], (old: any) => ({
          ...old,
          data: { ...old?.data, ...data }
        }));

        // Return a context object with the snapshotted value
        return { previousInvoice, previousInvoices };
      },
      onSuccess: (response, { id }) => {
        // Update the specific invoice in cache with server response
        queryClient.setQueryData(['invoice', id], response);
        // Invalidate invoices list to refetch
        queryClient.invalidateQueries({ queryKey: ['invoices'] });
      },
      onError: (error, { id }, context) => {
        // Rollback optimistic update on error
        if (context?.previousInvoice) {
          queryClient.setQueryData(['invoice', id], context.previousInvoice);
        }
        if (context?.previousInvoices) {
          queryClient.setQueryData(['invoices'], context.previousInvoices);
        }
      },
      onSettled: ({ id }) => {
        // Always refetch after error or success
        queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      },
    }
  );
};

export const useDeleteInvoice = () => {
  const queryClient = useQueryClient();
  
  return useApiMutation(
    (id: string) => api.delete(`/invoices/${id}`),
    {
      onSuccess: (response, id) => {
        // Remove from cache
        queryClient.removeQueries({ queryKey: ['invoice', id] });
        // Invalidate invoices list
        queryClient.invalidateQueries({ queryKey: ['invoices'] });
      },
    }
  );
};

export const useFileUpload = () => {
  const queryClient = useQueryClient();
  
  return useApiMutation(
    (formData: FormData) => api.post('/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }),
    {
      onSuccess: () => {
        // Invalidate files list if it exists
        queryClient.invalidateQueries({ queryKey: ['files'] });
      },
    }
  );
};

export const useFiles = (filters?: Record<string, any>) => {
  return useApiQuery(
    ['files', filters],
    () => api.get('/files', { params: filters }),
    {
      staleTime: 1 * 60 * 1000, // 1 minute
      placeholderData: (previousData) => previousData,
    }
  );
};

export const useFile = (fileId?: string) => {
  return useApiQuery(
    ['file', fileId],
    () => api.get(`/files/${fileId}`),
    {
      enabled: !!fileId,
      staleTime: 10 * 60 * 1000, // 10 minutes
    }
  );
};

// Auth-related hooks
export const useLogin = () => {
  const queryClient = useQueryClient();
  
  return useApiMutation(
    (credentials: { email: string; password: string }) => api.post('/auth/login', credentials),
    {
      onSuccess: (response) => {
        // Store token
        const { token, refreshToken } = response.data;
        localStorage.setItem('syntaxisai_token', token);
        if (refreshToken) {
          localStorage.setItem('syntaxisai_refresh_token', refreshToken);
        }
        
        // Invalidate all queries to refetch with new auth
        queryClient.invalidateQueries();
      },
    }
  );
};

export const useLogout = () => {
  const queryClient = useQueryClient();
  
  return useApiMutation(
    () => api.post('/auth/logout'),
    {
      onSuccess: () => {
        // Clear tokens
        localStorage.removeItem('syntaxisai_token');
        localStorage.removeItem('syntaxisai_refresh_token');
        
        // Clear all cached data
        queryClient.clear();
      },
      onError: () => {
        // Even if logout fails on server, clear local data
        localStorage.removeItem('syntaxisai_token');
        localStorage.removeItem('syntaxisai_refresh_token');
        queryClient.clear();
      },
    }
  );
};

export const useRegister = () => {
  return useApiMutation(
    (userData: { email: string; password: string; name: string }) => 
      api.post('/auth/register', userData)
  );
};

// System monitoring hooks
export const useSystemStatus = () => {
  return useApiQuery(
    ['system', 'status'],
    () => api.get('/system/status'),
    {
      staleTime: 30 * 1000, // 30 seconds
      refetchInterval: 60 * 1000, // Refetch every minute
      retry: 3,
    }
  );
};

export const useSystemHealth = () => {
  return useApiQuery(
    ['system', 'health'],
    () => api.get('/system/health'),
    {
      staleTime: 10 * 1000, // 10 seconds
      refetchInterval: 30 * 1000, // Refetch every 30 seconds
      retry: 5,
    }
  );
};
