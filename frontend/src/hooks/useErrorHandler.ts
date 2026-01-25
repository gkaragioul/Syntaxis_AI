// @ts-nocheck
import { useState, useCallback, useEffect } from 'react';
import { ErrorCode, ErrorState, ErrorResponse } from '../types/errors';
import { apiUtils } from '../services/api';

interface UseErrorHandlerReturn {
  error: ErrorState | null;
  showError: (error: Omit<ErrorState, 'isVisible'>) => void;
  hideError: () => void;
  clearError: () => void;
  handleApiError: (apiError: any) => void;
  retryLastAction: () => Promise<void>;
  isRetrying: boolean;
  canRetry: boolean;
}

const initialState: ErrorState = {
  code: ErrorCode.UNKNOWN_ERROR,
  userMessage: '',
  nextSteps: '',
  helpUrl: '',
  logId: undefined,
  isVisible: false,
};

export const useErrorHandler = (): UseErrorHandlerReturn => {
  const [error, setError] = useState<ErrorState | null>(null);
  const [lastAction, setLastAction] = useState<(() => Promise<void>) | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [canRetry, setCanRetry] = useState(false);

  const showError = useCallback((newError: Omit<ErrorState, 'isVisible'>, retryAction?: () => Promise<void>) => {
    setError({
      ...newError,
      isVisible: true,
    });

    // Set retry action if provided
    if (retryAction) {
      setLastAction(() => retryAction);
      setCanRetry(true);
    } else {
      setCanRetry(false);
    }

    // Reset retry count
    setRetryCount(0);

    // Log error to console in development
    if (import.meta.env.MODE === 'development') {
      console.error('Application Error:', {
        code: newError.code,
        message: newError.userMessage,
        logId: newError.logId,
        retryable: !!retryAction,
      });
    }

    // Send error to monitoring service in production
    if (import.meta.env.MODE === 'production' && newError.logId) {
      // TODO: Integrate with error monitoring service (e.g., Sentry)
      console.error('Production Error:', {
        logId: newError.logId,
        code: newError.code,
        userAgent: navigator.userAgent,
        url: window.location.href,
      });
    }
  }, []);

  const hideError = useCallback(() => {
    if (error) {
      setError(prev => prev ? { ...prev, isVisible: false } : null);
    }
  }, [error]);

  const clearError = useCallback(() => {
    setError(null);
    setLastAction(null);
    setCanRetry(false);
    setRetryCount(0);
  }, []);

  // Retry last action with exponential backoff
  const retryLastAction = useCallback(async () => {
    if (!lastAction || !canRetry || isRetrying) {
      return;
    }

    setIsRetrying(true);

    try {
      // Exponential backoff delay
      const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
      if (retryCount > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      await lastAction();

      // Success - clear error
      clearError();
    } catch (retryError) {
      setRetryCount(prev => prev + 1);

      // Max retries reached
      if (retryCount >= 2) {
        setCanRetry(false);
        showError({
          code: ErrorCode.UNKNOWN_ERROR,
          userMessage: 'Multiple retry attempts failed. Please try again later.',
          nextSteps: 'Contact support if the problem persists',
          helpUrl: '',
        });
      } else {
        // Update error with retry information
        setError(prev => prev ? {
          ...prev,
          nextSteps: `Retry attempt ${retryCount + 1} failed. ${prev.nextSteps}`,
        } : null);
      }
    } finally {
      setIsRetrying(false);
    }
  }, [lastAction, canRetry, isRetrying, retryCount, clearError, showError]);

  // Enhanced API error handler with smart recovery
  const handleApiError = useCallback((apiError: any, retryAction?: () => Promise<void>) => {
    // Determine error type and appropriate response
    const isNetworkError = apiUtils.isNetworkError(apiError);
    const isTimeoutError = apiUtils.isTimeoutError(apiError);
    const isAuthError = apiUtils.isAuthError(apiError);

    // Format user-friendly error message
    const userMessage = apiUtils.formatErrorMessage(apiError);

    // Determine if error is retryable
    const isRetryable = isNetworkError || isTimeoutError || (apiError?.response?.status >= 500);

    if (apiError?.response?.data?.error) {
      const { error: apiErrorData } = apiError.response.data as ErrorResponse;
      showError({
        code: apiErrorData.code || ErrorCode.UNKNOWN_ERROR,
        userMessage: apiErrorData.userMessage || userMessage,
        nextSteps: apiErrorData.nextSteps || getNextSteps(apiError),
        helpUrl: apiErrorData.helpUrl || '',
        logId: apiErrorData.logId,
      }, isRetryable ? retryAction : undefined);
    } else {
      showError({
        code: getErrorCode(apiError),
        userMessage,
        nextSteps: getNextSteps(apiError),
        helpUrl: getHelpUrl(apiError),
      }, isRetryable ? retryAction : undefined);
    }

    // Handle auth errors specially
    if (isAuthError) {
      // Dispatch logout event
      window.dispatchEvent(new CustomEvent('auth:logout'));
    }
  }, [showError]);

  // Helper functions for error categorization
  const getErrorCode = (error: any): ErrorCode => {
    if (apiUtils.isNetworkError(error)) return ErrorCode.NETWORK_ERROR;
    if (apiUtils.isTimeoutError(error)) return ErrorCode.TIMEOUT_ERROR;
    if (apiUtils.isAuthError(error)) return ErrorCode.AUTHENTICATION_ERROR;
    if (error?.response?.status >= 500) return ErrorCode.SERVER_ERROR;
    if (error?.response?.status >= 400) return ErrorCode.CLIENT_ERROR;
    return ErrorCode.UNKNOWN_ERROR;
  };

  const getNextSteps = (error: any): string => {
    if (apiUtils.isNetworkError(error)) {
      return 'Check your internet connection and try again.';
    }
    if (apiUtils.isTimeoutError(error)) {
      return 'The request took too long. Please try again.';
    }
    if (apiUtils.isAuthError(error)) {
      return 'Please log in again to continue.';
    }
    if (error?.response?.status >= 500) {
      return 'Our servers are experiencing issues. Please try again in a few minutes.';
    }
    return 'Please try again or contact support if the problem persists.';
  };

  const getHelpUrl = (error: any): string => {
    if (apiUtils.isNetworkError(error)) {
      return '/help/connection-issues';
    }
    if (apiUtils.isAuthError(error)) {
      return '/help/login-issues';
    }
    return '/help/general';
  };

  // Auto-hide errors after a timeout (optional)
  useEffect(() => {
    if (error?.isVisible && !canRetry) {
      const timer = setTimeout(() => {
        hideError();
      }, 10000); // Auto-hide after 10 seconds if not retryable

      return () => clearTimeout(timer);
    }
  }, [error?.isVisible, canRetry, hideError]);

  return {
    error,
    showError,
    hideError,
    clearError,
    handleApiError,
    retryLastAction,
    isRetrying,
    canRetry,
  };
};

export default useErrorHandler; 