import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';
import { UserModel } from '../models/User';
import { LicenseModel } from '../models/License';
import { DeviceModel } from '../models/Device';
import { config } from '../config';

const authService = new AuthService(
  new UserModel(config.db.pool),
  new LicenseModel(config.db.pool),
  new DeviceModel(config.db.pool),
  config.jwt,
);

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
      throw new UnauthorizedError('No token provided');
    }

    const token = authHeader.split(' ')[1];
    const deviceInfo = authService.getDeviceInfo(req);

    const { userId, deviceId, licenseId } =
      await authService.validateAccessToken(token);

    // Get user to ensure they exist and are active
    const user = await authService.userModel.findById(userId);
    if (!user || !user.is_active) {
      throw new ForbiddenError('User account is inactive or deleted');
    }

    // Attach user info to request
    req.user = {
      id: userId,
      email: user.email,
      deviceId,
      licenseId,
    };

    next();
  } catch (error) {
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
      next(error);
    } else {
      next(new UnauthorizedError('Invalid or expired token'));
    }
  }
};

export const requireActiveLicense = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user?.licenseId) {
      throw new ForbiddenError('No active license found');
    }

    const license = await authService.licenseModel.findById(req.user.licenseId);
    if (!license || !authService.licenseModel.isLicenseValid(license)) {
      throw new ForbiddenError('License is invalid or expired');
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const requireDeviceLimit = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user?.licenseId) {
      throw new ForbiddenError('No active license found');
    }

    const license = await authService.licenseModel.findById(req.user.licenseId);
    if (!license || !authService.licenseModel.canActivateDevice(license)) {
      throw new ForbiddenError('Device limit reached for this license');
    }

    next();
  } catch (error) {
    next(error);
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
        // Reset window
        requests.set(key, { count: 1, resetTime: now + options.windowMs });
      } else if (requestData.count >= options.max) {
        // Rate limit exceeded
        return res.status(429).json({
          error: options.message || 'Too many requests, please try again later',
        });
      } else {
        // Increment count
        requestData.count++;
      }
    } else {
      // First request
      requests.set(key, { count: 1, resetTime: now + options.windowMs });
    }

    next();
  };
};

// Clean up expired rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of requests.entries()) {
    if (now > data.resetTime) {
      requests.delete(key);
    }
  }
}, 60000); // Clean up every minute
