import React, { createContext, useContext, useState, useCallback } from 'react';

export interface LoadingState {
  isLoading: boolean;
  message?: string;
  progress?: number;
}

export interface LoadingContextType {
  isLoading: boolean;
  loadingStates: Record<string, LoadingState>;
  setLoading: (key: string, loading: boolean, message?: string) => void;
  setProgress: (key: string, progress: number) => void;
  addLoadingState: (key: string, state: Partial<LoadingState>) => void;
  removeLoadingState: (key: string) => void;
  clearAllLoading: () => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export const LoadingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loadingStates, setLoadingStates] = useState<Record<string, LoadingState>>({});

  const isLoading = Object.values(loadingStates).some(state => state.isLoading);

  const setLoading = useCallback((key: string, loading: boolean, message?: string) => {
    setLoadingStates(prev => {
      if (!loading) {
        const { [key]: removed, ...rest } = prev;
        return rest;
      }
      return {
        ...prev,
        [key]: { isLoading: loading, message },
      };
    });
  }, []);

  const setProgress = useCallback((key: string, progress: number) => {
    setLoadingStates(prev => ({
      ...prev,
      [key]: { ...prev[key], isLoading: true, progress },
    }));
  }, []);

  const addLoadingState = useCallback((key: string, state: Partial<LoadingState>) => {
    setLoadingStates(prev => ({
      ...prev,
      [key]: { isLoading: true, ...state },
    }));
  }, []);

  const removeLoadingState = useCallback((key: string) => {
    setLoadingStates(prev => {
      const { [key]: removed, ...rest } = prev;
      return rest;
    });
  }, []);

  const clearAllLoading = useCallback(() => {
    setLoadingStates({});
  }, []);

  const contextValue: LoadingContextType = {
    isLoading,
    loadingStates,
    setLoading,
    setProgress,
    addLoadingState,
    removeLoadingState,
    clearAllLoading,
  };

  return (
    <LoadingContext.Provider value={contextValue}>
      {children}
    </LoadingContext.Provider>
  );
};

export const useLoading = (): LoadingContextType => {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
};
