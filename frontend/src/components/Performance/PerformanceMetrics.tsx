// @ts-nocheck
import React, { useEffect, useState } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Grid,
    CircularProgress,
    Alert,
    LinearProgress,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { formatBytes, formatDuration } from '../../utils/formatters';

interface SystemHealth {
    status: 'healthy' | 'degraded' | 'critical';
    metrics: {
        uploadSpeed: number;
        processingSpeed: number;
        errorRate: number;
        responseTime: number;
    };
    alerts: Array<{
        id: string;
        type: string;
        message: string;
        timestamp: string;
        severity: 'warning' | 'error' | 'critical';
    }>;
}

export const PerformanceMetrics: React.FC = () => {
    const [refreshInterval, setRefreshInterval] = useState(5000); // 5 seconds

    const { data: health, isLoading, error } = useQuery<SystemHealth>({
        queryKey: ['systemHealth'],
        queryFn: async () => {
            const response = await api.get('/system/health');
            return response.data;
        },
        refetchInterval: refreshInterval,
    });

    // Adjust refresh interval based on system health
    useEffect(() => {
        if (health) {
            if (health.status === 'critical') {
                setRefreshInterval(1000); // 1 second for critical status
            } else if (health.status === 'degraded') {
                setRefreshInterval(3000); // 3 seconds for degraded status
            } else {
                setRefreshInterval(5000); // 5 seconds for healthy status
            }
        }
    }, [health?.status]);

    if (isLoading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Alert severity="error">
                Failed to load performance metrics. Please try again later.
            </Alert>
        );
    }

    if (!health) {
        return null;
    }

    const getStatusColor = (status: SystemHealth['status']) => {
        switch (status) {
            case 'healthy':
                return 'success.main';
            case 'degraded':
                return 'warning.main';
            case 'critical':
                return 'error.main';
            default:
                return 'text.secondary';
        }
    };

    const getMetricColor = (value: number, threshold: number) => {
        if (value >= threshold) {
            return 'error.main';
        } else if (value >= threshold * 0.8) {
            return 'warning.main';
        }
        return 'success.main';
    };

    return (
        <Box>
            <Card sx={{ mb: 2 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        System Status
                    </Typography>
                    <Box display="flex" alignItems="center" mb={2}>
                        <Box
                            sx={{
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                bgcolor: getStatusColor(health.status),
                                mr: 1,
                            }}
                        />
                        <Typography
                            variant="body1"
                            sx={{ textTransform: 'capitalize' }}
                        >
                            {health.status}
                        </Typography>
                    </Box>

                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6} md={3}>
                            <Typography variant="subtitle2" color="text.secondary">
                                Upload Speed
                            </Typography>
                            <Typography
                                variant="h6"
                                color={getMetricColor(health.metrics.uploadSpeed, 5 * 1024 * 1024)} // 5 MB/s threshold
                            >
                                {formatBytes(health.metrics.uploadSpeed)}/s
                            </Typography>
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <Typography variant="subtitle2" color="text.secondary">
                                Processing Speed
                            </Typography>
                            <Typography
                                variant="h6"
                                color={getMetricColor(health.metrics.processingSpeed, 10 * 1024 * 1024)} // 10 MB/s threshold
                            >
                                {formatBytes(health.metrics.processingSpeed)}/s
                            </Typography>
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <Typography variant="subtitle2" color="text.secondary">
                                Error Rate
                            </Typography>
                            <Typography
                                variant="h6"
                                color={getMetricColor(health.metrics.errorRate, 0.05)} // 5% threshold
                            >
                                {(health.metrics.errorRate * 100).toFixed(1)}%
                            </Typography>
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <Typography variant="subtitle2" color="text.secondary">
                                Average Response Time
                            </Typography>
                            <Typography
                                variant="h6"
                                color={getMetricColor(health.metrics.responseTime, 1000)} // 1s threshold
                            >
                                {formatDuration(health.metrics.responseTime)}
                            </Typography>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>

            {health.alerts.length > 0 && (
                <Card>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>
                            System Alerts
                        </Typography>
                        <Box>
                            {health.alerts.map((alert) => (
                                <Alert
                                    key={alert.id}
                                    severity={alert.severity}
                                    sx={{ mb: 1 }}
                                >
                                    <Typography variant="subtitle2">
                                        {alert.type}
                                    </Typography>
                                    <Typography variant="body2">
                                        {alert.message}
                                    </Typography>
                                    <Typography
                                        variant="caption"
                                        color="text.secondary"
                                    >
                                        {new Date(alert.timestamp).toLocaleString()}
                                    </Typography>
                                </Alert>
                            ))}
                        </Box>
                    </CardContent>
                </Card>
            )}
        </Box>
    );
}; 