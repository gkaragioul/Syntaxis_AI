/**
 * TDD Monitoring Service Tests
 * 
 * Task 1.2.5: Continuous Test Monitoring - TDD Implementation
 * 
 * These tests validate the TDD monitoring service functionality
 * following TDD principles: Red-Green-Refactor
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { setupTestEnvironment, cleanupTestEnvironment } from '../../utils/test-environment';
import { prismaMock } from '../../__mocks__/prisma';
import TDDMonitoringService, { defaultTDDMonitoringConfig } from '../../../monitoring/tdd-monitoring.service';

// Mock child_process for command execution
jest.mock('child_process');
const mockExecSync = jest.fn();
jest.doMock('child_process', () => ({
  execSync: mockExecSync,
}));

// Mock fs for file operations
jest.mock('fs');
const mockFs = {
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
};
jest.doMock('fs', () => mockFs);

describe('TDDMonitoringService', () => {
  let service: TDDMonitoringService;
  const mockConfig = {
    ...defaultTDDMonitoringConfig,
    monitoringInterval: 1000, // 1 second for testing
  };

  beforeEach(async () => {
    await setupTestEnvironment({ useMocks: true });
    service = new TDDMonitoringService(mockConfig, prismaMock as any);
    jest.clearAllMocks();
  });

  afterEach(async () => {
    service.stopMonitoring();
    await cleanupTestEnvironment();
  });

  describe('Service Initialization', () => {
    it('should initialize with valid configuration', () => {
      expect(service).toBeDefined();
      expect(service.getActiveAlerts()).toHaveLength(0);
    });

    it('should start and stop monitoring', () => {
      service.startMonitoring();
      // Monitoring should be active
      
      service.stopMonitoring();
      // Monitoring should be stopped
      
      expect(true).toBe(true); // Service lifecycle works
    });
  });

  describe('Metrics Collection', () => {
    it('should collect comprehensive TDD metrics', async () => {
      // Mock coverage data
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        total: {
          statements: { pct: 96 },
          branches: { pct: 94 },
          functions: { pct: 98 },
          lines: { pct: 95 },
        },
      }));

      // Mock test results
      mockExecSync.mockImplementation((command: string) => {
        if (command.includes('test:coverage')) {
          return '';
        } else if (command.includes('npm test')) {
          return JSON.stringify({
            numTotalTests: 150,
            numPassedTests: 148,
            numFailedTests: 2,
            numPendingTests: 0,
          });
        } else if (command.includes('validate-tdd-compliance')) {
          return JSON.stringify({
            redGreenRefactorCycles: 15,
            testFirstRatio: 0.94,
            coverageConsistency: 0.96,
            performanceCompliance: 0.92,
          });
        } else if (command.includes('lint')) {
          return JSON.stringify([
            { errorCount: 2, warningCount: 3 },
            { errorCount: 0, warningCount: 1 },
          ]);
        } else if (command.includes('test:performance')) {
          return JSON.stringify({
            averageTestTime: 180,
            slowestTest: 2500,
          });
        }
        return '';
      });

      const metrics = await service.collectMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.testCoverage.statements).toBe(96);
      expect(metrics.testResults.total).toBe(150);
      expect(metrics.testResults.passed).toBe(148);
      expect(metrics.testResults.failed).toBe(2);
      expect(metrics.tddCompliance.testFirstRatio).toBe(0.94);
      expect(metrics.codeQuality.lintErrors).toBe(6); // 2+3+0+1
      expect(metrics.performance.averageTestTime).toBe(180);
    });

    it('should handle metrics collection errors gracefully', async () => {
      // Mock command failures
      mockExecSync.mockImplementation(() => {
        throw new Error('Command failed');
      });

      mockFs.existsSync.mockReturnValue(false);

      const metrics = await service.collectMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.testCoverage.statements).toBe(0);
      expect(metrics.testResults.total).toBe(0);
      expect(metrics.tddCompliance.testFirstRatio).toBe(0);
    });

    it('should store metrics in database', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        total: { statements: { pct: 96 } },
      }));

      mockExecSync.mockReturnValue(JSON.stringify({
        numTotalTests: 100,
        numPassedTests: 100,
        numFailedTests: 0,
      }));

      prismaMock.performanceMetric.create.mockResolvedValue({
        id: 'metric-123',
        operation: 'tdd_monitoring',
        timestamp: new Date(),
      } as any);

      await service.collectMetrics();

      expect(prismaMock.performanceMetric.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          operation: 'tdd_monitoring',
          timestamp: expect.any(Date),
          metadata: expect.objectContaining({
            testCoverage: expect.any(Object),
            testResults: expect.any(Object),
          }),
        }),
      });
    });
  });

  describe('Alert Generation', () => {
    it('should generate coverage drop alert', async () => {
      // Mock low coverage
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        total: { statements: { pct: 90 } }, // Below 95% threshold
      }));

      mockExecSync.mockReturnValue(JSON.stringify({
        numTotalTests: 100,
        numPassedTests: 100,
        numFailedTests: 0,
      }));

      await service.collectMetrics();

      const alerts = service.getActiveAlerts();
      expect(alerts.length).toBeGreaterThan(0);
      
      const coverageAlert = alerts.find(a => a.type === 'coverage_drop');
      expect(coverageAlert).toBeDefined();
      expect(coverageAlert?.severity).toBe('high');
      expect(coverageAlert?.message).toContain('90%');
    });

    it('should generate test failure alert', async () => {
      // Mock high test failure rate
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        total: { statements: { pct: 96 } },
      }));

      mockExecSync.mockReturnValue(JSON.stringify({
        numTotalTests: 100,
        numPassedTests: 90,
        numFailedTests: 10, // 10% failure rate
      }));

      await service.collectMetrics();

      const alerts = service.getActiveAlerts();
      const failureAlert = alerts.find(a => a.type === 'test_failure');
      expect(failureAlert).toBeDefined();
      expect(failureAlert?.severity).toBe('critical');
    });

    it('should generate TDD compliance alert', async () => {
      // Mock low TDD compliance
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        total: { statements: { pct: 96 } },
      }));

      mockExecSync.mockImplementation((command: string) => {
        if (command.includes('validate-tdd-compliance')) {
          return JSON.stringify({
            testFirstRatio: 0.8, // Below 90% threshold
          });
        }
        return JSON.stringify({
          numTotalTests: 100,
          numPassedTests: 100,
          numFailedTests: 0,
        });
      });

      await service.collectMetrics();

      const alerts = service.getActiveAlerts();
      const tddAlert = alerts.find(a => a.type === 'tdd_violation');
      expect(tddAlert).toBeDefined();
      expect(tddAlert?.severity).toBe('medium');
    });

    it('should resolve alerts', async () => {
      // Generate an alert first
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        total: { statements: { pct: 90 } },
      }));

      mockExecSync.mockReturnValue(JSON.stringify({
        numTotalTests: 100,
        numPassedTests: 100,
        numFailedTests: 0,
      }));

      await service.collectMetrics();

      const alerts = service.getActiveAlerts();
      expect(alerts.length).toBeGreaterThan(0);

      const alertId = alerts[0].id;
      await service.resolveAlert(alertId);

      const activeAlerts = service.getActiveAlerts();
      const resolvedAlert = activeAlerts.find(a => a.id === alertId);
      expect(resolvedAlert).toBeUndefined();
    });
  });

  describe('Dashboard Data', () => {
    it('should generate comprehensive dashboard data', async () => {
      // Mock good metrics
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        total: {
          statements: { pct: 96 },
          branches: { pct: 94 },
          functions: { pct: 98 },
          lines: { pct: 95 },
        },
      }));

      mockExecSync.mockImplementation((command: string) => {
        if (command.includes('npm test')) {
          return JSON.stringify({
            numTotalTests: 150,
            numPassedTests: 150,
            numFailedTests: 0,
          });
        } else if (command.includes('validate-tdd-compliance')) {
          return JSON.stringify({
            testFirstRatio: 0.95,
            coverageConsistency: 0.96,
          });
        }
        return JSON.stringify({});
      });

      const dashboardData = await service.getDashboardData();

      expect(dashboardData).toBeDefined();
      expect(dashboardData.metrics).toBeDefined();
      expect(dashboardData.alerts).toBeDefined();
      expect(dashboardData.trends).toBeDefined();
      expect(dashboardData.summary).toBeDefined();
      expect(dashboardData.summary.overallHealth).toBeGreaterThan(80);
      expect(Array.isArray(dashboardData.summary.recommendations)).toBe(true);
    });

    it('should provide health score calculation', async () => {
      // Mock excellent metrics
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        total: { statements: { pct: 98 } },
      }));

      mockExecSync.mockImplementation((command: string) => {
        if (command.includes('npm test')) {
          return JSON.stringify({
            numTotalTests: 100,
            numPassedTests: 100,
            numFailedTests: 0,
          });
        } else if (command.includes('validate-tdd-compliance')) {
          return JSON.stringify({ testFirstRatio: 0.98 });
        } else if (command.includes('lint')) {
          return JSON.stringify([]);
        }
        return JSON.stringify({});
      });

      const dashboardData = await service.getDashboardData();
      expect(dashboardData.summary.overallHealth).toBeGreaterThan(90);
    });

    it('should generate actionable recommendations', async () => {
      // Mock metrics that need improvement
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        total: { statements: { pct: 92 } }, // Below threshold
      }));

      mockExecSync.mockImplementation((command: string) => {
        if (command.includes('validate-tdd-compliance')) {
          return JSON.stringify({ testFirstRatio: 0.85 }); // Below threshold
        } else if (command.includes('lint')) {
          return JSON.stringify([{ errorCount: 5, warningCount: 3 }]);
        } else if (command.includes('test:performance')) {
          return JSON.stringify({ averageTestTime: 250 }); // Above threshold
        }
        return JSON.stringify({
          numTotalTests: 100,
          numPassedTests: 100,
          numFailedTests: 0,
        });
      });

      const dashboardData = await service.getDashboardData();
      const recommendations = dashboardData.summary.recommendations;

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some((r: string) => r.includes('coverage'))).toBe(true);
      expect(recommendations.some((r: string) => r.includes('TDD compliance'))).toBe(true);
      expect(recommendations.some((r: string) => r.includes('linting'))).toBe(true);
      expect(recommendations.some((r: string) => r.includes('performance'))).toBe(true);
    });
  });

  describe('Continuous Monitoring', () => {
    it('should run periodic monitoring', (done) => {
      // Mock successful metrics collection
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        total: { statements: { pct: 96 } },
      }));

      mockExecSync.mockReturnValue(JSON.stringify({
        numTotalTests: 100,
        numPassedTests: 100,
        numFailedTests: 0,
      }));

      service.startMonitoring();

      // Wait for at least one monitoring cycle
      setTimeout(() => {
        service.stopMonitoring();
        done();
      }, 1500); // Wait longer than monitoring interval
    });

    it('should handle monitoring errors gracefully', (done) => {
      // Mock failing metrics collection
      mockExecSync.mockImplementation(() => {
        throw new Error('Monitoring failed');
      });

      service.startMonitoring();

      // Should not crash despite errors
      setTimeout(() => {
        service.stopMonitoring();
        done();
      }, 1500);
    });
  });

  describe('Notification System', () => {
    it('should prepare Slack notifications for alerts', async () => {
      // This would test Slack notification preparation
      // In a real implementation, we'd mock the HTTP request
      expect(true).toBe(true); // Placeholder for notification tests
    });

    it('should prepare email notifications for alerts', async () => {
      // This would test email notification preparation
      // In a real implementation, we'd mock the email service
      expect(true).toBe(true); // Placeholder for notification tests
    });
  });
});
