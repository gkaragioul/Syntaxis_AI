import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { LogSanitizer } from '../utils/logSanitizer';
import { encrypt, decrypt } from '../utils/encryption';
import { BaseError } from '../utils/errors';
import { ErrorCode } from '../types/errors';
import { NotificationService } from './NotificationService';
import { AuditLogService } from './AuditLogService';

interface DeviceInfo {
  os: string;
  browser: string;
  deviceType: string;
  ipAddress: string;
  userAgent: string;
  screenResolution?: string;
  timezone?: string;
}

interface DeviceActivationResult {
  device: {
    id: string;
    status: string;
    activatedAt: Date;
    deviceInfo: DeviceInfo;
  };
  conflict?: {
    deviceId: string;
    activatedAt: Date;
    deviceInfo: DeviceInfo;
  };
}

export class DeviceService {
  private notificationService: NotificationService;
  private auditLogService: AuditLogService;

  constructor() {
    this.notificationService = new NotificationService();
    this.auditLogService = new AuditLogService();
  }

  /**
   * Get all devices for a license
   */
  async getDevicesForLicense(
    licenseId: string,
    userId: string,
  ): Promise<any[]> {
    const devices = await prisma.device.findMany({
      where: {
        licenseId,
        license: {
          userId, // Ensure user owns the license
        },
      },
      orderBy: {
        activatedAt: 'desc',
      },
    });

    // Decrypt device info
    return devices.map((device) => ({
      ...device,
      deviceInfo: JSON.parse(decrypt(device.deviceInfo)),
    }));
  }

  /**
   * Activate a license on the current device
   */
  async activateDevice(
    licenseId: string,
    userId: string,
    deviceInfo: DeviceInfo,
    fingerprint: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<DeviceActivationResult> {
    // Start a transaction
    return await prisma.$transaction(async (tx) => {
      // Verify license ownership and status
      const license = await tx.license.findFirst({
        where: {
          id: licenseId,
          userId,
          status: 'active',
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        include: {
          devices: {
            where: {
              status: 'active',
              deactivatedAt: null,
            },
          },
        },
      });

      if (!license) {
        throw new BaseError({
          code: ErrorCode.LICENSE_EXPIRED,
          message: 'License not found or expired',
          statusCode: 404,
        });
      }

      // Check for active devices
      if (license.devices.length >= license.maxDevices) {
        const conflictingDevice = license.devices[0];
        const { logId } = LogSanitizer.sanitizeAndLog(
          {
            licenseId,
            userId,
            deviceInfo,
            fingerprint,
            conflict: {
              deviceId: conflictingDevice.id,
              activatedAt: conflictingDevice.activatedAt,
            },
          },
          'warn',
          'Device activation conflict',
        );

        // Create audit log
        await this.auditLogService.log({
          userId,
          action: 'device.activation_conflict',
          resourceType: 'device',
          resourceId: conflictingDevice.id,
          metadata: {
            licenseId,
            fingerprint,
            logId,
          },
          ipAddress,
          userAgent,
        });

        return {
          device: null,
          conflict: {
            deviceId: conflictingDevice.id,
            activatedAt: conflictingDevice.activatedAt,
            deviceInfo: JSON.parse(decrypt(conflictingDevice.deviceInfo)),
          },
        };
      }

      // Create new device
      const encryptedDeviceInfo = encrypt(JSON.stringify(deviceInfo));
      const device = await tx.device.create({
        data: {
          licenseId,
          deviceInfo: encryptedDeviceInfo,
          fingerprint,
          status: 'active',
        },
      });

      // Create audit log
      await this.auditLogService.log({
        userId,
        action: 'device.activated',
        resourceType: 'device',
        resourceId: device.id,
        metadata: {
          licenseId,
          fingerprint,
        },
        ipAddress,
        userAgent,
      });

      // Send notification
      await this.notificationService.createNotification({
        userId,
        type: 'device.activated',
        title: 'Device Activated',
        message: `Your license has been activated on a new device (${deviceInfo.deviceType})`,
        metadata: {
          deviceId: device.id,
          deviceInfo,
        },
      });

      return {
        device: {
          id: device.id,
          status: device.status,
          activatedAt: device.activatedAt,
          deviceInfo,
        },
      };
    });
  }

  /**
   * Deactivate a device
   */
  async deactivateDevice(
    deviceId: string,
    licenseId: string,
    userId: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<void> {
    return await prisma.$transaction(async (tx) => {
      const device = await tx.device.findFirst({
        where: {
          id: deviceId,
          licenseId,
          license: {
            userId, // Ensure user owns the license
          },
        },
      });

      if (!device) {
        throw new BaseError({
          code: ErrorCode.DEVICE_NOT_FOUND,
          message: 'Device not found',
          statusCode: 404,
        });
      }

      if (device.status === 'deactivated') {
        throw new BaseError({
          code: ErrorCode.DEVICE_ALREADY_DEACTIVATED,
          message: 'Device is already deactivated',
          statusCode: 400,
        });
      }

      // Update device status
      await tx.device.update({
        where: { id: deviceId },
        data: {
          status: 'deactivated',
          deactivatedAt: new Date(),
        },
      });

      // Create audit log
      await this.auditLogService.log({
        userId,
        action: 'device.deactivated',
        resourceType: 'device',
        resourceId: deviceId,
        metadata: {
          licenseId,
          deviceInfo: JSON.parse(decrypt(device.deviceInfo)),
        },
        ipAddress,
        userAgent,
      });

      // Send notification
      await this.notificationService.createNotification({
        userId,
        type: 'device.deactivated',
        title: 'Device Deactivated',
        message: 'A device has been deactivated from your license',
        metadata: {
          deviceId,
          deviceInfo: JSON.parse(decrypt(device.deviceInfo)),
        },
      });
    });
  }

  /**
   * Update device last seen timestamp
   */
  async updateDeviceLastSeen(
    deviceId: string,
    licenseId: string,
  ): Promise<void> {
    await prisma.device.update({
      where: {
        id: deviceId,
        licenseId,
      },
      data: {
        lastSeenAt: new Date(),
      },
    });
  }
}
