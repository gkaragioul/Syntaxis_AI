/**
 * Uptime Monitoring System Tests
 * 
 * Task 2.3.5: Uptime Monitoring Tests - TDD RED Phase
 * 
 * These tests define the uptime monitoring system requirements before implementation.
 * Following strict TDD: Red-Green-Refactor methodology.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { setupTestEnvironment, cleanupTestEnvironment } from '../utils/test-environment';
import { prismaMock } from '../__mocks__/prisma';

// Uptime Monitoring Requirements
const UPTIME_REQUIREMENTS = {
  CHECK_INTERVAL_MS: 60000, // 1 minute
  TIMEOUT_MS: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 5000, // 5 seconds
  UPTIME_TARGET_PERCENT: 99.9, // 99.9% uptime
  ALERT_THRESHOLD_FAILURES: 3, // Alert after 3 consecutive failures
  STATUS_PAGE_UPDATE_INTERVAL_MS: 30000, // 30 seconds
} as const;

// Uptime Monitoring Interfaces
interface HealthCheck {
  id: string;
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'HEAD';
  headers?: { [key: string]: string };
  body?: any;
  expectedStatus: number[];
  expectedContent?: string;
  timeout: number;
  interval: number;
  retryAttempts: number;
  retryDelay: number;
  enabled: boolean;
  tags: string[];
}

interface HealthCheckResult {
  id: string;
  checkId: string;
  timestamp: Date;
  status: 'up' | 'down' | 'degraded';
  responseTime: number;
  statusCode?: number;
  error?: string;
  metadata: {
    attempt: number;
    totalAttempts: number;
    headers?: { [key: string]: string };
    body?: string;
  };
}

interface UptimeIncident {
  id: string;
  checkId: string;
  title: string;
  description: string;
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  severity: 'minor' | 'major' | 'critical';
  startTime: Date;
  endTime?: Date;
  duration?: number;
  affectedServices: string[];
  updates: Array<{
    timestamp: Date;
    status: string;
    message: string;
    author: string;
  }>;
}

interface UptimeStats {
  checkId: string;
  uptime: number; // percentage
  downtime: number; // milliseconds
  averageResponseTime: number;
  totalChecks: number;
  successfulChecks: number;
  failedChecks: number;
  incidents: number;
  lastCheck: Date;
  status: 'up' | 'down' | 'degraded';
}

interface StatusPage {
  overall: {
    status: 'operational' | 'degraded' | 'partial_outage' | 'major_outage';
    uptime: number;
    lastUpdated: Date;
  };
  services: Array<{
    name: string;
    status: 'operational' | 'degraded' | 'outage';
    uptime: number;
    responseTime: number;
  }>;
  incidents: UptimeIncident[];
  metrics: {
    responseTime: Array<{ timestamp: Date; value: number }>;
    uptime: Array<{ timestamp: Date; value: number }>;
  };
}

// RED: This service doesn't exist yet - tests will fail
class UptimeMonitoringService {
  constructor(config: any) {}
  async initialize(): Promise<void> {
    throw new Error('Not implemented');
  }
  async addHealthCheck(check: Omit<HealthCheck, 'id'>): Promise<HealthCheck> {
    throw new Error('Not implemented');
  }
  async removeHealthCheck(id: string): Promise<void> {
    throw new Error('Not implemented');
  }
  async updateHealthCheck(id: string, updates: Partial<HealthCheck>): Promise<HealthCheck> {
    throw new Error('Not implemented');
  }
  async getHealthChecks(): Promise<HealthCheck[]> {
    throw new Error('Not implemented');
  }
  async runHealthCheck(id: string): Promise<HealthCheckResult> {
    throw new Error('Not implemented');
  }
  async getHealthCheckResults(checkId: string, timeRange?: { start: Date; end: Date }): Promise<HealthCheckResult[]> {
    throw new Error('Not implemented');
  }
  async getUptimeStats(checkId: string, timeRange: { start: Date; end: Date }): Promise<UptimeStats> {
    throw new Error('Not implemented');
  }
  async createIncident(incident: Omit<UptimeIncident, 'id'>): Promise<UptimeIncident> {
    throw new Error('Not implemented');
  }
  async updateIncident(id: string, updates: Partial<UptimeIncident>): Promise<UptimeIncident> {
    throw new Error('Not implemented');
  }
  async getIncidents(filters?: any): Promise<UptimeIncident[]> {
    throw new Error('Not implemented');
  }
  async getStatusPage(): Promise<StatusPage> {
    throw new Error('Not implemented');
  }
  async startMonitoring(): Promise<void> {
    throw new Error('Not implemented');
  }
  async stopMonitoring(): Promise<void> {
    throw new Error('Not implemented');
  }
}

describe('Uptime Monitoring System', () => {
  let uptimeService: UptimeMonitoringService;

  beforeEach(async () => {
    await setupTestEnvironment({ useMocks: true });
    
    const uptimeConfig = {
      serviceName: 'syntaxis-ai-backend',
      environment: 'test',
      defaultInterval: UPTIME_REQUIREMENTS.CHECK_INTERVAL_MS,
      defaultTimeout: UPTIME_REQUIREMENTS.TIMEOUT_MS,
      defaultRetryAttempts: UPTIME_REQUIREMENTS.RETRY_ATTEMPTS,
      alertThreshold: UPTIME_REQUIREMENTS.ALERT_THRESHOLD_FAILURES,
    };

    uptimeService = new UptimeMonitoringService(uptimeConfig);
  });

  afterEach(async () => {
    await uptimeService.stopMonitoring();
    await cleanupTestEnvironment();
  });

  describe('Uptime Service Initialization', () => {
    it('should initialize uptime monitoring service', async () => {
      // RED: This test will fail until UptimeMonitoringService is implemented
      await expect(uptimeService.initialize()).resolves.not.toThrow();
    });

    it('should validate uptime monitoring configuration', async () => {
      const invalidConfig = {
        serviceName: '', // Invalid empty service name
        defaultInterval: -1, // Invalid negative interval
        defaultTimeout: 0, // Invalid zero timeout
      };

      const invalidService = new UptimeMonitoringService(invalidConfig);
      await expect(invalidService.initialize()).rejects.toThrow('Invalid uptime monitoring configuration');
    });

    it('should start and stop monitoring', async () => {
      await uptimeService.initialize();
      
      await expect(uptimeService.startMonitoring()).resolves.not.toThrow();
      await expect(uptimeService.stopMonitoring()).resolves.not.toThrow();
    });
  });

  describe('Health Check Management', () => {
    it('should add health checks for different endpoints', async () => {
      // RED: This test will fail until health check management is implemented
      await uptimeService.initialize();

      const apiHealthCheck = await uptimeService.addHealthCheck({
        name: 'API Health Check',
        url: 'https://api.syntaxis.ai/health',
        method: 'GET',
        expectedStatus: [200],
        timeout: UPTIME_REQUIREMENTS.TIMEOUT_MS,
        interval: UPTIME_REQUIREMENTS.CHECK_INTERVAL_MS,
        retryAttempts: UPTIME_REQUIREMENTS.RETRY_ATTEMPTS,
        retryDelay: UPTIME_REQUIREMENTS.RETRY_DELAY_MS,
        enabled: true,
        tags: ['api', 'critical'],
      });

      expect(apiHealthCheck).toBeDefined();
      expect(apiHealthCheck.id).toBeDefined();
      expect(apiHealthCheck.name).toBe('API Health Check');
      expect(apiHealthCheck.url).toBe('https://api.syntaxis.ai/health');
      expect(apiHealthCheck.method).toBe('GET');
      expect(apiHealthCheck.enabled).toBe(true);

      const databaseHealthCheck = await uptimeService.addHealthCheck({
        name: 'Database Health Check',
        url: 'https://api.syntaxis.ai/health/database',
        method: 'GET',
        expectedStatus: [200],
        timeout: UPTIME_REQUIREMENTS.TIMEOUT_MS,
        interval: UPTIME_REQUIREMENTS.CHECK_INTERVAL_MS,
        retryAttempts: UPTIME_REQUIREMENTS.RETRY_ATTEMPTS,
        retryDelay: UPTIME_REQUIREMENTS.RETRY_DELAY_MS,
        enabled: true,
        tags: ['database', 'critical'],
      });

      expect(databaseHealthCheck.name).toBe('Database Health Check');
      expect(databaseHealthCheck.tags).toContain('database');
    });

    it('should update existing health checks', async () => {
      await uptimeService.initialize();

      const healthCheck = await uptimeService.addHealthCheck({
        name: 'Test Health Check',
        url: 'https://api.test.com/health',
        method: 'GET',
        expectedStatus: [200],
        timeout: 30000,
        interval: 60000,
        retryAttempts: 3,
        retryDelay: 5000,
        enabled: true,
        tags: ['test'],
      });

      const updatedCheck = await uptimeService.updateHealthCheck(healthCheck.id, {
        name: 'Updated Test Health Check',
        interval: 30000, // Changed interval
        enabled: false, // Disabled
        tags: ['test', 'updated'],
      });

      expect(updatedCheck.name).toBe('Updated Test Health Check');
      expect(updatedCheck.interval).toBe(30000);
      expect(updatedCheck.enabled).toBe(false);
      expect(updatedCheck.tags).toContain('updated');
    });

    it('should remove health checks', async () => {
      await uptimeService.initialize();

      const healthCheck = await uptimeService.addHealthCheck({
        name: 'Temporary Health Check',
        url: 'https://api.temp.com/health',
        method: 'GET',
        expectedStatus: [200],
        timeout: 30000,
        interval: 60000,
        retryAttempts: 3,
        retryDelay: 5000,
        enabled: true,
        tags: ['temporary'],
      });

      await expect(uptimeService.removeHealthCheck(healthCheck.id)).resolves.not.toThrow();

      const healthChecks = await uptimeService.getHealthChecks();
      expect(healthChecks.find(check => check.id === healthCheck.id)).toBeUndefined();
    });

    it('should list all health checks', async () => {
      await uptimeService.initialize();

      await uptimeService.addHealthCheck({
        name: 'Check 1',
        url: 'https://api1.com/health',
        method: 'GET',
        expectedStatus: [200],
        timeout: 30000,
        interval: 60000,
        retryAttempts: 3,
        retryDelay: 5000,
        enabled: true,
        tags: ['api1'],
      });

      await uptimeService.addHealthCheck({
        name: 'Check 2',
        url: 'https://api2.com/health',
        method: 'GET',
        expectedStatus: [200],
        timeout: 30000,
        interval: 60000,
        retryAttempts: 3,
        retryDelay: 5000,
        enabled: true,
        tags: ['api2'],
      });

      const healthChecks = await uptimeService.getHealthChecks();
      expect(healthChecks).toHaveLength(2);
      expect(healthChecks.map(check => check.name)).toContain('Check 1');
      expect(healthChecks.map(check => check.name)).toContain('Check 2');
    });
  });

  describe('Health Check Execution', () => {
    it('should execute health checks and return results', async () => {
      // RED: This test will fail until health check execution is implemented
      await uptimeService.initialize();

      const healthCheck = await uptimeService.addHealthCheck({
        name: 'API Health Check',
        url: 'https://httpbin.org/status/200', // Mock endpoint
        method: 'GET',
        expectedStatus: [200],
        timeout: UPTIME_REQUIREMENTS.TIMEOUT_MS,
        interval: UPTIME_REQUIREMENTS.CHECK_INTERVAL_MS,
        retryAttempts: 1,
        retryDelay: UPTIME_REQUIREMENTS.RETRY_DELAY_MS,
        enabled: true,
        tags: ['test'],
      });

      const result = await uptimeService.runHealthCheck(healthCheck.id);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.checkId).toBe(healthCheck.id);
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.status).toBe('up');
      expect(result.responseTime).toBeGreaterThan(0);
      expect(result.statusCode).toBe(200);
      expect(result.metadata.attempt).toBe(1);
      expect(result.metadata.totalAttempts).toBe(1);
    });

    it('should handle failed health checks with retries', async () => {
      await uptimeService.initialize();

      const healthCheck = await uptimeService.addHealthCheck({
        name: 'Failing Health Check',
        url: 'https://httpbin.org/status/500', // Mock failing endpoint
        method: 'GET',
        expectedStatus: [200],
        timeout: UPTIME_REQUIREMENTS.TIMEOUT_MS,
        interval: UPTIME_REQUIREMENTS.CHECK_INTERVAL_MS,
        retryAttempts: 3,
        retryDelay: 1000, // Shorter delay for testing
        enabled: true,
        tags: ['test'],
      });

      const result = await uptimeService.runHealthCheck(healthCheck.id);

      expect(result.status).toBe('down');
      expect(result.statusCode).toBe(500);
      expect(result.metadata.totalAttempts).toBe(3);
      expect(result.error).toBeDefined();
    });

    it('should handle timeout scenarios', async () => {
      await uptimeService.initialize();

      const healthCheck = await uptimeService.addHealthCheck({
        name: 'Timeout Health Check',
        url: 'https://httpbin.org/delay/10', // Mock slow endpoint
        method: 'GET',
        expectedStatus: [200],
        timeout: 2000, // 2 second timeout
        interval: UPTIME_REQUIREMENTS.CHECK_INTERVAL_MS,
        retryAttempts: 1,
        retryDelay: UPTIME_REQUIREMENTS.RETRY_DELAY_MS,
        enabled: true,
        tags: ['test'],
      });

      const result = await uptimeService.runHealthCheck(healthCheck.id);

      expect(result.status).toBe('down');
      expect(result.error).toContain('timeout');
    });

    it('should validate expected content in responses', async () => {
      await uptimeService.initialize();

      const healthCheck = await uptimeService.addHealthCheck({
        name: 'Content Validation Check',
        url: 'https://httpbin.org/json',
        method: 'GET',
        expectedStatus: [200],
        expectedContent: 'slideshow',
        timeout: UPTIME_REQUIREMENTS.TIMEOUT_MS,
        interval: UPTIME_REQUIREMENTS.CHECK_INTERVAL_MS,
        retryAttempts: 1,
        retryDelay: UPTIME_REQUIREMENTS.RETRY_DELAY_MS,
        enabled: true,
        tags: ['test'],
      });

      const result = await uptimeService.runHealthCheck(healthCheck.id);

      expect(result.status).toBe('up');
      expect(result.statusCode).toBe(200);
    });
  });

  describe('Uptime Statistics and Reporting', () => {
    it('should calculate uptime statistics for health checks', async () => {
      // RED: This test will fail until uptime statistics are implemented
      await uptimeService.initialize();

      const healthCheck = await uptimeService.addHealthCheck({
        name: 'Stats Test Check',
        url: 'https://httpbin.org/status/200',
        method: 'GET',
        expectedStatus: [200],
        timeout: UPTIME_REQUIREMENTS.TIMEOUT_MS,
        interval: UPTIME_REQUIREMENTS.CHECK_INTERVAL_MS,
        retryAttempts: 1,
        retryDelay: UPTIME_REQUIREMENTS.RETRY_DELAY_MS,
        enabled: true,
        tags: ['stats'],
      });

      // Simulate multiple check results
      for (let i = 0; i < 10; i++) {
        await uptimeService.runHealthCheck(healthCheck.id);
      }

      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const stats = await uptimeService.getUptimeStats(healthCheck.id, {
        start: oneHourAgo,
        end: now,
      });

      expect(stats).toBeDefined();
      expect(stats.checkId).toBe(healthCheck.id);
      expect(stats.uptime).toBeGreaterThan(0);
      expect(stats.totalChecks).toBe(10);
      expect(stats.successfulChecks).toBeGreaterThan(0);
      expect(stats.averageResponseTime).toBeGreaterThan(0);
      expect(stats.status).toBe('up');
      expect(stats.lastCheck).toBeInstanceOf(Date);
    });

    it('should retrieve health check results within time range', async () => {
      await uptimeService.initialize();

      const healthCheck = await uptimeService.addHealthCheck({
        name: 'Results Test Check',
        url: 'https://httpbin.org/status/200',
        method: 'GET',
        expectedStatus: [200],
        timeout: UPTIME_REQUIREMENTS.TIMEOUT_MS,
        interval: UPTIME_REQUIREMENTS.CHECK_INTERVAL_MS,
        retryAttempts: 1,
        retryDelay: UPTIME_REQUIREMENTS.RETRY_DELAY_MS,
        enabled: true,
        tags: ['results'],
      });

      // Run multiple checks
      for (let i = 0; i < 5; i++) {
        await uptimeService.runHealthCheck(healthCheck.id);
        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
      }

      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

      const results = await uptimeService.getHealthCheckResults(healthCheck.id, {
        start: oneMinuteAgo,
        end: now,
      });

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.checkId).toBe(healthCheck.id);
        expect(result.timestamp.getTime()).toBeGreaterThanOrEqual(oneMinuteAgo.getTime());
        expect(result.timestamp.getTime()).toBeLessThanOrEqual(now.getTime());
      });
    });
  });

  describe('Incident Management', () => {
    it('should create incidents for service outages', async () => {
      // RED: This test will fail until incident management is implemented
      await uptimeService.initialize();

      const incident = await uptimeService.createIncident({
        checkId: 'health-check-123',
        title: 'API Service Outage',
        description: 'The main API service is experiencing connectivity issues',
        status: 'investigating',
        severity: 'major',
        startTime: new Date(),
        affectedServices: ['api', 'authentication'],
        updates: [{
          timestamp: new Date(),
          status: 'investigating',
          message: 'We are investigating reports of API connectivity issues',
          author: 'SRE Team',
        }],
      });

      expect(incident).toBeDefined();
      expect(incident.id).toBeDefined();
      expect(incident.title).toBe('API Service Outage');
      expect(incident.status).toBe('investigating');
      expect(incident.severity).toBe('major');
      expect(incident.affectedServices).toContain('api');
      expect(incident.updates).toHaveLength(1);
    });

    it('should update incidents with status changes', async () => {
      await uptimeService.initialize();

      const incident = await uptimeService.createIncident({
        checkId: 'health-check-456',
        title: 'Database Connection Issues',
        description: 'Database connections are timing out',
        status: 'investigating',
        severity: 'critical',
        startTime: new Date(),
        affectedServices: ['database'],
        updates: [],
      });

      const updatedIncident = await uptimeService.updateIncident(incident.id, {
        status: 'identified',
        updates: [
          ...incident.updates,
          {
            timestamp: new Date(),
            status: 'identified',
            message: 'Issue identified as database server overload',
            author: 'Database Team',
          },
        ],
      });

      expect(updatedIncident.status).toBe('identified');
      expect(updatedIncident.updates).toHaveLength(1);
      expect(updatedIncident.updates[0].message).toContain('overload');
    });

    it('should resolve incidents and calculate duration', async () => {
      await uptimeService.initialize();

      const startTime = new Date();
      const incident = await uptimeService.createIncident({
        checkId: 'health-check-789',
        title: 'Service Degradation',
        description: 'Service response times are elevated',
        status: 'monitoring',
        severity: 'minor',
        startTime,
        affectedServices: ['api'],
        updates: [],
      });

      // Simulate time passing
      const endTime = new Date(startTime.getTime() + 30 * 60 * 1000); // 30 minutes later

      const resolvedIncident = await uptimeService.updateIncident(incident.id, {
        status: 'resolved',
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        updates: [
          {
            timestamp: endTime,
            status: 'resolved',
            message: 'Service performance has returned to normal',
            author: 'SRE Team',
          },
        ],
      });

      expect(resolvedIncident.status).toBe('resolved');
      expect(resolvedIncident.endTime).toEqual(endTime);
      expect(resolvedIncident.duration).toBe(30 * 60 * 1000);
    });

    it('should filter incidents by status and time range', async () => {
      await uptimeService.initialize();

      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      // Create resolved incident
      await uptimeService.createIncident({
        checkId: 'check-1',
        title: 'Resolved Issue',
        description: 'This issue was resolved',
        status: 'resolved',
        severity: 'minor',
        startTime: oneHourAgo,
        endTime: new Date(oneHourAgo.getTime() + 10 * 60 * 1000),
        affectedServices: ['api'],
        updates: [],
      });

      // Create ongoing incident
      await uptimeService.createIncident({
        checkId: 'check-2',
        title: 'Ongoing Issue',
        description: 'This issue is ongoing',
        status: 'investigating',
        severity: 'major',
        startTime: new Date(now.getTime() - 30 * 60 * 1000),
        affectedServices: ['database'],
        updates: [],
      });

      const ongoingIncidents = await uptimeService.getIncidents({
        status: 'investigating',
      });

      expect(ongoingIncidents).toHaveLength(1);
      expect(ongoingIncidents[0].title).toBe('Ongoing Issue');

      const recentIncidents = await uptimeService.getIncidents({
        timeRange: {
          start: new Date(now.getTime() - 45 * 60 * 1000),
          end: now,
        },
      });

      expect(recentIncidents).toHaveLength(1);
      expect(recentIncidents[0].title).toBe('Ongoing Issue');
    });
  });

  describe('Status Page Generation', () => {
    it('should generate comprehensive status page', async () => {
      // RED: This test will fail until status page generation is implemented
      await uptimeService.initialize();

      // Add multiple health checks
      const apiCheck = await uptimeService.addHealthCheck({
        name: 'API Service',
        url: 'https://api.example.com/health',
        method: 'GET',
        expectedStatus: [200],
        timeout: 30000,
        interval: 60000,
        retryAttempts: 3,
        retryDelay: 5000,
        enabled: true,
        tags: ['api', 'critical'],
      });

      const dbCheck = await uptimeService.addHealthCheck({
        name: 'Database Service',
        url: 'https://api.example.com/health/database',
        method: 'GET',
        expectedStatus: [200],
        timeout: 30000,
        interval: 60000,
        retryAttempts: 3,
        retryDelay: 5000,
        enabled: true,
        tags: ['database', 'critical'],
      });

      // Run health checks
      await uptimeService.runHealthCheck(apiCheck.id);
      await uptimeService.runHealthCheck(dbCheck.id);

      const statusPage = await uptimeService.getStatusPage();

      expect(statusPage).toBeDefined();
      expect(statusPage.overall).toBeDefined();
      expect(statusPage.overall.status).toBe('operational');
      expect(statusPage.overall.uptime).toBeGreaterThan(0);
      expect(statusPage.overall.lastUpdated).toBeInstanceOf(Date);

      expect(statusPage.services).toHaveLength(2);
      expect(statusPage.services.map(s => s.name)).toContain('API Service');
      expect(statusPage.services.map(s => s.name)).toContain('Database Service');

      expect(Array.isArray(statusPage.incidents)).toBe(true);
      expect(statusPage.metrics).toBeDefined();
      expect(Array.isArray(statusPage.metrics.responseTime)).toBe(true);
      expect(Array.isArray(statusPage.metrics.uptime)).toBe(true);
    });

    it('should reflect service degradation in status page', async () => {
      await uptimeService.initialize();

      const healthCheck = await uptimeService.addHealthCheck({
        name: 'Degraded Service',
        url: 'https://httpbin.org/status/500',
        method: 'GET',
        expectedStatus: [200],
        timeout: 30000,
        interval: 60000,
        retryAttempts: 1,
        retryDelay: 5000,
        enabled: true,
        tags: ['api'],
      });

      // Run failing health check
      await uptimeService.runHealthCheck(healthCheck.id);

      // Create incident
      await uptimeService.createIncident({
        checkId: healthCheck.id,
        title: 'Service Degradation',
        description: 'Service is experiencing issues',
        status: 'investigating',
        severity: 'major',
        startTime: new Date(),
        affectedServices: ['api'],
        updates: [],
      });

      const statusPage = await uptimeService.getStatusPage();

      expect(statusPage.overall.status).toBe('degraded');
      expect(statusPage.services[0].status).toBe('outage');
      expect(statusPage.incidents).toHaveLength(1);
      expect(statusPage.incidents[0].title).toBe('Service Degradation');
    });
  });

  describe('Continuous Monitoring', () => {
    it('should run continuous monitoring for enabled health checks', async () => {
      // RED: This test will fail until continuous monitoring is implemented
      await uptimeService.initialize();

      const healthCheck = await uptimeService.addHealthCheck({
        name: 'Continuous Monitor Test',
        url: 'https://httpbin.org/status/200',
        method: 'GET',
        expectedStatus: [200],
        timeout: 30000,
        interval: 1000, // 1 second for testing
        retryAttempts: 1,
        retryDelay: 1000,
        enabled: true,
        tags: ['continuous'],
      });

      await uptimeService.startMonitoring();

      // Wait for a few monitoring cycles
      await new Promise(resolve => setTimeout(resolve, 3500));

      await uptimeService.stopMonitoring();

      const results = await uptimeService.getHealthCheckResults(healthCheck.id);
      expect(results.length).toBeGreaterThan(2); // Should have run multiple times
    });

    it('should not monitor disabled health checks', async () => {
      await uptimeService.initialize();

      const disabledCheck = await uptimeService.addHealthCheck({
        name: 'Disabled Check',
        url: 'https://httpbin.org/status/200',
        method: 'GET',
        expectedStatus: [200],
        timeout: 30000,
        interval: 1000,
        retryAttempts: 1,
        retryDelay: 1000,
        enabled: false, // Disabled
        tags: ['disabled'],
      });

      await uptimeService.startMonitoring();
      await new Promise(resolve => setTimeout(resolve, 2500));
      await uptimeService.stopMonitoring();

      const results = await uptimeService.getHealthCheckResults(disabledCheck.id);
      expect(results).toHaveLength(0); // Should not have run
    });
  });
});
