import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SystemHealthDashboard from '../../../components/SystemHealth/SystemHealthDashboard';
import { HealthStatus } from '../../../hooks/useSystemHealth';

// Mock the hooks
vi.mock('../../../hooks/useSystemHealth', () => ({
  useDetailedHealth: vi.fn(),
  useSystemAlerts: vi.fn(),
  useSystemStatus: vi.fn(),
  getStatusColor: vi.fn((status) => status === 'healthy' ? 'green' : 'red'),
  getStatusIcon: vi.fn((status) => status === 'healthy' ? '✅' : '❌'),
  formatUptime: vi.fn((seconds) => `${Math.floor(seconds / 60)}m`),
  formatBytes: vi.fn((bytes) => `${Math.round(bytes / 1024 / 1024)}MB`),
  formatPercentage: vi.fn((value) => `${value}%`),
}));

const mockHealthData: HealthStatus = {
  status: 'healthy',
  timestamp: '2024-01-01T12:00:00Z',
  version: '1.0.0',
  environment: 'test',
  services: {
    database: {
      status: 'healthy',
      responseTime: 50,
      details: { userCount: 100 }
    },
    redis: {
      status: 'healthy',
      responseTime: 10,
      details: { memory: '10MB' }
    },
    fileSystem: {
      status: 'healthy',
      responseTime: 5,
      details: { writable: true }
    },
    memory: {
      status: 'degraded',
      details: { heapUsedPercent: '85%' }
    },
    environment: {
      status: 'healthy',
      details: { nodeEnv: 'test' }
    },
    dependencies: {
      status: 'healthy',
      details: { allDependenciesLoaded: true }
    }
  },
  performance: {
    uptime: 3600,
    memoryUsage: {
      rss: 100 * 1024 * 1024,
      heapTotal: 80 * 1024 * 1024,
      heapUsed: 60 * 1024 * 1024,
      external: 10 * 1024 * 1024,
      arrayBuffers: 5 * 1024 * 1024
    },
    cpuUsage: 25.5,
    loadAverage: [1.2, 1.1, 1.0],
    diskUsage: {
      total: 1000 * 1024 * 1024 * 1024,
      used: 600 * 1024 * 1024 * 1024,
      free: 400 * 1024 * 1024 * 1024,
      percentUsed: 60
    }
  },
  alerts: [
    {
      level: 'warning',
      service: 'memory',
      message: 'High memory usage detected',
      timestamp: '2024-01-01T12:00:00Z',
      details: { heapUsedPercent: 85 }
    }
  ],
  metadata: {
    checkDuration: 150,
    nodeVersion: 'v18.0.0',
    platform: 'linux',
    architecture: 'x64'
  }
};

const mockAlerts = [
  {
    level: 'warning' as const,
    service: 'memory',
    message: 'High memory usage detected',
    timestamp: '2024-01-01T12:00:00Z'
  },
  {
    level: 'critical' as const,
    service: 'database',
    message: 'Connection timeout',
    timestamp: '2024-01-01T11:55:00Z'
  }
];

describe('SystemHealthDashboard', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Reset mocks
    vi.clearAllMocks();
  });

  const renderWithQueryClient = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    );
  };

  it('renders loading state correctly', () => {
    const { useDetailedHealth, useSystemAlerts, useSystemStatus } = require('../../../hooks/useSystemHealth');
    
    useDetailedHealth.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn()
    });
    
    useSystemAlerts.mockReturnValue({
      data: undefined,
      isLoading: true
    });
    
    useSystemStatus.mockReturnValue({
      data: undefined
    });

    renderWithQueryClient(<SystemHealthDashboard />);

    expect(screen.getByText('Loading system health...')).toBeInTheDocument();
  });

  it('renders error state correctly', () => {
    const { useDetailedHealth, useSystemAlerts, useSystemStatus } = require('../../../hooks/useSystemHealth');
    
    useDetailedHealth.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn()
    });
    
    useSystemAlerts.mockReturnValue({
      data: undefined,
      isLoading: false
    });
    
    useSystemStatus.mockReturnValue({
      data: undefined
    });

    renderWithQueryClient(<SystemHealthDashboard />);

    expect(screen.getByText('Failed to load system health')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('renders healthy system status correctly', () => {
    const { useDetailedHealth, useSystemAlerts, useSystemStatus } = require('../../../hooks/useSystemHealth');
    
    useDetailedHealth.mockReturnValue({
      data: mockHealthData,
      isLoading: false,
      isError: false,
      refetch: vi.fn()
    });
    
    useSystemAlerts.mockReturnValue({
      data: mockAlerts,
      isLoading: false
    });
    
    useSystemStatus.mockReturnValue({
      data: { status: 'operational' }
    });

    renderWithQueryClient(<SystemHealthDashboard />);

    // Check header
    expect(screen.getByText('System Health Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Monitor system status and performance metrics')).toBeInTheDocument();

    // Check overall status
    expect(screen.getByText('Overall System Status')).toBeInTheDocument();
    expect(screen.getByText('HEALTHY')).toBeInTheDocument();

    // Check version and environment
    expect(screen.getByText('1.0.0')).toBeInTheDocument();
    expect(screen.getByText('test')).toBeInTheDocument();
  });

  it('displays service statuses correctly', () => {
    const { useDetailedHealth, useSystemAlerts, useSystemStatus } = require('../../../hooks/useSystemHealth');
    
    useDetailedHealth.mockReturnValue({
      data: mockHealthData,
      isLoading: false,
      isError: false,
      refetch: vi.fn()
    });
    
    useSystemAlerts.mockReturnValue({
      data: [],
      isLoading: false
    });
    
    useSystemStatus.mockReturnValue({
      data: { status: 'operational' }
    });

    renderWithQueryClient(<SystemHealthDashboard />);

    // Click on Services tab (should be default)
    const servicesTab = screen.getByRole('tab', { name: /services/i });
    fireEvent.click(servicesTab);

    // Check service cards
    expect(screen.getByText('Database')).toBeInTheDocument();
    expect(screen.getByText('Redis')).toBeInTheDocument();
    expect(screen.getByText('File System')).toBeInTheDocument();
    expect(screen.getByText('Memory')).toBeInTheDocument();
  });

  it('displays performance metrics correctly', () => {
    const { useDetailedHealth, useSystemAlerts, useSystemStatus } = require('../../../hooks/useSystemHealth');
    
    useDetailedHealth.mockReturnValue({
      data: mockHealthData,
      isLoading: false,
      isError: false,
      refetch: vi.fn()
    });
    
    useSystemAlerts.mockReturnValue({
      data: [],
      isLoading: false
    });
    
    useSystemStatus.mockReturnValue({
      data: { status: 'operational' }
    });

    renderWithQueryClient(<SystemHealthDashboard />);

    // Click on Performance tab
    const performanceTab = screen.getByRole('tab', { name: /performance/i });
    fireEvent.click(performanceTab);

    // Check performance sections
    expect(screen.getByText('Memory Usage')).toBeInTheDocument();
    expect(screen.getByText('Disk Usage')).toBeInTheDocument();
    expect(screen.getByText('Load Average')).toBeInTheDocument();
  });

  it('displays alerts correctly', () => {
    const { useDetailedHealth, useSystemAlerts, useSystemStatus } = require('../../../hooks/useSystemHealth');
    
    useDetailedHealth.mockReturnValue({
      data: mockHealthData,
      isLoading: false,
      isError: false,
      refetch: vi.fn()
    });
    
    useSystemAlerts.mockReturnValue({
      data: mockAlerts,
      isLoading: false
    });
    
    useSystemStatus.mockReturnValue({
      data: { status: 'operational' }
    });

    renderWithQueryClient(<SystemHealthDashboard />);

    // Click on Alerts tab
    const alertsTab = screen.getByRole('tab', { name: /alerts/i });
    fireEvent.click(alertsTab);

    // Check alerts
    expect(screen.getByText('High memory usage detected')).toBeInTheDocument();
    expect(screen.getByText('Connection timeout')).toBeInTheDocument();
    expect(screen.getByText('MEMORY')).toBeInTheDocument();
    expect(screen.getByText('DATABASE')).toBeInTheDocument();
  });

  it('displays system metadata correctly', () => {
    const { useDetailedHealth, useSystemAlerts, useSystemStatus } = require('../../../hooks/useSystemHealth');
    
    useDetailedHealth.mockReturnValue({
      data: mockHealthData,
      isLoading: false,
      isError: false,
      refetch: vi.fn()
    });
    
    useSystemAlerts.mockReturnValue({
      data: [],
      isLoading: false
    });
    
    useSystemStatus.mockReturnValue({
      data: { status: 'operational' }
    });

    renderWithQueryClient(<SystemHealthDashboard />);

    // Click on System Info tab
    const metadataTab = screen.getByRole('tab', { name: /system info/i });
    fireEvent.click(metadataTab);

    // Check metadata
    expect(screen.getByText('System Information')).toBeInTheDocument();
    expect(screen.getByText('v18.0.0')).toBeInTheDocument();
    expect(screen.getByText('linux')).toBeInTheDocument();
    expect(screen.getByText('x64')).toBeInTheDocument();
    expect(screen.getByText('150ms')).toBeInTheDocument();
  });

  it('handles refresh functionality', async () => {
    const mockRefetch = vi.fn();
    const { useDetailedHealth, useSystemAlerts, useSystemStatus } = require('../../../hooks/useSystemHealth');
    
    useDetailedHealth.mockReturnValue({
      data: mockHealthData,
      isLoading: false,
      isError: false,
      refetch: mockRefetch
    });
    
    useSystemAlerts.mockReturnValue({
      data: [],
      isLoading: false
    });
    
    useSystemStatus.mockReturnValue({
      data: { status: 'operational' }
    });

    renderWithQueryClient(<SystemHealthDashboard />);

    // Click refresh button
    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    fireEvent.click(refreshButton);

    expect(mockRefetch).toHaveBeenCalled();
  });

  it('handles auto-refresh toggle', () => {
    const { useDetailedHealth, useSystemAlerts, useSystemStatus } = require('../../../hooks/useSystemHealth');
    
    useDetailedHealth.mockReturnValue({
      data: mockHealthData,
      isLoading: false,
      isError: false,
      refetch: vi.fn()
    });
    
    useSystemAlerts.mockReturnValue({
      data: [],
      isLoading: false
    });
    
    useSystemStatus.mockReturnValue({
      data: { status: 'operational' }
    });

    renderWithQueryClient(<SystemHealthDashboard />);

    // Check initial state
    expect(screen.getByText('Disable Auto-refresh')).toBeInTheDocument();

    // Click to disable auto-refresh
    const autoRefreshButton = screen.getByRole('button', { name: /disable auto-refresh/i });
    fireEvent.click(autoRefreshButton);

    expect(screen.getByText('Enable Auto-refresh')).toBeInTheDocument();
  });

  it('shows no alerts message when there are no alerts', () => {
    const { useDetailedHealth, useSystemAlerts, useSystemStatus } = require('../../../hooks/useSystemHealth');
    
    useDetailedHealth.mockReturnValue({
      data: mockHealthData,
      isLoading: false,
      isError: false,
      refetch: vi.fn()
    });
    
    useSystemAlerts.mockReturnValue({
      data: [],
      isLoading: false
    });
    
    useSystemStatus.mockReturnValue({
      data: { status: 'operational' }
    });

    renderWithQueryClient(<SystemHealthDashboard />);

    // Click on Alerts tab
    const alertsTab = screen.getByRole('tab', { name: /alerts/i });
    fireEvent.click(alertsTab);

    expect(screen.getByText('No Active Alerts')).toBeInTheDocument();
    expect(screen.getByText('All systems are operating normally')).toBeInTheDocument();
  });
});
