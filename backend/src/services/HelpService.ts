// @ts-nocheck

import { redis } from '../redis';
import { User } from '../models/User';
import { HelpFeedback } from '../models/HelpFeedback';
import { logger } from '../utils/logger';
import { config } from '../config';

interface HelpContent {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  version: number;
  lastUpdated: Date;
  author: string;
}

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  component: string;
  order: number;
  required: boolean;
}

export class HelpService {
  private redis = redis;
  private readonly CACHE_TTL = 3600; // 1 hour

  constructor() {
    // Uses shared redis instance
  }

  // Onboarding Status Management
  async getOnboardingStatus(userId: string): Promise<{
    completed: boolean;
    currentStep: number;
    completedSteps: string[];
  }> {
    try {
      const cached = await this.redis.get(`onboarding:${userId}`);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      logger.warn('Redis cache error in getOnboardingStatus', { error: err.message });
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const status = {
      completed: user.onboardingCompleted || false,
      currentStep: user.onboardingStep || 0,
      completedSteps: user.completedOnboardingSteps || [],
    };

    try {
      await this.redis.set(
        `onboarding:${userId}`,
        JSON.stringify(status),
        'EX',
        this.CACHE_TTL,
      );
    } catch (err) {
      // Ignore cache set errors
    }

    return status;
  }

  async updateOnboardingStatus(
    userId: string,
    stepId: string,
    completed: boolean,
  ): Promise<void> {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const completedSteps = new Set(user.completedOnboardingSteps || []);
    if (completed) {
      completedSteps.add(stepId);
    } else {
      completedSteps.delete(stepId);
    }

    user.completedOnboardingSteps = Array.from(completedSteps);
    user.onboardingStep = Math.max(
      user.onboardingStep || 0,
      this.getStepOrder(stepId),
    );
    user.onboardingCompleted = completedSteps.size === this.getTotalSteps();

    await user.save();

    // Update cache
    try {
      await this.redis.set(
        `onboarding:${userId}`,
        JSON.stringify({
          completed: user.onboardingCompleted,
          currentStep: user.onboardingStep,
          completedSteps: user.completedOnboardingSteps,
        }),
        'EX',
        this.CACHE_TTL,
      );
    } catch (err) {
      // Ignore
    }
  }

  async skipOnboarding(userId: string): Promise<void> {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    user.onboardingCompleted = true;
    user.onboardingSkipped = true;
    await user.save();

    // Update cache
    try {
      await this.redis.set(
        `onboarding:${userId}`,
        JSON.stringify({
          completed: true,
          currentStep: this.getTotalSteps(),
          completedSteps: [],
          skipped: true,
        }),
        'EX',
        this.CACHE_TTL,
      );
    } catch (err) {
      // Ignore
    }
  }

  // Help Content Management
  async getHelpContent(
    category?: string,
    tags?: string[],
    search?: string,
  ): Promise<HelpContent[]> {
    const cacheKey = `help:${category || 'all'}:${tags?.join(',') || 'all'}:${search || 'all'
      }`;

    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      // Ignore cache read error
    }

    const content = await this.getMockHelpContent();
    const filtered = this.filterHelpContent(content, category, tags, search);

    try {
      await this.redis.set(
        cacheKey,
        JSON.stringify(filtered),
        'EX',
        this.CACHE_TTL,
      );
    } catch (err) {
      // Ignore
    }
    return filtered;
  }

  async getHelpArticle(id: string): Promise<HelpContent | null> {
    const cacheKey = `help:article:${id}`;
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      // Ignore
    }

    const content = await this.getMockHelpContent();
    const article = content.find((c) => c.id === id) || null;

    if (article) {
      try {
        await this.redis.set(
          cacheKey,
          JSON.stringify(article),
          'EX',
          this.CACHE_TTL,
        );
      } catch (err) {
        // Ignore
      }
    }

    return article;
  }

  // User Feedback Management
  async submitFeedback(
    userId: string,
    data: {
      page: string;
      context: string;
      feedback: string;
      rating?: number;
      type: 'bug' | 'suggestion' | 'question' | 'other';
    },
  ): Promise<void> {
    const feedback = new HelpFeedback({
      userId,
      ...data,
    });

    await feedback.save();
    logger.info('Help feedback submitted', { userId, ...data });
  }

  async getFeedback(
    userId: string,
    page?: string,
    type?: string,
  ): Promise<HelpFeedback[]> {
    const query: any = { userId };
    if (page) query.page = page;
    if (type) query.type = type;

    return HelpFeedback.find(query).sort({ createdAt: -1 }).limit(50);
  }

  // Private helper methods
  private getStepOrder(stepId: string): number {
    const steps = this.getOnboardingSteps();
    return steps.findIndex((step) => step.id === stepId) + 1;
  }

  private getTotalSteps(): number {
    return this.getOnboardingSteps().length;
  }

  private getOnboardingSteps(): OnboardingStep[] {
    return [
      {
        id: 'welcome',
        title: 'Welcome to SyntaxisAI',
        description: 'Learn how to extract data from your PDFs efficiently.',
        component: 'WelcomeStep',
        order: 1,
        required: true,
      },
      {
        id: 'upload',
        title: 'Uploading PDFs',
        description:
          'Learn how to upload single or multiple PDFs for processing.',
        component: 'UploadStep',
        order: 2,
        required: true,
      },
      {
        id: 'extraction',
        title: 'Table Extraction',
        description:
          'Understand how to extract and review tables from your PDFs.',
        component: 'ExtractionStep',
        order: 3,
        required: true,
      },
      {
        id: 'templates',
        title: 'Creating Templates',
        description: 'Learn how to create and save extraction templates.',
        component: 'TemplatesStep',
        order: 4,
        required: true,
      },
      {
        id: 'batch',
        title: 'Batch Processing',
        description: 'Process multiple PDFs using your templates.',
        component: 'BatchStep',
        order: 5,
        required: true,
      },
      {
        id: 'export',
        title: 'Exporting Results',
        description: 'Export your extracted data in various formats.',
        component: 'ExportStep',
        order: 6,
        required: true,
      },
    ];
  }

  private filterHelpContent(
    content: HelpContent[],
    category?: string,
    tags?: string[],
    search?: string,
  ): HelpContent[] {
    return content.filter((item) => {
      if (category && item.category !== category) return false;
      if (tags && !tags.every((tag) => item.tags.includes(tag))) return false;
      if (search) {
        const searchLower = search.toLowerCase();
        return (
          item.title.toLowerCase().includes(searchLower) ||
          item.content.toLowerCase().includes(searchLower) ||
          item.tags.some((tag) => tag.toLowerCase().includes(searchLower))
        );
      }
      return true;
    });
  }

  private async getMockHelpContent(): Promise<HelpContent[]> {
    return [
      {
        id: 'uploading-pdfs',
        title: 'Uploading PDFs',
        content: 'Learn how to upload single or multiple PDFs...',
        category: 'Getting Started',
        tags: ['upload', 'pdf', 'files'],
        version: 1,
        lastUpdated: new Date(),
        author: 'System',
      },
    ];
  }
}
