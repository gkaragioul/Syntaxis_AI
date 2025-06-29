import express from 'express';
import { DeviceService } from '../services/DeviceService';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { z } from 'zod';
import { getDeviceInfo } from '../utils/deviceInfo';
import { generateDeviceFingerprint } from '../utils/deviceFingerprint';

const router = express.Router();
const deviceService = new DeviceService();

// Schema for device activation
const activateDeviceSchema = z.object({
  licenseId: z.string().uuid(),
});

// Schema for device deactivation
const deactivateDeviceSchema = z.object({
  licenseId: z.string().uuid(),
  deviceId: z.string().uuid(),
});

/**
 * Get all devices for a license
 * GET /api/licenses/:licenseId/devices
 */
router.get(
  '/licenses/:licenseId/devices',
  authenticate,
  async (req, res, next) => {
    try {
      const { licenseId } = req.params;
      const devices = await deviceService.getDevicesForLicense(
        licenseId,
        req.user.id,
      );
      res.json({ devices });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * Activate a license on the current device
 * POST /api/licenses/:licenseId/devices/activate
 */
router.post(
  '/licenses/:licenseId/devices/activate',
  authenticate,
  validateRequest(activateDeviceSchema),
  async (req, res, next) => {
    try {
      const { licenseId } = req.params;
      const deviceInfo = getDeviceInfo(req);
      const fingerprint = generateDeviceFingerprint(req);

      const result = await deviceService.activateDevice(
        licenseId,
        req.user.id,
        deviceInfo,
        fingerprint,
        req.ip,
        req.headers['user-agent'] || '',
      );

      if (result.conflict) {
        res.status(409).json({
          error: {
            code: 'DEVICE_CONFLICT',
            message: 'License is already active on another device',
            nextSteps:
              'Please deactivate the existing device before activating this one',
            helpUrl: '/help/device-management',
            conflict: result.conflict,
          },
        });
        return;
      }

      res.json({ device: result.device });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * Deactivate a device
 * POST /api/licenses/:licenseId/devices/:deviceId/deactivate
 */
router.post(
  '/licenses/:licenseId/devices/:deviceId/deactivate',
  authenticate,
  validateRequest(deactivateDeviceSchema),
  async (req, res, next) => {
    try {
      const { licenseId, deviceId } = req.params;
      await deviceService.deactivateDevice(
        deviceId,
        licenseId,
        req.user.id,
        req.ip,
        req.headers['user-agent'] || '',
      );
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
