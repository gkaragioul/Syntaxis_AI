/**
 * Performance Optimization Tests
 * 
 * TDD Phase: RED - Failing tests for performance requirements
 * Task: 2.2 - Performance Optimization
 * 
 * These tests define the expected performance behavior:
 * 1. API response time <200ms requirement
 * 2. Processing time <30s requirement
 * 3. Concurrent user handling
 * 4. Memory usage optimization
 * 5. Caching and optimization strategies
 */

import { OCRService } from '../../services/ocr.service';
import { PrismaClient } from '@prisma/client';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { jest } from '@jest/globals';
import { setupSharpMock, cleanupSharpMock } from '../utils/sharpMockHelper';
import { setupPrismaMock } from '../utils/prismaMockHelper';

// Mock dependencies
jest.mock('@google-cloud/vision');
jest.mock('../../utils/OCRWorkerPool');

describe('Performance Optimization', () => {
  let ocrService: OCRService;
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockVisionClient: jest.Mocked<ImageAnnotatorClient>;
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

    // Setup Google Vision client mock
    mockVisionClient = {
      textDetection: jest.fn(),
      close: jest.fn(),
    } as any;

    (ImageAnnotatorClient as jest.MockedClass<typeof ImageAnnotatorClient>).mockImplementation(() => mockVisionClient);

    process.env.GOOGLE_APPLICATION_CREDENTIALS = '/path/to/credentials.json';
    ocrService = new OCRService(mockPrisma);
    (ocrService as any).visionClient = mockVisionClient;
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  });

  describe('API Response Time Requirements', () => {
    it('should complete Google Vision API calls within 200ms', async () => {
      // RED: This test should fail - we need performance optimization
      mockVisionClient.textDetection.mockImplementation(() => 
        new Promise(resolve => {
          setTimeout(() => resolve([{
            textAnnotations: [{ description: 'Fast result', boundingPoly: { vertices: [] } }]
          }]), 50); // Simulate fast API response
        })
      );

      const testBuffer = Buffer.from('performance test image');
      const startTime = Date.now();
      
      await ocrService.processWithGoogleVision(testBuffer);
      
      const processingTime = Date.now() - startTime;
      expect(processingTime).toBeLessThan(200);
    });

    it('should complete Tesseract processing within 200ms for simple images', async () => {
      // RED: This test should fail - we need Tesseract optimization
      const simpleImageBuffer = Buffer.from('simple text image');
      const startTime = Date.now();
      
      const result = await ocrService.processWithOptimizedTesseract(simpleImageBuffer);
      
      const processingTime = Date.now() - startTime;
      expect(processingTime).toBeLessThan(200);
      expect(result.metadata.processingTime).toBeLessThan(200);
    });

    it('should implement response time monitoring and alerting', async () => {
      // RED: This test should fail - we need monitoring implementation
      const testBuffer = Buffer.from('monitoring test image');
      
      const performanceMetrics = await ocrService.processWithPerformanceMonitoring(testBuffer);
      
      expect(performanceMetrics).toEqual({
        responseTime: expect.any(Number),
        engineUsed: expect.stringMatching(/^(tesseract|google-vision)$/),
        optimizationsApplied: expect.any(Array),
        performanceGrade: expect.stringMatching(/^(A|B|C|D|F)$/),
        recommendations: expect.any(Array),
        thresholdsMet: {
          responseTime: expect.any(Boolean),
          memoryUsage: expect.any(Boolean),
          cpuUsage: expect.any(Boolean)
        }
      });
    });

    it('should automatically switch to faster engine when response time exceeds threshold', async () => {
      // RED: This test should fail - we need automatic engine switching
      mockVisionClient.textDetection.mockImplementation(() => 
        new Promise(resolve => {
          setTimeout(() => resolve([{
            textAnnotations: [{ description: 'Slow result', boundingPoly: { vertices: [] } }]
          }]), 300); // Slower than 200ms threshold
        })
      );

      const testBuffer = Buffer.from('auto-switch test image');
      const config = {
        maxResponseTime: 200,
        autoSwitchEnabled: true,
        preferredEngine: 'google-vision' as const,
        fallbackEngine: 'tesseract' as const
      };

      const result = await ocrService.processWithAutoEngineSwitch(testBuffer, config);

      expect(result.engineSwitched).toBe(true);
      expect(result.finalEngine).toBe('tesseract');
      expect(result.finalResponseTime).toBeLessThan(200);
      expect(result.switchReason).toBe('response_time_exceeded');
    });
  });

  describe('Processing Time Requirements', () => {
    it('should complete full document processing within 30 seconds', async () => {
      // RED: This test should fail - we need processing optimization
      const largeDocumentBuffer = Buffer.from('large document with multiple pages');
      const startTime = Date.now();
      
      const result = await ocrService.processLargeDocument(largeDocumentBuffer, {
        maxPages: 10,
        parallelProcessing: true,
        optimizationLevel: 'high'
      });
      
      const processingTime = Date.now() - startTime;
      expect(processingTime).toBeLessThan(30000); // 30 seconds
      expect(result.totalProcessingTime).toBeLessThan(30000);
      expect(result.pagesProcessed).toBeGreaterThan(0);
    });

    it('should implement parallel processing for multi-page documents', async () => {
      // RED: This test should fail - we need parallel processing
      const multiPageBuffer = Buffer.from('multi-page document');
      
      const result = await ocrService.processWithParallelProcessing(multiPageBuffer, {
        maxConcurrency: 4,
        chunkSize: 2,
        loadBalancing: true
      });

      expect(result.parallelProcessingUsed).toBe(true);
      expect(result.concurrentTasks).toBeLessThanOrEqual(4);
      expect(result.processingChunks).toBeGreaterThan(1);
      expect(result.loadBalancingApplied).toBe(true);
      expect(result.speedupFactor).toBeGreaterThan(1.5); // At least 50% faster
    });

    it('should implement progressive processing with early results', async () => {
      // RED: This test should fail - we need progressive processing
      const testBuffer = Buffer.from('progressive processing test');
      const progressUpdates: any[] = [];

      const progressCallback = (update: any) => {
        progressUpdates.push(update);
      };

      const result = await ocrService.processWithProgressiveResults(testBuffer, {
        progressCallback,
        earlyResultsEnabled: true,
        confidenceThreshold: 0.7
      });

      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[0]).toEqual({
        stage: expect.stringMatching(/^(preprocessing|text_detection|confidence_analysis|finalization)$/),
        progress: expect.any(Number),
        partialResults: expect.any(Object),
        estimatedTimeRemaining: expect.any(Number)
      });

      expect(result.progressiveResultsProvided).toBe(true);
      expect(result.earlyResultsCount).toBeGreaterThan(0);
    });

    it('should implement intelligent preprocessing optimization', async () => {
      // RED: This test should fail - we need preprocessing optimization
      const testBuffer = Buffer.from('preprocessing optimization test');
      
      const result = await ocrService.processWithIntelligentPreprocessing(testBuffer);

      expect(result.preprocessingOptimizations).toEqual({
        applied: expect.any(Array),
        skipped: expect.any(Array),
        timeSaved: expect.any(Number),
        qualityImprovement: expect.any(Number),
        adaptiveSettings: expect.any(Object)
      });

      expect(result.preprocessingOptimizations.applied.length).toBeGreaterThan(0);
      expect(result.preprocessingOptimizations.timeSaved).toBeGreaterThan(0);
    });
  });

  describe('Memory Usage Optimization', () => {
    it('should maintain memory usage below 512MB during processing', async () => {
      // RED: This test should fail - we need memory optimization
      const largeImageBuffer = Buffer.alloc(10 * 1024 * 1024); // 10MB image
      
      const memoryBefore = process.memoryUsage();
      const result = await ocrService.processWithMemoryOptimization(largeImageBuffer);
      const memoryAfter = process.memoryUsage();

      const memoryIncrease = memoryAfter.heapUsed - memoryBefore.heapUsed;
      expect(memoryIncrease).toBeLessThan(512 * 1024 * 1024); // 512MB

      expect(result.memoryMetrics).toEqual({
        peakMemoryUsage: expect.any(Number),
        memoryOptimizationsApplied: expect.any(Array),
        garbageCollectionTriggered: expect.any(Boolean),
        memoryLeaksDetected: expect.any(Boolean)
      });
    });

    it('should implement streaming processing for large files', async () => {
      // RED: This test should fail - we need streaming implementation
      const largeFileBuffer = Buffer.alloc(50 * 1024 * 1024); // 50MB file
      
      const result = await ocrService.processWithStreaming(largeFileBuffer, {
        chunkSize: 5 * 1024 * 1024, // 5MB chunks
        streamingEnabled: true,
        memoryLimit: 100 * 1024 * 1024 // 100MB limit
      });

      expect(result.streamingUsed).toBe(true);
      expect(result.chunksProcessed).toBeGreaterThan(1);
      expect(result.maxMemoryUsage).toBeLessThan(100 * 1024 * 1024);
      expect(result.streamingEfficiency).toBeGreaterThan(0.8); // 80% efficiency
    });
  });

  describe('Caching and Optimization Strategies', () => {
    it('should implement intelligent result caching', async () => {
      // RED: This test should fail - we need caching implementation
      const testBuffer = Buffer.from('caching test image');
      
      // First call - should process and cache
      const result1 = await ocrService.processWithIntelligentCaching(testBuffer);
      
      // Second call - should use cache
      const result2 = await ocrService.processWithIntelligentCaching(testBuffer);

      expect(result1.cacheHit).toBe(false);
      expect(result1.cached).toBe(true);
      expect(result2.cacheHit).toBe(true);
      expect(result2.responseTime).toBeLessThan(result1.responseTime);

      expect(result2.cacheMetrics).toEqual({
        cacheKey: expect.any(String),
        cacheAge: expect.any(Number),
        cacheEfficiency: expect.any(Number),
        spaceSaved: expect.any(Number)
      });
    });

    it('should implement adaptive optimization based on usage patterns', async () => {
      // RED: This test should fail - we need adaptive optimization
      const testBuffers = [
        Buffer.from('pattern test 1'),
        Buffer.from('pattern test 2'),
        Buffer.from('pattern test 3')
      ];

      // Process multiple requests to establish patterns
      for (const buffer of testBuffers) {
        await ocrService.processWithAdaptiveOptimization(buffer);
      }

      const optimizationReport = await ocrService.getAdaptiveOptimizationReport();

      expect(optimizationReport).toEqual({
        patternsDetected: expect.any(Array),
        optimizationsApplied: expect.any(Array),
        performanceImprovement: expect.any(Number),
        adaptationConfidence: expect.any(Number),
        recommendations: expect.any(Array)
      });

      expect(optimizationReport.patternsDetected.length).toBeGreaterThan(0);
      expect(optimizationReport.performanceImprovement).toBeGreaterThan(0);
    });

    it('should implement predictive preprocessing based on image analysis', async () => {
      // RED: This test should fail - we need predictive preprocessing
      const testBuffer = Buffer.from('predictive preprocessing test');
      
      const result = await ocrService.processWithPredictivePreprocessing(testBuffer);

      expect(result.predictiveAnalysis).toEqual({
        imageComplexity: expect.any(Number),
        predictedOptimalEngine: expect.stringMatching(/^(tesseract|google-vision)$/),
        recommendedPreprocessing: expect.any(Array),
        confidencePrediction: expect.any(Number),
        processingTimePrediction: expect.any(Number)
      });

      expect(result.preprocessingOptimized).toBe(true);
      expect(result.predictionAccuracy).toBeGreaterThan(0.7); // 70% accuracy
    });
  });

  describe('Performance Monitoring and Alerting', () => {
    it('should provide real-time performance metrics', async () => {
      // RED: This test should fail - we need real-time monitoring
      const testBuffer = Buffer.from('monitoring test');
      
      const metricsStream = ocrService.getPerformanceMetricsStream();
      const metrics: any[] = [];

      metricsStream.on('data', (metric: any) => {
        metrics.push(metric);
      });

      await ocrService.processWithRealTimeMonitoring(testBuffer);

      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics[0]).toEqual({
        timestamp: expect.any(Number),
        responseTime: expect.any(Number),
        memoryUsage: expect.any(Number),
        cpuUsage: expect.any(Number),
        engineUsed: expect.any(String),
        optimizationsActive: expect.any(Array)
      });
    });

    it('should trigger alerts when performance thresholds are exceeded', async () => {
      // RED: This test should fail - we need alerting system
      const slowBuffer = Buffer.from('slow processing test');
      const alerts: any[] = [];

      const alertHandler = (alert: any) => {
        alerts.push(alert);
      };

      ocrService.setPerformanceAlertHandler(alertHandler);

      // Simulate slow processing
      mockVisionClient.textDetection.mockImplementation(() => 
        new Promise(resolve => {
          setTimeout(() => resolve([{
            textAnnotations: [{ description: 'Slow result', boundingPoly: { vertices: [] } }]
          }]), 500); // Exceeds 200ms threshold
        })
      );

      await ocrService.processWithGoogleVision(slowBuffer);

      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0]).toEqual({
        type: 'performance_threshold_exceeded',
        metric: 'response_time',
        value: expect.any(Number),
        threshold: 200,
        severity: expect.stringMatching(/^(low|medium|high|critical)$/),
        timestamp: expect.any(Number),
        recommendations: expect.any(Array)
      });
    });
  });
});
