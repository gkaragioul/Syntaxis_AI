// @ts-nocheck
import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Grid,
  LinearProgress,
  IconButton,
  Collapse,
  Alert,
  Tooltip,
} from '@mui/material';
import {
  CheckCircle,
  Error,
  Warning,
  Refresh,
  ExpandMore,
  ExpandLess,
  Info,
} from '@mui/icons-material';
import { useSystemHealth, useSystemStatus } from '../../hooks/useApiQuery';
import { formatDistanceToNow } from 'date-fns';

interface SystemStatusMonitorProps {
  showDetails?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface ServiceStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime?: number;
  error?: string;
}

interface HealthData {
  status: 'healthy' | 'unhealthy' | 'degraded';
  version: string;
  uptime: number;
  timestamp: string;
  services: {
    [key: string]: ServiceStatus;
  };
}

export const SystemStatusMonitor: React.FC<SystemStatusMonitorProps> = ({
  showDetails = false,
  autoRefresh = true,
  refreshInterval = 30000, // 30 seconds
}) => {
  const [expanded, setExpanded] = useState(showDetails);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const {
    data: healthData,
    isLoading: healthLoading,
    error: healthError,
    refetch: refetchHealth,
  } = useSystemHealth();

  const {
    data: statusData,
    isLoading: statusLoading,
    error: statusError,
    refetch: refetchStatus,
  } = useSystemStatus();

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      refetchHealth();
      refetchStatus();
      setLastRefresh(new Date());
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, refetchHealth, refetchStatus]);

  const handleManualRefresh = () => {
    refetchHealth();
    refetchStatus();
    setLastRefresh(new Date());
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'success';
      case 'degraded':
        return 'warning';
      case 'unhealthy':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle color="success" />;
      case 'degraded':
        return <Warning color="warning" />;
      case 'unhealthy':
        return <Error color="error" />;
      default:
        return <Info color="disabled" />;
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  const overallStatus = healthData?.status || 'unknown';
  const isLoading = healthLoading || statusLoading;
  const hasError = healthError || statusError;

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={2}>
            {getStatusIcon(overallStatus)}
            <Typography variant="h6" component="h2">
              System Status
            </Typography>
            <Chip
              label={overallStatus.toUpperCase()}
              color={getStatusColor(overallStatus) as any}
              size="small"
            />
          </Box>

          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="caption" color="text.secondary">
              Last updated: {formatDistanceToNow(lastRefresh)} ago
            </Typography>
            
            <Tooltip title="Refresh status">
              <IconButton
                onClick={handleManualRefresh}
                disabled={isLoading}
                size="small"
              >
                <Refresh />
              </IconButton>
            </Tooltip>

            <Tooltip title={expanded ? "Hide details" : "Show details"}>
              <IconButton
                onClick={() => setExpanded(!expanded)}
                size="small"
              >
                {expanded ? <ExpandLess /> : <ExpandMore />}
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {isLoading && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress />
          </Box>
        )}

        {hasError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            Failed to fetch system status. Please try again.
          </Alert>
        )}

        <Collapse in={expanded}>
          <Box sx={{ mt: 3 }}>
            {/* System Overview */}
            {statusData && (
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={3}>
                  <Box textAlign="center">
                    <Typography variant="caption" color="text.secondary">
                      Version
                    </Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {statusData.version}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Box textAlign="center">
                    <Typography variant="caption" color="text.secondary">
                      Uptime
                    </Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {formatUptime(statusData.uptime)}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Box textAlign="center">
                    <Typography variant="caption" color="text.secondary">
                      Environment
                    </Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {statusData.environment}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Box textAlign="center">
                    <Typography variant="caption" color="text.secondary">
                      Status
                    </Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {statusData.status}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            )}

            {/* Service Status */}
            {healthData?.services && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Service Health
                </Typography>
                <Grid container spacing={2}>
                  {Object.entries(healthData.services).map(([serviceName, service]) => (
                    <Grid item xs={12} sm={6} md={4} key={serviceName}>
                      <Card variant="outlined" sx={{ p: 2 }}>
                        <Box display="flex" alignItems="center" justifyContent="space-between">
                          <Box display="flex" alignItems="center" gap={1}>
                            {getStatusIcon(service.status)}
                            <Typography variant="body2" fontWeight="medium">
                              {serviceName.charAt(0).toUpperCase() + serviceName.slice(1)}
                            </Typography>
                          </Box>
                          <Chip
                            label={service.status}
                            color={getStatusColor(service.status) as any}
                            size="small"
                          />
                        </Box>

                        {service.responseTime && (
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                            Response time: {service.responseTime}ms
                          </Typography>
                        )}

                        {service.error && (
                          <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
                            Error: {service.error}
                          </Typography>
                        )}
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}

            {/* Health Check Timestamp */}
            {healthData?.timestamp && (
              <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                <Typography variant="caption" color="text.secondary">
                  Health check performed: {new Date(healthData.timestamp).toLocaleString()}
                </Typography>
              </Box>
            )}
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
};

export default SystemStatusMonitor;
