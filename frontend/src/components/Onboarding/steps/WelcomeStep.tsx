import React from 'react';
import {
    Box,
    Typography,
    Button,
    Grid,
    Card,
    CardContent,
    useTheme,
} from '@mui/material';
import {
    CloudUpload as UploadIcon,
    TableChart as TableIcon,
    Save as SaveIcon,
    PlaylistAdd as BatchIcon,
    FileDownload as ExportIcon,
} from '@mui/icons-material';

interface WelcomeStepProps {
    onComplete: () => void;
    onBack: () => void;
    isLastStep: boolean;
}

export const WelcomeStep: React.FC<WelcomeStepProps> = ({
    onComplete,
    onBack,
    isLastStep,
}) => {
    const theme = useTheme();

    const features = [
        {
            icon: <UploadIcon sx={{ fontSize: 40, color: theme.palette.primary.main }} />,
            title: 'Upload PDFs',
            description: 'Upload single or multiple PDFs for processing',
        },
        {
            icon: <TableIcon sx={{ fontSize: 40, color: theme.palette.primary.main }} />,
            title: 'Table Extraction',
            description: 'Extract and review tables from your PDFs',
        },
        {
            icon: <SaveIcon sx={{ fontSize: 40, color: theme.palette.primary.main }} />,
            title: 'Save Templates',
            description: 'Create and save extraction templates for reuse',
        },
        {
            icon: <BatchIcon sx={{ fontSize: 40, color: theme.palette.primary.main }} />,
            title: 'Batch Processing',
            description: 'Process multiple PDFs using your templates',
        },
        {
            icon: <ExportIcon sx={{ fontSize: 40, color: theme.palette.primary.main }} />,
            title: 'Export Results',
            description: 'Export your data in various formats',
        },
    ];

    return (
        <Box>
            <Box mb={4}>
                <Typography variant="h4" gutterBottom>
                    Welcome to SyntaxisAI
                </Typography>
                <Typography variant="body1" color="text.secondary" paragraph>
                    Let's get you started with the essential features of our platform.
                    We'll guide you through the process of extracting data from your PDFs
                    efficiently.
                </Typography>
            </Box>

            <Grid container spacing={3} mb={4}>
                {features.map((feature, index) => (
                    <Grid item xs={12} sm={6} md={4} key={index}>
                        <Card
                            sx={{
                                height: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                transition: 'transform 0.2s',
                                '&:hover': {
                                    transform: 'translateY(-4px)',
                                },
                            }}
                        >
                            <CardContent>
                                <Box
                                    display="flex"
                                    flexDirection="column"
                                    alignItems="center"
                                    textAlign="center"
                                >
                                    {feature.icon}
                                    <Typography
                                        variant="h6"
                                        sx={{ mt: 2, mb: 1 }}
                                    >
                                        {feature.title}
                                    </Typography>
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                    >
                                        {feature.description}
                                    </Typography>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            <Box
                display="flex"
                justifyContent="center"
                mt={4}
            >
                <Button
                    variant="contained"
                    color="primary"
                    size="large"
                    onClick={onComplete}
                >
                    Start Tutorial
                </Button>
            </Box>
        </Box>
    );
}; 