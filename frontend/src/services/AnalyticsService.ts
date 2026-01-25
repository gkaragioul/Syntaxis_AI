import { api } from './api';

export interface OnboardingAnalyticsEvent {
    eventType: 'step_started' | 'step_completed' | 'step_skipped' | 'onboarding_started' | 'onboarding_completed' | 'onboarding_abandoned' | 'help_accessed';
    stepId?: string;
    stepName?: string;
    timeSpent?: number; // in seconds
    metadata?: Record<string, any>;
    timestamp?: Date;
}

export interface OnboardingMetrics {
    totalUsers: number;
    completionRate: number;
    averageTimeToComplete: number;
    stepCompletionRates: Record<string, number>;
    abandonmentPoints: Record<string, number>;
    helpAccessCount: number;
    commonIssues: Array<{
        issue: string;
        count: number;
        stepId?: string;
    }>;
}

export interface UserOnboardingJourney {
    userId: string;
    startedAt: Date;
    completedAt?: Date;
    currentStep: string;
    stepsCompleted: string[];
    timeSpentPerStep: Record<string, number>;
    helpAccessedSteps: string[];
    abandonedAt?: Date;
    completionStatus: 'in_progress' | 'completed' | 'abandoned' | 'skipped';
}

class AnalyticsServiceClass {
    private sessionStartTime: number | null = null;
    private stepStartTime: number | null = null;
    private currentStep: string | null = null;

    /**
     * Track onboarding events
     */
    async trackOnboardingEvent(event: OnboardingAnalyticsEvent): Promise<void> {
        try {
            const eventData = {
                ...event,
                timestamp: event.timestamp || new Date(),
                sessionId: this.getSessionId(),
                userAgent: navigator.userAgent,
                viewport: {
                    width: window.innerWidth,
                    height: window.innerHeight,
                },
            };

            await api.post('/analytics/onboarding/events', eventData);
        } catch (error) {
            console.warn('Failed to track onboarding event:', error);
            // Store in local storage as fallback
            this.storeEventLocally(event);
        }
    }

    /**
     * Start tracking onboarding session
     */
    startOnboardingSession(): void {
        this.sessionStartTime = Date.now();
        this.trackOnboardingEvent({
            eventType: 'onboarding_started',
            metadata: {
                startTime: new Date(),
                referrer: document.referrer,
                userAgent: navigator.userAgent,
            },
        });
    }

    /**
     * Track step start
     */
    startStep(stepId: string, stepName: string): void {
        // End previous step if exists
        if (this.currentStep && this.stepStartTime) {
            this.endStep(this.currentStep, false);
        }

        this.currentStep = stepId;
        this.stepStartTime = Date.now();
        
        this.trackOnboardingEvent({
            eventType: 'step_started',
            stepId,
            stepName,
            metadata: {
                previousStep: this.currentStep,
                startTime: new Date(),
            },
        });
    }

    /**
     * Track step completion
     */
    completeStep(stepId: string, stepName?: string): void {
        const timeSpent = this.stepStartTime ? (Date.now() - this.stepStartTime) / 1000 : 0;
        
        this.trackOnboardingEvent({
            eventType: 'step_completed',
            stepId,
            stepName,
            timeSpent,
            metadata: {
                completedAt: new Date(),
                timeSpent,
            },
        });

        this.stepStartTime = null;
        this.currentStep = null;
    }

    /**
     * Track step skip
     */
    skipStep(stepId: string, stepName?: string, reason?: string): void {
        const timeSpent = this.stepStartTime ? (Date.now() - this.stepStartTime) / 1000 : 0;
        
        this.trackOnboardingEvent({
            eventType: 'step_skipped',
            stepId,
            stepName,
            timeSpent,
            metadata: {
                reason,
                skippedAt: new Date(),
                timeSpent,
            },
        });

        this.stepStartTime = null;
        this.currentStep = null;
    }

    /**
     * End step tracking (for internal use)
     */
    private endStep(stepId: string, completed: boolean): void {
        const timeSpent = this.stepStartTime ? (Date.now() - this.stepStartTime) / 1000 : 0;
        
        if (!completed) {
            this.trackOnboardingEvent({
                eventType: 'step_skipped',
                stepId,
                timeSpent,
                metadata: {
                    reason: 'navigated_away',
                    timeSpent,
                },
            });
        }
    }

    /**
     * Track onboarding completion
     */
    completeOnboarding(): void {
        const totalTime = this.sessionStartTime ? (Date.now() - this.sessionStartTime) / 1000 : 0;
        
        this.trackOnboardingEvent({
            eventType: 'onboarding_completed',
            timeSpent: totalTime,
            metadata: {
                completedAt: new Date(),
                totalTimeSpent: totalTime,
            },
        });

        this.sessionStartTime = null;
        this.stepStartTime = null;
        this.currentStep = null;
    }

    /**
     * Track onboarding abandonment
     */
    abandonOnboarding(reason?: string): void {
        const totalTime = this.sessionStartTime ? (Date.now() - this.sessionStartTime) / 1000 : 0;
        const currentStepTime = this.stepStartTime ? (Date.now() - this.stepStartTime) / 1000 : 0;
        
        this.trackOnboardingEvent({
            eventType: 'onboarding_abandoned',
            stepId: this.currentStep || undefined,
            timeSpent: totalTime,
            metadata: {
                reason,
                abandonedAt: new Date(),
                totalTimeSpent: totalTime,
                currentStepTimeSpent: currentStepTime,
                currentStep: this.currentStep,
            },
        });

        this.sessionStartTime = null;
        this.stepStartTime = null;
        this.currentStep = null;
    }

    /**
     * Track help access
     */
    trackHelpAccess(stepId?: string, helpType?: string, query?: string): void {
        this.trackOnboardingEvent({
            eventType: 'help_accessed',
            stepId,
            metadata: {
                helpType,
                query,
                accessedAt: new Date(),
                currentStep: this.currentStep,
            },
        });
    }

    /**
     * Get onboarding metrics (admin/analytics dashboard)
     */
    async getOnboardingMetrics(dateRange?: { start: Date; end: Date }): Promise<OnboardingMetrics> {
        const params = dateRange ? {
            startDate: dateRange.start.toISOString(),
            endDate: dateRange.end.toISOString(),
        } : undefined;

        const response = await api.get('/analytics/onboarding/metrics', { params });
        return response.data;
    }

    /**
     * Get user onboarding journey
     */
    async getUserOnboardingJourney(userId?: string): Promise<UserOnboardingJourney> {
        const response = await api.get(`/analytics/onboarding/journey${userId ? `/${userId}` : ''}`);
        return response.data;
    }

    /**
     * Get session ID for tracking
     */
    private getSessionId(): string {
        let sessionId = sessionStorage.getItem('onboarding_session_id');
        if (!sessionId) {
            sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            sessionStorage.setItem('onboarding_session_id', sessionId);
        }
        return sessionId;
    }

    /**
     * Store event locally as fallback
     */
    private storeEventLocally(event: OnboardingAnalyticsEvent): void {
        try {
            const key = 'onboarding_analytics_fallback';
            const stored = localStorage.getItem(key);
            const events = stored ? JSON.parse(stored) : [];
            
            events.push({
                ...event,
                timestamp: new Date().toISOString(),
                sessionId: this.getSessionId(),
            });

            // Keep only last 100 events
            if (events.length > 100) {
                events.splice(0, events.length - 100);
            }

            localStorage.setItem(key, JSON.stringify(events));
        } catch (error) {
            console.warn('Failed to store analytics event locally:', error);
        }
    }

    /**
     * Sync locally stored events when connection is restored
     */
    async syncLocalEvents(): Promise<void> {
        try {
            const key = 'onboarding_analytics_fallback';
            const stored = localStorage.getItem(key);
            
            if (stored) {
                const events = JSON.parse(stored);
                if (events.length > 0) {
                    await api.post('/analytics/onboarding/events/batch', { events });
                    localStorage.removeItem(key);
                }
            }
        } catch (error) {
            console.warn('Failed to sync local analytics events:', error);
        }
    }

    /**
     * Initialize analytics service
     */
    init(): void {
        // Sync any pending local events
        this.syncLocalEvents();

        // Track page visibility changes to detect abandonment
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.currentStep) {
                this.abandonOnboarding('page_hidden');
            }
        });

        // Track beforeunload to detect abandonment
        window.addEventListener('beforeunload', () => {
            if (this.currentStep) {
                this.abandonOnboarding('page_unload');
            }
        });
    }
}

export const AnalyticsService = new AnalyticsServiceClass();
