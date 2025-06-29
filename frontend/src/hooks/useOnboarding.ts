import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { HelpService, OnboardingStatus } from '../services/HelpService';
import { useAuth } from './useAuth';

export const useOnboarding = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [isOpen, setIsOpen] = useState(false);

    const { data: status, isLoading } = useQuery<OnboardingStatus>({
        queryKey: ['onboardingStatus'],
        queryFn: HelpService.getOnboardingStatus,
        enabled: !!user,
    });

    const updateStepMutation = useMutation({
        mutationFn: ({ stepId, completed }: { stepId: string; completed: boolean }) =>
            HelpService.updateOnboardingStep(stepId, completed),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['onboardingStatus'] });
        },
    });

    const skipMutation = useMutation({
        mutationFn: HelpService.skipOnboarding,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['onboardingStatus'] });
            setIsOpen(false);
        },
    });

    useEffect(() => {
        // Show onboarding on first login if not completed
        if (user && !isLoading && status && !status.completed && !status.skipped) {
            setIsOpen(true);
        }
    }, [user, isLoading, status]);

    const openOnboarding = () => setIsOpen(true);
    const closeOnboarding = () => setIsOpen(false);

    const updateStep = async (stepId: string, completed: boolean) => {
        await updateStepMutation.mutateAsync({ stepId, completed });
    };

    const skipOnboarding = async () => {
        await skipMutation.mutateAsync();
    };

    return {
        isOpen,
        status,
        isLoading,
        openOnboarding,
        closeOnboarding,
        updateStep,
        skipOnboarding,
    };
}; 