import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AccessibilityProvider, useAccessibility } from '../../components/Accessibility/AccessibilityProvider';
import { axe, toHaveNoViolations } from 'jest-axe';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Test component to use the accessibility context
const TestComponent: React.FC = () => {
  const {
    highContrast,
    reducedMotion,
    fontSize,
    screenReaderMode,
    keyboardNavigation,
    toggleHighContrast,
    toggleReducedMotion,
    setFontSize,
    toggleScreenReaderMode,
    announceToScreenReader,
  } = useAccessibility();

  return (
    <div>
      <div data-testid="high-contrast">{highContrast ? 'enabled' : 'disabled'}</div>
      <div data-testid="reduced-motion">{reducedMotion ? 'enabled' : 'disabled'}</div>
      <div data-testid="font-size">{fontSize}</div>
      <div data-testid="screen-reader">{screenReaderMode ? 'enabled' : 'disabled'}</div>
      <div data-testid="keyboard-nav">{keyboardNavigation ? 'enabled' : 'disabled'}</div>
      
      <button onClick={toggleHighContrast} data-testid="toggle-contrast">
        Toggle High Contrast
      </button>
      <button onClick={toggleReducedMotion} data-testid="toggle-motion">
        Toggle Reduced Motion
      </button>
      <button onClick={() => setFontSize('large')} data-testid="set-large-font">
        Large Font
      </button>
      <button onClick={toggleScreenReaderMode} data-testid="toggle-screen-reader">
        Toggle Screen Reader
      </button>
      <button 
        onClick={() => announceToScreenReader('Test announcement')} 
        data-testid="announce"
      >
        Announce
      </button>
    </div>
  );
};

describe('AccessibilityProvider', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    
    // Mock matchMedia for reduced motion detection
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it('should provide default accessibility settings', () => {
    render(
      <AccessibilityProvider>
        <TestComponent />
      </AccessibilityProvider>
    );

    expect(screen.getByTestId('high-contrast')).toHaveTextContent('disabled');
    expect(screen.getByTestId('reduced-motion')).toHaveTextContent('disabled');
    expect(screen.getByTestId('font-size')).toHaveTextContent('medium');
    expect(screen.getByTestId('screen-reader')).toHaveTextContent('disabled');
    expect(screen.getByTestId('keyboard-nav')).toHaveTextContent('enabled');
  });

  it('should toggle high contrast mode', () => {
    render(
      <AccessibilityProvider>
        <TestComponent />
      </AccessibilityProvider>
    );

    const toggleButton = screen.getByTestId('toggle-contrast');
    const contrastStatus = screen.getByTestId('high-contrast');

    expect(contrastStatus).toHaveTextContent('disabled');

    fireEvent.click(toggleButton);
    expect(contrastStatus).toHaveTextContent('enabled');

    fireEvent.click(toggleButton);
    expect(contrastStatus).toHaveTextContent('disabled');
  });

  it('should toggle reduced motion mode', () => {
    render(
      <AccessibilityProvider>
        <TestComponent />
      </AccessibilityProvider>
    );

    const toggleButton = screen.getByTestId('toggle-motion');
    const motionStatus = screen.getByTestId('reduced-motion');

    expect(motionStatus).toHaveTextContent('disabled');

    fireEvent.click(toggleButton);
    expect(motionStatus).toHaveTextContent('enabled');
  });

  it('should change font size', () => {
    render(
      <AccessibilityProvider>
        <TestComponent />
      </AccessibilityProvider>
    );

    const setLargeFontButton = screen.getByTestId('set-large-font');
    const fontSizeStatus = screen.getByTestId('font-size');

    expect(fontSizeStatus).toHaveTextContent('medium');

    fireEvent.click(setLargeFontButton);
    expect(fontSizeStatus).toHaveTextContent('large');
  });

  it('should toggle screen reader mode', () => {
    render(
      <AccessibilityProvider>
        <TestComponent />
      </AccessibilityProvider>
    );

    const toggleButton = screen.getByTestId('toggle-screen-reader');
    const screenReaderStatus = screen.getByTestId('screen-reader');

    expect(screenReaderStatus).toHaveTextContent('disabled');

    fireEvent.click(toggleButton);
    expect(screenReaderStatus).toHaveTextContent('enabled');
  });

  it('should persist accessibility settings in localStorage', () => {
    render(
      <AccessibilityProvider>
        <TestComponent />
      </AccessibilityProvider>
    );

    const toggleButton = screen.getByTestId('toggle-contrast');
    fireEvent.click(toggleButton);

    const savedSettings = JSON.parse(localStorage.getItem('accessibility-settings') || '{}');
    expect(savedSettings.highContrast).toBe(true);
  });

  it('should load accessibility settings from localStorage', () => {
    // Pre-populate localStorage
    localStorage.setItem('accessibility-settings', JSON.stringify({
      highContrast: true,
      fontSize: 'large',
      reducedMotion: true,
    }));

    render(
      <AccessibilityProvider>
        <TestComponent />
      </AccessibilityProvider>
    );

    expect(screen.getByTestId('high-contrast')).toHaveTextContent('enabled');
    expect(screen.getByTestId('font-size')).toHaveTextContent('large');
    expect(screen.getByTestId('reduced-motion')).toHaveTextContent('enabled');
  });

  it('should detect system preference for reduced motion', () => {
    // Mock matchMedia to return true for prefers-reduced-motion
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    render(
      <AccessibilityProvider>
        <TestComponent />
      </AccessibilityProvider>
    );

    expect(screen.getByTestId('reduced-motion')).toHaveTextContent('enabled');
  });

  it('should announce messages to screen reader', async () => {
    render(
      <AccessibilityProvider>
        <TestComponent />
      </AccessibilityProvider>
    );

    const announceButton = screen.getByTestId('announce');
    fireEvent.click(announceButton);

    // Check if aria-live region is created and contains the message
    await waitFor(() => {
      const ariaLiveRegion = document.querySelector('[aria-live="polite"]');
      expect(ariaLiveRegion).toBeInTheDocument();
      expect(ariaLiveRegion).toHaveTextContent('Test announcement');
    });
  });

  it('should apply CSS classes based on accessibility settings', () => {
    render(
      <AccessibilityProvider>
        <TestComponent />
      </AccessibilityProvider>
    );

    const toggleButton = screen.getByTestId('toggle-contrast');
    fireEvent.click(toggleButton);

    // Check if high contrast class is applied to document
    expect(document.documentElement).toHaveClass('high-contrast');
  });

  it('should have no accessibility violations', async () => {
    const { container } = render(
      <AccessibilityProvider>
        <TestComponent />
      </AccessibilityProvider>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should handle keyboard navigation properly', () => {
    render(
      <AccessibilityProvider>
        <TestComponent />
      </AccessibilityProvider>
    );

    const toggleButton = screen.getByTestId('toggle-contrast');
    
    // Test keyboard interaction
    toggleButton.focus();
    expect(toggleButton).toHaveFocus();

    fireEvent.keyDown(toggleButton, { key: 'Enter' });
    expect(screen.getByTestId('high-contrast')).toHaveTextContent('enabled');

    fireEvent.keyDown(toggleButton, { key: ' ' });
    expect(screen.getByTestId('high-contrast')).toHaveTextContent('disabled');
  });

  it('should provide focus management utilities', () => {
    const FocusTestComponent: React.FC = () => {
      const { focusManagement } = useAccessibility();
      
      return (
        <div>
          <button 
            onClick={() => focusManagement.trapFocus('modal')}
            data-testid="trap-focus"
          >
            Trap Focus
          </button>
          <button 
            onClick={() => focusManagement.restoreFocus()}
            data-testid="restore-focus"
          >
            Restore Focus
          </button>
          <div id="modal" tabIndex={-1}>
            <button data-testid="modal-button">Modal Button</button>
          </div>
        </div>
      );
    };

    render(
      <AccessibilityProvider>
        <FocusTestComponent />
      </AccessibilityProvider>
    );

    const trapButton = screen.getByTestId('trap-focus');
    const modalButton = screen.getByTestId('modal-button');

    fireEvent.click(trapButton);
    
    // Focus should be trapped in modal
    expect(modalButton).toHaveFocus();
  });
});
