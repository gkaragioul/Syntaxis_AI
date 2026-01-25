import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useOnboarding } from '../../hooks/useOnboarding';
import { HelpService } from '../../services/HelpService';
import { useAuth } from '../../hooks/useAuth';

// Mock dependencies
jest.mock('../../services/HelpService');
jest.mock('../../hooks/useAuth');

const mockHelpService = HelpService as jest.Mocked<typeof HelpService>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('useOnboarding', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      login: jest.fn(),
      logout: jest.fn(),
      register: jest.fn(),
      logoutAll: jest.fn(),
      refreshToken: jest.fn(),
      getUserSessions: jest.fn(),
      changePassword: jest.fn(),
      updateProfile: jest.fn(),
      accessToken: 'mock-token',
      refreshToken: 'mock-refresh-token',
    });
  });

  describe('Initial State', () => {
    it('should initialize with correct default values', async () => {
      mockHelpService.getOnboardingStatus.mockResolvedValue({
        completed: false,
        currentStep: 1,
        completedSteps: [],
      });

      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isOpen).toBe(false);
      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should not fetch status when user is not authenticated', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        login: jest.fn(),
        logout: jest.fn(),
        register: jest.fn(),
        logoutAll: jest.fn(),
        refreshToken: jest.fn(),
        getUserSessions: jest.fn(),
        changePassword: jest.fn(),
        updateProfile: jest.fn(),
        accessToken: null,
        refreshToken: null,
      });

      renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      expect(mockHelpService.getOnboardingStatus).not.toHaveBeenCalled();
    });
  });

  describe('Onboarding Status Loading', () => {
    it('should fetch onboarding status when user is authenticated', async () => {
      const mockStatus = {
        completed: false,
        currentStep: 2,
        completedSteps: ['welcome'],
      };

      mockHelpService.getOnboardingStatus.mockResolvedValue(mockStatus);

      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(mockHelpService.getOnboardingStatus).toHaveBeenCalled();
        expect(result.current.status).toEqual(mockStatus);
      });
    });

    it('should handle loading errors gracefully', async () => {
      mockHelpService.getOnboardingStatus.mockRejectedValue(new Error('API Error'));

      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should not crash and should maintain default state
      expect(result.current.isOpen).toBe(false);
    });
  });

  describe('Auto-opening Onboarding', () => {
    it('should auto-open onboarding for new users', async () => {
      mockHelpService.getOnboardingStatus.mockResolvedValue({
        completed: false,
        currentStep: 1,
        completedSteps: [],
        skipped: false,
      });

      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isOpen).toBe(true);
      });
    });

    it('should not auto-open for completed onboarding', async () => {
      mockHelpService.getOnboardingStatus.mockResolvedValue({
        completed: true,
        currentStep: 6,
        completedSteps: ['welcome', 'upload', 'extraction', 'templates', 'batch', 'export'],
      });

      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isOpen).toBe(false);
    });

    it('should not auto-open for skipped onboarding', async () => {
      mockHelpService.getOnboardingStatus.mockResolvedValue({
        completed: false,
        currentStep: 1,
        completedSteps: [],
        skipped: true,
      });

      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isOpen).toBe(false);
    });
  });

  describe('Manual Controls', () => {
    it('should allow manual opening of onboarding', async () => {
      mockHelpService.getOnboardingStatus.mockResolvedValue({
        completed: true,
        currentStep: 6,
        completedSteps: ['welcome', 'upload', 'extraction', 'templates', 'batch', 'export'],
      });

      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isOpen).toBe(false);

      // Manually open onboarding
      result.current.openOnboarding();

      expect(result.current.isOpen).toBe(true);
    });

    it('should allow manual closing of onboarding', async () => {
      mockHelpService.getOnboardingStatus.mockResolvedValue({
        completed: false,
        currentStep: 1,
        completedSteps: [],
      });

      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isOpen).toBe(true);
      });

      // Manually close onboarding
      result.current.closeOnboarding();

      expect(result.current.isOpen).toBe(false);
    });
  });

  describe('Step Updates', () => {
    it('should update step completion status', async () => {
      mockHelpService.getOnboardingStatus.mockResolvedValue({
        completed: false,
        currentStep: 1,
        completedSteps: [],
      });
      mockHelpService.updateOnboardingStep.mockResolvedValue();

      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.updateStep('welcome', true);

      expect(mockHelpService.updateOnboardingStep).toHaveBeenCalledWith('welcome', true);
    });

    it('should handle step update errors', async () => {
      mockHelpService.getOnboardingStatus.mockResolvedValue({
        completed: false,
        currentStep: 1,
        completedSteps: [],
      });
      mockHelpService.updateOnboardingStep.mockRejectedValue(new Error('Update failed'));

      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should not throw error
      await expect(result.current.updateStep('welcome', true)).rejects.toThrow('Update failed');
    });
  });

  describe('Skip Onboarding', () => {
    it('should skip onboarding and close dialog', async () => {
      mockHelpService.getOnboardingStatus.mockResolvedValue({
        completed: false,
        currentStep: 1,
        completedSteps: [],
      });
      mockHelpService.skipOnboarding.mockResolvedValue();

      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isOpen).toBe(true);
      });

      await result.current.skipOnboarding();

      expect(mockHelpService.skipOnboarding).toHaveBeenCalled();
      expect(result.current.isOpen).toBe(false);
    });

    it('should handle skip onboarding errors', async () => {
      mockHelpService.getOnboardingStatus.mockResolvedValue({
        completed: false,
        currentStep: 1,
        completedSteps: [],
      });
      mockHelpService.skipOnboarding.mockRejectedValue(new Error('Skip failed'));

      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should not throw error
      await expect(result.current.skipOnboarding()).rejects.toThrow('Skip failed');
    });
  });
});
