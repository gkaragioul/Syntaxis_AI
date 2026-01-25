import { HelpService, OnboardingStatus, HelpContent, HelpFeedback } from '../../services/HelpService';
import { api } from '../../services/api';

// Mock the api module
jest.mock('../../services/api');
const mockApi = api as jest.Mocked<typeof api>;

describe('HelpService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Onboarding Methods', () => {
    describe('getOnboardingStatus', () => {
      it('should fetch onboarding status successfully', async () => {
        const mockStatus: OnboardingStatus = {
          completed: false,
          currentStep: 2,
          completedSteps: ['welcome'],
        };

        mockApi.get.mockResolvedValue({ data: mockStatus });

        const result = await HelpService.getOnboardingStatus();

        expect(mockApi.get).toHaveBeenCalledWith('/help/onboarding/status');
        expect(result).toEqual(mockStatus);
      });

      it('should handle API errors', async () => {
        const error = new Error('Network error');
        mockApi.get.mockRejectedValue(error);

        await expect(HelpService.getOnboardingStatus()).rejects.toThrow('Network error');
        expect(mockApi.get).toHaveBeenCalledWith('/help/onboarding/status');
      });

      it('should return status with skipped flag when applicable', async () => {
        const mockStatus: OnboardingStatus = {
          completed: false,
          currentStep: 1,
          completedSteps: [],
          skipped: true,
        };

        mockApi.get.mockResolvedValue({ data: mockStatus });

        const result = await HelpService.getOnboardingStatus();

        expect(result.skipped).toBe(true);
      });
    });

    describe('updateOnboardingStep', () => {
      it('should update step completion successfully', async () => {
        mockApi.post.mockResolvedValue({ data: { message: 'Step updated' } });

        await HelpService.updateOnboardingStep('welcome', true);

        expect(mockApi.post).toHaveBeenCalledWith('/help/onboarding/step/welcome', {
          completed: true,
        });
      });

      it('should handle step update with false completion', async () => {
        mockApi.post.mockResolvedValue({ data: { message: 'Step updated' } });

        await HelpService.updateOnboardingStep('upload', false);

        expect(mockApi.post).toHaveBeenCalledWith('/help/onboarding/step/upload', {
          completed: false,
        });
      });

      it('should handle API errors during step update', async () => {
        const error = new Error('Update failed');
        mockApi.post.mockRejectedValue(error);

        await expect(HelpService.updateOnboardingStep('welcome', true)).rejects.toThrow('Update failed');
      });

      it('should handle different step IDs', async () => {
        mockApi.post.mockResolvedValue({ data: { message: 'Step updated' } });

        const stepIds = ['welcome', 'upload', 'extraction', 'templates', 'batch', 'export'];

        for (const stepId of stepIds) {
          await HelpService.updateOnboardingStep(stepId, true);
          expect(mockApi.post).toHaveBeenCalledWith(`/help/onboarding/step/${stepId}`, {
            completed: true,
          });
        }
      });
    });

    describe('skipOnboarding', () => {
      it('should skip onboarding successfully', async () => {
        mockApi.post.mockResolvedValue({ data: { message: 'Onboarding skipped' } });

        await HelpService.skipOnboarding();

        expect(mockApi.post).toHaveBeenCalledWith('/help/onboarding/skip');
      });

      it('should handle API errors during skip', async () => {
        const error = new Error('Skip failed');
        mockApi.post.mockRejectedValue(error);

        await expect(HelpService.skipOnboarding()).rejects.toThrow('Skip failed');
      });
    });
  });

  describe('Help Content Methods', () => {
    describe('getHelpContent', () => {
      it('should fetch help content without parameters', async () => {
        const mockContent: HelpContent[] = [
          {
            id: '1',
            title: 'Getting Started',
            content: 'Welcome to the platform',
            category: 'basics',
            tags: ['intro', 'setup'],
            version: 1,
            lastUpdated: new Date(),
            author: 'Admin',
          },
        ];

        mockApi.get.mockResolvedValue({ data: mockContent });

        const result = await HelpService.getHelpContent();

        expect(mockApi.get).toHaveBeenCalledWith('/help/content', { params: undefined });
        expect(result).toEqual(mockContent);
      });

      it('should fetch help content with category filter', async () => {
        const mockContent: HelpContent[] = [];
        mockApi.get.mockResolvedValue({ data: mockContent });

        await HelpService.getHelpContent({ category: 'advanced' });

        expect(mockApi.get).toHaveBeenCalledWith('/help/content', {
          params: { category: 'advanced' },
        });
      });

      it('should fetch help content with tags filter', async () => {
        const mockContent: HelpContent[] = [];
        mockApi.get.mockResolvedValue({ data: mockContent });

        await HelpService.getHelpContent({ tags: ['pdf', 'extraction'] });

        expect(mockApi.get).toHaveBeenCalledWith('/help/content', {
          params: { tags: ['pdf', 'extraction'] },
        });
      });

      it('should fetch help content with search query', async () => {
        const mockContent: HelpContent[] = [];
        mockApi.get.mockResolvedValue({ data: mockContent });

        await HelpService.getHelpContent({ search: 'upload files' });

        expect(mockApi.get).toHaveBeenCalledWith('/help/content', {
          params: { search: 'upload files' },
        });
      });

      it('should fetch help content with multiple filters', async () => {
        const mockContent: HelpContent[] = [];
        mockApi.get.mockResolvedValue({ data: mockContent });

        await HelpService.getHelpContent({
          category: 'tutorials',
          tags: ['beginner'],
          search: 'first steps',
        });

        expect(mockApi.get).toHaveBeenCalledWith('/help/content', {
          params: {
            category: 'tutorials',
            tags: ['beginner'],
            search: 'first steps',
          },
        });
      });
    });

    describe('getHelpArticle', () => {
      it('should fetch specific help article', async () => {
        const mockArticle: HelpContent = {
          id: 'article-123',
          title: 'Advanced Features',
          content: 'Detailed content here',
          category: 'advanced',
          tags: ['features', 'pro'],
          version: 2,
          lastUpdated: new Date(),
          author: 'Expert',
        };

        mockApi.get.mockResolvedValue({ data: mockArticle });

        const result = await HelpService.getHelpArticle('article-123');

        expect(mockApi.get).toHaveBeenCalledWith('/help/content/article-123');
        expect(result).toEqual(mockArticle);
      });

      it('should handle errors when fetching article', async () => {
        const error = new Error('Article not found');
        mockApi.get.mockRejectedValue(error);

        await expect(HelpService.getHelpArticle('nonexistent')).rejects.toThrow('Article not found');
      });
    });
  });

  describe('Feedback Methods', () => {
    describe('submitFeedback', () => {
      it('should submit feedback successfully', async () => {
        const feedback: HelpFeedback = {
          page: '/dashboard',
          context: 'onboarding',
          feedback: 'Great experience!',
          rating: 5,
          type: 'suggestion',
        };

        mockApi.post.mockResolvedValue({ data: { message: 'Feedback submitted' } });

        await HelpService.submitFeedback(feedback);

        expect(mockApi.post).toHaveBeenCalledWith('/help/feedback', feedback);
      });

      it('should handle feedback submission errors', async () => {
        const feedback: HelpFeedback = {
          page: '/upload',
          context: 'file-upload',
          feedback: 'Bug report',
          type: 'bug',
        };

        const error = new Error('Submission failed');
        mockApi.post.mockRejectedValue(error);

        await expect(HelpService.submitFeedback(feedback)).rejects.toThrow('Submission failed');
      });

      it('should submit feedback without rating', async () => {
        const feedback: HelpFeedback = {
          page: '/help',
          context: 'general',
          feedback: 'Need more documentation',
          type: 'suggestion',
        };

        mockApi.post.mockResolvedValue({ data: { message: 'Feedback submitted' } });

        await HelpService.submitFeedback(feedback);

        expect(mockApi.post).toHaveBeenCalledWith('/help/feedback', feedback);
      });
    });

    describe('getFeedback', () => {
      it('should fetch feedback without parameters', async () => {
        const mockFeedback: HelpFeedback[] = [
          {
            page: '/dashboard',
            context: 'general',
            feedback: 'Good interface',
            rating: 4,
            type: 'suggestion',
          },
        ];

        mockApi.get.mockResolvedValue({ data: mockFeedback });

        const result = await HelpService.getFeedback();

        expect(mockApi.get).toHaveBeenCalledWith('/help/feedback', { params: undefined });
        expect(result).toEqual(mockFeedback);
      });

      it('should fetch feedback with page filter', async () => {
        const mockFeedback: HelpFeedback[] = [];
        mockApi.get.mockResolvedValue({ data: mockFeedback });

        await HelpService.getFeedback({ page: '/upload' });

        expect(mockApi.get).toHaveBeenCalledWith('/help/feedback', {
          params: { page: '/upload' },
        });
      });

      it('should fetch feedback with type filter', async () => {
        const mockFeedback: HelpFeedback[] = [];
        mockApi.get.mockResolvedValue({ data: mockFeedback });

        await HelpService.getFeedback({ type: 'bug' });

        expect(mockApi.get).toHaveBeenCalledWith('/help/feedback', {
          params: { type: 'bug' },
        });
      });

      it('should handle errors when fetching feedback', async () => {
        const error = new Error('Access denied');
        mockApi.get.mockRejectedValue(error);

        await expect(HelpService.getFeedback()).rejects.toThrow('Access denied');
      });
    });
  });
});
