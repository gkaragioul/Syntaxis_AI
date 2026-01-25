// @ts-nocheck
import { useEffect, useCallback, useRef } from 'react';
import { AnalyticsService } from '../services/AnalyticsService';
import { useAuth } from './useAuth';

interface UseOnboardingAnalyticsOptions {
    enabled?: boolean;
    trackPageViews?: boolean;
    trackUserInteractions?: boolean;
}

export const useOnboardingAnalytics = (options: UseOnboardingAnalyticsOptions = {}) => {
    const { user } = useAuth();
    const {
        enabled = true,
        trackPageViews = true,
        trackUserInteractions = true,
    } = options;

    const sessionStartedRef = useRef(false);
    const currentStepRef = useRef<string | null>(null);

    // Initialize analytics service
    useEffect(() => {
        if (enabled && user) {
            AnalyticsService.init();
        }
    }, [enabled, user]);

    // Start onboarding session
    const startOnboardingSession = useCallback(() => {
        if (!enabled || sessionStartedRef.current) return;
        
        sessionStartedRef.current = true;
        AnalyticsService.startOnboardingSession();
    }, [enabled]);

    // Track step navigation
    const trackStepStart = useCallback((stepId: string, stepName: string) => {
        if (!enabled) return;
        
        currentStepRef.current = stepId;
        AnalyticsService.startStep(stepId, stepName);
    }, [enabled]);

    const trackStepComplete = useCallback((stepId: string, stepName?: string) => {
        if (!enabled) return;
        
        AnalyticsService.completeStep(stepId, stepName);
        currentStepRef.current = null;
    }, [enabled]);

    const trackStepSkip = useCallback((stepId: string, stepName?: string, reason?: string) => {
        if (!enabled) return;
        
        AnalyticsService.skipStep(stepId, stepName, reason);
        currentStepRef.current = null;
    }, [enabled]);

    // Track onboarding completion
    const trackOnboardingComplete = useCallback(() => {
        if (!enabled) return;
        
        AnalyticsService.completeOnboarding();
        sessionStartedRef.current = false;
        currentStepRef.current = null;
    }, [enabled]);

    // Track onboarding abandonment
    const trackOnboardingAbandon = useCallback((reason?: string) => {
        if (!enabled || !sessionStartedRef.current) return;
        
        AnalyticsService.abandonOnboarding(reason);
        sessionStartedRef.current = false;
        currentStepRef.current = null;
    }, [enabled]);

    // Track help access
    const trackHelpAccess = useCallback((helpType?: string, query?: string) => {
        if (!enabled) return;
        
        AnalyticsService.trackHelpAccess(currentStepRef.current || undefined, helpType, query);
    }, [enabled]);

    // Track user interactions
    const trackInteraction = useCallback((interactionType: string, elementId?: string, metadata?: Record<string, any>) => {
        if (!enabled || !trackUserInteractions) return;
        
        AnalyticsService.trackOnboardingEvent({
            eventType: 'help_accessed', // Reusing this event type for interactions
            stepId: currentStepRef.current || undefined,
            metadata: {
                interactionType,
                elementId,
                timestamp: new Date(),
                ...metadata,
            },
        });
    }, [enabled, trackUserInteractions]);

    // Track errors
    const trackError = useCallback((error: Error, context?: string) => {
        if (!enabled) return;
        
        AnalyticsService.trackOnboardingEvent({
            eventType: 'help_accessed', // Reusing this event type for errors
            stepId: currentStepRef.current || undefined,
            metadata: {
                eventType: 'error',
                errorMessage: error.message,
                errorStack: error.stack,
                context,
                timestamp: new Date(),
            },
        });
    }, [enabled]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (sessionStartedRef.current && currentStepRef.current) {
                trackOnboardingAbandon('component_unmount');
            }
        };
    }, [trackOnboardingAbandon]);

    return {
        startOnboardingSession,
        trackStepStart,
        trackStepComplete,
        trackStepSkip,
        trackOnboardingComplete,
        trackOnboardingAbandon,
        trackHelpAccess,
        trackInteraction,
        trackError,
        isSessionActive: sessionStartedRef.current,
        currentStep: currentStepRef.current,
    };
};

// Higher-order component for automatic analytics tracking
export const withOnboardingAnalytics = <P extends object>(
    Component: React.ComponentType<P>,
    stepId: string,
    stepName: string
): React.ForwardRefExoticComponent<React.PropsWithoutRef<P> & React.RefAttributes<any>> => {
    const WrappedComponent = React.forwardRef<any, P>(
        (props: P, ref: React.Ref<any>) => {
            const analytics = useOnboardingAnalytics();

            useEffect(() => {
                analytics.trackStepStart(stepId, stepName);

                return () => {
                    // Track abandonment if step wasn't completed
                    if (analytics.currentStep === stepId) {
                        analytics.trackOnboardingAbandon('step_component_unmount');
                    }
                };
            }, [analytics]);

            return React.createElement(Component, { ...props, ref });
        }
    );

    WrappedComponent.displayName = `withOnboardingAnalytics(${Component.displayName || Component.name || 'Component'})`;
    return WrappedComponent;
};

// Hook for tracking specific onboarding metrics
export const useOnboardingMetrics = () => {
    const { user } = useAuth();

    const getMetrics = useCallback(async (dateRange?: { start: Date; end: Date }) => {
        if (!user) return null;
        
        try {
            return await AnalyticsService.getOnboardingMetrics(dateRange);
        } catch (error) {
            console.error('Failed to fetch onboarding metrics:', error);
            return null;
        }
    }, [user]);

    const getUserJourney = useCallback(async (userId?: string) => {
        if (!user) return null;
        
        try {
            return await AnalyticsService.getUserOnboardingJourney(userId);
        } catch (error) {
            console.error('Failed to fetch user onboarding journey:', error);
            return null;
        }
    }, [user]);

    return {
        getMetrics,
        getUserJourney,
    };
};
