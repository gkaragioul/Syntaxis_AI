// @ts-nocheck

import { Router } from 'express';
import { AuthService } from '../services/auth.service';
import { prisma } from '../prisma';
import { authenticate } from '../middleware/auth';
import {
  validateRequest,
  bodySchemas,
  standardizeResponse,
  validateContentType,
} from '../middleware/standardValidation';
import { createSuccessResponse, createErrorResponse } from '../utils/response';
import { ErrorCode } from '../types/errors';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const authService = new AuthService(prisma);

// Apply standard middleware
router.use(standardizeResponse);
router.use(validateContentType(['application/json']));

// Register new user
router.post(
  '/register',
  validateRequest({ body: bodySchemas.auth.register }),
  asyncHandler(async (req, res) => {
    const requestId = req.headers['x-request-id'] as string;

    try {
      const user = await authService.register(req.body);

      res
        .status(201)
        .json(
          createSuccessResponse(
            user,
            'User registered successfully',
            requestId,
          ),
        );
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        return res
          .status(409)
          .json(
            createErrorResponse(
              ErrorCode.CONFLICT_ERROR,
              'User with this email already exists',
              'Please use a different email address or try logging in',
              '/help/registration',
              undefined,
              { email: req.body.email },
              requestId,
            ),
          );
      }
      throw error;
    }
  }),
);

// Login user
router.post(
  '/login',
  validateRequest({ body: bodySchemas.auth.login }),
  asyncHandler(async (req, res) => {
    const requestId = req.headers['x-request-id'] as string;

    try {
      const result = await authService.login(req.body);

      res.json(createSuccessResponse(result, 'Login successful', requestId));
    } catch (error: any) {
      if (error.name === 'AuthenticationError') {
        return res
          .status(401)
          .json(
            createErrorResponse(
              ErrorCode.AUTHENTICATION_ERROR,
              'Invalid email or password',
              'Please check your credentials and try again',
              '/help/login',
              undefined,
              undefined,
              requestId,
            ),
          );
      }
      throw error;
    }
  }),
);

// Get current user
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const requestId = req.headers['x-request-id'] as string;

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        subscriptionStatus: true,
        invoicesProcessedThisMonth: true,
        monthlyLimit: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res
        .status(404)
        .json(
          createErrorResponse(
            ErrorCode.RESOURCE_NOT_FOUND,
            'User not found',
            'Please log in again',
            '/help/authentication',
            undefined,
            undefined,
            requestId,
          ),
        );
    }

    res.json(
      createSuccessResponse(
        user,
        'User profile retrieved successfully',
        requestId,
      ),
    );
  }),
);

export const authRoutes = router;
export default router;
