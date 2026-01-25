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
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    useTheme,
    alpha,
} from '@mui/material';
import {
    Save as SaveIcon,
    Add as AddIcon,
    Description as TemplateIcon,
    Speed as SpeedIcon,
    Refresh as ReusableIcon,
    CheckCircle as CheckIcon,
    Star as StarIcon,
    Business as BusinessIcon,
    Receipt as ReceiptIcon,
    Assignment as ReportIcon,
} from '@mui/icons-material';

interface Props {
    onComplete: () => void;
    onBack: () => void;
    isLastStep?: boolean;
}

const sampleTemplates = [
    {
        id: 1,
        name: 'Invoice Template',
        description: 'Standard invoice format with line items, taxes, and totals',
        icon: <ReceiptIcon />,
        fields: ['Item', 'Quantity', 'Unit Price', 'Total', 'Tax'],
        usage: 45,
        category: 'Financial',
    },
    {
        id: 2,
        name: 'Purchase Order',
        description: 'Purchase order template for procurement documents',
        icon: <BusinessIcon />,
        fields: ['Product', 'SKU', 'Quantity', 'Price', 'Delivery Date'],
        usage: 32,
        category: 'Procurement',
    },
    {
        id: 3,
        name: 'Expense Report',
        description: 'Employee expense report with categories and amounts',
        icon: <ReportIcon />,
        fields: ['Date', 'Category', 'Description', 'Amount', 'Receipt'],
        usage: 28,
        category: 'Financial',
    },
];

const templateFeatures = [
    {
        icon: <SaveIcon color="primary" />,
        title: 'Save Configurations',
        description: 'Save extraction settings for consistent results across similar documents',
    },
    {
        icon: <ReusableIcon color="primary" />,
        title: 'Reusable Patterns',
        description: 'Apply saved templates to new documents with similar table structures',
    },
    {
        icon: <SpeedIcon color="primary" />,
        title: 'Faster Processing',
        description: 'Templates speed up extraction by pre-defining expected data patterns',
    },
];

export const TemplatesStep: React.FC<Props> = ({ onComplete, onBack, isLastStep }) => {
    const theme = useTheme();
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
    const [newTemplate, setNewTemplate] = useState({
        name: '',
        description: '',
        category: '',
    });

    const handleCreateTemplate = () => {
        setCreateDialogOpen(false);
        setNewTemplate({ name: '', description: '', category: '' });
        // In a real app, this would save the template
    };

    const handleUseTemplate = (templateId: number) => {
        setSelectedTemplate(templateId);
        // In a real app, this would apply the template
    };

    return (
        <Box>
            <Box mb={4}>
                <Typography variant="h4" gutterBottom>
                    Templates & Reusability
                </Typography>
                <Typography variant="body1" color="text.secondary" paragraph>
                    Learn how to create and use templates to streamline your document processing.
                    Templates save extraction configurations for consistent results across similar documents.
                </Typography>
            </Box>

            <Grid container spacing={4}>
                {/* Template Gallery */}
                <Grid item xs={12} md={8}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                        <Typography variant="h6">
                            Template Gallery
                        </Typography>
                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={() => setCreateDialogOpen(true)}
                        >
                            Create Template
                        </Button>
                    </Box>

                    <Grid container spacing={2}>
                        {sampleTemplates.map((template) => (
                            <Grid item xs={12} sm={6} key={template.id}>
                                <Card
                                    sx={{
                                        height: '100%',
                                        transition: 'all 0.2s',
                                        border: selectedTemplate === template.id ? 2 : 0,
                                        borderColor: 'primary.main',
                                        '&:hover': {
                                            transform: 'translateY(-2px)',
                                            boxShadow: theme.shadows[4],
                                        },
                                    }}
                                >
                                    <CardContent>
                                        <Box display="flex" alignItems="center" gap={2} mb={2}>
                                            {template.icon}
                                            <Box>
                                                <Typography variant="h6" component="div">
                                                    {template.name}
                                                </Typography>
                                                <Chip
                                                    label={template.category}
                                                    size="small"
                                                    color="primary"
                                                    variant="outlined"
                                                />
                                            </Box>
                                        </Box>

                                        <Typography variant="body2" color="text.secondary" paragraph>
                                            {template.description}
                                        </Typography>

                                        <Typography variant="subtitle2" gutterBottom>
                                            Fields:
                                        </Typography>
                                        <Box display="flex" flexWrap="wrap" gap={0.5} mb={2}>
                                            {template.fields.map((field, index) => (
                                                <Chip
                                                    key={index}
                                                    label={field}
                                                    size="small"
                                                    variant="outlined"
                                                />
                                            ))}
                                        </Box>

                                        <Box display="flex" alignItems="center" gap={1}>
                                            <StarIcon fontSize="small" color="warning" />
                                            <Typography variant="body2" color="text.secondary">
                                                Used {template.usage} times
                                            </Typography>
                                        </Box>
                                    </CardContent>

                                    <CardActions>
                                        <Button
                                            size="small"
                                            onClick={() => handleUseTemplate(template.id)}
                                            variant={selectedTemplate === template.id ? 'contained' : 'outlined'}
                                        >
                                            {selectedTemplate === template.id ? 'Selected' : 'Use Template'}
                                        </Button>
                                    </CardActions>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>
                </Grid>

                {/* Features */}
                <Grid item xs={12} md={4}>
                    <Typography variant="h6" gutterBottom>
                        Template Benefits
                    </Typography>

                    <Grid container spacing={2}>
                        {templateFeatures.map((feature, index) => (
                            <Grid item xs={12} key={index}>
                                <Card>
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

            {/* Template Tips */}
            <Box mt={4}>
                <Paper elevation={1} sx={{ p: 3, bgcolor: alpha(theme.palette.info.main, 0.05) }}>
                    <Typography variant="h6" gutterBottom color="info.main">
                        Template Best Practices
                    </Typography>
                    <List dense>
                        <ListItem>
                            <ListItemIcon>
                                <CheckIcon color="success" fontSize="small" />
                            </ListItemIcon>
                            <ListItemText
                                primary="Create templates for frequently used document types"
                                secondary="Save time by reusing extraction patterns for similar documents"
                            />
                        </ListItem>
                        <ListItem>
                            <ListItemIcon>
                                <CheckIcon color="success" fontSize="small" />
                            </ListItemIcon>
                            <ListItemText
                                primary="Use descriptive names and categories"
                                secondary="Make templates easy to find and understand for your team"
                            />
                        </ListItem>
                        <ListItem>
                            <ListItemIcon>
                                <CheckIcon color="success" fontSize="small" />
                            </ListItemIcon>
                            <ListItemText
                                primary="Test templates with sample documents"
                                secondary="Verify extraction accuracy before using templates in production"
                            />
                        </ListItem>
                    </List>
                </Paper>
            </Box>

            {/* Create Template Dialog */}
            <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Create New Template</DialogTitle>
                <DialogContent>
                    <Box display="flex" flexDirection="column" gap={2} mt={1}>
                        <TextField
                            label="Template Name"
                            value={newTemplate.name}
                            onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                            fullWidth
                        />
                        <TextField
                            label="Description"
                            value={newTemplate.description}
                            onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                            multiline
                            rows={3}
                            fullWidth
                        />
                        <FormControl fullWidth>
                            <InputLabel>Category</InputLabel>
                            <Select
                                value={newTemplate.category}
                                onChange={(e) => setNewTemplate({ ...newTemplate, category: e.target.value })}
                                label="Category"
                            >
                                <MenuItem value="Financial">Financial</MenuItem>
                                <MenuItem value="Procurement">Procurement</MenuItem>
                                <MenuItem value="Legal">Legal</MenuItem>
                                <MenuItem value="HR">Human Resources</MenuItem>
                                <MenuItem value="Other">Other</MenuItem>
                            </Select>
                        </FormControl>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleCreateTemplate} variant="contained">Create</Button>
                </DialogActions>
            </Dialog>

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
                    {isLastStep ? 'Complete' : 'Next: Batch Processing'}
                </Button>
            </Box>
        </Box>
    );
};