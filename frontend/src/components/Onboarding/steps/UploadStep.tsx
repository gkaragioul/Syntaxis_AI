// @ts-nocheck
import React, { useState, useCallback } from 'react';
import {
    Box,
    Typography,
    Button,
    Paper,
    Grid,
    Card,
    CardContent,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Stepper,
    Step,
    StepLabel,
    StepContent,
    useTheme,
    alpha,
} from '@mui/material';
import {
    CloudUpload as UploadIcon,
    CheckCircle as CheckIcon,
    Description as FileIcon,
    Speed as SpeedIcon,
    Security as SecurityIcon,
    Folder as FolderIcon,
} from '@mui/icons-material';

interface Props {
    onComplete: () => void;
    onBack: () => void;
    isLastStep?: boolean;
}

const uploadSteps = [
    {
        label: 'Select Files',
        description: 'Choose PDF files from your computer',
        icon: <FolderIcon />,
    },
    {
        label: 'Upload Progress',
        description: 'Files are securely uploaded to our servers',
        icon: <UploadIcon />,
    },
    {
        label: 'Processing',
        description: 'PDFs are prepared for table extraction',
        icon: <SpeedIcon />,
    },
    {
        label: 'Ready',
        description: 'Files are ready for table extraction',
        icon: <CheckIcon />,
    },
];

const features = [
    {
        icon: <SecurityIcon color="primary" />,
        title: 'Secure Upload',
        description: 'Your files are encrypted during transfer and storage',
    },
    {
        icon: <SpeedIcon color="primary" />,
        title: 'Fast Processing',
        description: 'Optimized upload process for quick file handling',
    },
    {
        icon: <FileIcon color="primary" />,
        title: 'PDF Support',
        description: 'Supports all standard PDF formats and sizes',
    },
];

export const UploadStep: React.FC<Props> = ({ onComplete, onBack, isLastStep }) => {
    const theme = useTheme();
    const [activeStep, setActiveStep] = useState(0);
    const [isSimulating, setIsSimulating] = useState(false);

    const handleSimulateUpload = useCallback(() => {
        setIsSimulating(true);
        setActiveStep(0);

        // Simulate upload process
        const steps = [0, 1, 2, 3];
        steps.forEach((step, index) => {
            setTimeout(() => {
                setActiveStep(step);
                if (step === 3) {
                    setIsSimulating(false);
                }
            }, (index + 1) * 1000);
        });
    }, []);

    return (
        <Box>
            <Box mb={4}>
                <Typography variant="h4" gutterBottom>
                    Upload Your PDFs
                </Typography>
                <Typography variant="body1" color="text.secondary" paragraph>
                    Learn how to upload PDF files for table extraction. This step shows you
                    the upload process and what to expect when processing your documents.
                </Typography>
            </Box>

            <Grid container spacing={4}>
                {/* Upload Process Demo */}
                <Grid item xs={12} md={6}>
                    <Paper
                        elevation={2}
                        sx={{
                            p: 3,
                            height: '100%',
                            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
                        }}
                    >
                        <Typography variant="h6" gutterBottom>
                            Upload Process
                        </Typography>

                        <Stepper activeStep={activeStep} orientation="vertical">
                            {uploadSteps.map((step, index) => (
                                <Step key={step.label}>
                                    <StepLabel
                                        icon={step.icon}
                                        sx={{
                                            '& .MuiStepLabel-iconContainer': {
                                                color: activeStep >= index ? theme.palette.primary.main : theme.palette.grey[400],
                                            },
                                        }}
                                    >
                                        {step.label}
                                    </StepLabel>
                                    <StepContent>
                                        <Typography variant="body2" color="text.secondary">
                                            {step.description}
                                        </Typography>
                                    </StepContent>
                                </Step>
                            ))}
                        </Stepper>

                        <Box mt={3}>
                            <Button
                                variant="outlined"
                                onClick={handleSimulateUpload}
                                disabled={isSimulating}
                                startIcon={<UploadIcon />}
                                fullWidth
                            >
                                {isSimulating ? 'Simulating Upload...' : 'Try Upload Demo'}
                            </Button>
                        </Box>
                    </Paper>
                </Grid>

                {/* Features */}
                <Grid item xs={12} md={6}>
                    <Typography variant="h6" gutterBottom>
                        Upload Features
                    </Typography>

                    <Grid container spacing={2}>
                        {features.map((feature, index) => (
                            <Grid item xs={12} key={index}>
                                <Card
                                    sx={{
                                        transition: 'transform 0.2s',
                                        '&:hover': {
                                            transform: 'translateY(-2px)',
                                        },
                                    }}
                                >
                                    <CardContent>
                                        <Box display="flex" alignItems="flex-start" gap={2}>
                                            {feature.icon}
                                            <Box>
                                                <Typography variant="subtitle1" gutterBottom>
                                                    {feature.title}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    {feature.description}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </CardContent>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>
                </Grid>
            </Grid>

            {/* Tips */}
            <Box mt={4}>
                <Paper elevation={1} sx={{ p: 3, bgcolor: alpha(theme.palette.info.main, 0.05) }}>
                    <Typography variant="h6" gutterBottom color="info.main">
                        Upload Tips
                    </Typography>
                    <List dense>
                        <ListItem>
                            <ListItemIcon>
                                <CheckIcon color="success" fontSize="small" />
                            </ListItemIcon>
                            <ListItemText
                                primary="Supported formats: PDF files up to 50MB each"
                                secondary="Ensure your PDFs contain tables for best results"
                            />
                        </ListItem>
                        <ListItem>
                            <ListItemIcon>
                                <CheckIcon color="success" fontSize="small" />
                            </ListItemIcon>
                            <ListItemText
                                primary="Multiple files: Upload up to 10 files at once"
                                secondary="Batch processing saves time for multiple documents"
                            />
                        </ListItem>
                        <ListItem>
                            <ListItemIcon>
                                <CheckIcon color="success" fontSize="small" />
                            </ListItemIcon>
                            <ListItemText
                                primary="File quality: Clear, high-resolution PDFs work best"
                                secondary="Avoid scanned documents with poor image quality"
                            />
                        </ListItem>
                    </List>
                </Paper>
            </Box>

            {/* Navigation */}
            <Box
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                mt={4}
            >
                <Button onClick={onBack} variant="outlined">
                    Back
                </Button>
                <Button
                    variant="contained"
                    onClick={onComplete}
                    size="large"
                >
                    {isLastStep ? 'Complete' : 'Next: Table Extraction'}
                </Button>
            </Box>
        </Box>
    );
};