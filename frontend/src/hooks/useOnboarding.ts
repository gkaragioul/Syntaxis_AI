// @ts-nocheck
import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { HelpService, OnboardingStatus } from '../services/HelpService';
import { useAuth } from './useAuth';
import { useOnboardingAnalytics } from './useOnboardingAnalytics';

// Local storage key for onboarding state persistence
const ONBOARDING_STORAGE_KEY = 'syntaxisai_onboarding_state';

interface LocalOnboardingState {
    isOpen: boolean;
    lastStep: number;
    timestamp: number;
}

export const useOnboarding = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [isOpen, setIsOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Initialize analytics
    const analytics = useOnboardingAnalytics({
        enabled: !!user,
        trackPageViews: true,
        trackUserInteractions: true,
    });

    // Load local state from localStorage
    const loadLocalState = useCallback((): LocalOnboardingState | null => {
        try {
            const stored = localStorage.getItem(ONBOARDING_STORAGE_KEY);
            if (stored) {
                const state = JSON.parse(stored) as LocalOnboardingState;
                // Only use local state if it's less than 24 hours old
                const isRecent = Date.now() - state.timestamp < 24 * 60 * 60 * 1000;
                return isRecent ? state : null;
            }
        } catch (error) {
            console.warn('Failed to load onboarding state from localStorage:', error);
        }
        return null;
    }, []);

    // Save local state to localStorage
    const saveLocalState = useCallback((state: Partial<LocalOnboardingState>) => {
        try {
            const currentState = loadLocalState() || { isOpen: false, lastStep: 1, timestamp: Date.now() };
            const newState = { ...currentState, ...state, timestamp: Date.now() };
            localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(newState));
        } catch (error) {
            console.warn('Failed to save onboarding state to localStorage:', error);
        }
    }, [loadLocalState]);

    // Clear local state
    const clearLocalState = useCallback(() => {
        try {
            localStorage.removeItem(ONBOARDING_STORAGE_KEY);
        } catch (error) {
            console.warn('Failed to clear onboarding state from localStorage:', error);
        }
    }, []);

    const { data: status, isLoading, error: queryError, refetch } = useQuery<OnboardingStatus>({
        queryKey: ['onboardingStatus'],
        queryFn: HelpService.getOnboardingStatus,
        enabled: !!user,
        retry: 3,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        staleTime: 5 * 60 * 1000, // 5 minutes
        cacheTime: 30 * 60 * 1000, // 30 minutes
        onError: (error) => {
            console.error('Failed to fetch onboarding status:', error);
            setError('Failed to load onboarding status. Please try again.');
        },
    });

    const updateStepMutation = useMutation({
        mutationFn: ({ stepId, completed }: { stepId: string; completed: boolean }) =>
            HelpService.updateOnboardingStep(stepId, completed),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['onboardingStatus'] });
            // Update local state
            if (variables.completed) {
                const stepOrder = getStepOrder(variables.stepId);
                saveLocalState({ lastStep: stepOrder });
            }
            setError(null);
        },
        onError: (error) => {
            console.error('Failed to update onboarding step:', error);
            setError('Failed to save progress. Your progress may not be saved.');
        },
        retry: 2,
    });

    const skipMutation = useMutation({
        mutationFn: HelpService.skipOnboarding,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['onboardingStatus'] });
            setIsOpen(false);
            clearLocalState();
            setError(null);
        },
        onError: (error) => {
            console.error('Failed to skip onboarding:', error);
            setError('Failed to skip onboarding. Please try again.');
        },
        retry: 2,
    });

    // Helper function to get step order
    const getStepOrder = (stepId: string): number => {
        const stepMap: Record<string, number> = {
            welcome: 1,
            upload: 2,
            extraction: 3,
            templates: 4,
            batch: 5,
            export: 6,
        };
        return stepMap[stepId] || 1;
    };

    // Helper function to get step name
    const getStepName = (stepId: string): string => {
        const stepNameMap: Record<string, string> = {
            welcome: 'Welcome',
            upload: 'Upload PDFs',
            extraction: 'Table Extraction',
            templates: 'Templates',
            batch: 'Batch Processing',
            export: 'Export Results',
        };
        return stepNameMap[stepId] || stepId;
    };

    // Auto-open onboarding logic with local state recovery
    useEffect(() => {
        if (!user || isLoading) return;

        const localState = loadLocalState();

        if (status) {
            // Server state is available
            if (!status.completed && !status.skipped) {
                setIsOpen(true);
                // Save current server state locally
                saveLocalState({
                    isOpen: true,
                    lastStep: status.currentStep || 1
                });
            } else {
                // Onboarding is completed or skipped, clear local state
                clearLocalState();
            }
        } else if (localState && !queryError) {
            // Server state not available but we have local state
            // This handles offline scenarios or temporary server issues
            setIsOpen(localState.isOpen);
        }
    }, [user, isLoading, status, queryError, loadLocalState, saveLocalState, clearLocalState]);

    const openOnboarding = useCallback(() => {
        setIsOpen(true);
        saveLocalState({ isOpen: true });

        // Start analytics session
        if (!analytics.isSessionActive) {
            analytics.startOnboardingSession();
        }
    }, [saveLocalState, analytics]);

    const closeOnboarding = useCallback(() => {
        setIsOpen(false);
        saveLocalState({ isOpen: false });

        // Track abandonment if session was active
        if (analytics.isSessionActive) {
            analytics.trackOnboardingAbandon('manual_close');
        }
    }, [saveLocalState, analytics]);

    const updateStep = useCallback(async (stepId: string, completed: boolean) => {
        try {
            await updateStepMutation.mutateAsync({ stepId, completed });

            // Track analytics
            if (completed) {
                analytics.trackStepComplete(stepId, getStepName(stepId));
            }
        } catch (error) {
            // Track error
            analytics.trackError(error as Error, `update_step_${stepId}`);

            // Even if server update fails, update local state for offline resilience
            if (completed) {
                const stepOrder = getStepOrder(stepId);
                saveLocalState({ lastStep: stepOrder });
            }
            throw error;
        }
    }, [updateStepMutation, saveLocalState, analytics]);

    const skipOnboarding = useCallback(async () => {
        try {
            // Track skip before API call
            analytics.trackOnboardingAbandon('user_skip');

            await skipMutation.mutateAsync();
        } catch (error) {
            // Track error
            analytics.trackError(error as Error, 'skip_onboarding');

            // If server skip fails, at least close locally
            setIsOpen(false);
            saveLocalState({ isOpen: false });
            throw error;
        }
    }, [skipMutation, saveLocalState, analytics]);

    const retryOperation = useCallback(() => {
        setError(null);
        refetch();
    }, [refetch]);

    const resetOnboarding = useCallback(() => {
        clearLocalState();
        setIsOpen(false);
        setError(null);
        queryClient.removeQueries({ queryKey: ['onboardingStatus'] });
    }, [clearLocalState, queryClient]);

    // Add step tracking function for external use
    const trackStepStart = useCallback((stepId: string) => {
        analytics.trackStepStart(stepId, getStepName(stepId));
    }, [analytics]);

    const trackHelpAccess = useCallback((helpType?: string, query?: string) => {
        analytics.trackHelpAccess(helpType, query);
    }, [analytics]);

    // Auto-start session when onboarding opens
    useEffect(() => {
        if (isOpen && !analytics.isSessionActive) {
            analytics.startOnboardingSession();
        }
    }, [isOpen, analytics]);

    return {
        isOpen,
        status,
        isLoading,
        error,
        openOnboarding,
        closeOnboarding,
        updateStep,
        skipOnboarding,
        retryOperation,
        resetOnboarding,
        trackStepStart,
        trackHelpAccess,
        isUpdating: updateStepMutation.isLoading,
        isSkipping: skipMutation.isLoading,
        // Analytics data
        analytics: {
            isSessionActive: analytics.isSessionActive,
            currentStep: analytics.currentStep,
            trackInteraction: analytics.trackInteraction,
            trackError: analytics.trackError,
        },
    };
};