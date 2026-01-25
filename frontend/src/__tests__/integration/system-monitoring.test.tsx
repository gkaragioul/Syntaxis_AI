import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { SystemStatusMonitor } from '../../components/SystemStatus/SystemStatusMonitor';
import { SystemAlerts } from '../../components/SystemStatus/SystemAlerts';
import { api } from '../../services/api';

// Mock the API
vi.mock('../../services/api');
const mockedApi = vi.mocked(api);

// Mock date-fns
vi.mock('date-fns', () => ({
  formatDistanceToNow: vi.fn(() => '2 minutes'),
}));

const theme = createTheme();

const createWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
};

describe('System Monitoring Integration Tests (Task 2.4.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('SystemStatusMonitor Component', () => {
    it('should render system status monitor with health data', async () => {
      const mockHealthData = {
        status: 'healthy',
        version: '1.0.0',
        uptime: 3600,
        timestamp: new Date().toISOString(),
        services: {
          database: { status: 'healthy', responseTime: 50 },
          redis: { status: 'healthy', responseTime: 25 },
          fileSystem: { status: 'healthy' },
          memory: { status: 'healthy' },
        },
      };

      const mockStatusData = {
        status: 'operational',
        version: '1.0.0',
        uptime: 3600,
        environment: 'development',
        timestamp: new Date().toISOString(),
      };

      mockedApi.get
        .mockResolvedValueOnce({ data: mockHealthData })
        .mockResolvedValueOnce({ data: mockStatusData });

      render(
        <SystemStatusMonitor showDetails={true} autoRefresh={false} />,
        { wrapper: createWrapper }
      );

      // Check if component renders
      expect(screen.getByText('System Status')).toBeInTheDocument();

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByText('HEALTHY')).toBeInTheDocument();
      });

      // Check if services are displayed
      expect(screen.getByText('Service Health')).toBeInTheDocument();
      expect(screen.getByText('Database')).toBeInTheDocument();
      expect(screen.getByText('Redis')).toBeInTheDocument();
    });

    it('should handle error states gracefully', async () => {
      mockedApi.get.mockRejectedValue(new Error('Network error'));

      render(
        <SystemStatusMonitor showDetails={true} autoRefresh={false} />,
        { wrapper: createWrapper }
      );

      await waitFor(() => {
        expect(screen.getByText('Failed to fetch system status')).toBeInTheDocument();
      });
    });

    it('should toggle details view', async () => {
      const mockHealthData = {
        status: 'healthy',
        services: {},
      };

      mockedApi.get.mockResolvedValue({ data: mockHealthData });

      render(
        <SystemStatusMonitor showDetails={false} autoRefresh={false} />,
        { wrapper: createWrapper }
      );

      // Find and click the expand button
      const expandButton = screen.getByLabelText(/show details/i);
      fireEvent.click(expandButton);

      // Details should now be visible
      await waitFor(() => {
        expect(screen.getByText('Service Health')).toBeInTheDocument();
      });
    });

    it('should refresh status manually', async () => {
      const mockHealthData = {
        status: 'healthy',
        services: {},
      };

      mockedApi.get.mockResolvedValue({ data: mockHealthData });

      render(
        <SystemStatusMonitor autoRefresh={false} />,
        { wrapper: createWrapper }
      );

      // Find and click the refresh button
      const refreshButton = screen.getByLabelText(/refresh status/i);
      fireEvent.click(refreshButton);

      // API should be called again
      await waitFor(() => {
        expect(mockedApi.get).toHaveBeenCalledTimes(2); // Initial load + manual refresh
      });
    });

    it('should auto-refresh when enabled', async () => {
      vi.useFakeTimers();

      const mockHealthData = {
        status: 'healthy',
        services: {},
      };

      mockedApi.get.mockResolvedValue({ data: mockHealthData });

      render(
        <SystemStatusMonitor autoRefresh={true} refreshInterval={1000} />,
        { wrapper: createWrapper }
      );

      // Wait for initial load
      await waitFor(() => {
        expect(mockedApi.get).toHaveBeenCalledTimes(1);
      });

      // Fast-forward time
      vi.advanceTimersByTime(1000);

      // Should have refreshed
      await waitFor(() => {
        expect(mockedApi.get).toHaveBeenCalledTimes(2);
      });

      vi.useRealTimers();
    });
  });

  describe('SystemAlerts Component', () => {
    it('should render system alerts', async () => {
      const mockAlerts = [
        {
          id: '1',
          type: 'error',
          title: 'Database Connection Error',
          message: 'Unable to connect to database',
          timestamp: new Date().toISOString(),
          resolved: false,
          severity: 'high',
          source: 'database',
        },
        {
          id: '2',
          type: 'warning',
          title: 'High Memory Usage',
          message: 'Memory usage is above 80%',
          timestamp: new Date().toISOString(),
          resolved: false,
          severity: 'medium',
          source: 'system',
        },
      ];

      mockedApi.get.mockResolvedValue({ data: mockAlerts });

      render(
        <SystemAlerts limit={10} autoRefresh={false} />,
        { wrapper: createWrapper }
      );

      // Check if component renders
      expect(screen.getByText('System Alerts')).toBeInTheDocument();

      // Wait for alerts to load
      await waitFor(() => {
        expect(screen.getByText('2 active')).toBeInTheDocument();
        expect(screen.getByText('Database Connection Error')).toBeInTheDocument();
        expect(screen.getByText('High Memory Usage')).toBeInTheDocument();
      });
    });

    it('should show all clear when no active alerts', async () => {
      const mockAlerts = [
        {
          id: '1',
          type: 'info',
          title: 'System Updated',
          message: 'System has been updated successfully',
          timestamp: new Date().toISOString(),
          resolved: true,
          severity: 'low',
          source: 'system',
        },
      ];

      mockedApi.get.mockResolvedValue({ data: mockAlerts });

      render(
        <SystemAlerts limit={10} autoRefresh={false} />,
        { wrapper: createWrapper }
      );

      await waitFor(() => {
        expect(screen.getByText('All clear')).toBeInTheDocument();
      });
    });

    it('should display critical alerts immediately', async () => {
      const mockAlerts = [
        {
          id: '1',
          type: 'error',
          title: 'Critical System Error',
          message: 'System is experiencing critical issues',
          timestamp: new Date().toISOString(),
          resolved: false,
          severity: 'critical',
          source: 'system',
        },
      ];

      mockedApi.get.mockResolvedValue({ data: mockAlerts });

      render(
        <SystemAlerts limit={10} autoRefresh={false} />,
        { wrapper: createWrapper }
      );

      await waitFor(() => {
        expect(screen.getByText('Critical System Error')).toBeInTheDocument();
        expect(screen.getByText('CRITICAL')).toBeInTheDocument();
      });
    });

    it('should expand and collapse alert details', async () => {
      const mockAlerts = [
        {
          id: '1',
          type: 'warning',
          title: 'Test Alert',
          message: 'Test alert message',
          timestamp: new Date().toISOString(),
          resolved: false,
          severity: 'medium',
          source: 'test',
        },
      ];

      mockedApi.get.mockResolvedValue({ data: mockAlerts });

      render(
        <SystemAlerts limit={10} autoRefresh={false} />,
        { wrapper: createWrapper }
      );

      // Wait for alerts to load
      await waitFor(() => {
        expect(screen.getByText('Test Alert')).toBeInTheDocument();
      });

      // Find and click the expand button
      const expandButton = screen.getByRole('button', { name: /expand/i });
      fireEvent.click(expandButton);

      // Details should be visible
      expect(screen.getByText('Test alert message')).toBeInTheDocument();
    });

    it('should handle error loading alerts', async () => {
      mockedApi.get.mockRejectedValue(new Error('Failed to load alerts'));

      render(
        <SystemAlerts limit={10} autoRefresh={false} />,
        { wrapper: createWrapper }
      );

      await waitFor(() => {
        expect(screen.getByText('Failed to Load Alerts')).toBeInTheDocument();
        expect(screen.getByText('Unable to fetch system alerts')).toBeInTheDocument();
      });
    });
  });

  describe('Integration with API Hooks', () => {
    it('should use correct API endpoints', async () => {
      const mockHealthData = { status: 'healthy' };
      const mockStatusData = { status: 'operational' };
      const mockAlerts = [];

      mockedApi.get
        .mockResolvedValueOnce({ data: mockHealthData })
        .mockResolvedValueOnce({ data: mockStatusData })
        .mockResolvedValueOnce({ data: mockAlerts });

      render(
        <div>
          <SystemStatusMonitor autoRefresh={false} />
          <SystemAlerts autoRefresh={false} />
        </div>,
        { wrapper: createWrapper }
      );

      await waitFor(() => {
        expect(mockedApi.get).toHaveBeenCalledWith('/system/health');
        expect(mockedApi.get).toHaveBeenCalledWith('/system/status');
        expect(mockedApi.get).toHaveBeenCalledWith('/system/alerts', expect.any(Object));
      });
    });
  });
});
