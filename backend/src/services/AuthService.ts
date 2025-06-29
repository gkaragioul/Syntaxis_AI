import jwt from 'jsonwebtoken';
import { Request } from 'express';
import { UserModel, User, CreateUserInput } from '../models/User';
import { LicenseModel, License } from '../models/License';
import { DeviceModel, Device, CreateDeviceInput } from '../models/Device';
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

export interface LoginResult {
  user: User;
  license?: License;
  device?: Device;
  tokens: AuthTokens;
  requiresLicenseActivation: boolean;
}

export interface DeviceInfo {
  device_fingerprint: string;
  device_name?: string;
  device_type?: string;
  browser_info?: Record<string, any>;
  ip_address?: string;
}

export class AuthService {
  private readonly JWT_SECRET: string;
  private readonly JWT_REFRESH_SECRET: string;
  private readonly ACCESS_TOKEN_EXPIRY: string;
  private readonly REFRESH_TOKEN_EXPIRY: string;

  constructor(
    private userModel: UserModel,
    private licenseModel: LicenseModel,
    private deviceModel: DeviceModel,
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
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
    });

    const refreshToken = jwt.sign(
      { userId, deviceId },
      this.JWT_REFRESH_SECRET,
      { expiresIn: this.REFRESH_TOKEN_EXPIRY },
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: parseInt(this.ACCESS_TOKEN_EXPIRY),
    };
  }

  async register(input: CreateUserInput): Promise<User> {
    const isEmailAvailable = await this.userModel.isEmailAvailable(input.email);
    if (!isEmailAvailable) {
      throw new ValidationError('Email already registered');
    }

    return this.userModel.create(input);
  }

  async login(
    email: string,
    password: string,
    deviceInfo: DeviceInfo,
  ): Promise<LoginResult> {
    const user = await this.userModel.verifyPassword(email, password);
    if (!user) {
      throw new AuthenticationError('Invalid email or password');
    }

    if (!user.is_active) {
      throw new AuthenticationError('Account is deactivated');
    }

    // Update last login timestamp
    await this.userModel.updateLastLogin(user.id);

    // Check for existing active license
    const licenses = await this.licenseModel.findByUserId(user.id);
    const activeLicense = licenses.find(
      (license) =>
        license.status === 'active' &&
        (!license.valid_until || new Date(license.valid_until) > new Date()),
    );

    // Check for existing active device
    const deviceFingerprint = deviceInfo.device_fingerprint;
    const existingDevice =
      await this.deviceModel.findByFingerprint(deviceFingerprint);

    let device: Device | undefined;
    let requiresLicenseActivation = false;

    if (activeLicense) {
      if (existingDevice) {
        // Update device info and last active timestamp
        device = await this.deviceModel.update(existingDevice.id, {
          ...deviceInfo,
          last_active_at: new Date(),
        });
      } else {
        // Check if license can activate new device
        const canActivate =
          await this.licenseModel.canActivateDevice(activeLicense);
        if (!canActivate) {
          throw new LicenseError('License device limit reached');
        }

        // Create new device
        const deviceInput: CreateDeviceInput = {
          license_id: activeLicense.id,
          user_id: user.id,
          ...deviceInfo,
        };
        device = await this.deviceModel.create(deviceInput);
        await this.licenseModel.incrementActivatedDevices(activeLicense.id);
      }
    } else {
      requiresLicenseActivation = true;
    }

    const tokens = this.generateTokens(user.id, device?.id);

    return {
      user,
      license: activeLicense,
      device,
      tokens,
      requiresLicenseActivation,
    };
  }

  async activateLicense(
    userId: string,
    licenseKey: string,
    deviceInfo: DeviceInfo,
  ): Promise<LoginResult> {
    const license = await this.licenseModel.findByLicenseKey(licenseKey);
    if (!license) {
      const error: any = new Error('Invalid license key');
      error.code = ErrorCodes.LICENSE_EXPIRED;
      error.userMessage = 'The license key you entered is invalid.';
      error.nextSteps = 'Please check your license key or contact support.';
      error.helpUrl = 'https://help.example.com/license-renewal'; // TODO
      error.statusCode = 400;
      throw error;
    }

    if (license.user_id && license.user_id !== userId) {
      const error: any = new Error('License already activated by another user');
      error.code = ErrorCodes.DEVICE_CONFLICT;
      error.userMessage =
        'This license is already activated on another account.';
      error.nextSteps =
        'Contact support to resolve device conflicts or manage your devices.';
      error.helpUrl = 'https://help.example.com/device-management'; // TODO
      error.statusCode = 400;
      throw error;
    }

    const isValid = await this.licenseModel.isLicenseValid(license);
    if (!isValid) {
      const error: any = new Error('License is not valid or has expired');
      error.code = ErrorCodes.LICENSE_EXPIRED;
      error.userMessage = 'Your license has expired or is not valid.';
      error.nextSteps = 'Renew your license to continue using the platform.';
      error.helpUrl = 'https://help.example.com/license-renewal'; // TODO
      error.statusCode = 403;
      throw error;
    }

    const canActivate = await this.licenseModel.canActivateDevice(license);
    if (!canActivate) {
      const error: any = new Error('License device limit reached');
      error.code = ErrorCodes.DEVICE_CONFLICT;
      error.userMessage =
        'You have reached the maximum number of devices for this license.';
      error.nextSteps =
        'Deactivate an old device or contact support to manage your devices.';
      error.helpUrl = 'https://help.example.com/device-management'; // TODO
      error.statusCode = 403;
      throw error;
    }

    // Update license with user ID
    await this.licenseModel.update(license.id, { user_id: userId });

    // Create new device
    const deviceInput: CreateDeviceInput = {
      license_id: license.id,
      user_id: userId,
      ...deviceInfo,
    };
    const device = await this.deviceModel.create(deviceInput);
    await this.licenseModel.incrementActivatedDevices(license.id);

    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new AuthenticationError('User not found');
    }

    const tokens = this.generateTokens(user.id, device.id);

    return {
      user,
      license,
      device,
      tokens,
      requiresLicenseActivation: false,
    };
  }

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      const decoded = jwt.verify(refreshToken, this.JWT_REFRESH_SECRET) as {
        userId: string;
        deviceId?: string;
      };

      const user = await this.userModel.findById(decoded.userId);
      if (!user || !user.is_active) {
        throw new AuthenticationError('Invalid refresh token');
      }

      if (decoded.deviceId) {
        const device = await this.deviceModel.findById(decoded.deviceId);
        if (!device || !device.is_active) {
          throw new AuthenticationError('Device not active');
        }
      }

      return this.generateTokens(decoded.userId, decoded.deviceId);
    } catch (error) {
      throw new AuthenticationError('Invalid refresh token');
    }
  }

  async deactivateDevice(userId: string, deviceId: string): Promise<void> {
    const device = await this.deviceModel.findById(deviceId);
    if (!device) {
      throw new ValidationError('Device not found');
    }

    if (device.user_id !== userId) {
      throw new AuthenticationError('Unauthorized to deactivate this device');
    }

    await this.deviceModel.deactivate(deviceId);
    await this.licenseModel.decrementActivatedDevices(device.license_id);
  }

  async getDeviceInfo(req: Request): Promise<DeviceInfo> {
    const deviceFingerprint = await generateDeviceFingerprint(req);
    const userAgent = req.headers['user-agent'] || '';
    const ipAddress = req.ip;

    return {
      device_fingerprint: deviceFingerprint,
      device_name: userAgent,
      device_type: 'web',
      browser_info: {
        userAgent,
        language: req.headers['accept-language'],
        platform: req.headers['sec-ch-ua-platform'],
      },
      ip_address: ipAddress,
    };
  }

  async validateAccessToken(
    token: string,
  ): Promise<{ userId: string; deviceId?: string }> {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET) as {
        userId: string;
        deviceId?: string;
      };

      const user = await this.userModel.findById(decoded.userId);
      if (!user || !user.is_active) {
        throw new AuthenticationError('Invalid access token');
      }

      if (decoded.deviceId) {
        const device = await this.deviceModel.findById(decoded.deviceId);
        if (!device || !device.is_active) {
          throw new AuthenticationError('Device not active');
        }

        // Update device last active timestamp
        await this.deviceModel.updateLastActive(device.id);

        // Verify license is still valid
        const license = await this.licenseModel.findById(device.license_id);
        if (!license || !(await this.licenseModel.isLicenseValid(license))) {
          throw new LicenseError('License is not valid or has expired');
        }
      }

      return decoded;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthenticationError('Invalid access token');
      }
      throw error;
    }
  }
}
