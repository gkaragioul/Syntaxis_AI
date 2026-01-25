import { useCallback } from 'react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

// Simple in-memory toast store
const toastListeners: Set<(toast: Toast) => void> = new Set();
let toastId = 0;

export const useToast = () => {
  const showToast = useCallback((message: string, type: ToastType = 'info', duration = 3000) => {
    const id = `toast-${++toastId}`;
    const toast: Toast = { id, message, type, duration };
    
    // Notify all listeners
    toastListeners.forEach(listener => listener(toast));
    
    // Auto-remove after duration
    if (duration > 0) {
      setTimeout(() => {
        toastListeners.forEach(listener => listener({ ...toast, message: '' }));
      }, duration);
    }
    
    return id;
  }, []);

  const showSuccess = useCallback((message: string, duration?: number) => {
    return showToast(message, 'success', duration);
  }, [showToast]);

  const showError = useCallback((message: string, duration?: number) => {
    return showToast(message, 'error', duration);
  }, [showToast]);

  const showWarning = useCallback((message: string, duration?: number) => {
    return showToast(message, 'warning', duration);
  }, [showToast]);

  const showInfo = useCallback((message: string, duration?: number) => {
    return showToast(message, 'info', duration);
  }, [showToast]);

  return {
    showToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
  };
};

export const useToastListener = (callback: (toast: Toast) => void) => {
  toastListeners.add(callback);
  return () => {
    toastListeners.delete(callback);
  };
};

