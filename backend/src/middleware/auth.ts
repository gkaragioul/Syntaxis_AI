// @ts-nocheck

import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';
import { config } from '../config';
import { prisma } from '../prisma';

let authService = new AuthService(config.jwt);

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    deviceId: string;
    licenseId: string;
  };
}

export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];

    const { userId, deviceId } = await authService.validateAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return next();
    }

    req.user = {
      id: userId,
      email: user.email,
      deviceId,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      error: 'Invalid or expired token',
    });
  }
};

export const authMiddleware = authenticate;

export const requireActiveLicense = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { prisma } = await import('../prisma');
    const licenses = await prisma.license.findMany({
      where: {
        userId: req.user!.id,
        status: 'active',
      },
    });

    if (licenses.length === 0) {
      return res.status(403).json({
        error: 'Active license required',
        code: 'LICENSE_REQUIRED',
      });
    }

    // Check if any license is still valid (not expired)
    const hasValidLicense = licenses.some(license => {
      if (!license.expiresAt) return true; // No expiration
      return new Date(license.expiresAt) > new Date();
    });

    if (!hasValidLicense) {
      return res.status(403).json({
        error: 'License expired',
        code: 'LICENSE_EXPIRED',
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to validate license',
    });
  }
};

export const requireDeviceLimit = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { prisma } = await import('../prisma');
    const licenses = await prisma.license.findMany({
      where: {
        userId: req.user!.id,
        status: 'active',
      },
      include: {
        devices: {
          where: { status: 'active' },
        },
      },
    });

    if (licenses.length === 0) {
      return res.status(403).json({
        error: 'No active license found',
        code: 'LICENSE_REQUIRED',
      });
    }

    // Check if user has reached device limit on any license
    const hasAvailableSlot = licenses.some(license => {
      return license.devices.length < license.maxDevices;
    });

    if (!hasAvailableSlot) {
      return res.status(403).json({
        error: 'Device limit reached on all licenses',
        code: 'DEVICE_LIMIT_REACHED',
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to validate device limit',
    });
  }
};

export const rateLimiter = (options: {
  windowMs: number;
  max: number;
  message?: string;
}) => {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip;
    const now = Date.now();

    const requestData = requests.get(key);
    if (requestData) {
      if (now > requestData.resetTime) {
        requests.set(key, { count: 1, resetTime: now + options.windowMs });
      } else if (requestData.count >= options.max) {
        return res.status(429).json({
          error: options.message || 'Too many requests, please try again later',
        });
      } else {
        requestData.count++;
      }
    } else {
      requests.set(key, { count: 1, resetTime: now + options.windowMs });
    }

    next();
  };
};

export default authMiddleware;
