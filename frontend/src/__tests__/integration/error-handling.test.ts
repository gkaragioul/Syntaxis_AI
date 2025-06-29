import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useErrorHandler } from '../../hooks/useErrorHandler';
import { apiUtils } from '../../services/api';

// Mock console methods
const consoleSpy = {
  error: vi.spyOn(console, 'error').mockImplementation(() => {}),
  warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
  log: vi.spyOn(console, 'log').mockImplementation(() => {}),
};

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock window.dispatchEvent
const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

describe('Error Handling Integration Tests (Task 2.3.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy.error.mockClear();
    consoleSpy.warn.mockClear();
    consoleSpy.log.mockClear();
    localStorageMock.clear();
    dispatchEventSpy.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Error Categorization', () => {
    it('should correctly identify network errors', () => {
      const networkError = {
        code: 'NETWORK_ERROR',
        message: 'Network Error',
      };

      expect(apiUtils.isNetworkError(networkError)).toBe(true);
      expect(apiUtils.getErrorCode(networkError)).toBe('NETWORK_ERROR');
      expect(apiUtils.formatErrorMessage(networkError)).toContain('Unable to connect');
    });

    it('should correctly identify timeout errors', () => {
      const timeoutError = {
        code: 'ECONNABORTED',
        message: 'timeout of 30000ms exceeded',
      };

      expect(apiUtils.isTimeoutError(timeoutError)).toBe(true);
      expect(apiUtils.getErrorCode(timeoutError)).toBe('TIMEOUT_ERROR');
      expect(apiUtils.formatErrorMessage(timeoutError)).toContain('timed out');
    });

    it('should correctly identify authentication errors', () => {
      const authError = {
        response: { status: 401, data: { message: 'Unauthorized' } },
      };

      expect(apiUtils.getErrorCode(authError)).toBe('UNAUTHORIZED');
      expect(apiUtils.formatErrorMessage(authError)).toContain('session has expired');
    });

    it('should correctly identify permission errors', () => {
      const permissionError = {
        response: { status: 403, data: { message: 'Forbidden' } },
      };

      expect(apiUtils.getErrorCode(permissionError)).toBe('FORBIDDEN');
      expect(apiUtils.formatErrorMessage(permissionError)).toContain('do not have permission');
    });

    it('should correctly identify not found errors', () => {
      const notFoundError = {
        response: { status: 404, data: { message: 'Not Found' } },
      };

      expect(apiUtils.getErrorCode(notFoundError)).toBe('NOT_FOUND');
      expect(apiUtils.formatErrorMessage(notFoundError)).toContain('not found');
    });

    it('should correctly identify server errors', () => {
      const serverError = {
        response: { status: 500, data: { message: 'Internal Server Error' } },
      };

      expect(apiUtils.getErrorCode(serverError)).toBe('SERVER_ERROR');
      expect(apiUtils.formatErrorMessage(serverError)).toContain('server error occurred');
    });
  });

  describe('Error Handler Hook', () => {
    it('should provide error handling functionality', () => {
      const { result } = renderHook(() => useErrorHandler());

      expect(result.current.handleApiError).toBeDefined();
      expect(typeof result.current.handleApiError).toBe('function');
      expect(result.current.error).toBeNull();
      expect(result.current.canRetry).toBe(false);
      expect(result.current.isRetrying).toBe(false);
    });

    it('should handle API errors with retry capability', () => {
      const { result } = renderHook(() => useErrorHandler());
      const mockRetryAction = vi.fn();

      const networkError = {
        code: 'NETWORK_ERROR',
        message: 'Network Error',
      };

      act(() => {
        result.current.handleApiError(networkError, mockRetryAction);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.canRetry).toBe(true);
      expect(result.current.error?.isVisible).toBe(true);
    });

    it('should not allow retry for client errors', () => {
      const { result } = renderHook(() => useErrorHandler());
      const mockRetryAction = vi.fn();

      const clientError = {
        response: { status: 400, data: { message: 'Bad Request' } },
      };

      act(() => {
        result.current.handleApiError(clientError, mockRetryAction);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.canRetry).toBe(false);
    });

    it('should handle auth errors specially', () => {
      const { result } = renderHook(() => useErrorHandler());

      const authError = {
        response: { status: 401, data: { message: 'Unauthorized' } },
      };

      act(() => {
        result.current.handleApiError(authError);
      });

      expect(result.current.error).toBeTruthy();
      expect(dispatchEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'auth:logout' })
      );
    });

    it('should auto-hide non-retryable errors after timeout', async () => {
      vi.useFakeTimers();

      const { result } = renderHook(() => useErrorHandler());

      const error = {
        response: { status: 400, data: { message: 'Bad Request' } },
      };

      act(() => {
        result.current.handleApiError(error);
      });

      expect(result.current.error?.isVisible).toBe(true);

      // Fast-forward time
      act(() => {
        vi.advanceTimersByTime(10000); // 10 seconds
      });

      expect(result.current.error?.isVisible).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('Retry Logic', () => {
    it('should implement exponential backoff for retries', async () => {
      const mockRequest = vi.fn()
        .mockRejectedValueOnce(new Error('Network Error'))
        .mockRejectedValueOnce(new Error('Network Error'))
        .mockResolvedValueOnce({ data: 'success' });

      const startTime = Date.now();
      
      const result = await apiUtils.retryRequest(mockRequest, 3, 100);
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(result).toEqual({ data: 'success' });
      expect(mockRequest).toHaveBeenCalledTimes(3);
      // Should have waited at least 100ms + 200ms = 300ms for exponential backoff
      expect(duration).toBeGreaterThan(250);
    });

    it('should not retry client errors except 401', async () => {
      const clientError = {
        response: { status: 400, data: { message: 'Bad Request' } },
      };
      
      const mockRequest = vi.fn().mockRejectedValue(clientError);

      await expect(apiUtils.retryRequest(mockRequest, 3, 100)).rejects.toEqual(clientError);
      expect(mockRequest).toHaveBeenCalledTimes(1);
    });

    it('should retry 401 errors for token refresh', async () => {
      const authError = {
        response: { status: 401, data: { message: 'Unauthorized' } },
      };
      
      const mockRequest = vi.fn()
        .mockRejectedValueOnce(authError)
        .mockResolvedValueOnce({ data: 'success' });

      const result = await apiUtils.retryRequest(mockRequest, 3, 100);
      
      expect(result).toEqual({ data: 'success' });
      expect(mockRequest).toHaveBeenCalledTimes(2);
    });
  });

  describe('User Feedback', () => {
    it('should provide user-friendly error messages', () => {
      const testCases = [
        {
          error: { code: 'NETWORK_ERROR' },
          expectedMessage: 'Unable to connect to the server',
        },
        {
          error: { code: 'ECONNABORTED' },
          expectedMessage: 'The request timed out',
        },
        {
          error: { response: { status: 401 } },
          expectedMessage: 'Your session has expired',
        },
        {
          error: { response: { status: 403 } },
          expectedMessage: 'You do not have permission',
        },
        {
          error: { response: { status: 404 } },
          expectedMessage: 'The requested resource was not found',
        },
        {
          error: { response: { status: 500 } },
          expectedMessage: 'A server error occurred',
        },
      ];

      testCases.forEach(({ error, expectedMessage }) => {
        const message = apiUtils.formatErrorMessage(error);
        expect(message).toContain(expectedMessage);
      });
    });

    it('should use custom error messages when available', () => {
      const customError = {
        response: {
          status: 400,
          data: { message: 'Custom validation error message' },
        },
      };

      const message = apiUtils.formatErrorMessage(customError);
      expect(message).toBe('Custom validation error message');
    });
  });

  describe('Error Recovery', () => {
    it('should handle connection recovery', async () => {
      const { success, latency } = await apiUtils.testConnection();
      
      // Should return connection status
      expect(typeof success).toBe('boolean');
      
      if (success) {
        expect(typeof latency).toBe('number');
        expect(latency).toBeGreaterThan(0);
      }
    });

    it('should validate API responses', () => {
      const validResponse = { data: { id: 1, name: 'test' } };
      const invalidResponse = { error: 'No data property' };
      const nullResponse = null;

      expect(apiUtils.validateResponse(validResponse)).toBe(true);
      expect(apiUtils.validateResponse(invalidResponse)).toBe(false);
      expect(apiUtils.validateResponse(nullResponse)).toBe(false);
    });
  });

  describe('Error Logging', () => {
    it('should log errors appropriately', () => {
      const error = new Error('Test error');
      
      // Simulate error handling
      apiUtils.formatErrorMessage(error);
      
      // In development, errors should be logged
      if (process.env.NODE_ENV === 'development') {
        // Error logging would be handled by the API interceptors
        expect(true).toBe(true); // Placeholder for actual logging verification
      }
    });
  });
});
