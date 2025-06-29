import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Alert,
  AlertTitle,
  Chip,
  IconButton,
  Collapse,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Button,
  Skeleton,
} from '@mui/material';
import {
  ExpandMore,
  ExpandLess,
  Warning,
  Error,
  Info,
  CheckCircle,
  Refresh,
} from '@mui/icons-material';
import { useApiQuery } from '../../hooks/useApiQuery';
import { formatDistanceToNow } from 'date-fns';

interface SystemAlert {
  id: string;
  type: 'error' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  timestamp: string;
  resolved: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
}

interface SystemAlertsProps {
  limit?: number;
  showResolved?: boolean;
  autoRefresh?: boolean;
}

export const SystemAlerts: React.FC<SystemAlertsProps> = ({
  limit = 10,
  showResolved = false,
  autoRefresh = true,
}) => {
  const [expanded, setExpanded] = useState(false);

  const {
    data: alertsData,
    isLoading,
    error,
    refetch,
  } = useApiQuery(
    ['system', 'alerts', { limit, showResolved }],
    () => api.get('/system/alerts', { params: { limit, showResolved } }),
    {
      refetchInterval: autoRefresh ? 60000 : false, // Refetch every minute
      staleTime: 30000, // 30 seconds
    }
  );

  const alerts: SystemAlert[] = alertsData || [];
  const activeAlerts = alerts.filter(alert => !alert.resolved);
  const criticalAlerts = activeAlerts.filter(alert => alert.severity === 'critical');
  const hasActiveAlerts = activeAlerts.length > 0;

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'error':
        return <Error color="error" />;
      case 'warning':
        return <Warning color="warning" />;
      case 'success':
        return <CheckCircle color="success" />;
      default:
        return <Info color="info" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'error';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      case 'low':
        return 'default';
      default:
        return 'default';
    }
  };

  const getAlertSeverity = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'error';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      case 'low':
        return 'info';
      default:
        return 'info';
    }
  };

  if (isLoading) {
    return (
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="between" mb={2}>
            <Skeleton variant="text" width={200} height={32} />
            <Skeleton variant="circular" width={40} height={40} />
          </Box>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rectangular" height={60} sx={{ mb: 1 }} />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Alert severity="error">
            <AlertTitle>Failed to Load Alerts</AlertTitle>
            Unable to fetch system alerts. Please try again.
            <Button onClick={() => refetch()} sx={{ ml: 2 }}>
              Retry
            </Button>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={2}>
            <Typography variant="h6" component="h2">
              System Alerts
            </Typography>
            
            {hasActiveAlerts && (
              <Chip
                label={`${activeAlerts.length} active`}
                color={criticalAlerts.length > 0 ? 'error' : 'warning'}
                size="small"
              />
            )}
            
            {!hasActiveAlerts && (
              <Chip
                label="All clear"
                color="success"
                size="small"
                icon={<CheckCircle />}
              />
            )}
          </Box>

          <Box display="flex" alignItems="center" gap={1}>
            <IconButton onClick={() => refetch()} size="small">
              <Refresh />
            </IconButton>
            
            <IconButton
              onClick={() => setExpanded(!expanded)}
              size="small"
            >
              {expanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          </Box>
        </Box>

        {/* Show critical alerts immediately */}
        {criticalAlerts.length > 0 && (
          <Box sx={{ mt: 2 }}>
            {criticalAlerts.map((alert) => (
              <Alert
                key={alert.id}
                severity={getAlertSeverity(alert.severity) as any}
                sx={{ mb: 1 }}
                action={
                  <Chip
                    label={alert.severity.toUpperCase()}
                    color={getSeverityColor(alert.severity) as any}
                    size="small"
                  />
                }
              >
                <AlertTitle>{alert.title}</AlertTitle>
                {alert.message}
                <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                  {alert.source} • {formatDistanceToNow(new Date(alert.timestamp))} ago
                </Typography>
              </Alert>
            ))}
          </Box>
        )}

        <Collapse in={expanded}>
          <Box sx={{ mt: 2 }}>
            {alerts.length === 0 ? (
              <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
                No alerts to display
              </Typography>
            ) : (
              <List dense>
                {alerts.map((alert) => (
                  <ListItem
                    key={alert.id}
                    sx={{
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 1,
                      mb: 1,
                      opacity: alert.resolved ? 0.6 : 1,
                    }}
                  >
                    <ListItemIcon>
                      {getAlertIcon(alert.type)}
                    </ListItemIcon>
                    
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="body2" fontWeight="medium">
                            {alert.title}
                          </Typography>
                          <Chip
                            label={alert.severity}
                            color={getSeverityColor(alert.severity) as any}
                            size="small"
                          />
                          {alert.resolved && (
                            <Chip
                              label="Resolved"
                              color="success"
                              size="small"
                              variant="outlined"
                            />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            {alert.message}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {alert.source} • {formatDistanceToNow(new Date(alert.timestamp))} ago
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            )}

            {alerts.length >= limit && (
              <Box textAlign="center" sx={{ mt: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Showing {alerts.length} of {limit} alerts
                </Typography>
              </Box>
            )}
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
};

export default SystemAlerts;
