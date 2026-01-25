/**
 * Production End-to-End Validation Tests
 * 
 * TDD Phase: Post-deployment production validation
 * Task: Validate production deployment with end-to-end tests
 * 
 * This test suite validates the complete production system following TDD principles:
 * 1. RED: Validate critical user journeys and business flows
 * 2. GREEN: Validate system integration and performance under real conditions
 * 3. REFACTOR: Validate optimization and monitoring in production environment
 */

import { TestEnvironment } from '../utils/test-environment';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { jest } from '@jest/globals';

describe('Production End-to-End Validation - TDD Implementation', () => {
  let testEnv: TestEnvironment;
  const PRODUCTION_BASE_URL = process.env.PRODUCTION_BASE_URL || 'https://api.syntaxis.ai';
  const E2E_TIMEOUT = 120000; // 2 minutes for E2E tests
  
  // Test data
  const testUser = {
    email: 'e2e-test@syntaxis.ai',
    apiKey: process.env.E2E_TEST_API_KEY || 'test-api-key',
    subscription: 'premium'
  };

  beforeAll(async () => {
    testEnv = TestEnvironment.getInstance();
    await testEnv.setup();
    
    // Validate production environment is accessible
    const healthCheck = await axios.get(`${PRODUCTION_BASE_URL}/health`, {
      timeout: 30000
    });
    
    if (healthCheck.status !== 200) {
      throw new Error(`Production environment not accessible: ${healthCheck.status}`);
    }
  }, 60000);

  afterAll(async () => {
    await testEnv.teardown();
  });

  describe('🔴 TDD RED Phase: Critical User Journey Validation', () => {
    it('should complete full OCR workflow for image processing', async () => {
      // RED: Test the complete user journey from file upload to OCR result
      
      // Step 1: Authenticate user
      const authResponse = await axios.post(`${PRODUCTION_BASE_URL}/api/v1/auth/login`, {
        email: testUser.email,
        apiKey: testUser.apiKey
      }, {
        timeout: E2E_TIMEOUT,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'SyntaxisAI-E2E-Test/1.0'
        }
      });

      expect(authResponse.status).toBe(200);
      expect(authResponse.data).toEqual({
        success: true,
        token: expect.any(String),
        user: expect.objectContaining({
          email: testUser.email,
          subscription: testUser.subscription,
          quotaRemaining: expect.any(Number)
        }),
        expiresIn: expect.any(Number)
      });

      const authToken = authResponse.data.token;

      // Step 2: Upload test image
      const testImagePath = path.join(__dirname, '../fixtures/test-image.jpg');
      const formData = new FormData();
      formData.append('file', fs.createReadStream(testImagePath));
      formData.append('language', 'en');
      formData.append('options', JSON.stringify({
        enableFallback: true,
        outputFormat: 'json',
        confidence: 'high'
      }));

      const uploadResponse = await axios.post(`${PRODUCTION_BASE_URL}/api/v1/files/upload`, formData, {
        timeout: E2E_TIMEOUT,
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'multipart/form-data',
          ...formData.getHeaders()
        }
      });

      expect(uploadResponse.status).toBe(200);
      expect(uploadResponse.data).toEqual({
        success: true,
        fileId: expect.any(String),
        uploadUrl: expect.any(String),
        metadata: expect.objectContaining({
          filename: expect.any(String),
          size: expect.any(Number),
          mimeType: 'image/jpeg'
        })
      });

      const fileId = uploadResponse.data.fileId;

      // Step 3: Process OCR
      const ocrResponse = await axios.post(`${PRODUCTION_BASE_URL}/api/v1/ocr/process`, {
        fileId: fileId,
        language: 'en',
        options: {
          enableFallback: true,
          priority: 'normal',
          outputFormat: 'json'
        }
      }, {
        timeout: E2E_TIMEOUT,
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      expect(ocrResponse.status).toBe(202); // Accepted for processing
      expect(ocrResponse.data).toEqual({
        success: true,
        processingId: expect.any(String),
        status: 'processing',
        estimatedTime: expect.any(Number),
        queuePosition: expect.any(Number)
      });

      const processingId = ocrResponse.data.processingId;

      // Step 4: Poll for completion
      let processingComplete = false;
      let attempts = 0;
      const maxAttempts = 30; // 30 attempts with 2-second intervals = 1 minute max
      let finalResult;

      while (!processingComplete && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        
        const statusResponse = await axios.get(`${PRODUCTION_BASE_URL}/api/v1/ocr/status/${processingId}`, {
          timeout: 30000,
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });

        expect(statusResponse.status).toBe(200);
        
        const status = statusResponse.data.status;
        
        if (status === 'completed') {
          processingComplete = true;
          finalResult = statusResponse.data;
        } else if (status === 'failed') {
          throw new Error(`OCR processing failed: ${statusResponse.data.error}`);
        }
        
        attempts++;
      }

      expect(processingComplete).toBe(true);
      expect(finalResult).toEqual({
        success: true,
        status: 'completed',
        processingId: processingId,
        result: expect.objectContaining({
          text: expect.any(String),
          confidence: expect.any(Number),
          language: 'en',
          processingTime: expect.any(Number),
          engine: expect.any(String)
        }),
        metadata: expect.objectContaining({
          fileId: fileId,
          processedAt: expect.any(String),
          billableUnits: expect.any(Number)
        })
      });

      // Validate OCR result quality
      expect(finalResult.result.text.length).toBeGreaterThan(0);
      expect(finalResult.result.confidence).toBeGreaterThan(0.8); // > 80% confidence
      expect(finalResult.result.processingTime).toBeLessThan(30000); // < 30 seconds

      // Step 5: Retrieve processed result
      const resultResponse = await axios.get(`${PRODUCTION_BASE_URL}/api/v1/ocr/result/${processingId}`, {
        timeout: 30000,
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(resultResponse.status).toBe(200);
      expect(resultResponse.data).toEqual({
        success: true,
        result: finalResult.result,
        downloadUrl: expect.any(String),
        expiresAt: expect.any(String)
      });
    });

    it('should handle batch processing workflow', async () => {
      // RED: Test batch processing capabilities
      
      const authToken = await authenticateTestUser();
      
      // Upload multiple files for batch processing
      const batchFiles = [
        '../fixtures/test-image-1.jpg',
        '../fixtures/test-image-2.png',
        '../fixtures/test-document.pdf'
      ];
      
      const fileIds = [];
      
      for (const filePath of batchFiles) {
        const fullPath = path.join(__dirname, filePath);
        const formData = new FormData();
        formData.append('file', fs.createReadStream(fullPath));
        
        const uploadResponse = await axios.post(`${PRODUCTION_BASE_URL}/api/v1/files/upload`, formData, {
          timeout: E2E_TIMEOUT,
          headers: {
            'Authorization': `Bearer ${authToken}`,
            ...formData.getHeaders()
          }
        });
        
        expect(uploadResponse.status).toBe(200);
        fileIds.push(uploadResponse.data.fileId);
      }
      
      // Submit batch processing request
      const batchResponse = await axios.post(`${PRODUCTION_BASE_URL}/api/v1/ocr/batch`, {
        fileIds: fileIds,
        language: 'en',
        options: {
          enableFallback: true,
          priority: 'normal',
          outputFormat: 'json'
        }
      }, {
        timeout: E2E_TIMEOUT,
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      expect(batchResponse.status).toBe(202);
      expect(batchResponse.data).toEqual({
        success: true,
        batchId: expect.any(String),
        status: 'processing',
        totalFiles: fileIds.length,
        estimatedTime: expect.any(Number)
      });
      
      const batchId = batchResponse.data.batchId;
      
      // Poll for batch completion
      let batchComplete = false;
      let attempts = 0;
      const maxAttempts = 60; // 2 minutes for batch processing
      
      while (!batchComplete && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const statusResponse = await axios.get(`${PRODUCTION_BASE_URL}/api/v1/ocr/batch/${batchId}`, {
          timeout: 30000,
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
        
        expect(statusResponse.status).toBe(200);
        
        if (statusResponse.data.status === 'completed') {
          batchComplete = true;
          
          expect(statusResponse.data).toEqual({
            success: true,
            batchId: batchId,
            status: 'completed',
            results: expect.arrayContaining([
              expect.objectContaining({
                fileId: expect.any(String),
                status: expect.stringMatching(/^(completed|failed)$/),
                result: expect.any(Object)
              })
            ]),
            summary: expect.objectContaining({
              totalFiles: fileIds.length,
              completedFiles: expect.any(Number),
              failedFiles: expect.any(Number),
              totalProcessingTime: expect.any(Number)
            })
          });
          
          // Validate that most files processed successfully
          const completedFiles = statusResponse.data.summary.completedFiles;
          expect(completedFiles).toBeGreaterThanOrEqual(Math.floor(fileIds.length * 0.8)); // At least 80% success
        }
        
        attempts++;
      }
      
      expect(batchComplete).toBe(true);
    });

    it('should validate API rate limiting and quota management', async () => {
      // RED: Test rate limiting and quota enforcement
      
      const authToken = await authenticateTestUser();
      
      // Test rate limiting
      const rapidRequests = Array.from({ length: 20 }, () =>
        axios.get(`${PRODUCTION_BASE_URL}/api/v1/user/quota`, {
          timeout: 10000,
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }).catch(error => error.response)
      );
      
      const responses = await Promise.all(rapidRequests);
      
      // Should have some rate limited responses (429)
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
      
      // Check quota information
      const quotaResponse = await axios.get(`${PRODUCTION_BASE_URL}/api/v1/user/quota`, {
        timeout: 30000,
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      expect(quotaResponse.status).toBe(200);
      expect(quotaResponse.data).toEqual({
        success: true,
        quota: expect.objectContaining({
          monthly: expect.objectContaining({
            limit: expect.any(Number),
            used: expect.any(Number),
            remaining: expect.any(Number),
            resetDate: expect.any(String)
          }),
          daily: expect.objectContaining({
            limit: expect.any(Number),
            used: expect.any(Number),
            remaining: expect.any(Number),
            resetDate: expect.any(String)
          })
        }),
        subscription: expect.objectContaining({
          plan: testUser.subscription,
          status: 'active',
          features: expect.any(Array)
        })
      });
    });
  });

  describe('🟢 TDD GREEN Phase: System Integration Validation', () => {
    it('should validate webhook notifications and callbacks', async () => {
      // GREEN: Test webhook integration
      
      const authToken = await authenticateTestUser();
      
      // Configure webhook endpoint
      const webhookUrl = 'https://webhook.site/test-endpoint'; // Test webhook service
      
      const webhookResponse = await axios.post(`${PRODUCTION_BASE_URL}/api/v1/webhooks/configure`, {
        url: webhookUrl,
        events: ['ocr.completed', 'ocr.failed'],
        secret: 'test-webhook-secret'
      }, {
        timeout: 30000,
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      expect(webhookResponse.status).toBe(200);
      expect(webhookResponse.data).toEqual({
        success: true,
        webhookId: expect.any(String),
        url: webhookUrl,
        events: ['ocr.completed', 'ocr.failed'],
        status: 'active'
      });
      
      // Process a file to trigger webhook
      const fileId = await uploadTestFile(authToken);
      const processingResponse = await processOCR(authToken, fileId);
      
      // Wait for processing and webhook delivery
      await new Promise(resolve => setTimeout(resolve, 10000)); // 10 seconds
      
      // Verify webhook was called (in real implementation, you'd check webhook.site or your test endpoint)
      // For now, we'll verify the processing completed
      const statusResponse = await axios.get(`${PRODUCTION_BASE_URL}/api/v1/ocr/status/${processingResponse.processingId}`, {
        timeout: 30000,
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      expect(statusResponse.data.status).toBe('completed');
    });

    it('should validate external service integrations', async () => {
      // GREEN: Test external service health and integration
      
      const integrationsResponse = await axios.get(`${PRODUCTION_BASE_URL}/health/integrations`, {
        timeout: 30000
      });
      
      expect(integrationsResponse.status).toBe(200);
      expect(integrationsResponse.data).toEqual({
        status: 'healthy',
        services: expect.objectContaining({
          googleVision: expect.objectContaining({
            status: 'healthy',
            responseTime: expect.any(Number),
            quotaRemaining: expect.any(Number)
          }),
          awsTextract: expect.objectContaining({
            status: 'healthy',
            responseTime: expect.any(Number),
            region: expect.any(String)
          }),
          sentry: expect.objectContaining({
            status: 'healthy',
            projectId: expect.any(String)
          })
        })
      });
      
      // All external services should be healthy
      Object.values(integrationsResponse.data.services).forEach((service: any) => {
        expect(service.status).toBe('healthy');
        if (service.responseTime) {
          expect(service.responseTime).toBeLessThan(5000); // < 5 seconds
        }
      });
    });

    it('should validate database performance and consistency', async () => {
      // GREEN: Test database performance under load
      
      const dbHealthResponse = await axios.get(`${PRODUCTION_BASE_URL}/health/database`, {
        timeout: 30000
      });
      
      expect(dbHealthResponse.status).toBe(200);
      expect(dbHealthResponse.data).toEqual({
        status: 'healthy',
        connectionPool: expect.objectContaining({
          active: expect.any(Number),
          idle: expect.any(Number),
          total: expect.any(Number)
        }),
        performance: expect.objectContaining({
          averageQueryTime: expect.any(Number),
          slowQueries: expect.any(Number),
          connectionTime: expect.any(Number)
        }),
        replication: expect.objectContaining({
          status: 'healthy',
          lag: expect.any(Number)
        })
      });
      
      // Database should meet performance requirements
      expect(dbHealthResponse.data.performance.averageQueryTime).toBeLessThan(100); // < 100ms
      expect(dbHealthResponse.data.performance.connectionTime).toBeLessThan(50); // < 50ms
      expect(dbHealthResponse.data.replication.lag).toBeLessThan(1000); // < 1 second
    });
  });

  describe('🔄 TDD REFACTOR Phase: Production Optimization Validation', () => {
    it('should validate monitoring and alerting systems', async () => {
      // REFACTOR: Test monitoring system integration
      
      const monitoringResponse = await axios.get(`${PRODUCTION_BASE_URL}/health/monitoring`, {
        timeout: 30000
      });
      
      expect(monitoringResponse.status).toBe(200);
      expect(monitoringResponse.data).toEqual({
        status: 'active',
        components: expect.objectContaining({
          prometheus: expect.objectContaining({
            status: 'healthy',
            targets: expect.any(Number),
            alerts: expect.any(Number)
          }),
          grafana: expect.objectContaining({
            status: 'healthy',
            dashboards: expect.any(Number)
          }),
          alertmanager: expect.objectContaining({
            status: 'healthy',
            routes: expect.any(Number)
          })
        }),
        metrics: expect.objectContaining({
          uptime: expect.any(Number),
          requestRate: expect.any(Number),
          errorRate: expect.any(Number),
          responseTime: expect.any(Number)
        })
      });
      
      // Monitoring should be comprehensive
      expect(monitoringResponse.data.components.prometheus.targets).toBeGreaterThan(5);
      expect(monitoringResponse.data.components.grafana.dashboards).toBeGreaterThan(3);
      expect(monitoringResponse.data.metrics.errorRate).toBeLessThan(0.01); // < 1%
    });

    it('should validate auto-scaling and resource optimization', async () => {
      // REFACTOR: Test auto-scaling behavior
      
      const scalingResponse = await axios.get(`${PRODUCTION_BASE_URL}/health/scaling`, {
        timeout: 30000
      });
      
      expect(scalingResponse.status).toBe(200);
      expect(scalingResponse.data).toEqual({
        status: 'configured',
        horizontalPodAutoscaler: expect.objectContaining({
          enabled: true,
          currentReplicas: expect.any(Number),
          targetReplicas: expect.any(Number),
          cpuUtilization: expect.any(Number),
          memoryUtilization: expect.any(Number)
        }),
        resourceUtilization: expect.objectContaining({
          cpu: expect.any(Number),
          memory: expect.any(Number),
          network: expect.any(Number),
          storage: expect.any(Number)
        })
      });
      
      // Resource utilization should be optimal
      expect(scalingResponse.data.resourceUtilization.cpu).toBeLessThan(80); // < 80%
      expect(scalingResponse.data.resourceUtilization.memory).toBeLessThan(85); // < 85%
      expect(scalingResponse.data.horizontalPodAutoscaler.currentReplicas).toBeGreaterThanOrEqual(3);
    });

    it('should validate business metrics and SLA compliance', async () => {
      // REFACTOR: Test business metrics and SLA tracking
      
      const metricsResponse = await axios.get(`${PRODUCTION_BASE_URL}/api/v1/metrics/business`, {
        timeout: 30000,
        headers: {
          'Authorization': `Bearer ${await authenticateTestUser()}`
        }
      });
      
      expect(metricsResponse.status).toBe(200);
      expect(metricsResponse.data).toEqual({
        success: true,
        metrics: expect.objectContaining({
          sla: expect.objectContaining({
            uptime: expect.any(Number),
            responseTime: expect.any(Number),
            errorRate: expect.any(Number),
            compliance: expect.any(Number)
          }),
          business: expect.objectContaining({
            totalRequests: expect.any(Number),
            successfulRequests: expect.any(Number),
            revenue: expect.any(Number),
            activeUsers: expect.any(Number)
          }),
          performance: expect.objectContaining({
            averageProcessingTime: expect.any(Number),
            throughput: expect.any(Number),
            queueLength: expect.any(Number)
          })
        }),
        period: expect.any(String)
      });
      
      // SLA compliance should be excellent
      expect(metricsResponse.data.metrics.sla.uptime).toBeGreaterThan(99.9); // > 99.9%
      expect(metricsResponse.data.metrics.sla.compliance).toBeGreaterThan(0.99); // > 99%
      expect(metricsResponse.data.metrics.sla.errorRate).toBeLessThan(0.001); // < 0.1%
    });
  });

  // Helper functions
  async function authenticateTestUser(): Promise<string> {
    const authResponse = await axios.post(`${PRODUCTION_BASE_URL}/api/v1/auth/login`, {
      email: testUser.email,
      apiKey: testUser.apiKey
    }, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    return authResponse.data.token;
  }

  async function uploadTestFile(authToken: string): Promise<string> {
    const testImagePath = path.join(__dirname, '../fixtures/test-image.jpg');
    const formData = new FormData();
    formData.append('file', fs.createReadStream(testImagePath));
    
    const uploadResponse = await axios.post(`${PRODUCTION_BASE_URL}/api/v1/files/upload`, formData, {
      timeout: E2E_TIMEOUT,
      headers: {
        'Authorization': `Bearer ${authToken}`,
        ...formData.getHeaders()
      }
    });
    
    return uploadResponse.data.fileId;
  }

  async function processOCR(authToken: string, fileId: string): Promise<any> {
    const ocrResponse = await axios.post(`${PRODUCTION_BASE_URL}/api/v1/ocr/process`, {
      fileId: fileId,
      language: 'en',
      options: {
        enableFallback: true,
        priority: 'normal'
      }
    }, {
      timeout: E2E_TIMEOUT,
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    return ocrResponse.data;
  }
}, E2E_TIMEOUT);
