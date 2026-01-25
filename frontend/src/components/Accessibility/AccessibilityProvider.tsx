import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface AccessibilitySettings {
  highContrast: boolean;
  reducedMotion: boolean;
  fontSize: 'small' | 'medium' | 'large' | 'extra-large';
  screenReaderMode: boolean;
  keyboardNavigation: boolean;
}

export interface FocusManagement {
  trapFocus: (containerId: string) => void;
  restoreFocus: () => void;
  setFocusableElements: (elements: HTMLElement[]) => void;
}

export interface AccessibilityContextType extends AccessibilitySettings {
  toggleHighContrast: () => void;
  toggleReducedMotion: () => void;
  setFontSize: (size: AccessibilitySettings['fontSize']) => void;
  toggleScreenReaderMode: () => void;
  announceToScreenReader: (message: string, priority?: 'polite' | 'assertive') => void;
  focusManagement: FocusManagement;
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

const STORAGE_KEY = 'accessibility-settings';

export const AccessibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AccessibilitySettings>(() => {
    // Load from localStorage
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return { ...getDefaultSettings(), ...JSON.parse(saved) };
      } catch {
        return getDefaultSettings();
      }
    }
    return getDefaultSettings();
  });

  const [previousFocus, setPreviousFocus] = useState<HTMLElement | null>(null);
  const [ariaLiveRegion, setAriaLiveRegion] = useState<HTMLElement | null>(null);

  // Detect system preferences
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches && !localStorage.getItem(STORAGE_KEY)) {
      setSettings(prev => ({ ...prev, reducedMotion: true }));
    }

    const handleChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setSettings(prev => ({ ...prev, reducedMotion: true }));
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Create aria-live region for screen reader announcements
  useEffect(() => {
    const region = document.createElement('div');
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('aria-atomic', 'true');
    region.style.position = 'absolute';
    region.style.left = '-10000px';
    region.style.width = '1px';
    region.style.height = '1px';
    region.style.overflow = 'hidden';
    document.body.appendChild(region);
    setAriaLiveRegion(region);

    return () => {
      if (document.body.contains(region)) {
        document.body.removeChild(region);
      }
    };
  }, []);

  // Apply CSS classes based on settings
  useEffect(() => {
    const root = document.documentElement;
    
    // High contrast
    if (settings.highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }

    // Reduced motion
    if (settings.reducedMotion) {
      root.classList.add('reduced-motion');
    } else {
      root.classList.remove('reduced-motion');
    }

    // Font size
    root.classList.remove('font-small', 'font-medium', 'font-large', 'font-extra-large');
    root.classList.add(`font-${settings.fontSize}`);

    // Screen reader mode
    if (settings.screenReaderMode) {
      root.classList.add('screen-reader-mode');
    } else {
      root.classList.remove('screen-reader-mode');
    }
  }, [settings]);

  // Save to localStorage when settings change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const toggleHighContrast = useCallback(() => {
    setSettings(prev => ({ ...prev, highContrast: !prev.highContrast }));
  }, []);

  const toggleReducedMotion = useCallback(() => {
    setSettings(prev => ({ ...prev, reducedMotion: !prev.reducedMotion }));
  }, []);

  const setFontSize = useCallback((size: AccessibilitySettings['fontSize']) => {
    setSettings(prev => ({ ...prev, fontSize: size }));
  }, []);

  const toggleScreenReaderMode = useCallback(() => {
    setSettings(prev => ({ ...prev, screenReaderMode: !prev.screenReaderMode }));
  }, []);

  const announceToScreenReader = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (ariaLiveRegion) {
      ariaLiveRegion.setAttribute('aria-live', priority);
      ariaLiveRegion.textContent = message;
      
      // Clear after announcement
      setTimeout(() => {
        ariaLiveRegion.textContent = '';
      }, 1000);
    }
  }, [ariaLiveRegion]);

  const focusManagement: FocusManagement = {
    trapFocus: useCallback((containerId: string) => {
      const container = document.getElementById(containerId);
      if (!container) return;

      // Store current focus
      setPreviousFocus(document.activeElement as HTMLElement);

      // Focus the container
      container.focus();

      const focusableElements = container.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      if (focusableElements.length > 0) {
        (focusableElements[0] as HTMLElement).focus();
      }
    }, []),

    restoreFocus: useCallback(() => {
      if (previousFocus) {
        previousFocus.focus();
        setPreviousFocus(null);
      }
    }, [previousFocus]),

    setFocusableElements: useCallback((elements: HTMLElement[]) => {
      // Implementation for managing focusable elements
      elements.forEach(element => {
        element.setAttribute('tabindex', '0');
      });
    }, []),
  };

  const contextValue: AccessibilityContextType = {
    ...settings,
    toggleHighContrast,
    toggleReducedMotion,
    setFontSize,
    toggleScreenReaderMode,
    announceToScreenReader,
    focusManagement,
  };

  return (
    <AccessibilityContext.Provider value={contextValue}>
      {children}
    </AccessibilityContext.Provider>
  );
};

export const useAccessibility = (): AccessibilityContextType => {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
};

function getDefaultSettings(): AccessibilitySettings {
  return {
    highContrast: false,
    reducedMotion: false,
    fontSize: 'medium',
    screenReaderMode: false,
    keyboardNavigation: true,
  };
}
