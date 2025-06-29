import { PerformanceMonitorService } from '../../services/performance-monitor.service';
import { PrismaClient } from '@prisma/client';
import { jest } from '@jest/globals';

const TEST_TIMEOUT = 30000;

describe('Performance Monitoring System', () => {
  let performanceMonitor: PerformanceMonitorService;
  let prisma: PrismaClient;
  let testUserId: string;
  let testFileId: string;

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_TEST_URL || process.env.DATABASE_URL,
        },
      },
    });

    performanceMonitor = new PerformanceMonitorService(prisma);

    // Create test user
    testUserId = 'test-user-perf-' + Date.now();
    await prisma.user.create({
      data: {
        id: testUserId,
        email: `test-perf-${Date.now()}@example.com`,
        passwordHash: 'test-password-hash',
      },
    });

    // Create test file
    testFileId = 'test-file-perf-' + Date.now();
    await prisma.file.create({
      data: {
        id: testFileId,
        userId: testUserId,
        filename: 'test-performance.txt',
        originalFilename: 'test-performance.txt',
        filePath: '/tmp/test-performance.txt',
        fileSize: BigInt(1024),
        mimeType: 'text/plain',
        fileHash: `hash-${testFileId}`,
        status: 'uploaded',
      },
    });
  }, TEST_TIMEOUT);

  afterAll(async () => {
    // Cleanup test data
    await cleanupTestData();
    await prisma.$disconnect();
  });

  async function cleanupTestData() {
    try {
      await prisma.performanceMetric.deleteMany({ where: { userId: testUserId } });
      await prisma.file.deleteMany({ where: { userId: testUserId } });
      await prisma.user.delete({ where: { id: testUserId } });
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
  }

  describe('Performance Tracking', () => {
    it('should start and finish tracking successfully', async () => {
      const sessionId = 'test-session-' + Date.now();

      // Start tracking
      performanceMonitor.startTracking(sessionId, {
        fileId: testFileId,
        userId: testUserId,
        fileSize: 1024,
        mimeType: 'text/plain',
        engine: 'tesseract',
      });

      // Update metrics
      performanceMonitor.updateProcessingMetrics(sessionId, {
        processingTime: 2500,
        confidence: 0.92,
        textLength: 150,
        pageCount: 1,
        confidenceMetrics: {
          overall: 0.92,
          textQuality: 0.9,
          structuralIntegrity: 0.85,
          fieldAccuracy: 0.95,
          processingReliability: 0.88,
        },
      });

      // Finish tracking
      await performanceMonitor.finishTracking(sessionId, true);

      // Verify metrics were persisted
      const metrics = await prisma.performanceMetric.findFirst({
        where: { fileId: testFileId },
        orderBy: { createdAt: 'desc' },
      });

      expect(metrics).toBeDefined();
      expect(metrics?.engine).toBe('tesseract');
      expect(metrics?.processingTime).toBe(2500);
      expect(metrics?.confidence).toBe(0.92);
      expect(metrics?.textLength).toBe(150);
      expect(metrics?.success).toBe(true);
      expect(metrics?.confidenceMetrics).toBeDefined();
    }, TEST_TIMEOUT);

    it('should record errors and retries', async () => {
      const sessionId = 'test-session-error-' + Date.now();

      performanceMonitor.startTracking(sessionId, {
        fileId: testFileId,
        userId: testUserId,
        fileSize: 1024,
        mimeType: 'text/plain',
        engine: 'tesseract',
      });

      // Record errors
      performanceMonitor.recordError(sessionId, 'OCREngineError', false);
      performanceMonitor.recordError(sessionId, 'OCREngineError', true);
      performanceMonitor.recordError(sessionId, 'OCREngineError', true);

      await performanceMonitor.finishTracking(sessionId, false);

      const metrics = await prisma.performanceMetric.findFirst({
        where: { fileId: testFileId },
        orderBy: { createdAt: 'desc' },
      });

      expect(metrics?.errorCount).toBe(3);
      expect(metrics?.retryCount).toBe(2);
      expect(metrics?.success).toBe(false);
    }, TEST_TIMEOUT);

    it('should record fallback usage', async () => {
      const sessionId = 'test-session-fallback-' + Date.now();

      performanceMonitor.startTracking(sessionId, {
        fileId: testFileId,
        userId: testUserId,
        fileSize: 1024,
        mimeType: 'text/plain',
        engine: 'tesseract',
      });

      // Record fallback
      performanceMonitor.recordFallback(sessionId, 'google-vision');

      await performanceMonitor.finishTracking(sessionId, true);

      const metrics = await prisma.performanceMetric.findFirst({
        where: { fileId: testFileId },
        orderBy: { createdAt: 'desc' },
      });

      expect(metrics?.fallbackUsed).toBe(true);
      expect(metrics?.enginesUsed).toContain('tesseract');
      expect(metrics?.enginesUsed).toContain('google-vision');
    }, TEST_TIMEOUT);

    it('should record resource usage', async () => {
      const sessionId = 'test-session-resources-' + Date.now();

      performanceMonitor.startTracking(sessionId, {
        fileId: testFileId,
        userId: testUserId,
        fileSize: 1024,
        mimeType: 'text/plain',
        engine: 'tesseract',
      });

      // Record resource usage
      performanceMonitor.recordResourceUsage(sessionId, 256 * 1024 * 1024, 45.5); // 256MB, 45.5% CPU

      await performanceMonitor.finishTracking(sessionId, true);

      const metrics = await prisma.performanceMetric.findFirst({
        where: { fileId: testFileId },
        orderBy: { createdAt: 'desc' },
      });

      expect(metrics?.resourceUsage).toBeDefined();
      const resourceUsage = metrics?.resourceUsage as any;
      expect(resourceUsage.memory).toBe(256 * 1024 * 1024);
      expect(resourceUsage.cpu).toBe(45.5);
    }, TEST_TIMEOUT);
  });

  describe('Performance Reporting', () => {
    beforeAll(async () => {
      // Create sample metrics for reporting
      const sampleMetrics = [
        {
          fileId: testFileId,
          userId: testUserId,
          engine: 'tesseract',
          processingTime: 2000,
          queueWaitTime: 500,
          totalTime: 2500,
          confidence: 0.9,
          textLength: 100,
          pageCount: 1,
          errorCount: 0,
          retryCount: 0,
          fallbackUsed: false,
          enginesUsed: ['tesseract'],
          fileSize: BigInt(1024),
          mimeType: 'text/plain',
          success: true,
          timestamp: new Date(),
        },
        {
          fileId: testFileId,
          userId: testUserId,
          engine: 'google-vision',
          processingTime: 1500,
          queueWaitTime: 300,
          totalTime: 1800,
          confidence: 0.95,
          textLength: 120,
          pageCount: 1,
          errorCount: 1,
          retryCount: 1,
          fallbackUsed: true,
          enginesUsed: ['tesseract', 'google-vision'],
          fileSize: BigInt(2048),
          mimeType: 'application/pdf',
          success: true,
          timestamp: new Date(),
        },
      ];

      for (const metric of sampleMetrics) {
        await prisma.performanceMetric.create({ data: metric });
      }
    });

    it('should generate performance report', async () => {
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      const endDate = new Date();

      const report = await performanceMonitor.generateReport(startDate, endDate);

      expect(report).toBeDefined();
      expect(report.period.start).toEqual(startDate);
      expect(report.period.end).toEqual(endDate);
      
      expect(report.summary.totalProcessed).toBeGreaterThan(0);
      expect(report.summary.averageProcessingTime).toBeGreaterThan(0);
      expect(report.summary.averageConfidence).toBeGreaterThan(0);
      expect(report.summary.successRate).toBeGreaterThanOrEqual(0);
      expect(report.summary.fallbackRate).toBeGreaterThanOrEqual(0);

      expect(report.engineComparison).toBeDefined();
      expect(report.trends).toBeDefined();
      expect(report.trends.processingTimeByHour).toHaveLength(24);
      expect(report.trends.confidenceByFileType).toBeDefined();
      expect(report.trends.errorsByType).toBeDefined();
    }, TEST_TIMEOUT);

    it('should get real-time statistics', async () => {
      const stats = await performanceMonitor.getRealTimeStats();

      expect(stats).toBeDefined();
      expect(stats.activeProcessing).toBeGreaterThanOrEqual(0);
      expect(stats.averageProcessingTime).toBeGreaterThanOrEqual(0);
      expect(stats.currentSuccessRate).toBeGreaterThanOrEqual(0);
      expect(stats.currentSuccessRate).toBeLessThanOrEqual(1);
      expect(stats.recentErrors).toBeGreaterThanOrEqual(0);
    }, TEST_TIMEOUT);

    it('should handle empty report periods', async () => {
      const futureStart = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const futureEnd = new Date(Date.now() + 48 * 60 * 60 * 1000);

      const report = await performanceMonitor.generateReport(futureStart, futureEnd);

      expect(report.summary.totalProcessed).toBe(0);
      expect(report.summary.averageProcessingTime).toBe(0);
      expect(report.summary.averageConfidence).toBe(0);
      expect(report.summary.successRate).toBe(0);
      expect(report.summary.fallbackRate).toBe(0);
    }, TEST_TIMEOUT);
  });

  describe('Performance Alerts', () => {
    it('should handle tracking without session', () => {
      const nonExistentSession = 'non-existent-session';

      // These should not throw errors
      expect(() => {
        performanceMonitor.updateProcessingMetrics(nonExistentSession, {
          processingTime: 1000,
        });
      }).not.toThrow();

      expect(() => {
        performanceMonitor.recordError(nonExistentSession, 'TestError');
      }).not.toThrow();

      expect(() => {
        performanceMonitor.recordFallback(nonExistentSession, 'google-vision');
      }).not.toThrow();
    });

    it('should handle finish tracking without session gracefully', async () => {
      const nonExistentSession = 'non-existent-session-finish';

      await expect(
        performanceMonitor.finishTracking(nonExistentSession, true)
      ).resolves.not.toThrow();
    });
  });

  describe('Engine Comparison', () => {
    it('should compare engine performance correctly', async () => {
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const report = await performanceMonitor.generateReport(startDate, endDate);

      expect(report.engineComparison).toBeDefined();
      
      // Should have data for both engines
      if (report.engineComparison['tesseract']) {
        expect(report.engineComparison['tesseract'].count).toBeGreaterThan(0);
        expect(report.engineComparison['tesseract'].averageProcessingTime).toBeGreaterThan(0);
        expect(report.engineComparison['tesseract'].averageConfidence).toBeGreaterThan(0);
        expect(report.engineComparison['tesseract'].successRate).toBeGreaterThanOrEqual(0);
      }

      if (report.engineComparison['google-vision']) {
        expect(report.engineComparison['google-vision'].count).toBeGreaterThan(0);
        expect(report.engineComparison['google-vision'].averageProcessingTime).toBeGreaterThan(0);
        expect(report.engineComparison['google-vision'].averageConfidence).toBeGreaterThan(0);
        expect(report.engineComparison['google-vision'].successRate).toBeGreaterThanOrEqual(0);
      }
    }, TEST_TIMEOUT);
  });
});
