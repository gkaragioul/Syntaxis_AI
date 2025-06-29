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
    useTheme,
    useMediaQuery,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { HelpService, OnboardingStatus } from '../../services/HelpService';
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
    const queryClient = useQueryClient();

    const { data: status, isLoading } = useQuery<OnboardingStatus>({
        queryKey: ['onboardingStatus'],
        queryFn: HelpService.getOnboardingStatus,
        enabled: open,
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
            onClose();
        },
    });

    useEffect(() => {
        if (status?.currentStep) {
            setActiveStep(status.currentStep - 1);
        }
    }, [status?.currentStep]);

    const handleNext = async () => {
        const currentStepId = steps[activeStep].id;
        await updateStepMutation.mutateAsync({
            stepId: currentStepId,
            completed: true,
        });
        setActiveStep((prev) => Math.min(prev + 1, steps.length - 1));
    };

    const handleBack = () => {
        setActiveStep((prev) => Math.max(prev - 1, 0));
    };

    const handleSkip = async () => {
        await skipMutation.mutateAsync();
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
        return null;
    }

    const CurrentStepComponent = steps[activeStep].component;

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="md"
            fullWidth
            fullScreen={isMobile}
            PaperProps={{
                sx: {
                    minHeight: isMobile ? '100vh' : '80vh',
                    maxHeight: isMobile ? '100vh' : '90vh',
                },
            }}
        >
            <DialogTitle>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Typography variant="h6">Getting Started with SyntaxisAI</Typography>
                    <IconButton onClick={handleClose} size="small">
                        <CloseIcon />
                    </IconButton>
                </Box>
            </DialogTitle>

            <DialogContent>
                <Box sx={{ width: '100%', mb: 4 }}>
                    <Stepper
                        activeStep={activeStep}
                        alternativeLabel={!isMobile}
                        orientation={isMobile ? 'vertical' : 'horizontal'}
                    >
                        {steps.map((step) => (
                            <Step key={step.id}>
                                <StepLabel>{step.label}</StepLabel>
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
                    }}
                >
                    <CurrentStepComponent
                        onComplete={handleNext}
                        onBack={handleBack}
                        isLastStep={activeStep === steps.length - 1}
                    />
                </Paper>
            </DialogContent>

            <DialogActions sx={{ p: 2, pt: 0 }}>
                <Box display="flex" justifyContent="space-between" width="100%">
                    <Button
                        onClick={handleBack}
                        disabled={activeStep === 0}
                        variant="outlined"
                    >
                        Back
                    </Button>
                    <Box>
                        <Button
                            onClick={handleSkip}
                            sx={{ mr: 1 }}
                            variant="text"
                            color="inherit"
                        >
                            Skip
                        </Button>
                        {activeStep === steps.length - 1 ? (
                            <Button
                                onClick={onClose}
                                variant="contained"
                                color="primary"
                            >
                                Finish
                            </Button>
                        ) : (
                            <Button
                                onClick={handleNext}
                                variant="contained"
                                color="primary"
                            >
                                Next
                            </Button>
                        )}
                    </Box>
                </Box>
            </DialogActions>
        </Dialog>
    );
}; 