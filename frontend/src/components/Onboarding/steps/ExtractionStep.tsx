// @ts-nocheck
import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Button,
    Paper,
    Grid,
    Card,
    CardContent,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    LinearProgress,
    Alert,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    useTheme,
    alpha,
} from '@mui/material';
import {
    TableChart as TableIcon,
    Visibility as PreviewIcon,
    Edit as EditIcon,
    CheckCircle as CheckIcon,
    Warning as WarningIcon,
    Info as InfoIcon,
    AutoFixHigh as AutoIcon,
} from '@mui/icons-material';

interface Props {
    onComplete: () => void;
    onBack: () => void;
    isLastStep?: boolean;
}

// Sample extracted table data for demonstration
const sampleTableData = [
    { item: 'Software License', quantity: 1, unitPrice: 299.99, total: 299.99, confidence: 95 },
    { item: 'Support Package', quantity: 1, unitPrice: 99.99, total: 99.99, confidence: 88 },
    { item: 'Training Session', quantity: 2, unitPrice: 150.00, total: 300.00, confidence: 92 },
    { item: 'Implementation', quantity: 1, unitPrice: 500.00, total: 500.00, confidence: 78 },
];

const extractionFeatures = [
    {
        icon: <AutoIcon color="primary" />,
        title: 'AI-Powered Detection',
        description: 'Advanced algorithms automatically identify table structures',
    },
    {
        icon: <PreviewIcon color="primary" />,
        title: 'Real-time Preview',
        description: 'See extracted data immediately with confidence scores',
    },
    {
        icon: <EditIcon color="primary" />,
        title: 'Manual Corrections',
        description: 'Edit and refine extracted data for perfect accuracy',
    },
];

export const ExtractionStep: React.FC<Props> = ({ onComplete, onBack, isLastStep }) => {
    const theme = useTheme();
    const [extractionProgress, setExtractionProgress] = useState(0);
    const [isExtracting, setIsExtracting] = useState(false);
    const [showResults, setShowResults] = useState(false);

    const handleStartExtraction = () => {
        setIsExtracting(true);
        setExtractionProgress(0);
        setShowResults(false);

        // Simulate extraction progress
        const interval = setInterval(() => {
            setExtractionProgress((prev) => {
                if (prev >= 100) {
                    clearInterval(interval);
                    setIsExtracting(false);
                    setShowResults(true);
                    return 100;
                }
                return prev + 10;
            });
        }, 200);
    };

    const getConfidenceColor = (confidence: number) => {
        if (confidence >= 90) return 'success';
        if (confidence >= 75) return 'warning';
        return 'error';
    };

    const getConfidenceLabel = (confidence: number) => {
        if (confidence >= 90) return 'High';
        if (confidence >= 75) return 'Medium';
        return 'Low';
    };

    return (
        <Box>
            <Box mb={4}>
                <Typography variant="h4" gutterBottom>
                    Table Extraction
                </Typography>
                <Typography variant="body1" color="text.secondary" paragraph>
                    Learn how our AI extracts table data from your PDFs. This step demonstrates
                    the extraction process and shows you how to review and validate the results.
                </Typography>
            </Box>

            <Grid container spacing={4}>
                {/* Extraction Demo */}
                <Grid item xs={12} md={8}>
                    <Paper elevation={2} sx={{ p: 3 }}>
                        <Box display="flex" alignItems="center" gap={2} mb={3}>
                            <TableIcon color="primary" />
                            <Typography variant="h6">
                                Sample Invoice Table Extraction
                            </Typography>
                        </Box>

                        {!showResults && (
                            <Box>
                                <Alert severity="info" sx={{ mb: 3 }}>
                                    <Typography variant="body2">
                                        Click "Start Extraction Demo" to see how tables are processed
                                    </Typography>
                                </Alert>

                                <Button
                                    variant="contained"
                                    onClick={handleStartExtraction}
                                    disabled={isExtracting}
                                    startIcon={<TableIcon />}
                                    fullWidth
                                    size="large"
                                >
                                    {isExtracting ? 'Extracting...' : 'Start Extraction Demo'}
                                </Button>

                                {isExtracting && (
                                    <Box mt={3}>
                                        <Typography variant="body2" gutterBottom>
                                            Extraction Progress: {extractionProgress}%
                                        </Typography>
                                        <LinearProgress
                                            variant="determinate"
                                            value={extractionProgress}
                                            sx={{ height: 8, borderRadius: 4 }}
                                        />
                                    </Box>
                                )}
                            </Box>
                        )}

                        {showResults && (
                            <Box>
                                <Alert severity="success" sx={{ mb: 3 }}>
                                    <Typography variant="body2">
                                        Extraction completed! Review the results below.
                                    </Typography>
                                </Alert>

                                <TableContainer component={Paper} variant="outlined">
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell><strong>Item</strong></TableCell>
                                                <TableCell align="right"><strong>Qty</strong></TableCell>
                                                <TableCell align="right"><strong>Unit Price</strong></TableCell>
                                                <TableCell align="right"><strong>Total</strong></TableCell>
                                                <TableCell align="center"><strong>Confidence</strong></TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {sampleTableData.map((row, index) => (
                                                <TableRow key={index}>
                                                    <TableCell>{row.item}</TableCell>
                                                    <TableCell align="right">{row.quantity}</TableCell>
                                                    <TableCell align="right">${row.unitPrice.toFixed(2)}</TableCell>
                                                    <TableCell align="right">${row.total.toFixed(2)}</TableCell>
                                                    <TableCell align="center">
                                                        <Chip
                                                            label={`${getConfidenceLabel(row.confidence)} (${row.confidence}%)`}
                                                            color={getConfidenceColor(row.confidence)}
                                                            size="small"
                                                        />
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>

                                <Box mt={2}>
                                    <Typography variant="body2" color="text.secondary">
                                        <InfoIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 1 }} />
                                        Confidence scores help you identify which data might need manual review
                                    </Typography>
                                </Box>
                            </Box>
                        )}
                    </Paper>
                </Grid>

                {/* Features */}
                <Grid item xs={12} md={4}>
                    <Typography variant="h6" gutterBottom>
                        Extraction Features
                    </Typography>

                    <Grid container spacing={2}>
                        {extractionFeatures.map((feature, index) => (
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

            {/* Best Practices */}
            <Box mt={4}>
                <Paper elevation={1} sx={{ p: 3, bgcolor: alpha(theme.palette.success.main, 0.05) }}>
                    <Typography variant="h6" gutterBottom color="success.main">
                        Extraction Best Practices
                    </Typography>
                    <List dense>
                        <ListItem>
                            <ListItemIcon>
                                <CheckIcon color="success" fontSize="small" />
                            </ListItemIcon>
                            <ListItemText
                                primary="Review confidence scores"
                                secondary="Items with low confidence may need manual verification"
                            />
                        </ListItem>
                        <ListItem>
                            <ListItemIcon>
                                <CheckIcon color="success" fontSize="small" />
                            </ListItemIcon>
                            <ListItemText
                                primary="Check data formatting"
                                secondary="Ensure numbers, dates, and text are correctly formatted"
                            />
                        </ListItem>
                        <ListItem>
                            <ListItemIcon>
                                <CheckIcon color="success" fontSize="small" />
                            </ListItemIcon>
                            <ListItemText
                                primary="Validate totals"
                                secondary="Cross-check calculated totals with source document"
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
                    {isLastStep ? 'Complete' : 'Next: Templates'}
                </Button>
            </Box>
        </Box>
    );
};