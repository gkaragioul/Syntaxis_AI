import request from 'supertest';
import { app } from '../../app';
import { prisma } from '../../index';
import { AuthService } from '../../services/auth.service';

describe('API Endpoint Consistency Tests (Task 2.3.4)', () => {
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    // Create test user and get auth token
    const authService = new AuthService(prisma);
    const user = await authService.register({
      email: 'test@example.com',
      password: 'password123',
    });

    const loginResult = await authService.login({
      email: 'test@example.com',
      password: 'password123',
    });

    authToken = loginResult.token;
    userId = user.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.user.delete({ where: { id: userId } });
  });

  describe('Response Format Consistency', () => {
    it('should return consistent success response format across all endpoints', async () => {
      const endpoints = [
        { method: 'get', path: '/api/v1/system/health', requiresAuth: false },
        { method: 'get', path: '/api/v1/invoices', requiresAuth: true },
        { method: 'get', path: '/api/v1/files', requiresAuth: true },
        { method: 'get', path: '/api/v1/auth/me', requiresAuth: true },
      ];

      for (const endpoint of endpoints) {
        const req = request(app)[endpoint.method](endpoint.path);

        if (endpoint.requiresAuth) {
          req.set('Authorization', `Bearer ${authToken}`);
        }

        const response = await req.expect(200);

        // Check standard response format
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body).toHaveProperty('timestamp');
        expect(response.body.timestamp).toMatch(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
        );

        // Should have consistent metadata
        if (response.body.meta) {
          expect(response.body.meta).toBeInstanceOf(Object);
        }

        // Should have request ID for tracing
        expect(response.body).toHaveProperty('requestId');
      }
    });

    it('should return consistent error response format across all endpoints', async () => {
      const errorEndpoints = [
        { method: 'get', path: '/api/v1/invoices/invalid-uuid', status: 400 },
        { method: 'get', path: '/api/v1/files/nonexistent-id', status: 404 },
        { method: 'post', path: '/api/v1/auth/login', status: 400, body: {} },
      ];

      for (const endpoint of errorEndpoints) {
        const req = request(app)[endpoint.method](endpoint.path);

        if (endpoint.body) {
          req.send(endpoint.body);
        }

        req.set('Authorization', `Bearer ${authToken}`);

        const response = await req.expect(endpoint.status);

        // Check standard error response format
        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toHaveProperty('code');
        expect(response.body.error).toHaveProperty('userMessage');
        expect(response.body.error).toHaveProperty('nextSteps');
        expect(response.body).toHaveProperty('timestamp');
        expect(response.body).toHaveProperty('requestId');
      }
    });

    it('should include proper CORS headers', async () => {
      const response = await request(app)
        .options('/api/v1/system/health')
        .expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
      expect(response.headers).toHaveProperty('access-control-allow-methods');
      expect(response.headers).toHaveProperty('access-control-allow-headers');
    });

    it('should include security headers', async () => {
      const response = await request(app)
        .get('/api/v1/system/health')
        .expect(200);

      expect(response.headers).toHaveProperty(
        'x-content-type-options',
        'nosniff',
      );
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-xss-protection');
    });
  });

  describe('Validation Consistency', () => {
    it('should validate UUID parameters consistently', async () => {
      const invalidUuidEndpoints = [
        '/api/v1/invoices/invalid-uuid',
        '/api/v1/files/invalid-uuid',
      ];

      for (const endpoint of invalidUuidEndpoints) {
        const response = await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(400);

        expect(response.body.error.code).toBe('VALIDATION_ERROR');
        expect(response.body.error.userMessage).toContain('Invalid');
      }
    });

    it('should validate required fields consistently', async () => {
      const requiredFieldEndpoints = [
        { path: '/api/v1/auth/login', fields: ['email', 'password'] },
        { path: '/api/v1/auth/register', fields: ['email', 'password'] },
      ];

      for (const endpoint of requiredFieldEndpoints) {
        const response = await request(app)
          .post(endpoint.path)
          .send({})
          .expect(400);

        expect(response.body.error.code).toBe('VALIDATION_ERROR');
        expect(response.body.error.userMessage).toContain('required');
      }
    });

    it('should validate email format consistently', async () => {
      const emailEndpoints = ['/api/v1/auth/login', '/api/v1/auth/register'];

      for (const endpoint of emailEndpoints) {
        const response = await request(app)
          .post(endpoint)
          .send({ email: 'invalid-email', password: 'password123' })
          .expect(400);

        expect(response.body.error.code).toBe('VALIDATION_ERROR');
        expect(response.body.error.userMessage).toContain('email');
      }
    });

    it('should validate file upload consistently', async () => {
      const response = await request(app)
        .post('/api/v1/files/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', Buffer.from('not a pdf'), 'test.txt')
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.userMessage).toContain('PDF');
    });
  });

  describe('Authentication Consistency', () => {
    it('should require authentication consistently', async () => {
      const protectedEndpoints = [
        '/api/v1/invoices',
        '/api/v1/files',
        '/api/v1/auth/me',
      ];

      for (const endpoint of protectedEndpoints) {
        const response = await request(app).get(endpoint).expect(401);

        expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
        expect(response.body.error.userMessage).toContain('token');
      }
    });

    it('should handle invalid tokens consistently', async () => {
      const protectedEndpoints = [
        '/api/v1/invoices',
        '/api/v1/files',
        '/api/v1/auth/me',
      ];

      for (const endpoint of protectedEndpoints) {
        const response = await request(app)
          .get(endpoint)
          .set('Authorization', 'Bearer invalid-token')
          .expect(401);

        expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
        expect(response.body.error.userMessage).toContain('Invalid');
      }
    });
  });

  describe('Rate Limiting Consistency', () => {
    it('should apply rate limiting consistently', async () => {
      // This test would need to be adjusted based on actual rate limits
      // For now, just check that rate limit headers are present
      const response = await request(app)
        .get('/api/v1/system/health')
        .expect(200);

      // Rate limiting headers should be present
      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
    });
  });

  describe('Content Type Handling', () => {
    it('should handle JSON content type consistently', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .set('Content-Type', 'application/json')
        .send({ email: 'test@example.com', password: 'password123' })
        .expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    it('should reject invalid content types consistently', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .set('Content-Type', 'text/plain')
        .send('invalid data')
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('HTTP Method Consistency', () => {
    it('should use appropriate HTTP methods', async () => {
      // GET for retrieving data
      await request(app)
        .get('/api/v1/invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // POST for creating data
      await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com', password: 'password123' })
        .expect(200);

      // Method not allowed for wrong methods
      await request(app).delete('/api/v1/system/health').expect(405);
    });
  });

  describe('Pagination Consistency', () => {
    it('should handle pagination parameters consistently', async () => {
      const paginatedEndpoints = ['/api/v1/invoices', '/api/v1/files'];

      for (const endpoint of paginatedEndpoints) {
        const response = await request(app)
          .get(`${endpoint}?page=1&limit=10`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        if (response.body.meta) {
          expect(response.body.meta).toHaveProperty('page');
          expect(response.body.meta).toHaveProperty('limit');
          expect(response.body.meta).toHaveProperty('total');
        }
      }
    });
  });
});
