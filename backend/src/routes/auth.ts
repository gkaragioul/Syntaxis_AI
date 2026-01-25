import { Router } from 'express';
import { AuthService } from '../services/AuthService';
import { config } from '../config';
import {
  authenticate,
  requireActiveLicense,
  requireDeviceLimit,
  rateLimiter,
  AuthenticatedRequest,
} from '../middleware/auth';
import {
  ValidationError,
  AuthenticationError,
  LicenseError,
  DeviceError,
} from '../utils/errors';

const router = Router();
const authService = new AuthService(config.jwt);

// Apply rate limiting to all auth routes
router.use(
  rateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many authentication attempts, please try again later',
  }),
);

// Register new user
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    if (!email || !password) {
      throw new ValidationError('Email and password are required');
    }

    const user = await authService.register({
      email,
      password,
    });

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Login user
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new ValidationError('Email and password are required');
    }

    const deviceInfo = authService.getDeviceInfo ? await authService.getDeviceInfo(req) : {};
    const result = await authService.login(email, password, deviceInfo);

    res.json({
      message: 'Login successful',
      user: {
        id: result.user.id,
        email: result.user.email,
      },
      tokens: result.tokens,
      device: result.device ? {
        id: result.device.id,
        fingerprint: result.device.fingerprint,
        status: result.device.status,
      } : null,
      license: result.license
        ? {
          id: result.license.id,
          type: result.license.type,
          status: result.license.status,
          expiresAt: result.license.expiresAt,
          maxDevices: result.license.maxDevices,
        }
        : null,
    });
  } catch (error) {
    next(error);
  }
});

// Refresh access token
router.post('/refresh-token', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new ValidationError('Refresh token is required');
    }

    const tokens = await authService.refreshToken(refreshToken);
    res.json({ tokens });
  } catch (error) {
    next(error);
  }
});

// Activate license
router.post(
  '/activate-license',
  authenticate,
  requireDeviceLimit,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { licenseKey } = req.body;

      if (!licenseKey) {
        throw new ValidationError('License key is required');
      }

      const deviceInfo = authService.getDeviceInfo ? await authService.getDeviceInfo(req) : {};
      const result = await authService.activateLicense(
        req.user!.id,
        licenseKey,
        deviceInfo,
      );

      res.json({
        message: 'License activated successfully',
        license: {
          id: result.license.id,
          type: result.license.type,
          status: result.license.status,
          validUntil: result.license.valid_until,
          maxDevices: result.license.max_devices,
          activatedDevices: result.license.activated_devices,
        },
        device: {
          id: result.device.id,
          name: result.device.device_name,
          type: result.device.device_type,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// Get user's devices
router.get(
  '/devices',
  authenticate,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const devices = await authService.deviceModel.findByUserId(req.user!.id);

      res.json({
        devices: devices.map((device) => ({
          id: device.id,
          name: device.device_name,
          type: device.device_type,
          browserInfo: device.browser_info,
          isActive: device.is_active,
          lastActiveAt: device.last_active_at,
          activatedAt: device.activated_at,
        })),
      });
    } catch (error) {
      next(error);
    }
  },
);

// Deactivate device
router.post(
  '/devices/:deviceId/deactivate',
  authenticate,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { deviceId } = req.params;

      if (!deviceId) {
        throw new ValidationError('Device ID is required');
      }

      await authService.deactivateDevice(req.user!.id, deviceId);
      res.json({ message: 'Device deactivated successfully' });
    } catch (error) {
      next(error);
    }
  },
);

// Get user's licenses
router.get(
  '/licenses',
  authenticate,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const licenses = await authService.licenseModel.findByUserId(
        req.user!.id,
      );

      res.json({
        licenses: licenses.map((license) => ({
          id: license.id,
          type: license.type,
          status: license.status,
          validFrom: license.valid_from,
          validUntil: license.valid_until,
          maxDevices: license.max_devices,
          activatedDevices: license.activated_devices,
          createdAt: license.created_at,
        })),
      });
    } catch (error) {
      next(error);
    }
  },
);

// Get current user profile
router.get(
  '/profile',
  authenticate,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { prisma } = await import('../prisma');
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: {
          id: true,
          email: true,
          subscriptionStatus: true,
          subscriptionId: true,
          invoicesProcessedThisMonth: true,
          monthlyLimit: true,
          emailVerified: true,
          createdAt: true,
          updatedAt: true,
        }
      });

      if (!user) {
        throw new AuthenticationError('User not found');
      }

      res.json({ user });
    } catch (error) {
      next(error);
    }
  },
);

// Update user profile
router.patch(
  '/profile',
  authenticate,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { email, currentPassword, newPassword } = req.body;
      const { prisma } = await import('../prisma');
      const bcrypt = await import('bcrypt');

      // Get current user
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id }
      });

      if (!user) {
        throw new AuthenticationError('User not found');
      }

      const updateData: any = {};

      // Update email if provided and different
      if (email && email !== user.email) {
        // Check if email is already taken
        const existingUser = await prisma.user.findUnique({
          where: { email }
        });

        if (existingUser) {
          throw new ValidationError('Email already in use');
        }

        updateData.email = email;
        updateData.emailVerified = false; // Require re-verification
      }

      // Update password if provided
      if (newPassword) {
        if (!currentPassword) {
          throw new ValidationError('Current password is required to set a new password');
        }

        // Verify current password
        const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!isPasswordValid) {
          throw new ValidationError('Current password is incorrect');
        }

        // Hash new password
        const saltRounds = 12;
        updateData.passwordHash = await bcrypt.hash(newPassword, saltRounds);
      }

      // Perform update if there are changes
      if (Object.keys(updateData).length > 0) {
        updateData.updatedAt = new Date();

        await prisma.user.update({
          where: { id: req.user!.id },
          data: updateData
        });
      }

      // Return updated user data
      const updatedUser = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: {
          id: true,
          email: true,
          subscriptionStatus: true,
          subscriptionId: true,
          invoicesProcessedThisMonth: true,
          monthlyLimit: true,
          emailVerified: true,
          createdAt: true,
          updatedAt: true,
        }
      });

      res.json({ 
        message: 'Profile updated successfully',
        user: updatedUser 
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
