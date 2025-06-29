import React, { useState } from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  ExternalLink,
  Wifi,
  WifiOff
} from 'lucide-react';
import { 
  useQuickHealth, 
  useSystemAlerts,
  getStatusColor,
  getStatusIcon,
  HealthAlert
} from '../../hooks/useSystemHealth';

interface SystemStatusIndicatorProps {
  className?: string;
  showDetails?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const SystemStatusIndicator: React.FC<SystemStatusIndicatorProps> = ({ 
  className = '',
  showDetails = true,
  size = 'md'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const { 
    data: healthData, 
    isLoading, 
    isError,
    refetch,
    dataUpdatedAt
  } = useQuickHealth({ refetchInterval: 30000 });
  
  const { 
    data: alertsData 
  } = useSystemAlerts(3, { refetchInterval: 15000 });

  const getStatusDisplay = () => {
    if (isLoading) {
      return {
        status: 'checking',
        color: 'gray',
        icon: <RefreshCw className="h-3 w-3 animate-spin" />,
        text: 'Checking...'
      };
    }
    
    if (isError) {
      return {
        status: 'error',
        color: 'red',
        icon: <WifiOff className="h-3 w-3" />,
        text: 'Offline'
      };
    }
    
    const status = healthData?.status || 'unknown';
    
    switch (status) {
      case 'healthy':
        return {
          status: 'healthy',
          color: 'green',
          icon: <CheckCircle className="h-3 w-3" />,
          text: 'Operational'
        };
      case 'degraded':
        return {
          status: 'degraded',
          color: 'yellow',
          icon: <AlertTriangle className="h-3 w-3" />,
          text: 'Degraded'
        };
      case 'unhealthy':
        return {
          status: 'unhealthy',
          color: 'red',
          icon: <XCircle className="h-3 w-3" />,
          text: 'Issues'
        };
      default:
        return {
          status: 'unknown',
          color: 'gray',
          icon: <Activity className="h-3 w-3" />,
          text: 'Unknown'
        };
    }
  };

  const statusDisplay = getStatusDisplay();
  const alerts = alertsData as HealthAlert[] || [];
  const criticalAlerts = alerts.filter(alert => alert.level === 'critical');
  const warningAlerts = alerts.filter(alert => alert.level === 'warning');

  const getBadgeVariant = (color: string) => {
    switch (color) {
      case 'green':
        return 'default';
      case 'yellow':
        return 'secondary';
      case 'red':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getLastUpdateText = () => {
    if (!dataUpdatedAt) return 'Never';
    
    const now = Date.now();
    const diff = now - dataUpdatedAt;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    
    if (minutes > 0) {
      return `${minutes}m ago`;
    } else {
      return `${seconds}s ago`;
    }
  };

  if (!showDetails) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className={`w-2 h-2 rounded-full bg-${statusDisplay.color}-500`} />
        <span className="text-sm text-muted-foreground">
          {statusDisplay.text}
        </span>
      </div>
    );
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size={size}
          className={`flex items-center space-x-2 ${className}`}
        >
          {statusDisplay.icon}
          <span className="hidden sm:inline">System Status</span>
          <Badge variant={getBadgeVariant(statusDisplay.color)}>
            {statusDisplay.text}
          </Badge>
          {(criticalAlerts.length > 0 || warningAlerts.length > 0) && (
            <div className="flex items-center space-x-1">
              {criticalAlerts.length > 0 && (
                <Badge variant="destructive" className="text-xs px-1">
                  {criticalAlerts.length}
                </Badge>
              )}
              {warningAlerts.length > 0 && (
                <Badge variant="secondary" className="text-xs px-1">
                  {warningAlerts.length}
                </Badge>
              )}
            </div>
          )}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-80" align="end">
        <Card className="border-0 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-2">
                {statusDisplay.icon}
                <span>System Status</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetch()}
                disabled={isLoading}
              >
                <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </CardTitle>
          </CardHeader>
          
          <CardContent className="space-y-3">
            {/* Current Status */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Current Status:</span>
              <Badge variant={getBadgeVariant(statusDisplay.color)}>
                {statusDisplay.text}
              </Badge>
            </div>
            
            {/* Last Update */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Last Update:</span>
              <span className="text-sm text-muted-foreground">
                {getLastUpdateText()}
              </span>
            </div>
            
            {/* Connection Status */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Connection:</span>
              <div className="flex items-center space-x-1">
                {isError ? (
                  <WifiOff className="h-3 w-3 text-red-500" />
                ) : (
                  <Wifi className="h-3 w-3 text-green-500" />
                )}
                <span className="text-sm text-muted-foreground">
                  {isError ? 'Disconnected' : 'Connected'}
                </span>
              </div>
            </div>
            
            {/* Alerts Summary */}
            {alerts.length > 0 && (
              <div className="space-y-2">
                <span className="text-sm font-medium">Active Alerts:</span>
                <div className="space-y-1">
                  {alerts.slice(0, 3).map((alert, index) => (
                    <Alert 
                      key={index} 
                      variant={alert.level === 'critical' ? 'destructive' : 'default'}
                      className="py-2"
                    >
                      <AlertTriangle className="h-3 w-3" />
                      <AlertDescription className="text-xs">
                        <div className="flex items-center justify-between">
                          <span>{alert.service}: {alert.message}</span>
                          <Badge 
                            variant={alert.level === 'critical' ? 'destructive' : 'secondary'}
                            className="text-xs"
                          >
                            {alert.level}
                          </Badge>
                        </div>
                      </AlertDescription>
                    </Alert>
                  ))}
                  
                  {alerts.length > 3 && (
                    <p className="text-xs text-muted-foreground text-center">
                      +{alerts.length - 3} more alerts
                    </p>
                  )}
                </div>
              </div>
            )}
            
            {/* No Alerts */}
            {alerts.length === 0 && !isError && (
              <div className="flex items-center space-x-2 text-green-600">
                <CheckCircle className="h-3 w-3" />
                <span className="text-sm">No active alerts</span>
              </div>
            )}
            
            {/* Error State */}
            {isError && (
              <Alert variant="destructive">
                <XCircle className="h-3 w-3" />
                <AlertDescription className="text-xs">
                  Unable to connect to system health monitoring. 
                  Some features may be unavailable.
                </AlertDescription>
              </Alert>
            )}
            
            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isLoading}
                className="text-xs"
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Navigate to full dashboard
                  window.open('/admin/system-health', '_blank');
                }}
                className="text-xs"
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Full Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
};

export default SystemStatusIndicator;
