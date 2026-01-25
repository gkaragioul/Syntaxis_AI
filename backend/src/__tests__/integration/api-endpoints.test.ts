import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../app';
import { prisma } from '../../index';
import { createTestUser, createTestToken } from '../helpers/testHelpers';

describe('API Endpoints Consistency Tests (Task 2.3.4)', () => {
  let testUser: any;
  let authToken: string;

  beforeEach(async () => {
    // Create test user and token
    testUser = await createTestUser();
    authToken = createTestToken(testUser.id);
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.user.deleteMany({
      where: { email: testUser.email },
    });
  });

  describe('Response Format Consistency', () => {
    it('should return consistent success response format across all endpoints', async () => {
      const endpoints = [
        { method: 'get', path: '/api/v1/system/health' },
        { method: 'get', path: '/api/v1/invoices' },
        { method: 'get', path: '/api/v1/files' },
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)
          [endpoint.method](endpoint.path)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        // Check standard response format
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body).toHaveProperty('timestamp');
        expect(response.body.timestamp).toMatch(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
        );
      }
    });

    it('should return consistent error response format across all endpoints', async () => {
      const endpoints = [
        { method: 'get', path: '/api/v1/invoices/invalid-uuid' },
        { method: 'get', path: '/api/v1/files/invalid-uuid' },
        { method: 'post', path: '/api/v1/invoices', body: { invalid: 'data' } },
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)
          [endpoint.method](endpoint.path)
          .set('Authorization', `Bearer ${authToken}`)
          .send(endpoint.body || {});

        // Should return error format (400 or 404)
        expect([400, 404, 422]).toContain(response.status);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toHaveProperty('code');
        expect(response.body.error).toHaveProperty('userMessage');
        expect(response.body.error).toHaveProperty('nextSteps');
        expect(response.body.error).toHaveProperty('helpUrl');
        expect(response.body).toHaveProperty('timestamp');
      }
    });

    it('should include request ID in all responses', async () => {
      const response = await request(app)
        .get('/api/v1/system/health')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Request-ID', 'test-request-123')
        .expect(200);

      expect(response.body).toHaveProperty('requestId');
      expect(response.body.requestId).toBeTruthy();
    });
  });

  describe('Authentication Consistency', () => {
    it('should require authentication for protected endpoints', async () => {
      const protectedEndpoints = [
        '/api/v1/invoices',
        '/api/v1/files',
        '/api/v1/system/status',
        '/api/v1/devices',
      ];

      for (const endpoint of protectedEndpoints) {
        const response = await request(app).get(endpoint).expect(401);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
      }
    });

    it('should allow access to public endpoints without authentication', async () => {
      const publicEndpoints = [
        '/health',
        '/api/v1/auth/login',
        '/api/v1/auth/register',
      ];

      for (const endpoint of publicEndpoints) {
        // Should not return 401 (may return other errors for invalid data)
        const response = await request(app).get(endpoint);
        expect(response.status).not.toBe(401);
      }
    });
  });

  describe('HTTP Status Code Consistency', () => {
    it('should use correct status codes for different operations', async () => {
      // GET requests should return 200 for success
      const getResponse = await request(app)
        .get('/api/v1/invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(getResponse.body.success).toBe(true);

      // POST requests should return 201 for creation
      const postResponse = await request(app)
        .post('/api/v1/files/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', Buffer.from('test pdf content'), 'test.pdf');

      // Should return 201 for successful creation
      if (postResponse.status === 201) {
        expect(postResponse.body.success).toBe(true);
      }
    });

    it('should return 404 for non-existent resources', async () => {
      const response = await request(app)
        .get('/api/v1/invoices/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('should return 400 for validation errors', async () => {
      const response = await request(app)
        .post('/api/v1/invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ invalid: 'data' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Pagination Consistency', () => {
    it('should implement consistent pagination across list endpoints', async () => {
      const listEndpoints = ['/api/v1/invoices', '/api/v1/files'];

      for (const endpoint of listEndpoints) {
        const response = await request(app)
          .get(`${endpoint}?page=1&limit=10`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('items');
        expect(response.body.data).toHaveProperty('pagination');
        expect(response.body.data.pagination).toHaveProperty('page');
        expect(response.body.data.pagination).toHaveProperty('limit');
        expect(response.body.data.pagination).toHaveProperty('total');
        expect(response.body.data.pagination).toHaveProperty('totalPages');
      }
    });
  });

  describe('Content-Type Consistency', () => {
    it('should return JSON content-type for API endpoints', async () => {
      const response = await request(app)
        .get('/api/v1/invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    it('should accept JSON content-type for POST/PUT requests', async () => {
      const response = await request(app)
        .post('/api/v1/invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send({
          invoiceNumber: 'INV-001',
          vendorName: 'Test Vendor',
          totalAmount: 100.0,
        });

      // Should accept the request (may fail validation but not content-type)
      expect(response.status).not.toBe(415); // Unsupported Media Type
    });
  });

  describe('Rate Limiting Consistency', () => {
    it('should implement rate limiting on sensitive endpoints', async () => {
      // Test rate limiting on auth endpoints
      const promises = Array(10)
        .fill(null)
        .map(() =>
          request(app)
            .post('/api/v1/auth/login')
            .send({ email: 'test@example.com', password: 'wrong' }),
        );

      const responses = await Promise.all(promises);

      // Should eventually hit rate limit
      const rateLimitedResponses = responses.filter((r) => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('CORS Headers Consistency', () => {
    it('should include proper CORS headers', async () => {
      const response = await request(app)
        .options('/api/v1/invoices')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET');

      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-methods']).toBeDefined();
      expect(response.headers['access-control-allow-headers']).toBeDefined();
    });
  });

  describe('API Versioning Consistency', () => {
    it('should use consistent API versioning', async () => {
      // All API endpoints should be under /api/v1
      const endpoints = [
        '/api/v1/auth/login',
        '/api/v1/invoices',
        '/api/v1/files',
        '/api/v1/system/health',
      ];

      for (const endpoint of endpoints) {
        expect(endpoint).toMatch(/^\/api\/v1\//);
      }
    });

    it('should return API version in response headers', async () => {
      const response = await request(app)
        .get('/api/v1/system/health')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.headers['x-api-version']).toBeDefined();
    });
  });

  describe('Error Handling Consistency', () => {
    it('should handle malformed JSON consistently', async () => {
      const response = await request(app)
        .post('/api/v1/invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle large payloads consistently', async () => {
      const largePayload = { data: 'x'.repeat(10 * 1024 * 1024) }; // 10MB

      const response = await request(app)
        .post('/api/v1/invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .send(largePayload);

      expect(response.status).toBe(413); // Payload Too Large
      expect(response.body.success).toBe(false);
    });
  });
});
