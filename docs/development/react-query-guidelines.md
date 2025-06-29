# React Query Usage Guidelines

This document provides comprehensive guidelines for using React Query (TanStack Query) in the SyntaxisAI application.

## Table of Contents

1. [Setup and Configuration](#setup-and-configuration)
2. [Query Patterns](#query-patterns)
3. [Mutation Patterns](#mutation-patterns)
4. [Cache Management](#cache-management)
5. [Error Handling](#error-handling)
6. [Performance Optimization](#performance-optimization)
7. [Testing Patterns](#testing-patterns)
8. [Common Pitfalls](#common-pitfalls)

## Setup and Configuration

### Query Client Configuration

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,        // 5 minutes
      gcTime: 10 * 60 * 1000,          // 10 minutes (formerly cacheTime)
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors (except 401)
        if (error?.response?.status >= 400 && 
            error?.response?.status < 500 && 
            error?.response?.status !== 401) {
          return false;
        }
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: (failureCount, error) => {
        // Don't retry mutations on client errors
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
          return false;
        }
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    },
  },
});
```

### Provider Setup

```typescript
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <YourApp />
      {/* Add React Query DevTools in development */}
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools />}
    </QueryClientProvider>
  );
}
```

## Query Patterns

### Basic Query

```typescript
import { useApiQuery } from '../hooks/useApiQuery';

function InvoicesList() {
  const { 
    data: invoices, 
    error, 
    isLoading, 
    isError,
    refetch 
  } = useApiQuery(
    ['invoices'],
    () => api.get('/invoices')
  );

  if (isLoading) return <LoadingSpinner />;
  if (isError) return <ErrorMessage error={error} onRetry={refetch} />;

  return <InvoicesList invoices={invoices} />;
}
```

### Parameterized Query

```typescript
function InvoicesList({ filters }) {
  const { data: invoices } = useApiQuery(
    ['invoices', filters],  // Include filters in query key
    () => api.get('/invoices', { params: filters }),
    {
      // Keep previous data while fetching new data
      placeholderData: (previousData) => previousData,
      // Only refetch if filters actually changed
      enabled: !!filters,
    }
  );

  return <InvoicesList invoices={invoices} />;
}
```

### Dependent Query

```typescript
function InvoiceDetails({ invoiceId }) {
  // First query: Get invoice
  const { data: invoice } = useApiQuery(
    ['invoice', invoiceId],
    () => api.get(`/invoices/${invoiceId}`),
    {
      enabled: !!invoiceId,
    }
  );

  // Dependent query: Get invoice files (only runs if invoice exists)
  const { data: files } = useApiQuery(
    ['invoice-files', invoiceId],
    () => api.get(`/invoices/${invoiceId}/files`),
    {
      enabled: !!invoice?.id,
    }
  );

  return <InvoiceDetails invoice={invoice} files={files} />;
}
```

### Infinite Query (Pagination)

```typescript
import { useInfiniteQuery } from '@tanstack/react-query';

function InfiniteInvoicesList() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['invoices', 'infinite'],
    queryFn: ({ pageParam = 1 }) => 
      api.get('/invoices', { params: { page: pageParam, limit: 20 } }),
    getNextPageParam: (lastPage, pages) => {
      const { page, total, limit } = lastPage.data.meta;
      return page * limit < total ? page + 1 : undefined;
    },
    initialPageParam: 1,
  });

  return (
    <div>
      {data?.pages.map((page, i) => (
        <div key={i}>
          {page.data.data.map(invoice => (
            <InvoiceCard key={invoice.id} invoice={invoice} />
          ))}
        </div>
      ))}
      
      {hasNextPage && (
        <button 
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? 'Loading...' : 'Load More'}
        </button>
      )}
    </div>
  );
}
```

## Mutation Patterns

### Basic Mutation

```typescript
import { useApiMutation } from '../hooks/useApiQuery';

function CreateInvoiceForm() {
  const queryClient = useQueryClient();
  
  const createInvoice = useApiMutation(
    (data) => api.post('/invoices', data),
    {
      onSuccess: () => {
        // Invalidate and refetch invoices list
        queryClient.invalidateQueries({ queryKey: ['invoices'] });
        // Show success message
        toast.success('Invoice created successfully');
      },
      onError: (error) => {
        // Error is automatically handled by useApiMutation
        // Additional custom error handling can go here
        console.error('Failed to create invoice:', error);
      },
    }
  );

  const handleSubmit = (formData) => {
    createInvoice.mutate(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* form fields */}
      <button 
        type="submit" 
        disabled={createInvoice.isPending}
      >
        {createInvoice.isPending ? 'Creating...' : 'Create Invoice'}
      </button>
    </form>
  );
}
```

### Optimistic Updates

```typescript
function UpdateInvoiceForm({ invoice }) {
  const queryClient = useQueryClient();
  
  const updateInvoice = useApiMutation(
    ({ id, data }) => api.put(`/invoices/${id}`, data),
    {
      // Optimistic update
      onMutate: async ({ id, data }) => {
        // Cancel any outgoing refetches
        await queryClient.cancelQueries({ queryKey: ['invoice', id] });
        await queryClient.cancelQueries({ queryKey: ['invoices'] });

        // Snapshot the previous values
        const previousInvoice = queryClient.getQueryData(['invoice', id]);
        const previousInvoices = queryClient.getQueryData(['invoices']);

        // Optimistically update to the new value
        queryClient.setQueryData(['invoice', id], (old) => ({
          ...old,
          data: { ...old?.data, ...data }
        }));

        // Update in the list as well
        queryClient.setQueryData(['invoices'], (old) => ({
          ...old,
          data: {
            ...old?.data,
            data: old?.data?.data?.map(item => 
              item.id === id ? { ...item, ...data } : item
            )
          }
        }));

        return { previousInvoice, previousInvoices };
      },
      
      // On success, update with server response
      onSuccess: (response, { id }) => {
        queryClient.setQueryData(['invoice', id], response);
        queryClient.invalidateQueries({ queryKey: ['invoices'] });
      },
      
      // On error, rollback optimistic update
      onError: (error, { id }, context) => {
        if (context?.previousInvoice) {
          queryClient.setQueryData(['invoice', id], context.previousInvoice);
        }
        if (context?.previousInvoices) {
          queryClient.setQueryData(['invoices'], context.previousInvoices);
        }
      },
      
      // Always refetch after error or success
      onSettled: (data, error, { id }) => {
        queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      },
    }
  );

  return <UpdateForm onSubmit={(data) => updateInvoice.mutate({ id: invoice.id, data })} />;
}
```

### Batch Mutations

```typescript
function BulkDeleteInvoices({ selectedIds }) {
  const queryClient = useQueryClient();
  
  const bulkDelete = useApiMutation(
    (ids) => Promise.all(ids.map(id => api.delete(`/invoices/${id}`))),
    {
      onSuccess: () => {
        // Invalidate all invoice-related queries
        queryClient.invalidateQueries({ queryKey: ['invoices'] });
        queryClient.invalidateQueries({ queryKey: ['invoice'] });
        toast.success(`${selectedIds.length} invoices deleted`);
      },
    }
  );

  return (
    <button 
      onClick={() => bulkDelete.mutate(selectedIds)}
      disabled={bulkDelete.isPending}
    >
      Delete Selected ({selectedIds.length})
    </button>
  );
}
```

## Cache Management

### Manual Cache Updates

```typescript
const queryClient = useQueryClient();

// Update specific cache entry
queryClient.setQueryData(['invoice', id], newInvoiceData);

// Update cache with function
queryClient.setQueryData(['invoices'], (old) => ({
  ...old,
  data: {
    ...old.data,
    data: old.data.data.map(item => 
      item.id === id ? { ...item, ...updates } : item
    )
  }
}));

// Remove from cache
queryClient.removeQueries({ queryKey: ['invoice', id] });

// Invalidate (mark as stale and refetch if active)
queryClient.invalidateQueries({ queryKey: ['invoices'] });

// Refetch immediately
queryClient.refetchQueries({ queryKey: ['invoices'] });
```

### Prefetching

```typescript
function InvoicesList() {
  const queryClient = useQueryClient();
  
  const { data: invoices } = useApiQuery(['invoices'], fetchInvoices);

  // Prefetch invoice details on hover
  const handleInvoiceHover = (invoiceId) => {
    queryClient.prefetchQuery({
      queryKey: ['invoice', invoiceId],
      queryFn: () => api.get(`/invoices/${invoiceId}`),
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  };

  return (
    <div>
      {invoices?.map(invoice => (
        <InvoiceCard 
          key={invoice.id}
          invoice={invoice}
          onMouseEnter={() => handleInvoiceHover(invoice.id)}
        />
      ))}
    </div>
  );
}
```

## Error Handling

### Global Error Handling

```typescript
// In your query client setup
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      onError: (error) => {
        // Global error handling
        if (error?.response?.status === 401) {
          // Redirect to login
          window.location.href = '/login';
        }
      },
    },
    mutations: {
      onError: (error) => {
        // Global mutation error handling
        if (error?.response?.status >= 500) {
          toast.error('Server error. Please try again later.');
        }
      },
    },
  },
});
```

### Component-Level Error Handling

```typescript
function InvoiceDetails({ invoiceId }) {
  const { 
    data: invoice, 
    error, 
    isError,
    refetch 
  } = useApiQuery(
    ['invoice', invoiceId],
    () => api.get(`/invoices/${invoiceId}`)
  );

  if (isError) {
    return (
      <ErrorBoundary 
        error={error}
        onRetry={refetch}
        fallback={<InvoiceErrorFallback />}
      />
    );
  }

  return <InvoiceDetails invoice={invoice} />;
}
```

## Performance Optimization

### Query Key Strategies

```typescript
// ✅ Good: Hierarchical query keys
['invoices']                    // All invoices
['invoices', { status: 'paid' }] // Filtered invoices
['invoice', id]                 // Specific invoice
['invoice', id, 'files']        // Invoice files

// ❌ Bad: Flat query keys
['paid-invoices']
['invoice-123']
['invoice-123-files']
```

### Selective Invalidation

```typescript
// Invalidate all invoice queries
queryClient.invalidateQueries({ queryKey: ['invoices'] });

// Invalidate specific invoice
queryClient.invalidateQueries({ queryKey: ['invoice', id] });

// Invalidate with predicate
queryClient.invalidateQueries({
  predicate: (query) => 
    query.queryKey[0] === 'invoices' && 
    query.queryKey[1]?.status === 'draft'
});
```

### Background Updates

```typescript
const { data: invoices } = useApiQuery(
  ['invoices'],
  fetchInvoices,
  {
    staleTime: 5 * 60 * 1000,     // 5 minutes
    refetchInterval: 30 * 1000,   // Refetch every 30 seconds
    refetchIntervalInBackground: true, // Continue refetching when tab is not active
  }
);
```

## Testing Patterns

### Mocking Queries

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderWithQueryClient(ui, { queryClient = createTestQueryClient() } = {}) {
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

// Test with mock data
test('displays invoice list', async () => {
  const queryClient = createTestQueryClient();
  
  // Pre-populate cache
  queryClient.setQueryData(['invoices'], {
    data: [
      { id: '1', number: 'INV-001' },
      { id: '2', number: 'INV-002' },
    ]
  });

  renderWithQueryClient(<InvoicesList />, { queryClient });
  
  expect(screen.getByText('INV-001')).toBeInTheDocument();
  expect(screen.getByText('INV-002')).toBeInTheDocument();
});
```

## Common Pitfalls

### 1. Query Key Dependencies

```typescript
// ❌ Bad: Missing dependencies in query key
const { data } = useApiQuery(
  ['invoices'],
  () => api.get('/invoices', { params: filters }) // filters not in key
);

// ✅ Good: Include all dependencies
const { data } = useApiQuery(
  ['invoices', filters],
  () => api.get('/invoices', { params: filters })
);
```

### 2. Stale Closures

```typescript
// ❌ Bad: Stale closure in mutation
const updateInvoice = useApiMutation(
  (data) => api.put(`/invoices/${invoiceId}`, data), // invoiceId might be stale
);

// ✅ Good: Pass all dependencies
const updateInvoice = useApiMutation(
  ({ id, data }) => api.put(`/invoices/${id}`, data)
);
```

### 3. Over-invalidation

```typescript
// ❌ Bad: Invalidates too much
queryClient.invalidateQueries(); // Invalidates ALL queries

// ✅ Good: Selective invalidation
queryClient.invalidateQueries({ queryKey: ['invoices'] });
```

### 4. Missing Error Boundaries

```typescript
// ✅ Always wrap your app with error boundaries
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <YourApp />
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
```

### 5. Forgetting to Handle Loading States

```typescript
// ✅ Always handle loading and error states
function InvoicesList() {
  const { data, isLoading, isError, error } = useApiQuery(
    ['invoices'],
    fetchInvoices
  );

  if (isLoading) return <LoadingSpinner />;
  if (isError) return <ErrorMessage error={error} />;
  
  return <InvoicesList invoices={data} />;
}
```

By following these patterns and guidelines, you'll have a robust, performant, and maintainable React Query implementation in your SyntaxisAI application.
