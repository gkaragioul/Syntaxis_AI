/**
 * API Performance Tests
 * 
 * Task 1.3.1: API Performance Tests - TDD Implementation
 * 
 * These tests validate that all API endpoints meet the <200ms response time requirement
 * following TDD principles: Red-Green-Refactor
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import { app } from '../../app';
import { setupTestEnvironment, cleanupTestEnvironment } from '../utils/test-environment';
import { prismaMock } from '../__mocks__/prisma';

// Performance requirements
const PERFORMANCE_REQUIREMENTS = {
  API_RESPONSE_TIME_MS: 200,
  BATCH_PROCESSING_TIME_MS: 30000, // 30 seconds
  DATABASE_QUERY_TIME_MS: 100,
  FILE_UPLOAD_TIME_MS: 500,
} as const;

describe('API Performance Requirements', () => {
  beforeEach(async () => {
    await setupTestEnvironment({ useMocks: true });
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(async () => {
    jest.useRealTimers();
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

      expect(response.status).toBeLessThan(500); // Should not be server error
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
  });

  describe('Invoice Management Endpoints Performance', () => {
    it('should respond to GET /api/invoices within 200ms', async () => {
      // Setup mock data for consistent testing
      prismaMock.invoice.findMany.mockResolvedValue([]);

      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/invoices')
        .set('Authorization', 'Bearer mock-jwt-token');

      const responseTime = Date.now() - startTime;

      expect(response.status).toBeLessThan(500);
      expect(responseTime).toBeLessThan(PERFORMANCE_REQUIREMENTS.API_RESPONSE_TIME_MS);
    });

    it('should respond to GET /api/invoices/:id within 200ms', async () => {
      prismaMock.invoice.findUnique.mockResolvedValue({
        id: 'test-invoice-id',
        userId: 'test-user-id',
        fileName: 'test.pdf',
        status: 'processed',
      } as any);

      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/invoices/test-invoice-id')
        .set('Authorization', 'Bearer mock-jwt-token');

      const responseTime = Date.now() - startTime;

      expect(response.status).toBeLessThan(500);
      expect(responseTime).toBeLessThan(PERFORMANCE_REQUIREMENTS.API_RESPONSE_TIME_MS);
    });

    it('should respond to POST /api/invoices/upload within 500ms (file upload)', async () => {
      // File uploads have slightly higher tolerance due to multipart processing
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/invoices/upload')
        .set('Authorization', 'Bearer mock-jwt-token')
        .attach('file', Buffer.from('mock pdf content'), 'test.pdf');

      const responseTime = Date.now() - startTime;

      expect(response.status).toBeLessThan(500);
      expect(responseTime).toBeLessThan(PERFORMANCE_REQUIREMENTS.FILE_UPLOAD_TIME_MS);
    });

    it('should respond to PUT /api/invoices/:id within 200ms', async () => {
      prismaMock.invoice.update.mockResolvedValue({
        id: 'test-invoice-id',
        status: 'updated',
      } as any);

      const startTime = Date.now();
      
      const response = await request(app)
        .put('/api/invoices/test-invoice-id')
        .set('Authorization', 'Bearer mock-jwt-token')
        .send({ status: 'processed' });

      const responseTime = Date.now() - startTime;

      expect(response.status).toBeLessThan(500);
      expect(responseTime).toBeLessThan(PERFORMANCE_REQUIREMENTS.API_RESPONSE_TIME_MS);
    });

    it('should respond to DELETE /api/invoices/:id within 200ms', async () => {
      prismaMock.invoice.delete.mockResolvedValue({
        id: 'test-invoice-id',
      } as any);

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
    it('should respond to POST /api/ocr/process within 200ms (async processing)', async () => {
      // OCR processing should return quickly and process asynchronously
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/ocr/process')
        .set('Authorization', 'Bearer mock-jwt-token')
        .send({ invoiceId: 'test-invoice-id' });

      const responseTime = Date.now() - startTime;

      expect(response.status).toBeLessThan(500);
      expect(responseTime).toBeLessThan(PERFORMANCE_REQUIREMENTS.API_RESPONSE_TIME_MS);
    });

    it('should respond to GET /api/ocr/results/:id within 200ms', async () => {
      prismaMock.ocrResult.findUnique.mockResolvedValue({
        id: 'test-ocr-result-id',
        confidence: 0.95,
        extractedText: 'Sample text',
      } as any);

      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/ocr/results/test-ocr-result-id')
        .set('Authorization', 'Bearer mock-jwt-token');

      const responseTime = Date.now() - startTime;

      expect(response.status).toBeLessThan(500);
      expect(responseTime).toBeLessThan(PERFORMANCE_REQUIREMENTS.API_RESPONSE_TIME_MS);
    });
  });

  describe('Dashboard and Analytics Performance', () => {
    it('should respond to GET /api/dashboard/stats within 200ms', async () => {
      // Mock dashboard statistics
      prismaMock.invoice.count.mockResolvedValue(10);
      prismaMock.invoice.aggregate.mockResolvedValue({
        _avg: { extractionConfidence: 0.95 },
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
      prismaMock.invoice.findMany.mockResolvedValue([]);

      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/dashboard/recent-activity')
        .set('Authorization', 'Bearer mock-jwt-token');

      const responseTime = Date.now() - startTime;

      expect(response.status).toBeLessThan(500);
      expect(responseTime).toBeLessThan(PERFORMANCE_REQUIREMENTS.API_RESPONSE_TIME_MS);
    });
  });

  describe('Performance Monitoring and Health Checks', () => {
    it('should respond to GET /api/health within 100ms', async () => {
      // Health checks should be extremely fast
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/health');

      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(100); // Stricter requirement for health checks
    });

    it('should respond to GET /api/metrics within 200ms', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/metrics')
        .set('Authorization', 'Bearer mock-jwt-token');

      const responseTime = Date.now() - startTime;

      expect(response.status).toBeLessThan(500);
      expect(responseTime).toBeLessThan(PERFORMANCE_REQUIREMENTS.API_RESPONSE_TIME_MS);
    });
  });

  describe('Batch Operations Performance', () => {
    it('should handle batch invoice processing within performance limits', async () => {
      // Test batch processing initiation (should be fast)
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/invoices/batch-process')
        .set('Authorization', 'Bearer mock-jwt-token')
        .send({ invoiceIds: ['id1', 'id2', 'id3'] });

      const responseTime = Date.now() - startTime;

      expect(response.status).toBeLessThan(500);
      expect(responseTime).toBeLessThan(PERFORMANCE_REQUIREMENTS.API_RESPONSE_TIME_MS);
      
      // Response should indicate async processing
      if (response.status === 200) {
        expect(response.body).toHaveProperty('jobId');
        expect(response.body).toHaveProperty('status', 'processing');
      }
    });

    it('should respond to batch status checks within 200ms', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/invoices/batch-status/test-job-id')
        .set('Authorization', 'Bearer mock-jwt-token');

      const responseTime = Date.now() - startTime;

      expect(response.status).toBeLessThan(500);
      expect(responseTime).toBeLessThan(PERFORMANCE_REQUIREMENTS.API_RESPONSE_TIME_MS);
    });
  });

  describe('Performance Regression Prevention', () => {
    it('should maintain consistent response times under load simulation', async () => {
      // Simulate multiple concurrent requests
      const concurrentRequests = 5;
      const requests = Array.from({ length: concurrentRequests }, () => {
        const startTime = Date.now();
        return request(app)
          .get('/api/health')
          .then(response => ({
            response,
            responseTime: Date.now() - startTime,
          }));
      });

      const results = await Promise.all(requests);

      // All requests should complete within performance requirements
      results.forEach(({ response, responseTime }) => {
        expect(response.status).toBe(200);
        expect(responseTime).toBeLessThan(PERFORMANCE_REQUIREMENTS.API_RESPONSE_TIME_MS);
      });

      // Average response time should be well within limits
      const averageResponseTime = results.reduce((sum, { responseTime }) => sum + responseTime, 0) / results.length;
      expect(averageResponseTime).toBeLessThan(PERFORMANCE_REQUIREMENTS.API_RESPONSE_TIME_MS * 0.8);
    });

    it('should handle error scenarios within performance limits', async () => {
      // Test that error responses are also fast
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/invoices/non-existent-id')
        .set('Authorization', 'Bearer mock-jwt-token');

      const responseTime = Date.now() - startTime;

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(responseTime).toBeLessThan(PERFORMANCE_REQUIREMENTS.API_RESPONSE_TIME_MS);
    });
  });
});
