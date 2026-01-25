/**
 * API Response Time Performance Tests
 * 
 * Task 2.2.1: API Response Time Tests (<200ms) - TDD RED Phase
 * 
 * These tests define the <200ms API response requirement before implementation.
 * Following strict TDD: Red-Green-Refactor methodology.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import { app } from '../../app';
import { setupTestEnvironment, cleanupTestEnvironment } from '../utils/test-environment';
import { prismaMock } from '../__mocks__/prisma';

// Performance requirements
const PERFORMANCE_REQUIREMENTS = {
  API_RESPONSE_TIME_MS: 200,
  CONCURRENT_USERS: 10,
  LOAD_TEST_DURATION_MS: 30000,
  SUCCESS_RATE_THRESHOLD: 0.95,
} as const;

// Performance measurement utilities
interface PerformanceMeasurement {
  endpoint: string;
  method: string;
  responseTime: number;
  statusCode: number;
  timestamp: Date;
  success: boolean;
}

interface LoadTestResult {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  successRate: number;
  measurements: PerformanceMeasurement[];
}

describe('API Response Time Performance (<200ms)', () => {
  beforeEach(async () => {
    await setupTestEnvironment({ useMocks: true });
    
    // Setup mock data for consistent performance testing
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'test-user-id',
      email: 'test@example.com',
      subscriptionStatus: 'free',
    } as any);

    prismaMock.invoice.findMany.mockResolvedValue([]);
    prismaMock.invoice.findUnique.mockResolvedValue({
      id: 'test-invoice-id',
      userId: 'test-user-id',
      fileName: 'test.pdf',
      status: 'processed',
    } as any);
  });

  afterEach(async () => {
    await cleanupTestEnvironment();
  });

  describe('Authentication Endpoints Performance', () => {
    it('should respond to POST /api/auth/login within 200ms', async () => {
      // RED: This test will initially fail until performance optimizations are implemented
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
        });

      const responseTime = Date.now() - startTime;

      expect(response.status).toBeLessThan(500);
      expect(responseTime).toBeLessThan(PERFORMANCE_REQUIREMENTS.API_RESPONSE_TIME_MS);
    });

    it('should respond to POST /api/auth/register within 200ms', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'newuser@example.com',
          password: 'password123',
          confirmPassword: 'password123',
        });

      const responseTime = Date.now() - startTime;

      expect(response.status).toBeLessThan(500);
      expect(responseTime).toBeLessThan(PERFORMANCE_REQUIREMENTS.API_RESPONSE_TIME_MS);
    });

    it('should respond to GET /api/auth/profile within 200ms', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer mock-jwt-token');

      const responseTime = Date.now() - startTime;

      expect(response.status).toBeLessThan(500);
      expect(responseTime).toBeLessThan(PERFORMANCE_REQUIREMENTS.API_RESPONSE_TIME_MS);
    });

    it('should handle authentication failures within 200ms', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'invalid@example.com',
          password: 'wrongpassword',
        });

      const responseTime = Date.now() - startTime;

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(responseTime).toBeLessThan(PERFORMANCE_REQUIREMENTS.API_RESPONSE_TIME_MS);
    });
  });

  describe('Invoice Management Endpoints Performance', () => {
    it('should respond to GET /api/invoices within 200ms', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/invoices')
        .set('Authorization', 'Bearer mock-jwt-token');

      const responseTime = Date.now() - startTime;

      expect(response.status).toBeLessThan(500);
      expect(responseTime).toBeLessThan(PERFORMANCE_REQUIREMENTS.API_RESPONSE_TIME_MS);
    });

    it('should respond to GET /api/invoices/:id within 200ms', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/invoices/test-invoice-id')
        .set('Authorization', 'Bearer mock-jwt-token');

      const responseTime = Date.now() - startTime;

      expect(response.status).toBeLessThan(500);
      expect(responseTime).toBeLessThan(PERFORMANCE_REQUIREMENTS.API_RESPONSE_TIME_MS);
    });

    it('should respond to POST /api/invoices within 200ms', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/invoices')
        .set('Authorization', 'Bearer mock-jwt-token')
        .send({
          fileName: 'new-invoice.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
        });

      const responseTime = Date.now() - startTime;

      expect(response.status).toBeLessThan(500);
      expect(responseTime).toBeLessThan(PERFORMANCE_REQUIREMENTS.API_RESPONSE_TIME_MS);
    });

    it('should respond to PUT /api/invoices/:id within 200ms', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .put('/api/invoices/test-invoice-id')
        .set('Authorization', 'Bearer mock-jwt-token')
        .send({
          status: 'processed',
          extractionConfidence: 0.95,
        });

      const responseTime = Date.now() - startTime;

      expect(response.status).toBeLessThan(500);
      expect(responseTime).toBeLessThan(PERFORMANCE_REQUIREMENTS.API_RESPONSE_TIME_MS);
    });

    it('should respond to DELETE /api/invoices/:id within 200ms', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .delete('/api/invoices/test-invoice-id')
        .set('Authorization', 'Bearer mock-jwt-token');

      const responseTime = Date.now() - startTime;

      expect(response.status).toBeLessThan(500);
      expect(responseTime).toBeLessThan(PERFORMANCE_REQUIREMENTS.API_RESPONSE_TIME_MS);
    });
  });

  describe('OCR Processing Endpoints Performance', () => {
    it('should respond to POST /api/ocr/process within 200ms (async initiation)', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/ocr/process')
        .set('Authorization', 'Bearer mock-jwt-token')
        .send({
          invoiceId: 'test-invoice-id',
          enginePreference: 'google-vision',
        });

      const responseTime = Date.now() - startTime;

      expect(response.status).toBeLessThan(500);
      expect(responseTime).toBeLessThan(PERFORMANCE_REQUIREMENTS.API_RESPONSE_TIME_MS);
      
      // Should return job ID for async processing
      if (response.status === 200) {
        expect(response.body).toHaveProperty('jobId');
        expect(response.body).toHaveProperty('status', 'processing');
      }
    });

    it('should respond to GET /api/ocr/results/:id within 200ms', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/ocr/results/test-result-id')
        .set('Authorization', 'Bearer mock-jwt-token');

      const responseTime = Date.now() - startTime;

      expect(response.status).toBeLessThan(500);
      expect(responseTime).toBeLessThan(PERFORMANCE_REQUIREMENTS.API_RESPONSE_TIME_MS);
    });

    it('should respond to GET /api/ocr/status/:jobId within 200ms', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/ocr/status/test-job-id')
        .set('Authorization', 'Bearer mock-jwt-token');

      const responseTime = Date.now() - startTime;

      expect(response.status).toBeLessThan(500);
      expect(responseTime).toBeLessThan(PERFORMANCE_REQUIREMENTS.API_RESPONSE_TIME_MS);
    });
  });

  describe('Dashboard and Analytics Performance', () => {
    it('should respond to GET /api/dashboard/stats within 200ms', async () => {
      prismaMock.invoice.count.mockResolvedValue(10);
      prismaMock.invoice.aggregate.mockResolvedValue({
        _avg: { extractionConfidence: 0.95 },
        _sum: { fileSize: 1024000 },
      } as any);

      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/dashboard/stats')
        .set('Authorization', 'Bearer mock-jwt-token');

      const responseTime = Date.now() - startTime;

      expect(response.status).toBeLessThan(500);
      expect(responseTime).toBeLessThan(PERFORMANCE_REQUIREMENTS.API_RESPONSE_TIME_MS);
    });

    it('should respond to GET /api/dashboard/recent-activity within 200ms', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/dashboard/recent-activity')
        .set('Authorization', 'Bearer mock-jwt-token')
        .query({ limit: 10 });

      const responseTime = Date.now() - startTime;

      expect(response.status).toBeLessThan(500);
      expect(responseTime).toBeLessThan(PERFORMANCE_REQUIREMENTS.API_RESPONSE_TIME_MS);
    });

    it('should respond to GET /api/dashboard/analytics within 200ms', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/dashboard/analytics')
        .set('Authorization', 'Bearer mock-jwt-token')
        .query({ period: '7d' });

      const responseTime = Date.now() - startTime;

      expect(response.status).toBeLessThan(500);
      expect(responseTime).toBeLessThan(PERFORMANCE_REQUIREMENTS.API_RESPONSE_TIME_MS);
    });
  });

  describe('Load Testing and Concurrent Performance', () => {
    it('should handle concurrent requests within performance limits', async () => {
      const concurrentRequests = 5;
      const requests = Array.from({ length: concurrentRequests }, () => {
        const startTime = Date.now();
        return request(app)
          .get('/api/invoices')
          .set('Authorization', 'Bearer mock-jwt-token')
          .then(response => ({
            responseTime: Date.now() - startTime,
            statusCode: response.status,
            success: response.status < 500,
          }));
      });

      const results = await Promise.all(requests);

      // All requests should complete within performance limits
      results.forEach(result => {
        expect(result.responseTime).toBeLessThan(PERFORMANCE_REQUIREMENTS.API_RESPONSE_TIME_MS);
        expect(result.success).toBe(true);
      });

      // Average response time should be well within limits
      const averageTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
      expect(averageTime).toBeLessThan(PERFORMANCE_REQUIREMENTS.API_RESPONSE_TIME_MS * 0.8);
    });

    it('should maintain performance under sustained load', async () => {
      const loadTestDuration = 5000; // 5 seconds for testing
      const requestInterval = 100; // Request every 100ms
      const measurements: PerformanceMeasurement[] = [];

      const startTime = Date.now();
      
      while (Date.now() - startTime < loadTestDuration) {
        const requestStart = Date.now();
        
        try {
          const response = await request(app)
            .get('/api/health')
            .timeout(PERFORMANCE_REQUIREMENTS.API_RESPONSE_TIME_MS);

          const responseTime = Date.now() - requestStart;
          
          measurements.push({
            endpoint: '/api/health',
            method: 'GET',
            responseTime,
            statusCode: response.status,
            timestamp: new Date(),
            success: response.status === 200,
          });

          expect(responseTime).toBeLessThan(PERFORMANCE_REQUIREMENTS.API_RESPONSE_TIME_MS);
          
        } catch (error) {
          measurements.push({
            endpoint: '/api/health',
            method: 'GET',
            responseTime: PERFORMANCE_REQUIREMENTS.API_RESPONSE_TIME_MS,
            statusCode: 500,
            timestamp: new Date(),
            success: false,
          });
        }

        // Wait before next request
        await new Promise(resolve => setTimeout(resolve, requestInterval));
      }

      // Analyze load test results
      const successfulRequests = measurements.filter(m => m.success).length;
      const successRate = successfulRequests / measurements.length;
      const averageResponseTime = measurements
        .filter(m => m.success)
        .reduce((sum, m) => sum + m.responseTime, 0) / successfulRequests;

      expect(successRate).toBeGreaterThan(PERFORMANCE_REQUIREMENTS.SUCCESS_RATE_THRESHOLD);
      expect(averageResponseTime).toBeLessThan(PERFORMANCE_REQUIREMENTS.API_RESPONSE_TIME_MS);
    });

    it('should handle error scenarios within performance limits', async () => {
      const errorScenarios = [
        { endpoint: '/api/invoices/non-existent-id', expectedStatus: 404 },
        { endpoint: '/api/auth/profile', headers: {}, expectedStatus: 401 },
        { endpoint: '/api/invoices', method: 'POST', body: {}, expectedStatus: 400 },
      ];

      for (const scenario of errorScenarios) {
        const startTime = Date.now();
        
        let response;
        if (scenario.method === 'POST') {
          response = await request(app)
            .post(scenario.endpoint)
            .send(scenario.body || {});
        } else {
          response = await request(app)
            .get(scenario.endpoint)
            .set(scenario.headers || { 'Authorization': 'Bearer invalid-token' });
        }

        const responseTime = Date.now() - startTime;

        expect(response.status).toBe(scenario.expectedStatus);
        expect(responseTime).toBeLessThan(PERFORMANCE_REQUIREMENTS.API_RESPONSE_TIME_MS);
      }
    });
  });

  describe('Performance Regression Prevention', () => {
    it('should maintain consistent performance across different data sizes', async () => {
      const dataSizes = [1, 10, 50, 100]; // Different numbers of invoices
      
      for (const size of dataSizes) {
        // Mock different data sizes
        const mockInvoices = Array.from({ length: size }, (_, i) => ({
          id: `invoice-${i}`,
          fileName: `invoice-${i}.pdf`,
          status: 'processed',
        }));
        
        prismaMock.invoice.findMany.mockResolvedValueOnce(mockInvoices as any);

        const startTime = Date.now();
        
        const response = await request(app)
          .get('/api/invoices')
          .set('Authorization', 'Bearer mock-jwt-token');

        const responseTime = Date.now() - startTime;

        expect(response.status).toBe(200);
        expect(responseTime).toBeLessThan(PERFORMANCE_REQUIREMENTS.API_RESPONSE_TIME_MS);
      }
    });

    it('should handle database query optimization requirements', async () => {
      // Test complex queries that might be slow
      prismaMock.invoice.findMany.mockImplementation(async (args) => {
        // Simulate database query time
        await new Promise(resolve => setTimeout(resolve, 50));
        return [];
      });

      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/invoices')
        .set('Authorization', 'Bearer mock-jwt-token')
        .query({
          page: 1,
          limit: 20,
          sortBy: 'createdAt',
          sortOrder: 'desc',
          status: 'processed',
        });

      const responseTime = Date.now() - startTime;

      expect(response.status).toBeLessThan(500);
      expect(responseTime).toBeLessThan(PERFORMANCE_REQUIREMENTS.API_RESPONSE_TIME_MS);
    });
  });
});
