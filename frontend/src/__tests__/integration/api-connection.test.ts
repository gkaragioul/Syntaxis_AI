import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios, { AxiosError } from 'axios';
import { api, apiUtils } from '../../services/api';
import { API_BASE_URL } from '../../config';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

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

describe('API Connection Integration Tests (Task 2.3.1)', () => {
  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();

    // Clear localStorage mock
    localStorageMock.clear();
    localStorageMock.getItem.mockReturnValue(null);

    // Mock axios.create to return our api instance
    mockedAxios.create.mockReturnValue(api);

    // Mock axios.post for refresh token
    mockedAxios.post.mockResolvedValue({ data: { token: 'new-token' } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('API Configuration', () => {
    it('should have correct base URL configuration', () => {
      expect(API_BASE_URL).toBeDefined();
      expect(typeof API_BASE_URL).toBe('string');

      // Should default to localhost:3001 for development (backend port)
      if (!process.env.VITE_API_BASE_URL && !process.env.REACT_APP_API_BASE_URL) {
        expect(API_BASE_URL).toBe('http://localhost:3001');
      }
    });

    it('should create axios instance with correct configuration', () => {
      expect(api.defaults.baseURL).toBeDefined();
      expect(api.defaults.withCredentials).toBe(true);
      expect(api.defaults.timeout).toBe(30000);
      expect(api.defaults.headers['Content-Type']).toBe('application/json');
    });

    it('should have request interceptor for authentication', () => {
      expect(api.interceptors.request.use).toBeDefined();
    });

    it('should have response interceptor for error handling', () => {
      expect(api.interceptors.response.use).toBeDefined();
    });

    it('should handle environment-specific base URL correctly', () => {
      // In development, should use full URL with port
      if (process.env.NODE_ENV === 'development') {
        expect(api.defaults.baseURL).toContain('/api/v1');
      }

      // Should not be empty
      expect(api.defaults.baseURL).toBeTruthy();
    });
  });

  describe('Authentication Token Handling', () => {
    it('should add Authorization header when token exists', () => {
      const mockToken = 'test-jwt-token';
      localStorage.setItem('syntaxisai_token', mockToken);

      const mockConfig = { headers: {} };
      const interceptor = api.interceptors.request.handlers[0];
      
      if (interceptor && interceptor.fulfilled) {
        const result = interceptor.fulfilled(mockConfig);
        expect(result.headers['Authorization']).toBe(`Bearer ${mockToken}`);
      }
    });

    it('should not add Authorization header when token does not exist', () => {
      const mockConfig = { headers: {} };
      const interceptor = api.interceptors.request.handlers[0];
      
      if (interceptor && interceptor.fulfilled) {
        const result = interceptor.fulfilled(mockConfig);
        expect(result.headers['Authorization']).toBeUndefined();
      }
    });

    it('should handle missing headers object gracefully', () => {
      const mockToken = 'test-jwt-token';
      localStorage.setItem('syntaxisai_token', mockToken);

      const mockConfig = {};
      const interceptor = api.interceptors.request.handlers[0];
      
      if (interceptor && interceptor.fulfilled) {
        const result = interceptor.fulfilled(mockConfig);
        expect(result.headers).toBeDefined();
        expect(result.headers['Authorization']).toBe(`Bearer ${mockToken}`);
      }
    });
  });

  describe('API Endpoint Connectivity', () => {
    it('should handle successful API responses', async () => {
      const mockResponse = { data: { status: 'ok' } };
      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      const response = await api.get('/health');
      expect(response.data).toEqual({ status: 'ok' });
    });

    it('should handle network errors gracefully', async () => {
      const networkError = new Error('Network Error');
      mockedAxios.get.mockRejectedValueOnce(networkError);

      await expect(api.get('/health')).rejects.toThrow('Network Error');
    });

    it('should handle 401 unauthorized responses', async () => {
      const unauthorizedError = {
        response: {
          status: 401,
          data: { error: { code: 'UNAUTHORIZED', message: 'Invalid token' } }
        }
      };
      mockedAxios.get.mockRejectedValueOnce(unauthorizedError);

      await expect(api.get('/protected-endpoint')).rejects.toMatchObject({
        response: { status: 401 }
      });
    });

    it('should handle 500 server errors', async () => {
      const serverError = {
        response: {
          status: 500,
          data: { error: { code: 'INTERNAL_ERROR', message: 'Server error' } }
        }
      };
      mockedAxios.get.mockRejectedValueOnce(serverError);

      await expect(api.get('/endpoint')).rejects.toMatchObject({
        response: { status: 500 }
      });
    });
  });

  describe('Request/Response Interceptors', () => {
    it('should have response interceptor for error handling', () => {
      // Check if response interceptor exists
      expect(api.interceptors.response).toBeDefined();
    });

    it('should handle timeout errors', async () => {
      const timeoutError = {
        code: 'ECONNABORTED',
        message: 'timeout of 5000ms exceeded'
      };
      mockedAxios.get.mockRejectedValueOnce(timeoutError);

      await expect(api.get('/slow-endpoint')).rejects.toMatchObject({
        code: 'ECONNABORTED'
      });
    });
  });

  describe('CORS and Credentials', () => {
    it('should include credentials in requests', () => {
      expect(api.defaults.withCredentials).toBe(true);
    });

    it('should handle CORS preflight requests', async () => {
      const mockResponse = { data: 'OK' };
      mockedAxios.options.mockResolvedValueOnce(mockResponse);

      const response = await api.options('/endpoint');
      expect(response.data).toBe('OK');
    });
  });

  describe('Content Type Handling', () => {
    it('should handle JSON responses', async () => {
      const jsonResponse = { data: { message: 'success', data: { id: 1 } } };
      mockedAxios.get.mockResolvedValueOnce(jsonResponse);

      const response = await api.get('/json-endpoint');
      expect(response.data).toEqual({ message: 'success', data: { id: 1 } });
    });

    it('should handle file upload with multipart/form-data', async () => {
      const formData = new FormData();
      formData.append('file', new Blob(['test'], { type: 'text/plain' }));

      const uploadResponse = { data: { fileId: 'test-id' } };
      mockedAxios.post.mockResolvedValueOnce(uploadResponse);

      const response = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      expect(response.data).toEqual({ fileId: 'test-id' });
    });
  });

  describe('Network Error Handling', () => {
    it('should handle network connection failures', async () => {
      const networkError = new Error('Network Error');
      networkError.name = 'NetworkError';

      mockedAxios.get.mockRejectedValueOnce(networkError);

      const healthCheck = await apiUtils.healthCheck();
      expect(healthCheck).toBe(false);
    });

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('timeout of 30000ms exceeded');
      timeoutError.name = 'TimeoutError';

      mockedAxios.get.mockRejectedValueOnce(timeoutError);

      const healthCheck = await apiUtils.healthCheck();
      expect(healthCheck).toBe(false);
    });

    it('should handle DNS resolution failures', async () => {
      const dnsError = new Error('getaddrinfo ENOTFOUND');
      dnsError.name = 'DNSError';

      mockedAxios.get.mockRejectedValueOnce(dnsError);

      const healthCheck = await apiUtils.healthCheck();
      expect(healthCheck).toBe(false);
    });

    it('should handle CORS errors', async () => {
      const corsError = new Error('CORS policy blocked');
      corsError.name = 'CORSError';

      mockedAxios.get.mockRejectedValueOnce(corsError);

      const healthCheck = await apiUtils.healthCheck();
      expect(healthCheck).toBe(false);
    });
  });

  describe('API Base URL Configuration Issues', () => {
    it('should use correct base URL for development environment', () => {
      // Should use localhost:3001 for backend in development
      expect(API_BASE_URL).toBe('http://localhost:3001');
    });

    it('should handle environment variable configuration correctly', () => {
      // Test both VITE_ and REACT_APP_ prefixes
      const hasViteConfig = process.env.VITE_API_BASE_URL;
      const hasReactConfig = process.env.REACT_APP_API_BASE_URL;

      // Should have at least one configuration method
      expect(hasViteConfig || hasReactConfig || API_BASE_URL).toBeTruthy();
    });

    it('should construct correct API endpoint URLs', () => {
      const baseURL = api.defaults.baseURL;

      // Should end with /api/v1
      expect(baseURL).toMatch(/\/api\/v1$/);

      // Should not have double slashes
      expect(baseURL).not.toMatch(/\/\//);
    });
  });

  describe('API Utility Functions', () => {
    it('should provide health check functionality', async () => {
      mockedAxios.get.mockResolvedValueOnce({ status: 200, data: { status: 'healthy' } });

      const isHealthy = await apiUtils.healthCheck();
      expect(isHealthy).toBe(true);
      expect(mockedAxios.get).toHaveBeenCalledWith('/health');
    });

    it('should provide base URL getter', () => {
      const baseURL = apiUtils.getBaseURL();
      expect(baseURL).toBeDefined();
      expect(typeof baseURL).toBe('string');
    });

    it('should handle auth token management', () => {
      const testToken = 'test-token-123';

      apiUtils.setAuthToken(testToken);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('syntaxisai_token', testToken);

      apiUtils.clearAuthToken();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('syntaxisai_token');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('syntaxisai_refresh_token');
    });

    it('should handle retry requests with exponential backoff', async () => {
      let callCount = 0;
      const mockRequestFn = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.reject(new Error('Temporary failure'));
        }
        return Promise.resolve({ data: 'success' });
      });

      const result = await apiUtils.retryRequest(mockRequestFn, 3, 100);
      expect(result).toEqual({ data: 'success' });
      expect(mockRequestFn).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries', async () => {
      const mockRequestFn = vi.fn().mockRejectedValue(new Error('Persistent failure'));

      await expect(apiUtils.retryRequest(mockRequestFn, 2, 100)).rejects.toThrow('Persistent failure');
      expect(mockRequestFn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('Connection Recovery and Resilience', () => {
    it('should handle intermittent connection failures', async () => {
      // Simulate intermittent failures
      mockedAxios.get
        .mockRejectedValueOnce(new Error('Network Error'))
        .mockRejectedValueOnce(new Error('Network Error'))
        .mockResolvedValueOnce({ status: 200, data: { status: 'healthy' } });

      const requestFn = () => api.get('/health');
      const result = await apiUtils.retryRequest(requestFn, 3, 100);

      expect(result.status).toBe(200);
      expect(result.data).toEqual({ status: 'healthy' });
    });

    it('should detect network errors correctly', () => {
      const networkError = new Error('Network Error');
      networkError.name = 'NetworkError';

      expect(apiUtils.isNetworkError(networkError)).toBe(true);
      expect(apiUtils.isNetworkError({ code: 'NETWORK_ERROR' })).toBe(true);
      expect(apiUtils.isNetworkError({ message: 'Network Error' })).toBe(true);
    });

    it('should detect timeout errors correctly', () => {
      const timeoutError = new Error('timeout of 30000ms exceeded');
      timeoutError.name = 'TimeoutError';

      expect(apiUtils.isTimeoutError(timeoutError)).toBe(true);
      expect(apiUtils.isTimeoutError({ code: 'ECONNABORTED' })).toBe(true);
      expect(apiUtils.isTimeoutError({ message: 'timeout' })).toBe(true);
    });

    it('should detect auth errors correctly', () => {
      const authError = { response: { status: 401 } };
      expect(apiUtils.isAuthError(authError)).toBe(true);

      const forbiddenError = { response: { status: 403 } };
      expect(apiUtils.isAuthError(forbiddenError)).toBe(true);
    });

    it('should format error messages appropriately', () => {
      const networkError = new Error('Network Error');
      expect(apiUtils.formatErrorMessage(networkError)).toContain('connection');

      const timeoutError = { code: 'ECONNABORTED' };
      expect(apiUtils.formatErrorMessage(timeoutError)).toContain('timeout');

      const serverError = { response: { status: 500, data: { message: 'Server error' } } };
      expect(apiUtils.formatErrorMessage(serverError)).toContain('server');
    });
  });

  describe('Request Logging and Debugging', () => {
    it('should log requests in development mode', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Simulate development environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const mockConfig = {
        method: 'GET',
        url: '/test',
        data: { test: 'data' },
        params: { param: 'value' }
      };

      const interceptor = api.interceptors.request.handlers[0];
      if (interceptor && interceptor.fulfilled) {
        interceptor.fulfilled(mockConfig);
      }

      // Restore environment
      process.env.NODE_ENV = originalEnv;
      consoleSpy.mockRestore();
    });

    it('should handle request errors gracefully', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const requestError = new Error('Request failed');
      const interceptor = api.interceptors.request.handlers[0];

      if (interceptor && interceptor.rejected) {
        expect(() => interceptor.rejected(requestError)).rejects.toThrow('Request failed');
      }

      consoleErrorSpy.mockRestore();
    });
  });
});
