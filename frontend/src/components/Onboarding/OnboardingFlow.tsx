// @ts-nocheck
import React, { useState, useEffect } from 'react';
import {
    Box,
    Stepper,
    Step,
    StepLabel,
    Button,
    Typography,
    Paper,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    IconButton,
    Alert,
    CircularProgress,
    useTheme,
    useMediaQuery,
} from '@mui/material';
import { Close as CloseIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { useOnboarding } from '../../hooks/useOnboarding';
import { useAccessibility } from '../../hooks/useAccessibility';
import { WelcomeStep } from './steps/WelcomeStep';
import { UploadStep } from './steps/UploadStep';
import { ExtractionStep } from './steps/ExtractionStep';
import { TemplatesStep } from './steps/TemplatesStep';
import { BatchStep } from './steps/BatchStep';
import { ExportStep } from './steps/ExportStep';

const steps = [
    { id: 'welcome', label: 'Welcome', component: WelcomeStep },
    { id: 'upload', label: 'Upload PDFs', component: UploadStep },
    { id: 'extraction', label: 'Table Extraction', component: ExtractionStep },
    { id: 'templates', label: 'Templates', component: TemplatesStep },
    { id: 'batch', label: 'Batch Processing', component: BatchStep },
    { id: 'export', label: 'Export Results', component: ExportStep },
];

interface OnboardingFlowProps {
    open: boolean;
    onClose: () => void;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ open, onClose }) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const [activeStep, setActiveStep] = useState(0);

    const {
        status,
        isLoading,
        error,
        updateStep,
        skipOnboarding,
        retryOperation,
        trackStepStart,
        trackHelpAccess,
        isUpdating,
        isSkipping,
        analytics,
    } = useOnboarding();

    const {
        announce,
        focusElement,
        updateFocusableElements,
        handleKeyDown,
        generateId,
        getStepAriaAttributes,
        getProgressAriaAttributes,
        checkMotionPreferences,
    } = useAccessibility({
        announcePageChanges: true,
        manageFocus: true,
        enableKeyboardNavigation: true,
        reducedMotion: checkMotionPreferences(),
    });

    useEffect(() => {
        if (status?.currentStep) {
            setActiveStep(status.currentStep - 1);
        }
    }, [status?.currentStep]);

    // Track step changes and announce to screen readers
    useEffect(() => {
        if (activeStep >= 0 && activeStep < steps.length) {
            const currentStepId = steps[activeStep].id;
            const stepName = steps[activeStep].label;

            trackStepStart(currentStepId);

            // Announce step change to screen readers
            announce(
                `Now on ${stepName}, step ${activeStep + 1} of ${steps.length}. ${
                    activeStep === 0
                        ? 'Welcome to the onboarding process.'
                        : `You have completed ${activeStep} of ${steps.length} steps.`
                }`
            );
        }
    }, [activeStep, trackStepStart, announce]);

    const handleNext = async () => {
        try {
            const currentStepId = steps[activeStep].id;
            const currentStepName = steps[activeStep].label;

            await updateStep(currentStepId, true);

            // Announce step completion
            announce(`${currentStepName} completed successfully.`, 'polite');

            // Only advance to next step if this isn't the last step
            if (activeStep < steps.length - 1) {
                setActiveStep((prev) => prev + 1);
            } else {
                // Last step completed, close onboarding
                announce('Congratulations! You have completed the onboarding process.', 'assertive');
                onClose();
            }
        } catch (error) {
            console.error('Failed to update step:', error);
            announce('There was an error saving your progress. Please try again.', 'assertive');
            // Error is handled by the hook and displayed in the UI
        }
    };

    const handleBack = () => {
        setActiveStep((prev) => Math.max(prev - 1, 0));
    };

    const handleSkip = async () => {
        try {
            await skipOnboarding();
        } catch (error) {
            console.error('Failed to skip onboarding:', error);
            // Error is handled by the hook and displayed in the UI
        }
    };

    const handleClose = () => {
        if (status?.completed) {
            onClose();
        } else {
            // Show confirmation dialog
            if (window.confirm('Are you sure you want to skip the onboarding? You can always access it later from the help menu.')) {
                handleSkip();
            }
        }
    };

    if (isLoading) {
        return (
            <Dialog open={open} maxWidth="sm">
                <DialogContent>
                    <Box display="flex" alignItems="center" justifyContent="center" p={4}>
                        <CircularProgress />
                        <Typography variant="body1" sx={{ ml: 2 }}>
                            Loading onboarding...
                        </Typography>
                    </Box>
                </DialogContent>
            </Dialog>
        );
    }

    const CurrentStepComponent = steps[activeStep].component;
    const dialogId = generateId('onboarding-dialog');
    const titleId = generateId('onboarding-title');
    const contentId = generateId('onboarding-content');
    const stepAriaAttributes = getStepAriaAttributes(activeStep, steps.length, steps[activeStep].label);
    const progressAriaAttributes = getProgressAriaAttributes(activeStep + 1, steps.length);

    // Handle keyboard navigation
    useEffect(() => {
        const handleDialogKeyDown = (event: KeyboardEvent) => {
            handleKeyDown(event);

            // Handle escape key
            if (event.key === 'Escape') {
                handleClose();
            }
        };

        if (open) {
            document.addEventListener('keydown', handleDialogKeyDown);
            return () => {
                document.removeEventListener('keydown', handleDialogKeyDown);
            };
        }
    }, [open, handleKeyDown, handleClose]);

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="md"
            fullWidth
            fullScreen={isMobile}
            aria-labelledby={titleId}
            aria-describedby={contentId}
            role="dialog"
            aria-modal="true"
            PaperProps={{
                sx: {
                    minHeight: isMobile ? '100vh' : '80vh',
                    maxHeight: isMobile ? '100vh' : '90vh',
                },
                id: dialogId,
                role: 'document',
            }}
        >
            <DialogTitle id={titleId}>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Typography
                        variant="h6"
                        component="h1"
                        aria-level={1}
                    >
                        Getting Started with SyntaxisAI
                    </Typography>
                    <IconButton
                        onClick={handleClose}
                        size="small"
                        aria-label="Close onboarding dialog"
                        title="Close onboarding dialog"
                    >
                        <CloseIcon />
                    </IconButton>
                </Box>
            </DialogTitle>

            <DialogContent id={contentId}>
                {/* Error Alert */}
                {error && (
                    <Alert
                        severity="error"
                        sx={{ mb: 2 }}
                        role="alert"
                        aria-live="assertive"
                        action={
                            <Button
                                color="inherit"
                                size="small"
                                onClick={retryOperation}
                                startIcon={<RefreshIcon />}
                                aria-label="Retry operation"
                            >
                                Retry
                            </Button>
                        }
                    >
                        {error}
                    </Alert>
                )}

                <Box sx={{ width: '100%', mb: 4 }}>
                    <Box
                        {...progressAriaAttributes}
                        sx={{ mb: 2 }}
                    >
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            id={`${dialogId}-progress-text`}
                            aria-live="polite"
                        >
                            Step {activeStep + 1} of {steps.length}
                        </Typography>
                    </Box>

                    <Stepper
                        activeStep={activeStep}
                        alternativeLabel={!isMobile}
                        orientation={isMobile ? 'vertical' : 'horizontal'}
                        role="tablist"
                        aria-label="Onboarding progress"
                    >
                        {steps.map((step, index) => (
                            <Step
                                key={step.id}
                                completed={status?.completedSteps?.includes(step.id)}
                            >
                                <StepLabel
                                    error={error && activeStep === index}
                                    aria-current={activeStep === index ? 'step' : undefined}
                                    aria-label={`${step.label}${
                                        status?.completedSteps?.includes(step.id) ? ' - completed' : ''
                                    }${activeStep === index ? ' - current step' : ''}`}
                                >
                                    {step.label}
                                </StepLabel>
                            </Step>
                        ))}
                    </Stepper>
                </Box>

                <Paper
                    elevation={0}
                    sx={{
                        p: 3,
                        bgcolor: 'background.default',
                        borderRadius: 2,
                        minHeight: '400px',
                        position: 'relative',
                    }}
                    {...stepAriaAttributes}
                    id={`step-${activeStep}-content`}
                    tabIndex={-1}
                    ref={(element) => {
                        if (element) {
                            updateFocusableElements(element);
                        }
                    }}
                >
                    {/* Loading overlay */}
                    {(isUpdating || isSkipping) && (
                        <Box
                            position="absolute"
                            top={0}
                            left={0}
                            right={0}
                            bottom={0}
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                            bgcolor="rgba(255, 255, 255, 0.8)"
                            zIndex={1}
                            borderRadius={2}
                            role="status"
                            aria-live="polite"
                            aria-label={isUpdating ? 'Saving progress' : 'Skipping onboarding'}
                        >
                            <CircularProgress aria-hidden="true" />
                            <Typography variant="body2" sx={{ ml: 2 }}>
                                {isUpdating ? 'Saving progress...' : 'Skipping onboarding...'}
                            </Typography>
                        </Box>
                    )}

                    <Box
                        id={`step-${activeStep}-description`}
                        sx={{ mb: 2 }}
                    >
                        <Typography
                            variant="h2"
                            component="h2"
                            sx={{ fontSize: '1.5rem', mb: 1 }}
                            aria-level={2}
                        >
                            {steps[activeStep].label}
                        </Typography>
                    </Box>

                    <CurrentStepComponent
                        onComplete={handleNext}
                        onBack={handleBack}
                        isLastStep={activeStep === steps.length - 1}
                    />
                </Paper>
            </DialogContent>

            <DialogActions sx={{ p: 2, pt: 0 }} role="group" aria-label="Onboarding navigation">
                <Box display="flex" justifyContent="space-between" width="100%">
                    <Button
                        onClick={handleBack}
                        disabled={activeStep === 0 || isUpdating || isSkipping}
                        variant="outlined"
                        aria-label={`Go back to ${activeStep > 0 ? steps[activeStep - 1].label : 'previous step'}`}
                        aria-describedby={activeStep === 0 ? undefined : `step-${activeStep - 1}-description`}
                    >
                        Back
                    </Button>
                    <Box>
                        <Button
                            onClick={handleSkip}
                            sx={{ mr: 1 }}
                            variant="text"
                            color="inherit"
                            disabled={isUpdating || isSkipping}
                            aria-label="Skip the entire onboarding process"
                            aria-describedby="skip-warning"
                        >
                            {isSkipping ? 'Skipping...' : 'Skip'}
                        </Button>
                        {activeStep === steps.length - 1 ? (
                            <Button
                                onClick={handleNext}
                                variant="contained"
                                color="success"
                                disabled={isUpdating || isSkipping}
                                aria-label="Complete the onboarding process"
                                aria-describedby="completion-info"
                            >
                                {isUpdating ? 'Completing...' : 'Complete Onboarding'}
                            </Button>
                        ) : (
                            <Button
                                onClick={handleNext}
                                variant="contained"
                                color="primary"
                                disabled={isUpdating || isSkipping}
                                aria-label={`Continue to ${steps[activeStep + 1]?.label || 'next step'}`}
                                aria-describedby={`step-${activeStep + 1}-description`}
                            >
                                {isUpdating ? 'Saving...' : 'Next'}
                            </Button>
                        )}
                    </Box>
                </Box>

                {/* Hidden descriptive text for screen readers */}
                <Box sx={{ position: 'absolute', left: '-10000px' }}>
                    <div id="skip-warning">
                        Skipping will close the onboarding and you can access it later from the help menu.
                    </div>
                    <div id="completion-info">
                        This will complete your onboarding and take you to the main application.
                    </div>
                </Box>
            </DialogActions>
        </Dialog>
    );
}; 