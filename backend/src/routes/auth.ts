import { Router } from 'express';
import { AuthService } from '../services/AuthService';
import { UserModel } from '../models/User';
import { LicenseModel } from '../models/License';
import { DeviceModel } from '../models/Device';
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
const authService = new AuthService(
  new UserModel(config.db.pool),
  new LicenseModel(config.db.pool),
  new DeviceModel(config.db.pool),
  config.jwt,
);

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
      first_name: firstName,
      last_name: lastName,
    });

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
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

    const deviceInfo = authService.getDeviceInfo(req);
    const result = await authService.login(email, password, deviceInfo);

    res.json({
      message: 'Login successful',
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.first_name,
        lastName: result.user.last_name,
      },
      tokens: result.tokens,
      device: {
        id: result.device.id,
        name: result.device.device_name,
        type: result.device.device_type,
      },
      license: result.license
        ? {
            id: result.license.id,
            type: result.license.type,
            status: result.license.status,
            validUntil: result.license.valid_until,
            maxDevices: result.license.max_devices,
            activatedDevices: result.license.activated_devices,
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

      const deviceInfo = authService.getDeviceInfo(req);
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

// Error handling middleware
router.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  if (error instanceof ValidationError) {
    res.status(400).json({ error: error.message });
  } else if (error instanceof AuthenticationError) {
    res.status(401).json({ error: error.message });
  } else if (error instanceof LicenseError) {
    res.status(403).json({ error: error.message });
  } else if (error instanceof DeviceError) {
    res.status(403).json({ error: error.message });
  } else {
    console.error('Auth route error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
