/**
 * Concurrent User Handling Tests
 * 
 * TDD Phase: RED - Failing tests for concurrent user handling
 * Task: 2.4 - Concurrent User Handling
 * 
 * These tests define the expected behavior for concurrent user handling:
 * 1. Load testing and scalability validation
 * 2. Resource pooling and queue management
 * 3. Rate limiting and throttling
 * 4. Session management and user isolation
 * 5. Performance under concurrent load
 */

import { ConcurrencyService } from '../../services/concurrency.service';
import { LoadBalancerService } from '../../services/load-balancer.service';
import { RateLimiterService } from '../../services/rate-limiter.service';
import { OCRService } from '../../services/ocr.service';
import { PrismaClient } from '@prisma/client';
import { jest } from '@jest/globals';
import { setupSharpMock, cleanupSharpMock } from '../utils/sharpMockHelper';
import { setupPrismaMock } from '../utils/prismaMockHelper';

describe('Concurrent User Handling', () => {
  let concurrencyService: ConcurrencyService;
  let loadBalancerService: LoadBalancerService;
  let rateLimiterService: RateLimiterService;
  let ocrService: OCRService;
  let mockPrisma: jest.Mocked<PrismaClient>;
  let sharpMockFactory: any;

  beforeAll(() => {
    sharpMockFactory = setupSharpMock();
  });

  afterAll(() => {
    cleanupSharpMock();
  });

  beforeEach(() => {
    // Setup mocks
    const prismaMockFactory = setupPrismaMock();
    mockPrisma = prismaMockFactory.mock;
    
    sharpMockFactory.resetMocks();
    sharpMockFactory.setupSuccessfulProcessing();

    // Initialize services
    concurrencyService = new ConcurrencyService();
    loadBalancerService = new LoadBalancerService();
    rateLimiterService = new RateLimiterService();
    ocrService = new OCRService(mockPrisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Load Testing and Scalability', () => {
    it('should handle 100 concurrent OCR requests without degradation', async () => {
      // RED: This test should fail - we need concurrent request handling
      const concurrentRequests = 100;
      const testBuffer = Buffer.from('concurrent test image');
      
      const startTime = Date.now();
      const promises = [];

      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(
          concurrencyService.processWithConcurrencyControl(
            () => ocrService.processWithTesseract(testBuffer, {}),
            {
              userId: `user-${i % 10}`, // 10 different users
              priority: i % 3, // 3 priority levels
              timeout: 30000
            }
          )
        );
      }

      const results = await Promise.allSettled(promises);
      const totalTime = Date.now() - startTime;
      
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      expect(successful).toBeGreaterThan(95); // 95% success rate
      expect(failed).toBeLessThan(5);
      expect(totalTime).toBeLessThan(60000); // Complete within 1 minute
      
      // Check performance metrics
      const metrics = await concurrencyService.getConcurrencyMetrics();
      expect(metrics.peakConcurrency).toBeLessThanOrEqual(concurrentRequests);
      expect(metrics.averageResponseTime).toBeLessThan(1000); // 1 second average
      expect(metrics.queueWaitTime).toBeLessThan(5000); // 5 second max queue wait
    });

    it('should implement intelligent load balancing across worker pools', async () => {
      // RED: This test should fail - we need load balancing implementation
      const loadBalancerConfig = {
        maxWorkersPerPool: 5,
        poolCount: 3,
        balancingStrategy: 'least_connections',
        healthCheckInterval: 5000
      };

      await loadBalancerService.initialize(loadBalancerConfig);

      const testRequests = Array.from({ length: 50 }, (_, i) => ({
        id: `request-${i}`,
        buffer: Buffer.from(`test image ${i}`),
        userId: `user-${i % 10}`
      }));

      const results = await loadBalancerService.distributeRequests(testRequests);

      expect(results).toEqual({
        totalRequests: 50,
        distributedRequests: 50,
        poolDistribution: expect.any(Object),
        averagePoolLoad: expect.any(Number),
        balancingEfficiency: expect.any(Number),
        failedDistributions: 0
      });

      expect(results.balancingEfficiency).toBeGreaterThan(0.8); // 80% efficiency
      expect(results.averagePoolLoad).toBeLessThan(0.9); // 90% max load
    });

    it('should scale worker pools dynamically based on load', async () => {
      // RED: This test should fail - we need dynamic scaling
      const scalingConfig = {
        minWorkers: 2,
        maxWorkers: 10,
        scaleUpThreshold: 0.8, // 80% utilization
        scaleDownThreshold: 0.3, // 30% utilization
        scaleUpCooldown: 30000, // 30 seconds
        scaleDownCooldown: 60000 // 1 minute
      };

      await concurrencyService.enableAutoScaling(scalingConfig);

      // Simulate high load
      const highLoadPromises = Array.from({ length: 20 }, () =>
        concurrencyService.processWithConcurrencyControl(
          () => new Promise(resolve => setTimeout(() => resolve('result'), 2000)),
          { userId: 'load-test-user', priority: 1 }
        )
      );

      // Wait for scaling to trigger
      await new Promise(resolve => setTimeout(resolve, 5000));

      const scalingMetrics = await concurrencyService.getScalingMetrics();

      expect(scalingMetrics).toEqual({
        currentWorkers: expect.any(Number),
        targetWorkers: expect.any(Number),
        utilizationRate: expect.any(Number),
        scalingEvents: expect.any(Array),
        lastScalingAction: expect.any(String),
        scalingEfficiency: expect.any(Number)
      });

      expect(scalingMetrics.currentWorkers).toBeGreaterThan(scalingConfig.minWorkers);
      expect(scalingMetrics.utilizationRate).toBeLessThan(1.0);

      // Wait for requests to complete
      await Promise.allSettled(highLoadPromises);
    });
  });

  describe('Resource Pooling and Queue Management', () => {
    it('should implement priority-based request queuing', async () => {
      // RED: This test should fail - we need priority queue implementation
      const requests = [
        { id: 'low-1', priority: 0, userId: 'user1' },
        { id: 'high-1', priority: 2, userId: 'user2' },
        { id: 'medium-1', priority: 1, userId: 'user3' },
        { id: 'high-2', priority: 2, userId: 'user4' },
        { id: 'low-2', priority: 0, userId: 'user5' }
      ];

      const processedOrder: string[] = [];
      const promises = requests.map(req =>
        concurrencyService.processWithPriority(
          async () => {
            processedOrder.push(req.id);
            await new Promise(resolve => setTimeout(resolve, 100));
            return `processed-${req.id}`;
          },
          {
            priority: req.priority,
            userId: req.userId,
            maxConcurrency: 2 // Force queuing
          }
        )
      );

      await Promise.all(promises);

      // High priority requests should be processed first
      const highPriorityIndices = processedOrder
        .map((id, index) => id.includes('high') ? index : -1)
        .filter(index => index !== -1);

      const lowPriorityIndices = processedOrder
        .map((id, index) => id.includes('low') ? index : -1)
        .filter(index => index !== -1);

      expect(Math.max(...highPriorityIndices)).toBeLessThan(Math.min(...lowPriorityIndices));
    });

    it('should implement fair resource allocation per user', async () => {
      // RED: This test should fail - we need fair allocation
      const users = ['user1', 'user2', 'user3'];
      const requestsPerUser = 10;
      
      const allPromises = users.flatMap(userId =>
        Array.from({ length: requestsPerUser }, (_, i) =>
          concurrencyService.processWithFairAllocation(
            async () => {
              await new Promise(resolve => setTimeout(resolve, 100));
              return `${userId}-request-${i}`;
            },
            {
              userId,
              fairnessPolicy: 'round_robin',
              maxConcurrencyPerUser: 3
            }
          )
        )
      );

      const results = await Promise.allSettled(allPromises);
      const successful = results.filter(r => r.status === 'fulfilled').length;

      expect(successful).toBe(users.length * requestsPerUser);

      const allocationMetrics = await concurrencyService.getAllocationMetrics();
      
      expect(allocationMetrics).toEqual({
        userAllocations: expect.any(Object),
        fairnessScore: expect.any(Number),
        resourceUtilization: expect.any(Number),
        allocationEfficiency: expect.any(Number)
      });

      expect(allocationMetrics.fairnessScore).toBeGreaterThan(0.8); // 80% fairness
      
      // Check that each user got roughly equal allocation
      users.forEach(userId => {
        expect(allocationMetrics.userAllocations[userId]).toBeDefined();
        expect(allocationMetrics.userAllocations[userId].requestsProcessed).toBe(requestsPerUser);
      });
    });

    it('should implement intelligent queue management with overflow handling', async () => {
      // RED: This test should fail - we need queue management
      const queueConfig = {
        maxQueueSize: 50,
        overflowStrategy: 'reject_oldest',
        queueTimeoutMs: 30000,
        priorityLevels: 3
      };

      await concurrencyService.configureQueue(queueConfig);

      // Fill queue beyond capacity
      const promises = Array.from({ length: 60 }, (_, i) =>
        concurrencyService.enqueueRequest(
          async () => {
            await new Promise(resolve => setTimeout(resolve, 1000));
            return `request-${i}`;
          },
          {
            priority: i % 3,
            userId: `user-${i % 5}`,
            timeout: 30000
          }
        )
      );

      const results = await Promise.allSettled(promises);
      const queueMetrics = await concurrencyService.getQueueMetrics();

      expect(queueMetrics).toEqual({
        currentQueueSize: expect.any(Number),
        maxQueueSize: 50,
        overflowCount: expect.any(Number),
        averageWaitTime: expect.any(Number),
        timeoutCount: expect.any(Number),
        throughput: expect.any(Number)
      });

      expect(queueMetrics.currentQueueSize).toBeLessThanOrEqual(50);
      expect(queueMetrics.overflowCount).toBeGreaterThan(0);
    });
  });

  describe('Rate Limiting and Throttling', () => {
    it('should implement per-user rate limiting', async () => {
      // RED: This test should fail - we need rate limiting
      const rateLimitConfig = {
        requestsPerMinute: 10,
        burstLimit: 15,
        windowSizeMs: 60000
      };

      await rateLimiterService.setUserRateLimit('test-user', rateLimitConfig);

      // Send requests rapidly
      const promises = Array.from({ length: 20 }, (_, i) =>
        rateLimiterService.checkRateLimit('test-user', {
          endpoint: '/api/ocr/process',
          method: 'POST'
        })
      );

      const results = await Promise.allSettled(promises);
      const allowed = results.filter(r => 
        r.status === 'fulfilled' && (r.value as any).allowed
      ).length;
      const rateLimited = results.filter(r => 
        r.status === 'fulfilled' && !(r.value as any).allowed
      ).length;

      expect(allowed).toBeLessThanOrEqual(rateLimitConfig.burstLimit);
      expect(rateLimited).toBeGreaterThan(0);

      const rateLimitStatus = await rateLimiterService.getRateLimitStatus('test-user');
      expect(rateLimitStatus).toEqual({
        userId: 'test-user',
        requestsRemaining: expect.any(Number),
        resetTime: expect.any(Number),
        rateLimited: expect.any(Boolean),
        retryAfter: expect.any(Number)
      });
    });

    it('should implement adaptive throttling based on system load', async () => {
      // RED: This test should fail - we need adaptive throttling
      const throttlingConfig = {
        cpuThreshold: 80,
        memoryThreshold: 85,
        responseTimeThreshold: 2000,
        adaptiveEnabled: true
      };

      await rateLimiterService.enableAdaptiveThrottling(throttlingConfig);

      // Simulate high system load
      await rateLimiterService.simulateSystemLoad({
        cpuUsage: 85,
        memoryUsage: 90,
        averageResponseTime: 2500
      });

      const throttlingStatus = await rateLimiterService.getThrottlingStatus();

      expect(throttlingStatus).toEqual({
        throttlingActive: true,
        throttlingLevel: expect.any(Number),
        systemMetrics: {
          cpuUsage: 85,
          memoryUsage: 90,
          averageResponseTime: 2500
        },
        adaptiveRules: expect.any(Array),
        affectedEndpoints: expect.any(Array)
      });

      expect(throttlingStatus.throttlingLevel).toBeGreaterThan(0);
      expect(throttlingStatus.affectedEndpoints.length).toBeGreaterThan(0);
    });

    it('should implement circuit breaker pattern for service protection', async () => {
      // RED: This test should fail - we need circuit breaker
      const circuitBreakerConfig = {
        failureThreshold: 5,
        timeoutMs: 1000,
        resetTimeoutMs: 30000,
        monitoringPeriodMs: 60000
      };

      await rateLimiterService.configureCircuitBreaker('ocr-service', circuitBreakerConfig);

      // Simulate service failures
      const failingService = async () => {
        throw new Error('Service unavailable');
      };

      // Trigger circuit breaker
      const promises = Array.from({ length: 10 }, () =>
        rateLimiterService.executeWithCircuitBreaker('ocr-service', failingService)
      );

      const results = await Promise.allSettled(promises);
      const circuitBreakerStatus = await rateLimiterService.getCircuitBreakerStatus('ocr-service');

      expect(circuitBreakerStatus).toEqual({
        serviceName: 'ocr-service',
        state: expect.stringMatching(/^(closed|open|half-open)$/),
        failureCount: expect.any(Number),
        lastFailureTime: expect.any(Number),
        nextAttemptTime: expect.any(Number),
        successRate: expect.any(Number)
      });

      expect(circuitBreakerStatus.state).toBe('open');
      expect(circuitBreakerStatus.failureCount).toBeGreaterThanOrEqual(circuitBreakerConfig.failureThreshold);
    });
  });

  describe('Session Management and User Isolation', () => {
    it('should maintain user session isolation during concurrent processing', async () => {
      // RED: This test should fail - we need session isolation
      const users = ['user1', 'user2', 'user3'];
      const sessionsPerUser = 3;

      const allSessions = users.flatMap(userId =>
        Array.from({ length: sessionsPerUser }, (_, i) => ({
          userId,
          sessionId: `${userId}-session-${i}`,
          data: { preference: `pref-${userId}-${i}` }
        }))
      );

      // Process requests concurrently with session context
      const promises = allSessions.map(session =>
        concurrencyService.processWithSessionContext(
          async () => {
            // Simulate processing that uses session data
            await new Promise(resolve => setTimeout(resolve, 100));
            return {
              result: 'processed',
              sessionData: session.data,
              userId: session.userId
            };
          },
          session
        )
      );

      const results = await Promise.all(promises);

      // Verify session isolation
      results.forEach((result, index) => {
        const expectedSession = allSessions[index];
        expect(result.userId).toBe(expectedSession.userId);
        expect(result.sessionData).toEqual(expectedSession.data);
      });

      const isolationMetrics = await concurrencyService.getSessionIsolationMetrics();
      expect(isolationMetrics).toEqual({
        activeSessions: expect.any(Number),
        sessionCrossTalk: 0, // No cross-talk between sessions
        isolationViolations: 0,
        sessionEfficiency: expect.any(Number)
      });
    });

    it('should implement user-specific resource quotas', async () => {
      // RED: This test should fail - we need resource quotas
      const userQuotas = {
        'premium-user': { maxConcurrentRequests: 10, maxMemoryMB: 500 },
        'standard-user': { maxConcurrentRequests: 5, maxMemoryMB: 200 },
        'basic-user': { maxConcurrentRequests: 2, maxMemoryMB: 100 }
      };

      await concurrencyService.setUserQuotas(userQuotas);

      // Test quota enforcement
      const quotaTests = Object.entries(userQuotas).map(async ([userId, quota]) => {
        const promises = Array.from({ length: quota.maxConcurrentRequests + 2 }, () =>
          concurrencyService.processWithQuotaEnforcement(
            async () => {
              await new Promise(resolve => setTimeout(resolve, 1000));
              return 'processed';
            },
            { userId }
          )
        );

        const results = await Promise.allSettled(promises);
        const successful = results.filter(r => r.status === 'fulfilled').length;
        const quotaExceeded = results.filter(r => 
          r.status === 'rejected' && 
          (r.reason as Error).message.includes('quota')
        ).length;

        return {
          userId,
          successful,
          quotaExceeded,
          expectedMax: quota.maxConcurrentRequests
        };
      });

      const quotaResults = await Promise.all(quotaTests);

      quotaResults.forEach(result => {
        expect(result.successful).toBeLessThanOrEqual(result.expectedMax);
        expect(result.quotaExceeded).toBeGreaterThan(0);
      });
    });
  });

  describe('Performance Under Concurrent Load', () => {
    it('should maintain response time SLA under concurrent load', async () => {
      // RED: This test should fail - we need SLA maintenance
      const slaConfig = {
        maxResponseTimeMs: 2000,
        successRateThreshold: 95,
        concurrentUsers: 50
      };

      const loadTestResults = await concurrencyService.runLoadTest({
        concurrentUsers: slaConfig.concurrentUsers,
        requestsPerUser: 10,
        rampUpTimeMs: 5000,
        testDurationMs: 30000,
        slaRequirements: slaConfig
      });

      expect(loadTestResults).toEqual({
        totalRequests: expect.any(Number),
        successfulRequests: expect.any(Number),
        failedRequests: expect.any(Number),
        averageResponseTime: expect.any(Number),
        p95ResponseTime: expect.any(Number),
        p99ResponseTime: expect.any(Number),
        successRate: expect.any(Number),
        slaCompliance: {
          responseTimeMet: expect.any(Boolean),
          successRateMet: expect.any(Boolean),
          overallCompliance: expect.any(Boolean)
        },
        performanceMetrics: expect.any(Object)
      });

      expect(loadTestResults.averageResponseTime).toBeLessThan(slaConfig.maxResponseTimeMs);
      expect(loadTestResults.successRate).toBeGreaterThan(slaConfig.successRateThreshold);
      expect(loadTestResults.slaCompliance.overallCompliance).toBe(true);
    });

    it('should provide detailed performance analytics for concurrent operations', async () => {
      // RED: This test should fail - we need performance analytics
      const analytics = await concurrencyService.getPerformanceAnalytics({
        timeRange: '1h',
        includeUserBreakdown: true,
        includeResourceMetrics: true
      });

      expect(analytics).toEqual({
        timeRange: '1h',
        overallMetrics: {
          totalRequests: expect.any(Number),
          averageResponseTime: expect.any(Number),
          throughput: expect.any(Number),
          errorRate: expect.any(Number),
          concurrencyLevel: expect.any(Number)
        },
        userBreakdown: expect.any(Object),
        resourceMetrics: {
          cpuUtilization: expect.any(Number),
          memoryUtilization: expect.any(Number),
          networkUtilization: expect.any(Number),
          diskUtilization: expect.any(Number)
        },
        bottlenecks: expect.any(Array),
        recommendations: expect.any(Array)
      });

      expect(analytics.overallMetrics.throughput).toBeGreaterThan(0);
      expect(analytics.bottlenecks).toBeInstanceOf(Array);
      expect(analytics.recommendations).toBeInstanceOf(Array);
    });
  });
});
