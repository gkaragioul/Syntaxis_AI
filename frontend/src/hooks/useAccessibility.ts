import { useEffect, useCallback, useRef } from 'react';

interface UseAccessibilityOptions {
    announcePageChanges?: boolean;
    manageFocus?: boolean;
    enableKeyboardNavigation?: boolean;
    highContrastMode?: boolean;
    reducedMotion?: boolean;
}

export const useAccessibility = (options: UseAccessibilityOptions = {}) => {
    const {
        announcePageChanges = true,
        manageFocus = true,
        enableKeyboardNavigation = true,
        highContrastMode = false,
        reducedMotion = false,
    } = options;

    const announcementRef = useRef<HTMLDivElement | null>(null);
    const focusableElementsRef = useRef<HTMLElement[]>([]);
    const currentFocusIndexRef = useRef(0);

    // Create or get the live region for announcements
    const getLiveRegion = useCallback(() => {
        if (!announcementRef.current) {
            const existing = document.getElementById('onboarding-live-region');
            if (existing) {
                announcementRef.current = existing as HTMLDivElement;
            } else {
                const liveRegion = document.createElement('div');
                liveRegion.id = 'onboarding-live-region';
                liveRegion.setAttribute('aria-live', 'polite');
                liveRegion.setAttribute('aria-atomic', 'true');
                liveRegion.style.position = 'absolute';
                liveRegion.style.left = '-10000px';
                liveRegion.style.width = '1px';
                liveRegion.style.height = '1px';
                liveRegion.style.overflow = 'hidden';
                document.body.appendChild(liveRegion);
                announcementRef.current = liveRegion;
            }
        }
        return announcementRef.current;
    }, []);

    // Announce messages to screen readers
    const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
        if (!announcePageChanges) return;

        const liveRegion = getLiveRegion();
        liveRegion.setAttribute('aria-live', priority);
        
        // Clear and then set the message to ensure it's announced
        liveRegion.textContent = '';
        setTimeout(() => {
            liveRegion.textContent = message;
        }, 100);
    }, [announcePageChanges, getLiveRegion]);

    // Focus management
    const focusElement = useCallback((element: HTMLElement | null, options?: FocusOptions) => {
        if (!manageFocus || !element) return;

        // Ensure element is focusable
        if (element.tabIndex < 0) {
            element.tabIndex = -1;
        }

        element.focus(options);
    }, [manageFocus]);

    // Get all focusable elements within a container
    const getFocusableElements = useCallback((container: HTMLElement): HTMLElement[] => {
        const focusableSelectors = [
            'button:not([disabled])',
            'input:not([disabled])',
            'select:not([disabled])',
            'textarea:not([disabled])',
            'a[href]',
            '[tabindex]:not([tabindex="-1"])',
            '[contenteditable="true"]',
        ].join(', ');

        return Array.from(container.querySelectorAll(focusableSelectors)) as HTMLElement[];
    }, []);

    // Update focusable elements list
    const updateFocusableElements = useCallback((container: HTMLElement) => {
        focusableElementsRef.current = getFocusableElements(container);
        currentFocusIndexRef.current = 0;
    }, [getFocusableElements]);

    // Navigate to next focusable element
    const focusNext = useCallback(() => {
        if (!enableKeyboardNavigation || focusableElementsRef.current.length === 0) return;

        currentFocusIndexRef.current = (currentFocusIndexRef.current + 1) % focusableElementsRef.current.length;
        const nextElement = focusableElementsRef.current[currentFocusIndexRef.current];
        focusElement(nextElement);
    }, [enableKeyboardNavigation, focusElement]);

    // Navigate to previous focusable element
    const focusPrevious = useCallback(() => {
        if (!enableKeyboardNavigation || focusableElementsRef.current.length === 0) return;

        currentFocusIndexRef.current = currentFocusIndexRef.current === 0 
            ? focusableElementsRef.current.length - 1 
            : currentFocusIndexRef.current - 1;
        const previousElement = focusableElementsRef.current[currentFocusIndexRef.current];
        focusElement(previousElement);
    }, [enableKeyboardNavigation, focusElement]);

    // Focus first element
    const focusFirst = useCallback(() => {
        if (!enableKeyboardNavigation || focusableElementsRef.current.length === 0) return;

        currentFocusIndexRef.current = 0;
        const firstElement = focusableElementsRef.current[0];
        focusElement(firstElement);
    }, [enableKeyboardNavigation, focusElement]);

    // Focus last element
    const focusLast = useCallback(() => {
        if (!enableKeyboardNavigation || focusableElementsRef.current.length === 0) return;

        currentFocusIndexRef.current = focusableElementsRef.current.length - 1;
        const lastElement = focusableElementsRef.current[currentFocusIndexRef.current];
        focusElement(lastElement);
    }, [enableKeyboardNavigation, focusElement]);

    // Keyboard event handler
    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        if (!enableKeyboardNavigation) return;

        switch (event.key) {
            case 'Tab':
                // Let default tab behavior work, but update our index
                const activeElement = document.activeElement as HTMLElement;
                const index = focusableElementsRef.current.indexOf(activeElement);
                if (index !== -1) {
                    currentFocusIndexRef.current = index;
                }
                break;

            case 'ArrowDown':
            case 'ArrowRight':
                event.preventDefault();
                focusNext();
                break;

            case 'ArrowUp':
            case 'ArrowLeft':
                event.preventDefault();
                focusPrevious();
                break;

            case 'Home':
                event.preventDefault();
                focusFirst();
                break;

            case 'End':
                event.preventDefault();
                focusLast();
                break;

            case 'Escape':
                // Allow parent components to handle escape
                break;
        }
    }, [enableKeyboardNavigation, focusNext, focusPrevious, focusFirst, focusLast]);

    // Apply accessibility preferences
    const applyAccessibilityPreferences = useCallback(() => {
        const root = document.documentElement;

        // High contrast mode
        if (highContrastMode) {
            root.classList.add('high-contrast');
        } else {
            root.classList.remove('high-contrast');
        }

        // Reduced motion
        if (reducedMotion) {
            root.classList.add('reduced-motion');
        } else {
            root.classList.remove('reduced-motion');
        }
    }, [highContrastMode, reducedMotion]);

    // Check for user's motion preferences
    const checkMotionPreferences = useCallback(() => {
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        return prefersReducedMotion;
    }, []);

    // Check for user's contrast preferences
    const checkContrastPreferences = useCallback(() => {
        const prefersHighContrast = window.matchMedia('(prefers-contrast: high)').matches;
        return prefersHighContrast;
    }, []);

    // Generate accessible IDs
    const generateId = useCallback((prefix: string = 'onboarding') => {
        return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
    }, []);

    // Create ARIA attributes for step navigation
    const getStepAriaAttributes = useCallback((currentStep: number, totalSteps: number, stepName: string) => {
        return {
            'aria-label': `Step ${currentStep + 1} of ${totalSteps}: ${stepName}`,
            'aria-current': 'step',
            'role': 'tabpanel',
            'aria-describedby': `step-${currentStep}-description`,
        };
    }, []);

    // Create ARIA attributes for progress indicators
    const getProgressAriaAttributes = useCallback((current: number, total: number) => {
        const percentage = Math.round((current / total) * 100);
        return {
            'role': 'progressbar',
            'aria-valuenow': current,
            'aria-valuemin': 0,
            'aria-valuemax': total,
            'aria-valuetext': `Step ${current} of ${total}, ${percentage}% complete`,
        };
    }, []);

    // Setup accessibility features
    useEffect(() => {
        applyAccessibilityPreferences();

        // Listen for preference changes
        const motionMediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        const contrastMediaQuery = window.matchMedia('(prefers-contrast: high)');

        const handleMotionChange = () => applyAccessibilityPreferences();
        const handleContrastChange = () => applyAccessibilityPreferences();

        motionMediaQuery.addEventListener('change', handleMotionChange);
        contrastMediaQuery.addEventListener('change', handleContrastChange);

        return () => {
            motionMediaQuery.removeEventListener('change', handleMotionChange);
            contrastMediaQuery.removeEventListener('change', handleContrastChange);
        };
    }, [applyAccessibilityPreferences]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            const liveRegion = document.getElementById('onboarding-live-region');
            if (liveRegion) {
                document.body.removeChild(liveRegion);
            }
        };
    }, []);

    return {
        announce,
        focusElement,
        updateFocusableElements,
        focusNext,
        focusPrevious,
        focusFirst,
        focusLast,
        handleKeyDown,
        generateId,
        getStepAriaAttributes,
        getProgressAriaAttributes,
        checkMotionPreferences,
        checkContrastPreferences,
        applyAccessibilityPreferences,
        // Expose refs for advanced usage
        focusableElements: focusableElementsRef.current,
        currentFocusIndex: currentFocusIndexRef.current,
    };
};
