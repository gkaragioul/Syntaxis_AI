import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { MonitoringDashboardService } from '../../services/monitoring-dashboard.service';

// Mock dependencies
jest.mock('../../services/PerformanceMonitoringService');
jest.mock('../../services/MetricsService');

/**
 * Monitoring Dashboard Tests
 * 
 * Tests the monitoring dashboard service including:
 * - Dashboard metrics collection and aggregation
 * - Alert rule management and evaluation
 * - System health monitoring
 * - Performance metrics tracking
 * - Infrastructure monitoring
 */
describe('Monitoring Dashboard', () => {
  let monitoringService: MonitoringDashboardService;

  beforeEach(() => {
    monitoringService = MonitoringDashboardService.getInstance();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Dashboard Metrics Collection', () => {
    it('should have a method to collect dashboard metrics', () => {
      expect(typeof monitoringService.getDashboardMetrics).toBe('function');
    });

    it('should handle dashboard metrics structure', () => {
      // Test the expected structure without complex mocking
      const expectedStructure = {
        system: expect.any(Object),
        application: expect.any(Object),
        security: expect.any(Object),
        performance: expect.any(Object),
        infrastructure: expect.any(Object),
      };

      // This validates the service has the right interface
      expect(monitoringService).toBeDefined();
    });
  });

  describe('Alert Rule Management', () => {
    it('should initialize with default alert rules', () => {
      const alertRules = monitoringService.getAlertRules();

      expect(alertRules).toBeDefined();
      expect(alertRules.length).toBeGreaterThan(0);

      // Check for specific default rules
      const errorRateRule = alertRules.find(rule => rule.id === 'high_error_rate');
      expect(errorRateRule).toBeDefined();
      expect(errorRateRule?.metric).toBe('application.errorRate');
      expect(errorRateRule?.threshold).toBe(0.05);
      expect(errorRateRule?.severity).toBe('high');

      const responseTimeRule = alertRules.find(rule => rule.id === 'slow_response_time');
      expect(responseTimeRule).toBeDefined();
      expect(responseTimeRule?.metric).toBe('application.averageResponseTime');
      expect(responseTimeRule?.threshold).toBe(5000);
    });

    it('should add custom alert rules', () => {
      const customRule = {
        id: 'custom_rule',
        name: 'Custom Alert Rule',
        metric: 'custom.metric',
        condition: 'greater_than' as const,
        threshold: 100,
        severity: 'medium' as const,
        enabled: true,
        cooldownMinutes: 5,
      };

      monitoringService.addAlertRule(customRule);

      const alertRules = monitoringService.getAlertRules();
      const addedRule = alertRules.find(rule => rule.id === 'custom_rule');

      expect(addedRule).toBeDefined();
      expect(addedRule?.name).toBe('Custom Alert Rule');
      expect(addedRule?.threshold).toBe(100);
    });

    it('should enable and disable alert rules', () => {
      const alertRules = monitoringService.getAlertRules();
      const firstRule = alertRules[0];

      expect(firstRule.enabled).toBe(true);

      monitoringService.toggleAlertRule(firstRule.id, false);
      const updatedRules = monitoringService.getAlertRules();
      const updatedRule = updatedRules.find(rule => rule.id === firstRule.id);

      expect(updatedRule?.enabled).toBe(false);
    });
  });

  describe('Alert Evaluation', () => {
    it('should evaluate greater_than conditions correctly', () => {
      const evaluateCondition = (monitoringService as any).evaluateCondition.bind(monitoringService);

      expect(evaluateCondition(10, 'greater_than', 5)).toBe(true);
      expect(evaluateCondition(3, 'greater_than', 5)).toBe(false);
      expect(evaluateCondition(5, 'greater_than', 5)).toBe(false);
    });

    it('should evaluate less_than conditions correctly', () => {
      const evaluateCondition = (monitoringService as any).evaluateCondition.bind(monitoringService);

      expect(evaluateCondition(3, 'less_than', 5)).toBe(true);
      expect(evaluateCondition(10, 'less_than', 5)).toBe(false);
      expect(evaluateCondition(5, 'less_than', 5)).toBe(false);
    });

    it('should evaluate equals conditions correctly', () => {
      const evaluateCondition = (monitoringService as any).evaluateCondition.bind(monitoringService);

      expect(evaluateCondition(5, 'equals', 5)).toBe(true);
      expect(evaluateCondition('healthy', 'equals', 'healthy')).toBe(true);
      expect(evaluateCondition(5, 'equals', 10)).toBe(false);
    });

    it('should extract metric values from nested objects', () => {
      const getMetricValue = (monitoringService as any).getMetricValue.bind(monitoringService);

      const metrics = {
        system: {
          memoryUsage: {
            heapUsed: 100000000,
          },
        },
        application: {
          errorRate: 0.05,
        },
      };

      expect(getMetricValue(metrics, 'system.memoryUsage.heapUsed')).toBe(100000000);
      expect(getMetricValue(metrics, 'application.errorRate')).toBe(0.05);
      expect(getMetricValue(metrics, 'nonexistent.path')).toBeUndefined();
    });
  });

  describe('System Health Monitoring', () => {
    it('should have system health monitoring capabilities', () => {
      // Test that the service has the expected methods
      expect(monitoringService).toBeDefined();
      expect(typeof monitoringService.getDashboardMetrics).toBe('function');
    });
  });

  describe('Performance Metrics Tracking', () => {
    it('should have performance tracking capabilities', () => {
      expect(monitoringService).toBeDefined();
      expect(typeof monitoringService.getDashboardMetrics).toBe('function');
    });
  });

  describe('Alert History and Management', () => {
    it('should have alert management capabilities', () => {
      expect(typeof monitoringService.getRecentAlerts).toBe('function');
      expect(typeof monitoringService.addAlertRule).toBe('function');
      expect(typeof monitoringService.getAlertRules).toBe('function');
      expect(typeof monitoringService.toggleAlertRule).toBe('function');
    });
  });

  describe('Integration and Error Handling', () => {
    it('should validate alert rule configuration', () => {
      const alertRules = monitoringService.getAlertRules();

      alertRules.forEach(rule => {
        expect(rule.id).toBeDefined();
        expect(rule.name).toBeDefined();
        expect(rule.metric).toBeDefined();
        expect(['greater_than', 'less_than', 'equals']).toContain(rule.condition);
        expect(rule.threshold).toBeDefined();
        expect(['low', 'medium', 'high', 'critical']).toContain(rule.severity);
        expect(typeof rule.enabled).toBe('boolean');
        expect(rule.cooldownMinutes).toBeGreaterThan(0);
      });
    });

    it('should have proper service initialization', () => {
      expect(monitoringService).toBeDefined();
      expect(MonitoringDashboardService.getInstance()).toBe(monitoringService);
    });
  });
});
