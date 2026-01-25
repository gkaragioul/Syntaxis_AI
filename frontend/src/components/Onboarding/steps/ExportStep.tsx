// @ts-nocheck
import React, { useState } from 'react';
import {
    Box,
    Typography,
    Button,
    Paper,
    Grid,
    Card,
    CardContent,
    CardActions,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Chip,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    FormControlLabel,
    Checkbox,
    Alert,
    Divider,
    useTheme,
    alpha,
} from '@mui/material';
import {
    GetApp as DownloadIcon,
    TableChart as ExcelIcon,
    Description as CsvIcon,
    Code as JsonIcon,
    PictureAsPdf as PdfIcon,
    CheckCircle as CheckIcon,
    Settings as SettingsIcon,
    CloudDownload as CloudIcon,
    Share as ShareIcon,
    Schedule as ScheduleIcon,
} from '@mui/icons-material';

interface Props {
    onComplete: () => void;
    onBack: () => void;
    isLastStep?: boolean;
}

const exportFormats = [
    {
        id: 'excel',
        name: 'Microsoft Excel',
        description: 'XLSX format with formatted tables and formulas',
        icon: <ExcelIcon color="success" />,
        features: ['Formatted tables', 'Formulas', 'Multiple sheets', 'Charts'],
        recommended: true,
    },
    {
        id: 'csv',
        name: 'CSV (Comma Separated)',
        description: 'Simple CSV format for data analysis and import',
        icon: <CsvIcon color="primary" />,
        features: ['Universal compatibility', 'Lightweight', 'Easy import', 'Data analysis'],
        recommended: false,
    },
    {
        id: 'json',
        name: 'JSON',
        description: 'Structured JSON format for API integration',
        icon: <JsonIcon color="info" />,
        features: ['API integration', 'Structured data', 'Nested objects', 'Web-friendly'],
        recommended: false,
    },
    {
        id: 'pdf',
        name: 'PDF Report',
        description: 'Formatted PDF report with tables and summaries',
        icon: <PdfIcon color="error" />,
        features: ['Professional format', 'Print-ready', 'Summaries', 'Charts'],
        recommended: false,
    },
];

const exportFeatures = [
    {
        icon: <CloudIcon color="primary" />,
        title: 'Cloud Storage',
        description: 'Direct export to Google Drive, Dropbox, or OneDrive',
    },
    {
        icon: <ShareIcon color="primary" />,
        title: 'Team Sharing',
        description: 'Share exported files with team members via secure links',
    },
    {
        icon: <ScheduleIcon color="primary" />,
        title: 'Scheduled Exports',
        description: 'Automate regular exports for recurring document processing',
    },
];

export const ExportStep: React.FC<Props> = ({ onBack, onComplete, isLastStep }) => {
    const theme = useTheme();
    const [selectedFormat, setSelectedFormat] = useState('excel');
    const [exportOptions, setExportOptions] = useState({
        includeMetadata: true,
        includeConfidenceScores: false,
        separateSheets: true,
        includeCharts: true,
    });
    const [isExporting, setIsExporting] = useState(false);

    const handleExportDemo = () => {
        setIsExporting(true);
        setTimeout(() => {
            setIsExporting(false);
            // In a real app, this would trigger the actual export
        }, 2000);
    };

    const selectedFormatData = exportFormats.find(f => f.id === selectedFormat);

    return (
        <Box>
            <Box mb={4}>
                <Typography variant="h4" gutterBottom>
                    Export Your Results
                </Typography>
                <Typography variant="body1" color="text.secondary" paragraph>
                    Learn how to export your extracted table data in various formats.
                    Choose the right format for your workflow and customize export settings.
                </Typography>
            </Box>

            <Grid container spacing={4}>
                {/* Export Formats */}
                <Grid item xs={12} md={8}>
                    <Typography variant="h6" gutterBottom>
                        Choose Export Format
                    </Typography>

                    <Grid container spacing={2} mb={4}>
                        {exportFormats.map((format) => (
                            <Grid item xs={12} sm={6} key={format.id}>
                                <Card
                                    sx={{
                                        height: '100%',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        border: selectedFormat === format.id ? 2 : 1,
                                        borderColor: selectedFormat === format.id ? 'primary.main' : 'divider',
                                        '&:hover': {
                                            transform: 'translateY(-2px)',
                                            boxShadow: theme.shadows[4],
                                        },
                                    }}
                                    onClick={() => setSelectedFormat(format.id)}
                                >
                                    <CardContent>
                                        <Box display="flex" alignItems="center" gap={2} mb={2}>
                                            {format.icon}
                                            <Box>
                                                <Typography variant="h6" component="div">
                                                    {format.name}
                                                    {format.recommended && (
                                                        <Chip
                                                            label="Recommended"
                                                            size="small"
                                                            color="primary"
                                                            sx={{ ml: 1 }}
                                                        />
                                                    )}
                                                </Typography>
                                            </Box>
                                        </Box>

                                        <Typography variant="body2" color="text.secondary" paragraph>
                                            {format.description}
                                        </Typography>

                                        <Typography variant="subtitle2" gutterBottom>
                                            Features:
                                        </Typography>
                                        <Box display="flex" flexWrap="wrap" gap={0.5}>
                                            {format.features.map((feature, index) => (
                                                <Chip
                                                    key={index}
                                                    label={feature}
                                                    size="small"
                                                    variant="outlined"
                                                />
                                            ))}
                                        </Box>
                                    </CardContent>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>

                    {/* Export Options */}
                    {selectedFormatData && (
                        <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
                            <Typography variant="h6" gutterBottom>
                                Export Options for {selectedFormatData.name}
                            </Typography>

                            <Grid container spacing={2}>
                                <Grid item xs={12} sm={6}>
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={exportOptions.includeMetadata}
                                                onChange={(e) => setExportOptions({
                                                    ...exportOptions,
                                                    includeMetadata: e.target.checked
                                                })}
                                            />
                                        }
                                        label="Include metadata (file names, dates)"
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={exportOptions.includeConfidenceScores}
                                                onChange={(e) => setExportOptions({
                                                    ...exportOptions,
                                                    includeConfidenceScores: e.target.checked
                                                })}
                                            />
                                        }
                                        label="Include confidence scores"
                                    />
                                </Grid>
                                {selectedFormat === 'excel' && (
                                    <>
                                        <Grid item xs={12} sm={6}>
                                            <FormControlLabel
                                                control={
                                                    <Checkbox
                                                        checked={exportOptions.separateSheets}
                                                        onChange={(e) => setExportOptions({
                                                            ...exportOptions,
                                                            separateSheets: e.target.checked
                                                        })}
                                                    />
                                                }
                                                label="Separate sheets per document"
                                            />
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                            <FormControlLabel
                                                control={
                                                    <Checkbox
                                                        checked={exportOptions.includeCharts}
                                                        onChange={(e) => setExportOptions({
                                                            ...exportOptions,
                                                            includeCharts: e.target.checked
                                                        })}
                                                    />
                                                }
                                                label="Include summary charts"
                                            />
                                        </Grid>
                                    </>
                                )}
                            </Grid>

                            <Divider sx={{ my: 2 }} />

                            <Button
                                variant="contained"
                                startIcon={<DownloadIcon />}
                                onClick={handleExportDemo}
                                disabled={isExporting}
                                size="large"
                            >
                                {isExporting ? 'Exporting...' : `Export as ${selectedFormatData.name}`}
                            </Button>

                            {isExporting && (
                                <Alert severity="info" sx={{ mt: 2 }}>
                                    Preparing your export... This may take a few moments for large datasets.
                                </Alert>
                            )}
                        </Paper>
                    )}
                </Grid>

                {/* Export Features */}
                <Grid item xs={12} md={4}>
                    <Typography variant="h6" gutterBottom>
                        Advanced Features
                    </Typography>

                    <Grid container spacing={2} mb={3}>
                        {exportFeatures.map((feature, index) => (
                            <Grid item xs={12} key={index}>
                                <Card>
                                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
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

                    {/* Quick Export */}
                    <Paper elevation={1} sx={{ p: 2, bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                        <Typography variant="subtitle1" gutterBottom color="primary">
                            Quick Export
                        </Typography>
                        <Typography variant="body2" color="text.secondary" paragraph>
                            For common use cases, use these preset export configurations:
                        </Typography>
                        <Box display="flex" flexDirection="column" gap={1}>
                            <Button
                                variant="outlined"
                                size="small"
                                startIcon={<ExcelIcon />}
                                onClick={() => setSelectedFormat('excel')}
                            >
                                Financial Reports
                            </Button>
                            <Button
                                variant="outlined"
                                size="small"
                                startIcon={<CsvIcon />}
                                onClick={() => setSelectedFormat('csv')}
                            >
                                Data Analysis
                            </Button>
                            <Button
                                variant="outlined"
                                size="small"
                                startIcon={<JsonIcon />}
                                onClick={() => setSelectedFormat('json')}
                            >
                                API Integration
                            </Button>
                        </Box>
                    </Paper>
                </Grid>
            </Grid>

            {/* Export Best Practices */}
            <Box mt={4}>
                <Paper elevation={1} sx={{ p: 3, bgcolor: alpha(theme.palette.success.main, 0.05) }}>
                    <Typography variant="h6" gutterBottom color="success.main">
                        Export Best Practices
                    </Typography>
                    <List dense>
                        <ListItem>
                            <ListItemIcon>
                                <CheckIcon color="success" fontSize="small" />
                            </ListItemIcon>
                            <ListItemText
                                primary="Choose the right format for your use case"
                                secondary="Excel for analysis, CSV for databases, JSON for APIs, PDF for reports"
                            />
                        </ListItem>
                        <ListItem>
                            <ListItemIcon>
                                <CheckIcon color="success" fontSize="small" />
                            </ListItemIcon>
                            <ListItemText
                                primary="Include metadata for traceability"
                                secondary="Source file names and extraction dates help with data lineage"
                            />
                        </ListItem>
                        <ListItem>
                            <ListItemIcon>
                                <CheckIcon color="success" fontSize="small" />
                            </ListItemIcon>
                            <ListItemText
                                primary="Review confidence scores"
                                secondary="Include confidence data to identify records that may need manual review"
                            />
                        </ListItem>
                        <ListItem>
                            <ListItemIcon>
                                <CheckIcon color="success" fontSize="small" />
                            </ListItemIcon>
                            <ListItemText
                                primary="Test with sample data first"
                                secondary="Verify export format and options with a small dataset before bulk exports"
                            />
                        </ListItem>
                    </List>
                </Paper>
            </Box>

            {/* Completion Message */}
            <Box mt={4}>
                <Alert severity="success" sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom>
                        🎉 Congratulations! You've completed the onboarding tour.
                    </Typography>
                    <Typography variant="body1">
                        You now know how to upload PDFs, extract tables, create templates,
                        process batches, and export results. You're ready to start using
                        SyntaxisAI for your document processing needs!
                    </Typography>
                </Alert>
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
                    color="success"
                >
                    {isLastStep ? 'Complete Onboarding' : 'Finish'}
                </Button>
            </Box>
        </Box>
    );
};