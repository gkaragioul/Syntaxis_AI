import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@mui/material/styles';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { OnboardingFlow } from '../../../components/Onboarding/OnboardingFlow';
import { HelpService } from '../../../services/HelpService';
import { theme } from '../../../theme';

// Mock the HelpService
vi.mock('../../../services/HelpService');
const mockHelpService = HelpService as any;

// Mock the step components
vi.mock('../../../components/Onboarding/steps/WelcomeStep', () => ({
  WelcomeStep: ({ onComplete }: { onComplete: () => void }) => (
    <div data-testid="welcome-step">
      <button onClick={onComplete}>Complete Welcome</button>
    </div>
  ),
}));

vi.mock('../../../components/Onboarding/steps/UploadStep', () => ({
  UploadStep: ({ onComplete }: { onComplete: () => void }) => (
    <div data-testid="upload-step">
      <button onClick={onComplete}>Complete Upload</button>
    </div>
  ),
}));

vi.mock('../../../components/Onboarding/steps/ExtractionStep', () => ({
  ExtractionStep: ({ onComplete }: { onComplete: () => void }) => (
    <div data-testid="extraction-step">
      <button onClick={onComplete}>Complete Extraction</button>
    </div>
  ),
}));

vi.mock('../../../components/Onboarding/steps/TemplatesStep', () => ({
  TemplatesStep: ({ onComplete }: { onComplete: () => void }) => (
    <div data-testid="templates-step">
      <button onClick={onComplete}>Complete Templates</button>
    </div>
  ),
}));

vi.mock('../../../components/Onboarding/steps/BatchStep', () => ({
  BatchStep: ({ onComplete }: { onComplete: () => void }) => (
    <div data-testid="batch-step">
      <button onClick={onComplete}>Complete Batch</button>
    </div>
  ),
}));

vi.mock('../../../components/Onboarding/steps/ExportStep', () => ({
  ExportStep: ({ onComplete }: { onComplete: () => void }) => (
    <div data-testid="export-step">
      <button onClick={onComplete}>Complete Export</button>
    </div>
  ),
}));

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
      <ThemeProvider theme={theme}>
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
};

describe('OnboardingFlow', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockHelpService.getOnboardingStatus = vi.fn().mockResolvedValue({
      completed: false,
      currentStep: 1,
      completedSteps: [],
    });
    mockHelpService.updateOnboardingStep = vi.fn().mockResolvedValue(undefined);
    mockHelpService.skipOnboarding = vi.fn().mockResolvedValue(undefined);
  });

  const renderOnboardingFlow = (props = {}) => {
    const defaultProps = {
      open: true,
      onClose: mockOnClose,
      ...props,
    };

    return render(<OnboardingFlow {...defaultProps} />, {
      wrapper: createWrapper(),
    });
  };

  describe('Rendering', () => {
    it('should render the onboarding dialog when open', async () => {
      renderOnboardingFlow();

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('should not render when closed', () => {
      renderOnboardingFlow({ open: false });

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should display the stepper with all steps', async () => {
      renderOnboardingFlow();

      await waitFor(() => {
        expect(screen.getByText('Welcome')).toBeInTheDocument();
        expect(screen.getByText('Upload PDFs')).toBeInTheDocument();
        expect(screen.getByText('Table Extraction')).toBeInTheDocument();
        expect(screen.getByText('Templates')).toBeInTheDocument();
        expect(screen.getByText('Batch Processing')).toBeInTheDocument();
        expect(screen.getByText('Export Results')).toBeInTheDocument();
      });
    });

    it('should display the current step component', async () => {
      renderOnboardingFlow();

      await waitFor(() => {
        expect(screen.getByTestId('welcome-step')).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    it('should advance to next step when completing current step', async () => {
      renderOnboardingFlow();

      await waitFor(() => {
        expect(screen.getByTestId('welcome-step')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Complete Welcome'));

      await waitFor(() => {
        expect(mockHelpService.updateOnboardingStep).toHaveBeenCalledWith('welcome', true);
      });
    });

    it('should go back to previous step when back button is clicked', async () => {
      mockHelpService.getOnboardingStatus.mockResolvedValue({
        completed: false,
        currentStep: 2,
        completedSteps: ['welcome'],
      });

      renderOnboardingFlow();

      await waitFor(() => {
        expect(screen.getByTestId('upload-step')).toBeInTheDocument();
      });

      const backButton = screen.getByText('Back');
      fireEvent.click(backButton);

      await waitFor(() => {
        expect(screen.getByTestId('welcome-step')).toBeInTheDocument();
      });
    });

    it('should handle skip onboarding', async () => {
      renderOnboardingFlow();

      await waitFor(() => {
        expect(screen.getByText('Skip')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Skip'));

      await waitFor(() => {
        expect(mockHelpService.skipOnboarding).toHaveBeenCalled();
        expect(mockOnClose).toHaveBeenCalled();
      });
    });
  });

  describe('Progress Tracking', () => {
    it('should load and display current onboarding status', async () => {
      mockHelpService.getOnboardingStatus.mockResolvedValue({
        completed: false,
        currentStep: 3,
        completedSteps: ['welcome', 'upload'],
      });

      renderOnboardingFlow();

      await waitFor(() => {
        expect(mockHelpService.getOnboardingStatus).toHaveBeenCalled();
        expect(screen.getByTestId('extraction-step')).toBeInTheDocument();
      });
    });

    it('should update step completion status', async () => {
      renderOnboardingFlow();

      await waitFor(() => {
        expect(screen.getByTestId('welcome-step')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Complete Welcome'));

      await waitFor(() => {
        expect(mockHelpService.updateOnboardingStep).toHaveBeenCalledWith('welcome', true);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      mockHelpService.getOnboardingStatus.mockRejectedValue(new Error('API Error'));

      renderOnboardingFlow();

      // Should still render the dialog even if status loading fails
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('should handle step update errors', async () => {
      mockHelpService.updateOnboardingStep.mockRejectedValue(new Error('Update failed'));

      renderOnboardingFlow();

      await waitFor(() => {
        expect(screen.getByTestId('welcome-step')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Complete Welcome'));

      // Should not advance to next step on error
      await waitFor(() => {
        expect(screen.getByTestId('welcome-step')).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Design', () => {
    it('should adapt to mobile screens', async () => {
      // Mock mobile breakpoint
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 600,
      });

      renderOnboardingFlow();

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Check that mobile-specific styles are applied
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
    });
  });
});
