import { useApiQuery, useApiMutation } from './useApiQuery';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

// Types for system health
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  environment: string;
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
    fileSystem: ServiceHealth;
    memory: ServiceHealth;
    environment: ServiceHealth;
    dependencies: ServiceHealth;
  };
  performance: {
    uptime: number;
    memoryUsage: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
      arrayBuffers: number;
    };
    cpuUsage?: number;
    loadAverage?: number[];
    diskUsage?: {
      total: number;
      used: number;
      free: number;
      percentUsed: number;
    };
  };
  alerts?: HealthAlert[];
  metadata: {
    checkDuration: number;
    nodeVersion: string;
    platform: string;
    architecture: string;
  };
}

export interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  message?: string;
  details?: any;
  lastChecked?: string;
  errorCount?: number;
}

export interface HealthAlert {
  level: 'warning' | 'critical';
  service: string;
  message: string;
  timestamp: string;
  details?: any;
}

export interface QuickHealthStatus {
  status: string;
  timestamp: string;
}

// Hook for quick health check (no auth required)
export const useQuickHealth = (options?: { 
  refetchInterval?: number;
  enabled?: boolean;
}) => {
  return useApiQuery<QuickHealthStatus>(
    ['system', 'health', 'quick'],
    () => api.get('/system/health'),
    {
      refetchInterval: options?.refetchInterval || 30000, // 30 seconds
      enabled: options?.enabled !== false,
      staleTime: 10000, // 10 seconds
      retry: (failureCount, error: any) => {
        // Don't retry too aggressively for health checks
        return failureCount < 2;
      },
      ...options,
    }
  );
};

// Hook for detailed health check (requires auth)
export const useDetailedHealth = (options?: {
  refetchInterval?: number;
  enabled?: boolean;
}) => {
  return useApiQuery<HealthStatus>(
    ['system', 'health', 'detailed'],
    () => api.get('/system/health/detailed'),
    {
      refetchInterval: options?.refetchInterval || 60000, // 1 minute
      enabled: options?.enabled !== false,
      staleTime: 30000, // 30 seconds
      retry: (failureCount, error: any) => {
        return failureCount < 2;
      },
      ...options,
    }
  );
};

// Hook for service-specific health checks
export const useServiceHealth = (service: 'database' | 'redis' | 'memory' | 'filesystem', options?: {
  refetchInterval?: number;
  enabled?: boolean;
}) => {
  return useApiQuery<ServiceHealth>(
    ['system', 'health', service],
    () => api.get(`/system/health/${service}`),
    {
      refetchInterval: options?.refetchInterval || 60000,
      enabled: options?.enabled !== false,
      staleTime: 30000,
      retry: 1,
      ...options,
    }
  );
};

// Hook for system metrics
export const useSystemMetrics = (
  metric: 'cpu' | 'memory' | 'disk' | 'network' | 'requests' | 'errors',
  startDate: string,
  endDate: string,
  options?: {
    enabled?: boolean;
  }
) => {
  return useApiQuery(
    ['system', 'metrics', metric, startDate, endDate],
    () => api.get('/system/metrics', {
      params: { metric, startDate, endDate }
    }),
    {
      enabled: options?.enabled !== false && !!startDate && !!endDate,
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
      ...options,
    }
  );
};

// Hook for system alerts
export const useSystemAlerts = (limit: number = 10, options?: {
  refetchInterval?: number;
  enabled?: boolean;
}) => {
  return useApiQuery(
    ['system', 'alerts', limit],
    () => api.get('/system/alerts', { params: { limit } }),
    {
      refetchInterval: options?.refetchInterval || 30000,
      enabled: options?.enabled !== false,
      staleTime: 15000, // 15 seconds
      retry: 1,
      ...options,
    }
  );
};

// Hook for system status
export const useSystemStatus = (options?: {
  refetchInterval?: number;
  enabled?: boolean;
}) => {
  return useApiQuery(
    ['system', 'status'],
    () => api.get('/system/status'),
    {
      refetchInterval: options?.refetchInterval || 60000,
      enabled: options?.enabled !== false,
      staleTime: 30000,
      retry: 1,
      ...options,
    }
  );
};

// Utility functions for health status
export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'healthy':
      return 'green';
    case 'degraded':
      return 'yellow';
    case 'unhealthy':
      return 'red';
    default:
      return 'gray';
  }
};

export const getStatusIcon = (status: string): string => {
  switch (status) {
    case 'healthy':
      return '✅';
    case 'degraded':
      return '⚠️';
    case 'unhealthy':
      return '❌';
    default:
      return '❓';
  }
};

export const formatUptime = (seconds: number): string => {
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

export const formatBytes = (bytes: number): string => {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
};

export const formatPercentage = (value: number): string => {
  return `${Math.round(value * 100) / 100}%`;
};

// Hook for real-time health monitoring with WebSocket (if available)
export const useRealTimeHealth = () => {
  // This would connect to a WebSocket endpoint for real-time updates
  // For now, we'll use polling with a shorter interval
  const quickHealth = useQuickHealth({ refetchInterval: 5000 }); // 5 seconds
  const detailedHealth = useDetailedHealth({ refetchInterval: 15000 }); // 15 seconds
  const alerts = useSystemAlerts(5, { refetchInterval: 10000 }); // 10 seconds
  
  return {
    quickHealth,
    detailedHealth,
    alerts,
    isConnected: !quickHealth.isError,
    lastUpdate: quickHealth.dataUpdatedAt,
  };
};

export default {
  useQuickHealth,
  useDetailedHealth,
  useServiceHealth,
  useSystemMetrics,
  useSystemAlerts,
  useSystemStatus,
  useRealTimeHealth,
  getStatusColor,
  getStatusIcon,
  formatUptime,
  formatBytes,
  formatPercentage,
};
