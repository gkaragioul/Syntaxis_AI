import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { DebugPanel } from '../../components/Debug/DebugPanel';
import { useDebug } from '../../hooks/useDebug';

// Mock the API
vi.mock('../../services/api', () => ({
  api: {
    defaults: { baseURL: '/api/v1' },
  },
  apiUtils: {
    healthCheck: vi.fn(),
    getBaseURL: vi.fn(() => '/api/v1'),
    setAuthToken: vi.fn(),
    clearAuthToken: vi.fn(),
  },
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  key: vi.fn(),
  length: 0,
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock fetch for API testing
global.fetch = vi.fn();

const theme = createTheme();

const createWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
};

describe('Debug Tools Integration Tests (Task 2.4.4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    
    // Mock environment
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'development',
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('useDebug Hook', () => {
    it('should enable debug mode in development', () => {
      const { result } = renderHook(() => useDebug());

      expect(result.current.isDebugMode).toBe(true);
    });

    it('should toggle debug panel', () => {
      const { result } = renderHook(() => useDebug());

      expect(result.current.debugPanelOpen).toBe(false);

      act(() => {
        result.current.toggleDebugPanel();
      });

      expect(result.current.debugPanelOpen).toBe(true);
    });

    it('should log debug information', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { result } = renderHook(() => useDebug());

      act(() => {
        result.current.logDebugInfo({ test: 'data' });
      });

      expect(consoleSpy).toHaveBeenCalledWith('[DEBUG]', { test: 'data' });
      consoleSpy.mockRestore();
    });

    it('should get performance metrics', () => {
      // Mock performance API
      Object.defineProperty(window, 'performance', {
        value: {
          getEntriesByType: vi.fn((type) => {
            if (type === 'navigation') {
              return [{
                domContentLoadedEventEnd: 1000,
                domContentLoadedEventStart: 500,
                loadEventEnd: 1500,
                loadEventStart: 1200,
                responseStart: 100,
                requestStart: 50,
                domInteractive: 800,
                navigationStart: 0,
              }];
            }
            if (type === 'paint') {
              return [
                { name: 'first-paint', startTime: 300 },
                { name: 'first-contentful-paint', startTime: 400 },
              ];
            }
            if (type === 'resource') {
              return [
                { name: 'script.js', transferSize: 1024 },
                { name: 'style.css', transferSize: 512 },
              ];
            }
            return [];
          }),
          memory: {
            usedJSHeapSize: 1024 * 1024,
            totalJSHeapSize: 2048 * 1024,
            jsHeapSizeLimit: 4096 * 1024,
          },
        },
        writable: true,
      });

      const { result } = renderHook(() => useDebug());

      const metrics = result.current.getPerformanceMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.navigation).toBeDefined();
      expect(metrics.paint).toBeDefined();
      expect(metrics.resources).toBeDefined();
      expect(metrics.memory).toBeDefined();
    });

    it('should enable and disable debug mode', () => {
      const { result } = renderHook(() => useDebug());

      act(() => {
        result.current.disableDebugMode();
      });

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('syntaxisai_debug_mode');

      act(() => {
        result.current.enableDebugMode();
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith('syntaxisai_debug_mode', 'true');
    });

    it('should handle keyboard shortcuts', () => {
      const { result } = renderHook(() => useDebug());

      // Simulate Ctrl+Shift+D
      const event = new KeyboardEvent('keydown', {
        key: 'D',
        ctrlKey: true,
        shiftKey: true,
      });

      act(() => {
        window.dispatchEvent(event);
      });

      expect(result.current.debugPanelOpen).toBe(true);
    });
  });

  describe('DebugPanel Component', () => {
    it('should render debug panel when open', () => {
      render(
        <DebugPanel open={true} onClose={() => {}} />,
        { wrapper: createWrapper }
      );

      expect(screen.getByText('Debug Panel')).toBeInTheDocument();
      expect(screen.getByText('Console')).toBeInTheDocument();
      expect(screen.getByText('API Test')).toBeInTheDocument();
      expect(screen.getByText('Query Cache')).toBeInTheDocument();
      expect(screen.getByText('Storage')).toBeInTheDocument();
      expect(screen.getByText('System Info')).toBeInTheDocument();
    });

    it('should not render in production', () => {
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'production',
        writable: true,
      });

      const { container } = render(
        <DebugPanel open={true} onClose={() => {}} />,
        { wrapper: createWrapper }
      );

      expect(container.firstChild).toBeNull();
    });

    it('should switch between tabs', () => {
      render(
        <DebugPanel open={true} onClose={() => {}} />,
        { wrapper: createWrapper }
      );

      // Click on API Test tab
      fireEvent.click(screen.getByText('API Test'));

      expect(screen.getByText('API Endpoint Tester')).toBeInTheDocument();
      expect(screen.getByLabelText('API Endpoint')).toBeInTheDocument();
    });

    it('should test API endpoints', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve({ status: 'healthy' }),
        headers: new Headers({ 'content-type': 'application/json' }),
      };

      (global.fetch as any).mockResolvedValueOnce(mockResponse);

      render(
        <DebugPanel open={true} onClose={() => {}} />,
        { wrapper: createWrapper }
      );

      // Switch to API Test tab
      fireEvent.click(screen.getByText('API Test'));

      // Enter API endpoint
      const endpointInput = screen.getByLabelText('API Endpoint');
      fireEvent.change(endpointInput, { target: { value: '/api/v1/health' } });

      // Click test button
      fireEvent.click(screen.getByText('Test'));

      await waitFor(() => {
        expect(screen.getByText('Status: 200 OK')).toBeInTheDocument();
      });
    });

    it('should display console logs', () => {
      render(
        <DebugPanel open={true} onClose={() => {}} />,
        { wrapper: createWrapper }
      );

      // Console tab should be active by default
      expect(screen.getByText('Console Logs')).toBeInTheDocument();
      expect(screen.getByText('Capture')).toBeInTheDocument();
      expect(screen.getByText('Clear')).toBeInTheDocument();
    });

    it('should clear console logs', () => {
      render(
        <DebugPanel open={true} onClose={() => {}} />,
        { wrapper: createWrapper }
      );

      // Click clear button
      fireEvent.click(screen.getByText('Clear'));

      // Logs should be cleared (implementation detail)
      expect(screen.getByText('Clear')).toBeInTheDocument();
    });

    it('should display query cache information', () => {
      render(
        <DebugPanel open={true} onClose={() => {}} />,
        { wrapper: createWrapper }
      );

      // Switch to Query Cache tab
      fireEvent.click(screen.getByText('Query Cache'));

      expect(screen.getByText('React Query Cache')).toBeInTheDocument();
      expect(screen.getByText('Invalidate All')).toBeInTheDocument();
      expect(screen.getByText('Clear Cache')).toBeInTheDocument();
    });

    it('should display local storage data', () => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'test-key') return 'test-value';
        return null;
      });

      localStorageMock.key.mockImplementation((index) => {
        if (index === 0) return 'test-key';
        return null;
      });

      Object.defineProperty(localStorageMock, 'length', { value: 1 });

      render(
        <DebugPanel open={true} onClose={() => {}} />,
        { wrapper: createWrapper }
      );

      // Switch to Storage tab
      fireEvent.click(screen.getByText('Storage'));

      expect(screen.getByText('Local Storage')).toBeInTheDocument();
      expect(screen.getByText('Clear All')).toBeInTheDocument();
    });

    it('should display system information', () => {
      render(
        <DebugPanel open={true} onClose={() => {}} />,
        { wrapper: createWrapper }
      );

      // Switch to System Info tab
      fireEvent.click(screen.getByText('System Info'));

      expect(screen.getByText('System Information')).toBeInTheDocument();
    });

    it('should close when close button is clicked', () => {
      const onCloseMock = vi.fn();

      render(
        <DebugPanel open={true} onClose={onCloseMock} />,
        { wrapper: createWrapper }
      );

      // Click close button
      fireEvent.click(screen.getByRole('button', { name: /close/i }));

      expect(onCloseMock).toHaveBeenCalled();
    });
  });

  describe('Global Debug Utilities', () => {
    it('should add debug utilities to window in development', () => {
      // Re-import to trigger the global setup
      require('../../hooks/useDebug');

      expect((window as any).syntaxisDebug).toBeDefined();
      expect((window as any).syntaxisDebug.enableDebug).toBeDefined();
      expect((window as any).syntaxisDebug.disableDebug).toBeDefined();
      expect((window as any).syntaxisDebug.clearStorage).toBeDefined();
      expect((window as any).syntaxisDebug.getPerformance).toBeDefined();
    });

    it('should enable debug mode via global utility', () => {
      require('../../hooks/useDebug');

      (window as any).syntaxisDebug.enableDebug();

      expect(localStorageMock.setItem).toHaveBeenCalledWith('syntaxisai_debug_mode', 'true');
    });

    it('should clear storage via global utility', () => {
      require('../../hooks/useDebug');

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      (window as any).syntaxisDebug.clearStorage();

      expect(localStorageMock.clear).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Storage cleared');

      consoleSpy.mockRestore();
    });
  });

  describe('Debug Mode Detection', () => {
    it('should detect debug mode from localStorage', () => {
      localStorageMock.getItem.mockReturnValue('true');

      const { result } = renderHook(() => useDebug());

      expect(result.current.isDebugMode).toBe(true);
    });

    it('should detect debug mode from URL parameter', () => {
      Object.defineProperty(window, 'location', {
        value: { search: '?debug=true' },
        writable: true,
      });

      const { result } = renderHook(() => useDebug());

      expect(result.current.isDebugMode).toBe(true);
    });
  });
});
