import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL } from '../config';

// Determine base URL based on environment
const isElectron = (): boolean => {
  try {
    // window.process.versions.electron is only present in Electron renderer
    return !!(typeof window !== 'undefined' && (window as any).process?.versions?.electron);
  } catch {
    return false;
  }
};

const getBaseURL = (): string => {
  const base = (API_BASE_URL || 'http://localhost:8000').replace(/\/+$/, '');

  // In development, use configured base
  if (import.meta.env.MODE === 'development') {
    return `${base}/api/v1`;
  }

  // In packaged Electron, talk to the embedded backend port
  if (isElectron()) {
    return 'http://localhost:8000/api/v1';
  }

  // Fallback for web hosting (same-origin)
  return '/api/v1';
};

// Create axios instance with enhanced configuration
export const api = axios.create({
  baseURL: getBaseURL(),
  withCredentials: true,
  timeout: 30000, // 30 seconds timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for authentication and request logging
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Add auth token if available
    const token = localStorage.getItem('syntaxisai_token');
    if (token) {
      config.headers = config.headers ?? {};
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    // Log request in development
    if (import.meta.env.MODE === 'development') {
      console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`, {
        data: config.data,
        params: config.params,
      });
    }

    return config;
  },
  (error) => {
    console.error('❌ Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling and response logging
api.interceptors.response.use(
  (response: AxiosResponse) => {
    // Log successful response in development
    if (import.meta.env.MODE === 'development') {
      console.log(`✅ API Response: ${response.config.method?.toUpperCase()} ${response.config.url}`, {
        status: response.status,
        data: response.data,
      });
    }

    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Log error in development
    if (import.meta.env.MODE === 'development') {
      console.error(`❌ API Error: ${originalRequest?.method?.toUpperCase()} ${originalRequest?.url}`, {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
    }

    // Handle 401 Unauthorized - token refresh logic
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Try to refresh token
        const refreshToken = localStorage.getItem('syntaxisai_refresh_token');
        if (refreshToken) {
          const response = await axios.post('/api/v1/auth/refresh', {
            refreshToken,
          });

          const { token } = response.data;
          localStorage.setItem('syntaxisai_token', token);

          // Retry original request with new token
          if (originalRequest.headers) {
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
          }

          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, redirect to login
        localStorage.removeItem('syntaxisai_token');
        localStorage.removeItem('syntaxisai_refresh_token');

        // Dispatch custom event for auth failure
        window.dispatchEvent(new CustomEvent('auth:logout'));

        return Promise.reject(refreshError);
      }
    }

    // Handle network errors
    if (!error.response) {
      const networkError = {
        ...error,
        message: 'Network error. Please check your internet connection.',
        code: 'NETWORK_ERROR',
      };
      return Promise.reject(networkError);
    }

    // Handle timeout errors
    if (error.code === 'ECONNABORTED') {
      const timeoutError = {
        ...error,
        message: 'Request timeout. Please try again.',
        code: 'TIMEOUT_ERROR',
      };
      return Promise.reject(timeoutError);
    }

    return Promise.reject(error);
  }
);

// Enhanced API utility functions
export const apiUtils = {
  // Check if API is reachable with retry logic
  async healthCheck(): Promise<boolean> {
    try {
      const response = await api.get('/health');
      return response.status === 200;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  },

  // Get API base URL for debugging
  getBaseURL(): string {
    return api.defaults.baseURL || '';
  },

  // Set auth token
  setAuthToken(token: string): void {
    localStorage.setItem('syntaxisai_token', token);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  },

  // Clear auth token
  clearAuthToken(): void {
    localStorage.removeItem('syntaxisai_token');
    localStorage.removeItem('syntaxisai_refresh_token');
    delete api.defaults.headers.common['Authorization'];
  },

  // Retry request with exponential backoff
  async retryRequest<T>(
    requestFn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error;

        // Don't retry on client errors (4xx) except 401
        if (error instanceof AxiosError &&
          error.response?.status !== undefined &&
          error.response.status >= 400 &&
          error.response.status < 500 &&
          error.response.status !== 401) {
          throw error;
        }

        // Don't retry on last attempt
        if (attempt === maxRetries) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));

        console.log(`Retrying request (attempt ${attempt + 2}/${maxRetries + 1}) after ${delay}ms`);
      }
    }

    throw lastError;
  },

  // Check if error is network-related
  isNetworkError(error: any): boolean {
    return !error.response && (
      error.code === 'NETWORK_ERROR' ||
      error.code === 'ECONNREFUSED' ||
      error.code === 'ENOTFOUND' ||
      error.message?.includes('Network Error') ||
      error.message?.includes('ERR_NETWORK')
    );
  },

  // Check if error is timeout-related
  isTimeoutError(error: any): boolean {
    return error.code === 'ECONNABORTED' ||
      error.message?.includes('timeout');
  },

  // Check if error is auth-related
  isAuthError(error: any): boolean {
    return error.response?.status === 401;
  },

  // Format error message for user display
  formatErrorMessage(error: any): string {
    if (this.isNetworkError(error)) {
      return 'Unable to connect to the server. Please check your internet connection and try again.';
    }

    if (this.isTimeoutError(error)) {
      return 'The request timed out. Please try again.';
    }

    if (error.response?.data?.message) {
      return error.response.data.message;
    }

    if (error.response?.status === 401) {
      return 'Your session has expired. Please log in again.';
    }

    if (error.response?.status === 403) {
      return 'You do not have permission to perform this action.';
    }

    if (error.response?.status === 404) {
      return 'The requested resource was not found.';
    }

    if (error.response?.status >= 500) {
      return 'A server error occurred. Please try again later.';
    }

    return error.message || 'An unexpected error occurred.';
  },

  // Get error code for categorization
  getErrorCode(error: any): string {
    if (this.isNetworkError(error)) return 'NETWORK_ERROR';
    if (this.isTimeoutError(error)) return 'TIMEOUT_ERROR';
    if (error.response?.status === 401) return 'UNAUTHORIZED';
    if (error.response?.status === 403) return 'FORBIDDEN';
    if (error.response?.status === 404) return 'NOT_FOUND';
    if (error.response?.status >= 500) return 'SERVER_ERROR';
    if (error.response?.status >= 400) return 'CLIENT_ERROR';
    return 'UNKNOWN_ERROR';
  },

  // Test API connectivity
  async testConnection(): Promise<{ success: boolean; latency?: number; error?: string }> {
    const startTime = Date.now();

    try {
      await this.healthCheck();
      const latency = Date.now() - startTime;
      return { success: true, latency };
    } catch (error) {
      return {
        success: false,
        error: this.formatErrorMessage(error)
      };
    }
  },

  // Validate API response structure
  validateResponse(response: any): boolean {
    return response &&
      typeof response === 'object' &&
      response.hasOwnProperty('data');
  },
};

// Export default api instance
export default api;