// @ts-nocheck
import React from 'react';
import { Helmet } from 'react-helmet-async';
import SystemHealthDashboard from '../../components/SystemHealth/SystemHealthDashboard';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { Shield, AlertTriangle } from 'lucide-react';

const SystemHealthPage: React.FC = () => {
  return (
    <>
      <Helmet>
        <title>System Health - SyntaxisAI Admin</title>
        <meta name="description" content="Monitor system health and performance metrics" />
      </Helmet>
      
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-4">
            <Shield className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold">System Health Monitoring</h1>
              <p className="text-muted-foreground">
                Real-time monitoring of system components and performance metrics
              </p>
            </div>
          </div>
          
          {/* Admin Notice */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Administrator Access</AlertTitle>
            <AlertDescription>
              This page contains sensitive system information and is only accessible to administrators.
              All actions are logged for security purposes.
            </AlertDescription>
          </Alert>
        </div>

        {/* System Health Dashboard */}
        <SystemHealthDashboard />
        
        {/* Additional Information */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>About System Monitoring</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                This dashboard provides real-time monitoring of critical system components including:
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Database connectivity and performance</li>
                <li>Redis cache status and memory usage</li>
                <li>File system health and disk usage</li>
                <li>Memory consumption and heap statistics</li>
                <li>System load and CPU utilization</li>
                <li>Active alerts and warnings</li>
              </ul>
              <p className="text-sm text-muted-foreground">
                Data is automatically refreshed every 30 seconds when auto-refresh is enabled.
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Health Check Endpoints</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                The following health check endpoints are available:
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <code className="bg-muted px-2 py-1 rounded text-xs">
                    GET /api/v1/system/health
                  </code>
                  <span className="text-muted-foreground">Quick check</span>
                </div>
                <div className="flex justify-between">
                  <code className="bg-muted px-2 py-1 rounded text-xs">
                    GET /api/v1/system/health/detailed
                  </code>
                  <span className="text-muted-foreground">Full status</span>
                </div>
                <div className="flex justify-between">
                  <code className="bg-muted px-2 py-1 rounded text-xs">
                    GET /api/v1/system/health/database
                  </code>
                  <span className="text-muted-foreground">Database only</span>
                </div>
                <div className="flex justify-between">
                  <code className="bg-muted px-2 py-1 rounded text-xs">
                    GET /api/v1/system/health/redis
                  </code>
                  <span className="text-muted-foreground">Redis only</span>
                </div>
                <div className="flex justify-between">
                  <code className="bg-muted px-2 py-1 rounded text-xs">
                    GET /api/v1/system/alerts
                  </code>
                  <span className="text-muted-foreground">Active alerts</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                All endpoints except the quick health check require authentication.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default SystemHealthPage;
