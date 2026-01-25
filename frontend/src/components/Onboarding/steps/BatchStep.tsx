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
    LinearProgress,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Chip,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    IconButton,
    Tooltip,
    useTheme,
    alpha,
} from '@mui/material';
import {
    PlayArrow as StartIcon,
    Pause as PauseIcon,
    Stop as StopIcon,
    CheckCircle as CompleteIcon,
    Error as ErrorIcon,
    Schedule as PendingIcon,
    Speed as SpeedIcon,
    Group as BatchIcon,
    Timeline as ProgressIcon,
    Visibility as ViewIcon,
} from '@mui/icons-material';

interface Props {
    onComplete: () => void;
    onBack: () => void;
    isLastStep?: boolean;
}

interface BatchJob {
    id: string;
    fileName: string;
    status: 'pending' | 'processing' | 'completed' | 'error';
    progress: number;
    pages: number;
    tablesFound: number;
    processingTime?: string;
}

const sampleBatchJobs: BatchJob[] = [
    {
        id: '1',
        fileName: 'invoice_batch_001.pdf',
        status: 'completed',
        progress: 100,
        pages: 5,
        tablesFound: 3,
        processingTime: '2.3s',
    },
    {
        id: '2',
        fileName: 'purchase_orders_q1.pdf',
        status: 'processing',
        progress: 65,
        pages: 12,
        tablesFound: 8,
    },
    {
        id: '3',
        fileName: 'expense_reports_march.pdf',
        status: 'pending',
        progress: 0,
        pages: 8,
        tablesFound: 0,
    },
    {
        id: '4',
        fileName: 'contracts_2024.pdf',
        status: 'error',
        progress: 25,
        pages: 15,
        tablesFound: 2,
    },
];

const batchFeatures = [
    {
        icon: <BatchIcon color="primary" />,
        title: 'Multiple Files',
        description: 'Process dozens of documents simultaneously for maximum efficiency',
    },
    {
        icon: <ProgressIcon color="primary" />,
        title: 'Real-time Monitoring',
        description: 'Track progress of each file with detailed status updates',
    },
    {
        icon: <SpeedIcon color="primary" />,
        title: 'Optimized Performance',
        description: 'Parallel processing ensures fast completion of large batches',
    },
];

export const BatchStep: React.FC<Props> = ({ onComplete, onBack, isLastStep }) => {
    const theme = useTheme();
    const [batchJobs, setBatchJobs] = useState<BatchJob[]>(sampleBatchJobs);
    const [isRunning, setIsRunning] = useState(false);

    const handleStartBatch = () => {
        setIsRunning(true);
        // Simulate batch processing
        const interval = setInterval(() => {
            setBatchJobs(prev => prev.map(job => {
                if (job.status === 'processing' && job.progress < 100) {
                    const newProgress = Math.min(job.progress + 5, 100);
                    return {
                        ...job,
                        progress: newProgress,
                        status: newProgress === 100 ? 'completed' : 'processing',
                        processingTime: newProgress === 100 ? `${(Math.random() * 3 + 1).toFixed(1)}s` : undefined,
                    };
                }
                if (job.status === 'pending') {
                    return { ...job, status: 'processing', progress: 5 };
                }
                return job;
            }));
        }, 500);

        setTimeout(() => {
            clearInterval(interval);
            setIsRunning(false);
        }, 10000);
    };

    const getStatusIcon = (status: BatchJob['status']) => {
        switch (status) {
            case 'completed':
                return <CompleteIcon color="success" />;
            case 'processing':
                return <ProgressIcon color="primary" />;
            case 'pending':
                return <PendingIcon color="warning" />;
            case 'error':
                return <ErrorIcon color="error" />;
            default:
                return <PendingIcon />;
        }
    };

    const getStatusColor = (status: BatchJob['status']) => {
        switch (status) {
            case 'completed':
                return 'success';
            case 'processing':
                return 'primary';
            case 'pending':
                return 'warning';
            case 'error':
                return 'error';
            default:
                return 'default';
        }
    };

    const completedJobs = batchJobs.filter(job => job.status === 'completed').length;
    const totalJobs = batchJobs.length;
    const overallProgress = (completedJobs / totalJobs) * 100;

    return (
        <Box>
            <Box mb={4}>
                <Typography variant="h4" gutterBottom>
                    Batch Processing
                </Typography>
                <Typography variant="body1" color="text.secondary" paragraph>
                    Learn how to process multiple documents efficiently using batch operations.
                    Monitor progress, manage queues, and handle large-scale document processing.
                </Typography>
            </Box>

            <Grid container spacing={4}>
                {/* Batch Control Panel */}
                <Grid item xs={12} md={4}>
                    <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
                        <Typography variant="h6" gutterBottom>
                            Batch Control
                        </Typography>

                        <Box mb={3}>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                                Overall Progress
                            </Typography>
                            <LinearProgress
                                variant="determinate"
                                value={overallProgress}
                                sx={{ height: 8, borderRadius: 4, mb: 1 }}
                            />
                            <Typography variant="body2">
                                {completedJobs} of {totalJobs} files completed
                            </Typography>
                        </Box>

                        <Box display="flex" gap={1} mb={3}>
                            <Button
                                variant="contained"
                                startIcon={<StartIcon />}
                                onClick={handleStartBatch}
                                disabled={isRunning}
                                size="small"
                            >
                                Start
                            </Button>
                            <Button
                                variant="outlined"
                                startIcon={<PauseIcon />}
                                disabled={!isRunning}
                                size="small"
                            >
                                Pause
                            </Button>
                            <Button
                                variant="outlined"
                                startIcon={<StopIcon />}
                                disabled={!isRunning}
                                size="small"
                            >
                                Stop
                            </Button>
                        </Box>

                        <Box>
                            <Typography variant="subtitle2" gutterBottom>
                                Batch Statistics
                            </Typography>
                            <List dense>
                                <ListItem>
                                    <ListItemText
                                        primary="Queue Size"
                                        secondary={`${batchJobs.filter(j => j.status === 'pending').length} files`}
                                    />
                                </ListItem>
                                <ListItem>
                                    <ListItemText
                                        primary="Processing"
                                        secondary={`${batchJobs.filter(j => j.status === 'processing').length} files`}
                                    />
                                </ListItem>
                                <ListItem>
                                    <ListItemText
                                        primary="Completed"
                                        secondary={`${completedJobs} files`}
                                    />
                                </ListItem>
                                <ListItem>
                                    <ListItemText
                                        primary="Errors"
                                        secondary={`${batchJobs.filter(j => j.status === 'error').length} files`}
                                    />
                                </ListItem>
                            </List>
                        </Box>
                    </Paper>

                    {/* Features */}
                    <Typography variant="h6" gutterBottom>
                        Batch Features
                    </Typography>
                    <Grid container spacing={2}>
                        {batchFeatures.map((feature, index) => (
                            <Grid item xs={12} key={index}>
                                <Card size="small">
                                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                        <Box display="flex" alignItems="flex-start" gap={2}>
                                            {feature.icon}
                                            <Box>
                                                <Typography variant="subtitle2" gutterBottom>
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

                {/* Batch Job List */}
                <Grid item xs={12} md={8}>
                    <Paper elevation={2} sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom>
                            Batch Job Queue
                        </Typography>

                        <TableContainer>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>File Name</TableCell>
                                        <TableCell align="center">Status</TableCell>
                                        <TableCell align="center">Progress</TableCell>
                                        <TableCell align="center">Pages</TableCell>
                                        <TableCell align="center">Tables</TableCell>
                                        <TableCell align="center">Time</TableCell>
                                        <TableCell align="center">Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {batchJobs.map((job) => (
                                        <TableRow key={job.id}>
                                            <TableCell>
                                                <Typography variant="body2" noWrap>
                                                    {job.fileName}
                                                </Typography>
                                            </TableCell>
                                            <TableCell align="center">
                                                <Chip
                                                    icon={getStatusIcon(job.status)}
                                                    label={job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                                                    color={getStatusColor(job.status)}
                                                    size="small"
                                                />
                                            </TableCell>
                                            <TableCell align="center">
                                                <Box display="flex" alignItems="center" gap={1}>
                                                    <LinearProgress
                                                        variant="determinate"
                                                        value={job.progress}
                                                        sx={{ width: 60, height: 4 }}
                                                    />
                                                    <Typography variant="body2" sx={{ minWidth: 35 }}>
                                                        {job.progress}%
                                                    </Typography>
                                                </Box>
                                            </TableCell>
                                            <TableCell align="center">{job.pages}</TableCell>
                                            <TableCell align="center">{job.tablesFound}</TableCell>
                                            <TableCell align="center">
                                                {job.processingTime || '-'}
                                            </TableCell>
                                            <TableCell align="center">
                                                <Tooltip title="View Details">
                                                    <IconButton size="small">
                                                        <ViewIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Paper>
                </Grid>
            </Grid>

            {/* Best Practices */}
            <Box mt={4}>
                <Paper elevation={1} sx={{ p: 3, bgcolor: alpha(theme.palette.warning.main, 0.05) }}>
                    <Typography variant="h6" gutterBottom color="warning.main">
                        Batch Processing Tips
                    </Typography>
                    <List dense>
                        <ListItem>
                            <ListItemIcon>
                                <CompleteIcon color="success" fontSize="small" />
                            </ListItemIcon>
                            <ListItemText
                                primary="Organize files by type"
                                secondary="Group similar documents together for better template matching"
                            />
                        </ListItem>
                        <ListItem>
                            <ListItemIcon>
                                <CompleteIcon color="success" fontSize="small" />
                            </ListItemIcon>
                            <ListItemText
                                primary="Monitor system resources"
                                secondary="Large batches may require more processing time and memory"
                            />
                        </ListItem>
                        <ListItem>
                            <ListItemIcon>
                                <CompleteIcon color="success" fontSize="small" />
                            </ListItemIcon>
                            <ListItemText
                                primary="Handle errors gracefully"
                                secondary="Review failed jobs and reprocess with adjusted settings"
                            />
                        </ListItem>
                        <ListItem>
                            <ListItemIcon>
                                <CompleteIcon color="success" fontSize="small" />
                            </ListItemIcon>
                            <ListItemText
                                primary="Schedule during off-peak hours"
                                secondary="Run large batches when system load is lower for optimal performance"
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
                    {isLastStep ? 'Complete' : 'Next: Export Results'}
                </Button>
            </Box>
        </Box>
    );
};