import React, { createContext, useContext, ReactNode } from 'react';
import useErrorHandler from '../hooks/useErrorHandler';
import ErrorDisplay from '../components/ErrorDisplay';
import { ErrorState } from '../types/errors';

interface ErrorContextType {
  showError: (error: Omit<ErrorState, 'isVisible'>) => void;
  hideError: () => void;
  clearError: () => void;
  handleApiError: (apiError: any) => void;
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined);

interface ErrorProviderProps {
  children: ReactNode;
}

export const ErrorProvider: React.FC<ErrorProviderProps> = ({ children }) => {
  const { error, showError, hideError, clearError, handleApiError } = useErrorHandler();

  return (
    <ErrorContext.Provider
      value={{
        showError,
        hideError,
        clearError,
        handleApiError,
      }}
    >
      {children}
      {error?.isVisible && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 9999, maxWidth: '500px' }}>
          <ErrorDisplay
            error={{
              code: error.code,
              userMessage: error.userMessage,
              nextSteps: error.nextSteps,
              helpUrl: error.helpUrl,
              logId: error.logId,
            }}
            onClose={hideError}
          />
        </div>
      )}
    </ErrorContext.Provider>
  );
};

export const useError = () => {
  const context = useContext(ErrorContext);
  if (context === undefined) {
    throw new Error('useError must be used within an ErrorProvider');
  }
  return context;
};

export default ErrorProvider; 