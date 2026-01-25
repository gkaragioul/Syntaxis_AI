import request from 'supertest';
import { app } from '../../app';
import { HelpService } from '../../services/HelpService';
import { createTestUser, generateAuthToken } from '../utils/test-factories';

// Mock the HelpService
jest.mock('../../services/HelpService');
const mockHelpService = HelpService as jest.MockedClass<typeof HelpService>;

describe('Onboarding API Integration Tests', () => {
  let testUser: any;
  let authToken: string;
  let helpServiceInstance: jest.Mocked<HelpService>;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Create test user and auth token
    testUser = await createTestUser();
    authToken = generateAuthToken(testUser.id);

    // Mock HelpService instance
    helpServiceInstance = {
      getOnboardingStatus: jest.fn(),
      updateOnboardingStatus: jest.fn(),
      skipOnboarding: jest.fn(),
    } as any;

    mockHelpService.mockImplementation(() => helpServiceInstance);
  });

  describe('GET /api/help/onboarding/status', () => {
    it('should return onboarding status for authenticated user', async () => {
      const mockStatus = {
        completed: false,
        currentStep: 2,
        completedSteps: ['welcome'],
      };

      helpServiceInstance.getOnboardingStatus.mockResolvedValue(mockStatus);

      const response = await request(app)
        .get('/api/help/onboarding/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toEqual(mockStatus);
      expect(helpServiceInstance.getOnboardingStatus).toHaveBeenCalledWith(
        testUser.id,
      );
    });

    it('should return 401 for unauthenticated requests', async () => {
      await request(app).get('/api/help/onboarding/status').expect(401);

      expect(helpServiceInstance.getOnboardingStatus).not.toHaveBeenCalled();
    });

    it('should handle service errors gracefully', async () => {
      helpServiceInstance.getOnboardingStatus.mockRejectedValue(
        new Error('Service error'),
      );

      await request(app)
        .get('/api/help/onboarding/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(500);
    });

    it('should return completed onboarding status', async () => {
      const mockStatus = {
        completed: true,
        currentStep: 6,
        completedSteps: [
          'welcome',
          'upload',
          'extraction',
          'templates',
          'batch',
          'export',
        ],
      };

      helpServiceInstance.getOnboardingStatus.mockResolvedValue(mockStatus);

      const response = await request(app)
        .get('/api/help/onboarding/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.completed).toBe(true);
      expect(response.body.completedSteps).toHaveLength(6);
    });

    it('should return skipped onboarding status', async () => {
      const mockStatus = {
        completed: false,
        currentStep: 1,
        completedSteps: [],
        skipped: true,
      };

      helpServiceInstance.getOnboardingStatus.mockResolvedValue(mockStatus);

      const response = await request(app)
        .get('/api/help/onboarding/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.skipped).toBe(true);
    });
  });

  describe('POST /api/help/onboarding/step/:stepId', () => {
    it('should update step completion successfully', async () => {
      helpServiceInstance.updateOnboardingStatus.mockResolvedValue();

      const response = await request(app)
        .post('/api/help/onboarding/step/welcome')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ completed: true })
        .expect(200);

      expect(response.body.message).toBe('Onboarding step updated');
      expect(helpServiceInstance.updateOnboardingStatus).toHaveBeenCalledWith(
        testUser.id,
        'welcome',
        true,
      );
    });

    it('should handle step uncomplete', async () => {
      helpServiceInstance.updateOnboardingStatus.mockResolvedValue();

      await request(app)
        .post('/api/help/onboarding/step/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ completed: false })
        .expect(200);

      expect(helpServiceInstance.updateOnboardingStatus).toHaveBeenCalledWith(
        testUser.id,
        'upload',
        false,
      );
    });

    it('should validate request body', async () => {
      await request(app)
        .post('/api/help/onboarding/step/welcome')
        .set('Authorization', `Bearer ${authToken}`)
        .send({}) // Missing completed field
        .expect(400);

      expect(helpServiceInstance.updateOnboardingStatus).not.toHaveBeenCalled();
    });

    it('should validate stepId parameter', async () => {
      await request(app)
        .post('/api/help/onboarding/step/') // Empty stepId
        .set('Authorization', `Bearer ${authToken}`)
        .send({ completed: true })
        .expect(404);
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/help/onboarding/step/welcome')
        .send({ completed: true })
        .expect(401);

      expect(helpServiceInstance.updateOnboardingStatus).not.toHaveBeenCalled();
    });

    it('should handle invalid completed value', async () => {
      await request(app)
        .post('/api/help/onboarding/step/welcome')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ completed: 'invalid' })
        .expect(400);
    });

    it('should handle service errors', async () => {
      helpServiceInstance.updateOnboardingStatus.mockRejectedValue(
        new Error('Update failed'),
      );

      await request(app)
        .post('/api/help/onboarding/step/welcome')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ completed: true })
        .expect(500);
    });

    it('should handle all valid step IDs', async () => {
      helpServiceInstance.updateOnboardingStatus.mockResolvedValue();

      const validSteps = [
        'welcome',
        'upload',
        'extraction',
        'templates',
        'batch',
        'export',
      ];

      for (const stepId of validSteps) {
        await request(app)
          .post(`/api/help/onboarding/step/${stepId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ completed: true })
          .expect(200);

        expect(helpServiceInstance.updateOnboardingStatus).toHaveBeenCalledWith(
          testUser.id,
          stepId,
          true,
        );
      }
    });
  });

  describe('POST /api/help/onboarding/skip', () => {
    it('should skip onboarding successfully', async () => {
      helpServiceInstance.skipOnboarding.mockResolvedValue();

      const response = await request(app)
        .post('/api/help/onboarding/skip')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.message).toBe('Onboarding skipped');
      expect(helpServiceInstance.skipOnboarding).toHaveBeenCalledWith(
        testUser.id,
      );
    });

    it('should require authentication', async () => {
      await request(app).post('/api/help/onboarding/skip').expect(401);

      expect(helpServiceInstance.skipOnboarding).not.toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      helpServiceInstance.skipOnboarding.mockRejectedValue(
        new Error('Skip failed'),
      );

      await request(app)
        .post('/api/help/onboarding/skip')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(500);
    });

    it('should not require request body', async () => {
      helpServiceInstance.skipOnboarding.mockResolvedValue();

      await request(app)
        .post('/api/help/onboarding/skip')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
    });

    it('should handle already skipped onboarding', async () => {
      helpServiceInstance.skipOnboarding.mockResolvedValue();

      // Skip twice
      await request(app)
        .post('/api/help/onboarding/skip')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      await request(app)
        .post('/api/help/onboarding/skip')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(helpServiceInstance.skipOnboarding).toHaveBeenCalledTimes(2);
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to onboarding endpoints', async () => {
      helpServiceInstance.getOnboardingStatus.mockResolvedValue({
        completed: false,
        currentStep: 1,
        completedSteps: [],
      });

      // Make multiple rapid requests
      const requests = Array(20)
        .fill(null)
        .map(() =>
          request(app)
            .get('/api/help/onboarding/status')
            .set('Authorization', `Bearer ${authToken}`),
        );

      const responses = await Promise.all(requests);

      // Some requests should be rate limited (429)
      const rateLimitedResponses = responses.filter(
        (res) => res.status === 429,
      );
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Content Type Validation', () => {
    it('should require JSON content type for POST requests', async () => {
      await request(app)
        .post('/api/help/onboarding/step/welcome')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'text/plain')
        .send('completed=true')
        .expect(400);
    });

    it('should accept application/json content type', async () => {
      helpServiceInstance.updateOnboardingStatus.mockResolvedValue();

      await request(app)
        .post('/api/help/onboarding/step/welcome')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send({ completed: true })
        .expect(200);
    });
  });

  describe('Error Response Format', () => {
    it('should return consistent error format', async () => {
      helpServiceInstance.getOnboardingStatus.mockRejectedValue(
        new Error('Test error'),
      );

      const response = await request(app)
        .get('/api/help/onboarding/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
    });

    it('should return validation errors in consistent format', async () => {
      const response = await request(app)
        .post('/api/help/onboarding/step/welcome')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ completed: 'invalid' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('details');
    });
  });
});
