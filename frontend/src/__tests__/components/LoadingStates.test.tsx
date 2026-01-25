import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LoadingProvider, useLoading } from '../../components/Loading/LoadingProvider';
import { LoadingSpinner } from '../../components/Loading/LoadingSpinner';
import { LoadingSkeleton } from '../../components/Loading/LoadingSkeleton';
import { ProgressBar } from '../../components/Loading/ProgressBar';
import { ErrorBoundary } from '../../components/ErrorBoundary';

// Test component to use loading context
const TestLoadingComponent: React.FC = () => {
  const {
    isLoading,
    loadingStates,
    setLoading,
    setProgress,
    addLoadingState,
    removeLoadingState,
  } = useLoading();

  return (
    <div>
      <div data-testid="loading-status">{isLoading ? 'loading' : 'idle'}</div>
      <div data-testid="loading-count">{Object.keys(loadingStates).length}</div>
      
      <button 
        onClick={() => setLoading('test-operation', true)}
        data-testid="start-loading"
      >
        Start Loading
      </button>
      <button 
        onClick={() => setLoading('test-operation', false)}
        data-testid="stop-loading"
      >
        Stop Loading
      </button>
      <button 
        onClick={() => setProgress('upload', 50)}
        data-testid="set-progress"
      >
        Set Progress
      </button>
      <button 
        onClick={() => addLoadingState('api-call', { message: 'Fetching data...' })}
        data-testid="add-state"
      >
        Add State
      </button>
      <button 
        onClick={() => removeLoadingState('api-call')}
        data-testid="remove-state"
      >
        Remove State
      </button>
    </div>
  );
};

describe('LoadingProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should provide default loading state', () => {
    render(
      <LoadingProvider>
        <TestLoadingComponent />
      </LoadingProvider>
    );

    expect(screen.getByTestId('loading-status')).toHaveTextContent('idle');
    expect(screen.getByTestId('loading-count')).toHaveTextContent('0');
  });

  it('should manage loading states', () => {
    render(
      <LoadingProvider>
        <TestLoadingComponent />
      </LoadingProvider>
    );

    const startButton = screen.getByTestId('start-loading');
    const stopButton = screen.getByTestId('stop-loading');
    const loadingStatus = screen.getByTestId('loading-status');

    fireEvent.click(startButton);
    expect(loadingStatus).toHaveTextContent('loading');

    fireEvent.click(stopButton);
    expect(loadingStatus).toHaveTextContent('idle');
  });

  it('should handle multiple loading states', () => {
    render(
      <LoadingProvider>
        <TestLoadingComponent />
      </LoadingProvider>
    );

    const addButton = screen.getByTestId('add-state');
    const removeButton = screen.getByTestId('remove-state');
    const loadingCount = screen.getByTestId('loading-count');

    fireEvent.click(addButton);
    expect(loadingCount).toHaveTextContent('1');

    fireEvent.click(removeButton);
    expect(loadingCount).toHaveTextContent('0');
  });

  it('should manage progress states', () => {
    render(
      <LoadingProvider>
        <TestLoadingComponent />
      </LoadingProvider>
    );

    const setProgressButton = screen.getByTestId('set-progress');
    fireEvent.click(setProgressButton);

    // Progress should be tracked in loading states
    expect(screen.getByTestId('loading-count')).toHaveTextContent('1');
  });
});

describe('LoadingSpinner', () => {
  it('should render with default props', () => {
    render(<LoadingSpinner data-testid="spinner" />);
    
    const spinner = screen.getByTestId('spinner');
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveClass('loading-spinner');
  });

  it('should render with custom size', () => {
    render(<LoadingSpinner size="large" data-testid="spinner" />);
    
    const spinner = screen.getByTestId('spinner');
    expect(spinner).toHaveClass('loading-spinner-large');
  });

  it('should render with custom color', () => {
    render(<LoadingSpinner color="primary" data-testid="spinner" />);
    
    const spinner = screen.getByTestId('spinner');
    expect(spinner).toHaveClass('loading-spinner-primary');
  });

  it('should be accessible', () => {
    render(<LoadingSpinner data-testid="spinner" />);
    
    const spinner = screen.getByTestId('spinner');
    expect(spinner).toHaveAttribute('role', 'status');
    expect(spinner).toHaveAttribute('aria-label', 'Loading');
  });

  it('should support custom aria-label', () => {
    render(<LoadingSpinner aria-label="Processing invoice" data-testid="spinner" />);
    
    const spinner = screen.getByTestId('spinner');
    expect(spinner).toHaveAttribute('aria-label', 'Processing invoice');
  });

  it('should respect reduced motion preference', () => {
    // Mock prefers-reduced-motion
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    render(<LoadingSpinner data-testid="spinner" />);
    
    const spinner = screen.getByTestId('spinner');
    expect(spinner).toHaveClass('reduced-motion');
  });
});

describe('LoadingSkeleton', () => {
  it('should render text skeleton', () => {
    render(<LoadingSkeleton variant="text" data-testid="skeleton" />);
    
    const skeleton = screen.getByTestId('skeleton');
    expect(skeleton).toHaveClass('skeleton-text');
  });

  it('should render rectangular skeleton', () => {
    render(<LoadingSkeleton variant="rectangular" width={200} height={100} data-testid="skeleton" />);
    
    const skeleton = screen.getByTestId('skeleton');
    expect(skeleton).toHaveClass('skeleton-rectangular');
    expect(skeleton).toHaveStyle('width: 200px');
    expect(skeleton).toHaveStyle('height: 100px');
  });

  it('should render circular skeleton', () => {
    render(<LoadingSkeleton variant="circular" size={50} data-testid="skeleton" />);
    
    const skeleton = screen.getByTestId('skeleton');
    expect(skeleton).toHaveClass('skeleton-circular');
    expect(skeleton).toHaveStyle('width: 50px');
    expect(skeleton).toHaveStyle('height: 50px');
  });

  it('should support animation control', () => {
    render(<LoadingSkeleton variant="text" animation={false} data-testid="skeleton" />);
    
    const skeleton = screen.getByTestId('skeleton');
    expect(skeleton).toHaveClass('skeleton-no-animation');
  });

  it('should be accessible', () => {
    render(<LoadingSkeleton variant="text" data-testid="skeleton" />);
    
    const skeleton = screen.getByTestId('skeleton');
    expect(skeleton).toHaveAttribute('aria-label', 'Loading content');
    expect(skeleton).toHaveAttribute('role', 'status');
  });
});

describe('ProgressBar', () => {
  it('should render with progress value', () => {
    render(<ProgressBar value={50} data-testid="progress" />);
    
    const progress = screen.getByTestId('progress');
    expect(progress).toHaveAttribute('aria-valuenow', '50');
    expect(progress).toHaveAttribute('aria-valuemin', '0');
    expect(progress).toHaveAttribute('aria-valuemax', '100');
  });

  it('should render indeterminate progress', () => {
    render(<ProgressBar data-testid="progress" />);
    
    const progress = screen.getByTestId('progress');
    expect(progress).toHaveClass('progress-indeterminate');
  });

  it('should display progress label', () => {
    render(<ProgressBar value={75} showLabel data-testid="progress" />);
    
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('should support custom label', () => {
    render(<ProgressBar value={30} label="Uploading..." data-testid="progress" />);
    
    expect(screen.getByText('Uploading...')).toBeInTheDocument();
  });

  it('should handle different variants', () => {
    render(<ProgressBar value={60} variant="success" data-testid="progress" />);
    
    const progress = screen.getByTestId('progress');
    expect(progress).toHaveClass('progress-success');
  });

  it('should be accessible', () => {
    render(<ProgressBar value={40} label="Processing" data-testid="progress" />);
    
    const progress = screen.getByTestId('progress');
    expect(progress).toHaveAttribute('role', 'progressbar');
    expect(progress).toHaveAttribute('aria-label', 'Processing');
  });
});

describe('Loading States Integration', () => {
  it('should show loading spinner during async operations', async () => {
    const AsyncComponent: React.FC = () => {
      const { setLoading } = useLoading();
      const [data, setData] = React.useState<string | null>(null);

      const fetchData = async () => {
        setLoading('fetch', true);
        try {
          // Simulate API call
          await new Promise(resolve => setTimeout(resolve, 100));
          setData('Loaded data');
        } finally {
          setLoading('fetch', false);
        }
      };

      return (
        <div>
          <button onClick={fetchData} data-testid="fetch-button">
            Fetch Data
          </button>
          {data && <div data-testid="data">{data}</div>}
        </div>
      );
    };

    render(
      <LoadingProvider>
        <AsyncComponent />
        <LoadingSpinner data-testid="global-spinner" />
      </LoadingProvider>
    );

    const fetchButton = screen.getByTestId('fetch-button');
    fireEvent.click(fetchButton);

    // Should show loading spinner
    expect(screen.getByTestId('global-spinner')).toBeInTheDocument();

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByTestId('data')).toHaveTextContent('Loaded data');
    });
  });

  it('should handle loading errors gracefully', async () => {
    const ErrorComponent: React.FC = () => {
      const { setLoading } = useLoading();
      const [error, setError] = React.useState<string | null>(null);

      const fetchWithError = async () => {
        setLoading('fetch', true);
        try {
          throw new Error('Network error');
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
          setLoading('fetch', false);
        }
      };

      return (
        <div>
          <button onClick={fetchWithError} data-testid="error-button">
            Trigger Error
          </button>
          {error && <div data-testid="error" role="alert">{error}</div>}
        </div>
      );
    };

    render(
      <ErrorBoundary>
        <LoadingProvider>
          <ErrorComponent />
        </LoadingProvider>
      </ErrorBoundary>
    );

    const errorButton = screen.getByTestId('error-button');
    fireEvent.click(errorButton);

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('Network error');
    });
  });
});
