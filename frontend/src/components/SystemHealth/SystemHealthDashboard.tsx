import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { RefreshCw, Activity, Server, Database, HardDrive, Cpu, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { 
  useDetailedHealth, 
  useSystemAlerts, 
  useSystemStatus,
  getStatusColor,
  getStatusIcon,
  formatUptime,
  formatBytes,
  formatPercentage,
  HealthStatus,
  ServiceHealth,
  HealthAlert
} from '../../hooks/useSystemHealth';

interface SystemHealthDashboardProps {
  className?: string;
}

const SystemHealthDashboard: React.FC<SystemHealthDashboardProps> = ({ className }) => {
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  const { 
    data: healthData, 
    isLoading: healthLoading, 
    isError: healthError, 
    refetch: refetchHealth 
  } = useDetailedHealth({ 
    refetchInterval: autoRefresh ? 30000 : undefined 
  });
  
  const { 
    data: alertsData, 
    isLoading: alertsLoading 
  } = useSystemAlerts(10, { 
    refetchInterval: autoRefresh ? 15000 : undefined 
  });
  
  const { 
    data: statusData 
  } = useSystemStatus({ 
    refetchInterval: autoRefresh ? 60000 : undefined 
  });

  const handleRefresh = () => {
    refetchHealth();
  };

  const getServiceIcon = (serviceName: string) => {
    switch (serviceName) {
      case 'database':
        return <Database className="h-4 w-4" />;
      case 'redis':
        return <Server className="h-4 w-4" />;
      case 'fileSystem':
        return <HardDrive className="h-4 w-4" />;
      case 'memory':
        return <Cpu className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getAlertIcon = (level: string) => {
    switch (level) {
      case 'critical':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
  };

  if (healthLoading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        <span>Loading system health...</span>
      </div>
    );
  }

  if (healthError) {
    return (
      <div className={`p-4 ${className}`}>
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Failed to load system health</AlertTitle>
          <AlertDescription>
            Unable to retrieve system health information. Please try again.
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              className="ml-2"
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const health = healthData as HealthStatus;
  const alerts = alertsData as HealthAlert[];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">System Health Dashboard</h2>
          <p className="text-muted-foreground">
            Monitor system status and performance metrics
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? 'Disable' : 'Enable'} Auto-refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={healthLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${healthLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overall Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <span>{getStatusIcon(health?.status || 'unknown')}</span>
            <span>Overall System Status</span>
            <Badge 
              variant={health?.status === 'healthy' ? 'default' : 
                      health?.status === 'degraded' ? 'secondary' : 'destructive'}
            >
              {health?.status?.toUpperCase() || 'UNKNOWN'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm font-medium">Version</p>
              <p className="text-2xl font-bold">{health?.version || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Environment</p>
              <p className="text-2xl font-bold">{health?.environment || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Uptime</p>
              <p className="text-2xl font-bold">
                {health?.performance?.uptime ? formatUptime(health.performance.uptime) : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">Last Check</p>
              <p className="text-2xl font-bold">
                {health?.timestamp ? new Date(health.timestamp).toLocaleTimeString() : 'N/A'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="services" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="metadata">System Info</TabsTrigger>
        </TabsList>

        {/* Services Tab */}
        <TabsContent value="services" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {health?.services && Object.entries(health.services).map(([serviceName, service]) => (
              <Card key={serviceName}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center space-x-2 text-sm">
                    {getServiceIcon(serviceName)}
                    <span className="capitalize">{serviceName.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <Badge 
                      variant={service.status === 'healthy' ? 'default' : 
                              service.status === 'degraded' ? 'secondary' : 'destructive'}
                      className="ml-auto"
                    >
                      {service.status}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {service.responseTime && (
                    <p className="text-sm">
                      <span className="font-medium">Response Time:</span> {service.responseTime}ms
                    </p>
                  )}
                  {service.message && (
                    <p className="text-sm text-muted-foreground mt-1">{service.message}</p>
                  )}
                  {service.details && (
                    <div className="mt-2 text-xs">
                      <details>
                        <summary className="cursor-pointer font-medium">Details</summary>
                        <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-auto">
                          {JSON.stringify(service.details, null, 2)}
                        </pre>
                      </details>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Memory Usage */}
            <Card>
              <CardHeader>
                <CardTitle>Memory Usage</CardTitle>
              </CardHeader>
              <CardContent>
                {health?.performance?.memoryUsage && (
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Heap Used:</span>
                      <span>{formatBytes(health.performance.memoryUsage.heapUsed)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Heap Total:</span>
                      <span>{formatBytes(health.performance.memoryUsage.heapTotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>RSS:</span>
                      <span>{formatBytes(health.performance.memoryUsage.rss)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>External:</span>
                      <span>{formatBytes(health.performance.memoryUsage.external)}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Disk Usage */}
            {health?.performance?.diskUsage && (
              <Card>
                <CardHeader>
                  <CardTitle>Disk Usage</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Used:</span>
                      <span>{formatBytes(health.performance.diskUsage.used)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Free:</span>
                      <span>{formatBytes(health.performance.diskUsage.free)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total:</span>
                      <span>{formatBytes(health.performance.diskUsage.total)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Usage:</span>
                      <span>{formatPercentage(health.performance.diskUsage.percentUsed)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Load Average */}
            {health?.performance?.loadAverage && (
              <Card>
                <CardHeader>
                  <CardTitle>Load Average</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>1 minute:</span>
                      <span>{health.performance.loadAverage[0]?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>5 minutes:</span>
                      <span>{health.performance.loadAverage[1]?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>15 minutes:</span>
                      <span>{health.performance.loadAverage[2]?.toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          {alerts && alerts.length > 0 ? (
            <div className="space-y-2">
              {alerts.map((alert, index) => (
                <Alert key={index} variant={alert.level === 'critical' ? 'destructive' : 'default'}>
                  {getAlertIcon(alert.level)}
                  <AlertTitle className="flex items-center space-x-2">
                    <span>{alert.service.toUpperCase()}</span>
                    <Badge variant={alert.level === 'critical' ? 'destructive' : 'secondary'}>
                      {alert.level}
                    </Badge>
                  </AlertTitle>
                  <AlertDescription>
                    <p>{alert.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(alert.timestamp).toLocaleString()}
                    </p>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <div className="text-center">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
                  <p className="text-lg font-medium">No Active Alerts</p>
                  <p className="text-muted-foreground">All systems are operating normally</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Metadata Tab */}
        <TabsContent value="metadata" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Information</CardTitle>
            </CardHeader>
            <CardContent>
              {health?.metadata && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Node Version:</span>
                      <span>{health.metadata.nodeVersion}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Platform:</span>
                      <span>{health.metadata.platform}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Architecture:</span>
                      <span>{health.metadata.architecture}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Check Duration:</span>
                      <span>{health.metadata.checkDuration}ms</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SystemHealthDashboard;
