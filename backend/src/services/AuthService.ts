import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from '../prisma';
import {
  ValidationError,
  AuthenticationError,
  LicenseError,
} from '../utils/errors';
import { generateDeviceFingerprint } from '../utils/deviceFingerprint';
import { ErrorCodes } from '../types/ErrorMessage';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export class AuthService {
  private readonly JWT_SECRET: string;
  private readonly JWT_REFRESH_SECRET: string;
  private readonly ACCESS_TOKEN_EXPIRY: string;
  private readonly REFRESH_TOKEN_EXPIRY: string;

  // Model accessors for compatibility with route handlers
  public readonly deviceModel = {
    findByUserId: async (userId: string) => {
      const licenses = await prisma.license.findMany({
        where: { userId },
        include: { devices: true }
      });
      return licenses.flatMap(license => license.devices);
    }
  };

  public readonly licenseModel = {
    findByUserId: async (userId: string) => {
      return await prisma.license.findMany({
        where: { userId }
      });
    }
  };

  constructor(
    config: {
      jwtSecret: string;
      jwtRefreshSecret: string;
      accessTokenExpiry: string;
      refreshTokenExpiry: string;
    },
  ) {
    this.JWT_SECRET = config.jwtSecret;
    this.JWT_REFRESH_SECRET = config.jwtRefreshSecret;
    this.ACCESS_TOKEN_EXPIRY = config.accessTokenExpiry;
    this.REFRESH_TOKEN_EXPIRY = config.refreshTokenExpiry;
  }

  private generateTokens(userId: string, deviceId?: string): AuthTokens {
    const accessToken = jwt.sign({ userId, deviceId }, this.JWT_SECRET, {
      expiresIn: this.ACCESS_TOKEN_EXPIRY as any,
    });

    const refreshToken = jwt.sign(
      { userId, deviceId },
      this.JWT_REFRESH_SECRET,
      { expiresIn: this.REFRESH_TOKEN_EXPIRY as any },
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: 3600,
    };
  }

  async register(input: any) {
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(input.password, saltRounds);
    
    return prisma.user.create({
      data: {
        email: input.email,
        passwordHash: hashedPassword,
      }
    });
  }

  async login(email: string, password: string, deviceInfo: any) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new AuthenticationError('Invalid credentials');

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) throw new AuthenticationError('Invalid credentials');

    const tokens = this.generateTokens(user.id);
    return { user, tokens, requiresLicenseActivation: false };
  }

  async refreshToken(token: string) {
    const decoded = jwt.verify(token, this.JWT_REFRESH_SECRET) as { userId: string };
    return this.generateTokens(decoded.userId);
  }

  async validateAccessToken(
    token: string,
  ): Promise<{ userId: string; deviceId?: string }> {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET) as {
        userId: string;
        deviceId?: string;
      };

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId }
      });

      if (!user) {
        throw new AuthenticationError('Invalid access token');
      }

      return decoded;
    } catch (error) {
      throw new AuthenticationError('Invalid access token');
    }
  }

  async getDeviceInfo(req: any) {
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const fingerprint = await generateDeviceFingerprint(req);
    
    return {
      fingerprint,
      userAgent,
      ip: req.ip || req.connection?.remoteAddress || 'Unknown'
    };
  }

  async activateLicense(userId: string, licenseKey: string, deviceInfo: any) {
    // Find license by key
    const license = await prisma.license.findUnique({
      where: { key: licenseKey },
      include: { devices: true }
    });

    if (!license) {
      throw new LicenseError('Invalid license key');
    }

    if (license.userId !== userId) {
      throw new LicenseError('License does not belong to this user');
    }

    if (license.status !== 'active') {
      throw new LicenseError('License is not active');
    }

    // Check device limit
    const activeDevices = license.devices.filter(d => d.status === 'active');
    if (activeDevices.length >= license.maxDevices) {
      throw new LicenseError('Device limit reached for this license');
    }

    // Create or activate device
    const existingDevice = await prisma.device.findFirst({
      where: {
        licenseId: license.id,
        fingerprint: deviceInfo.fingerprint
      }
    });

    let device;
    if (existingDevice) {
      // Reactivate existing device
      device = await prisma.device.update({
        where: { id: existingDevice.id },
        data: {
          status: 'active',
          lastSeenAt: new Date(),
          deactivatedAt: null
        }
      });
    } else {
      // Create new device
      device = await prisma.device.create({
        data: {
          licenseId: license.id,
          deviceInfo: JSON.stringify(deviceInfo),
          fingerprint: deviceInfo.fingerprint,
          status: 'active',
          lastSeenAt: new Date()
        }
      });
    }

    return { license, device };
  }

  async deactivateDevice(userId: string, deviceId: string) {
    const device = await prisma.device.findUnique({
      where: { id: deviceId },
      include: { license: true }
    });

    if (!device) {
      throw new ValidationError('Device not found');
    }

    if (device.license.userId !== userId) {
      throw new AuthenticationError('Unauthorized to deactivate this device');
    }

    await prisma.device.update({
      where: { id: deviceId },
      data: {
        status: 'inactive',
        deactivatedAt: new Date()
      }
    });
  }
}

export default AuthService;
