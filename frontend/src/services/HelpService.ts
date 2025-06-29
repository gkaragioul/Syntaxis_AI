import { api } from './api';

export interface OnboardingStatus {
    completed: boolean;
    currentStep: number;
    completedSteps: string[];
    skipped?: boolean;
}

export interface HelpContent {
    id: string;
    title: string;
    content: string;
    category: string;
    tags: string[];
    version: number;
    lastUpdated: Date;
    author: string;
}

export interface HelpFeedback {
    page: string;
    context: string;
    feedback: string;
    rating?: number;
    type: 'bug' | 'suggestion' | 'question' | 'other';
}

export class HelpService {
    // Onboarding
    static async getOnboardingStatus(): Promise<OnboardingStatus> {
        const response = await api.get('/help/onboarding/status');
        return response.data;
    }

    static async updateOnboardingStep(stepId: string, completed: boolean): Promise<void> {
        await api.post(`/help/onboarding/step/${stepId}`, { completed });
    }

    static async skipOnboarding(): Promise<void> {
        await api.post('/help/onboarding/skip');
    }

    // Help Content
    static async getHelpContent(params?: {
        category?: string;
        tags?: string[];
        search?: string;
    }): Promise<HelpContent[]> {
        const response = await api.get('/help/content', { params });
        return response.data;
    }

    static async getHelpArticle(id: string): Promise<HelpContent> {
        const response = await api.get(`/help/content/${id}`);
        return response.data;
    }

    // Feedback
    static async submitFeedback(feedback: HelpFeedback): Promise<void> {
        await api.post('/help/feedback', feedback);
    }

    static async getFeedback(params?: {
        page?: string;
        type?: string;
    }): Promise<HelpFeedback[]> {
        const response = await api.get('/help/feedback', { params });
        return response.data;
    }
} 