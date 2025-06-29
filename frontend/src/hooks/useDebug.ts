import { useState, useEffect, useCallback } from 'react';

interface DebugInfo {
  isDebugMode: boolean;
  debugPanelOpen: boolean;
  toggleDebugPanel: () => void;
  logDebugInfo: (info: any) => void;
  getPerformanceMetrics: () => any;
  enableDebugMode: () => void;
  disableDebugMode: () => void;
}

export const useDebug = (): DebugInfo => {
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [debugPanelOpen, setDebugPanelOpen] = useState(false);

  // Check if debug mode should be enabled
  useEffect(() => {
    const shouldEnableDebug = 
      process.env.NODE_ENV === 'development' ||
      localStorage.getItem('syntaxisai_debug_mode') === 'true' ||
      window.location.search.includes('debug=true');

    setIsDebugMode(shouldEnableDebug);

    // Add keyboard shortcut to toggle debug panel (Ctrl+Shift+D)
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'D') {
        event.preventDefault();
        setDebugPanelOpen(prev => !prev);
      }
    };

    if (shouldEnableDebug) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const toggleDebugPanel = useCallback(() => {
    setDebugPanelOpen(prev => !prev);
  }, []);

  const logDebugInfo = useCallback((info: any) => {
    if (isDebugMode) {
      console.log('[DEBUG]', info);
    }
  }, [isDebugMode]);

  const getPerformanceMetrics = useCallback(() => {
    if (!isDebugMode) return null;

    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const paint = performance.getEntriesByType('paint');
    const resources = performance.getEntriesByType('resource');

    return {
      navigation: {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        firstByte: navigation.responseStart - navigation.requestStart,
        domInteractive: navigation.domInteractive - navigation.navigationStart,
      },
      paint: paint.reduce((acc, entry) => {
        acc[entry.name] = entry.startTime;
        return acc;
      }, {} as Record<string, number>),
      resources: {
        total: resources.length,
        scripts: resources.filter(r => r.name.includes('.js')).length,
        stylesheets: resources.filter(r => r.name.includes('.css')).length,
        images: resources.filter(r => r.name.match(/\.(jpg|jpeg|png|gif|svg|webp)$/)).length,
        totalSize: resources.reduce((acc, r) => acc + (r.transferSize || 0), 0),
      },
      memory: (performance as any).memory ? {
        usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
        totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
        jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit,
      } : null,
    };
  }, [isDebugMode]);

  const enableDebugMode = useCallback(() => {
    setIsDebugMode(true);
    localStorage.setItem('syntaxisai_debug_mode', 'true');
  }, []);

  const disableDebugMode = useCallback(() => {
    setIsDebugMode(false);
    setDebugPanelOpen(false);
    localStorage.removeItem('syntaxisai_debug_mode');
  }, []);

  return {
    isDebugMode,
    debugPanelOpen,
    toggleDebugPanel,
    logDebugInfo,
    getPerformanceMetrics,
    enableDebugMode,
    disableDebugMode,
  };
};

// Global debug utilities (only available in development)
if (process.env.NODE_ENV === 'development') {
  // Add debug utilities to window object for console access
  (window as any).syntaxisDebug = {
    enableDebug: () => {
      localStorage.setItem('syntaxisai_debug_mode', 'true');
      window.location.reload();
    },
    disableDebug: () => {
      localStorage.removeItem('syntaxisai_debug_mode');
      window.location.reload();
    },
    clearStorage: () => {
      localStorage.clear();
      sessionStorage.clear();
      console.log('Storage cleared');
    },
    getPerformance: () => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        loadTime: navigation.loadEventEnd - navigation.navigationStart,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.navigationStart,
        firstByte: navigation.responseStart - navigation.requestStart,
      };
    },
    logApiCalls: () => {
      // This would integrate with the API service to log all calls
      console.log('API call logging enabled');
    },
  };

  console.log('🐛 Debug utilities available at window.syntaxisDebug');
  console.log('🔧 Press Ctrl+Shift+D to toggle debug panel');
}

export default useDebug;
