import { HelpService } from '../../services/HelpService';
import { User } from '../../models/User';
import { Redis } from 'ioredis';

// Mock dependencies
jest.mock('ioredis');
jest.mock('../../models/User');
jest.mock('../../config', () => ({
  config: {
    redis: {
      url: 'redis://localhost:6379',
    },
  },
}));

const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
} as any;

const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  onboardingCompleted: false,
  onboardingSkipped: false,
  onboardingStep: 0,
  completedOnboardingSteps: [],
  save: jest.fn(),
};

describe('HelpService', () => {
  let helpService: HelpService;

  beforeEach(() => {
    jest.clearAllMocks();
    (Redis as jest.MockedClass<typeof Redis>).mockImplementation(
      () => mockRedis,
    );
    helpService = new HelpService();
  });

  describe('getOnboardingStatus', () => {
    it('should return cached status when available', async () => {
      const cachedStatus = {
        completed: false,
        currentStep: 2,
        completedSteps: ['welcome'],
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(cachedStatus));

      const result = await helpService.getOnboardingStatus('user-123');

      expect(mockRedis.get).toHaveBeenCalledWith('onboarding:user-123');
      expect(result).toEqual(cachedStatus);
      expect(User.findById).not.toHaveBeenCalled();
    });

    it('should fetch from database when cache is empty', async () => {
      mockRedis.get.mockResolvedValue(null);
      (User.findById as jest.Mock).mockResolvedValue(mockUser);

      const result = await helpService.getOnboardingStatus('user-123');

      expect(mockRedis.get).toHaveBeenCalledWith('onboarding:user-123');
      expect(User.findById).toHaveBeenCalledWith('user-123');
      expect(result).toEqual({
        completed: false,
        currentStep: 0,
        completedSteps: [],
      });
    });

    it('should cache the result after fetching from database', async () => {
      mockRedis.get.mockResolvedValue(null);
      (User.findById as jest.Mock).mockResolvedValue(mockUser);

      await helpService.getOnboardingStatus('user-123');

      expect(mockRedis.set).toHaveBeenCalledWith(
        'onboarding:user-123',
        JSON.stringify({
          completed: false,
          currentStep: 0,
          completedSteps: [],
        }),
        'EX',
        3600,
      );
    });

    it('should throw error when user not found', async () => {
      mockRedis.get.mockResolvedValue(null);
      (User.findById as jest.Mock).mockResolvedValue(null);

      await expect(
        helpService.getOnboardingStatus('nonexistent'),
      ).rejects.toThrow('User not found');
    });

    it('should handle users with existing onboarding progress', async () => {
      const userWithProgress = {
        ...mockUser,
        onboardingCompleted: false,
        onboardingStep: 3,
        completedOnboardingSteps: ['welcome', 'upload', 'extraction'],
      };

      mockRedis.get.mockResolvedValue(null);
      (User.findById as jest.Mock).mockResolvedValue(userWithProgress);

      const result = await helpService.getOnboardingStatus('user-123');

      expect(result).toEqual({
        completed: false,
        currentStep: 3,
        completedSteps: ['welcome', 'upload', 'extraction'],
      });
    });
  });

  describe('updateOnboardingStatus', () => {
    beforeEach(() => {
      // Mock the private methods
      (helpService as any).getStepOrder = jest.fn().mockReturnValue(1);
      (helpService as any).getTotalSteps = jest.fn().mockReturnValue(6);
    });

    it('should add step to completed steps when marking as completed', async () => {
      (User.findById as jest.Mock).mockResolvedValue(mockUser);

      await helpService.updateOnboardingStatus('user-123', 'welcome', true);

      expect(mockUser.completedOnboardingSteps).toContain('welcome');
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should remove step from completed steps when marking as incomplete', async () => {
      const userWithSteps = {
        ...mockUser,
        completedOnboardingSteps: ['welcome', 'upload'],
      };

      (User.findById as jest.Mock).mockResolvedValue(userWithSteps);

      await helpService.updateOnboardingStatus('user-123', 'welcome', false);

      expect(userWithSteps.completedOnboardingSteps).not.toContain('welcome');
      expect(userWithSteps.save).toHaveBeenCalled();
    });

    it('should update onboarding step to maximum completed step', async () => {
      (User.findById as jest.Mock).mockResolvedValue(mockUser);
      (helpService as any).getStepOrder = jest.fn().mockReturnValue(3);

      await helpService.updateOnboardingStatus('user-123', 'extraction', true);

      expect(mockUser.onboardingStep).toBe(3);
    });

    it('should mark onboarding as completed when all steps are done', async () => {
      (User.findById as jest.Mock).mockResolvedValue(mockUser);
      (helpService as any).getTotalSteps = jest.fn().mockReturnValue(1); // Only one step for this test

      await helpService.updateOnboardingStatus('user-123', 'welcome', true);

      expect(mockUser.onboardingCompleted).toBe(true);
    });

    it('should update cache after updating status', async () => {
      (User.findById as jest.Mock).mockResolvedValue(mockUser);

      await helpService.updateOnboardingStatus('user-123', 'welcome', true);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'onboarding:user-123',
        expect.stringContaining('"completed"'),
        'EX',
        3600,
      );
    });

    it('should throw error when user not found', async () => {
      (User.findById as jest.Mock).mockResolvedValue(null);

      await expect(
        helpService.updateOnboardingStatus('nonexistent', 'welcome', true),
      ).rejects.toThrow('User not found');
    });

    it('should handle duplicate step completion', async () => {
      const userWithSteps = {
        ...mockUser,
        completedOnboardingSteps: ['welcome'],
      };

      (User.findById as jest.Mock).mockResolvedValue(userWithSteps);

      await helpService.updateOnboardingStatus('user-123', 'welcome', true);

      // Should not duplicate the step
      const welcomeCount = userWithSteps.completedOnboardingSteps.filter(
        (step) => step === 'welcome',
      ).length;
      expect(welcomeCount).toBe(1);
    });
  });

  describe('skipOnboarding', () => {
    it('should mark onboarding as completed and skipped', async () => {
      (User.findById as jest.Mock).mockResolvedValue(mockUser);
      (helpService as any).getTotalSteps = jest.fn().mockReturnValue(6);

      await helpService.skipOnboarding('user-123');

      expect(mockUser.onboardingCompleted).toBe(true);
      expect(mockUser.onboardingSkipped).toBe(true);
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should update cache with skipped status', async () => {
      (User.findById as jest.Mock).mockResolvedValue(mockUser);
      (helpService as any).getTotalSteps = jest.fn().mockReturnValue(6);

      await helpService.skipOnboarding('user-123');

      expect(mockRedis.set).toHaveBeenCalledWith(
        'onboarding:user-123',
        JSON.stringify({
          completed: true,
          currentStep: 6,
          completedSteps: [],
          skipped: true,
        }),
        'EX',
        3600,
      );
    });

    it('should throw error when user not found', async () => {
      (User.findById as jest.Mock).mockResolvedValue(null);

      await expect(helpService.skipOnboarding('nonexistent')).rejects.toThrow(
        'User not found',
      );
    });

    it('should handle already skipped onboarding', async () => {
      const skippedUser = {
        ...mockUser,
        onboardingCompleted: true,
        onboardingSkipped: true,
      };

      (User.findById as jest.Mock).mockResolvedValue(skippedUser);
      (helpService as any).getTotalSteps = jest.fn().mockReturnValue(6);

      await helpService.skipOnboarding('user-123');

      // Should still work without issues
      expect(skippedUser.onboardingCompleted).toBe(true);
      expect(skippedUser.onboardingSkipped).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle Redis connection errors gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));
      (User.findById as jest.Mock).mockResolvedValue(mockUser);

      // Should fall back to database
      const result = await helpService.getOnboardingStatus('user-123');

      expect(result).toEqual({
        completed: false,
        currentStep: 0,
        completedSteps: [],
      });
    });

    it('should handle database save errors', async () => {
      (User.findById as jest.Mock).mockResolvedValue(mockUser);
      mockUser.save.mockRejectedValue(new Error('Database error'));

      await expect(
        helpService.updateOnboardingStatus('user-123', 'welcome', true),
      ).rejects.toThrow('Database error');
    });

    it('should handle cache update errors gracefully', async () => {
      (User.findById as jest.Mock).mockResolvedValue(mockUser);
      mockRedis.set.mockRejectedValue(new Error('Cache error'));

      // Should not throw error, just log it
      await expect(
        helpService.updateOnboardingStatus('user-123', 'welcome', true),
      ).resolves.not.toThrow();
    });
  });

  describe('Performance', () => {
    it('should use cache for repeated requests', async () => {
      const cachedStatus = {
        completed: false,
        currentStep: 2,
        completedSteps: ['welcome'],
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(cachedStatus));

      // Make multiple requests
      await helpService.getOnboardingStatus('user-123');
      await helpService.getOnboardingStatus('user-123');
      await helpService.getOnboardingStatus('user-123');

      expect(mockRedis.get).toHaveBeenCalledTimes(3);
      expect(User.findById).not.toHaveBeenCalled();
    });

    it('should set appropriate cache TTL', async () => {
      mockRedis.get.mockResolvedValue(null);
      (User.findById as jest.Mock).mockResolvedValue(mockUser);

      await helpService.getOnboardingStatus('user-123');

      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        'EX',
        3600, // 1 hour TTL
      );
    });
  });
});
