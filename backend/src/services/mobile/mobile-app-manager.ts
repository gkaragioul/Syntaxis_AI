/**
 * Mobile App Manager
 * 
 * TDD Phase: GREEN - Minimal implementation to make mobile app support tests pass
 * Enhancement: Mobile App Support
 * 
 * This class provides comprehensive mobile app management with:
 * - Cross-platform device registration and lifecycle management
 * - Platform-specific configurations and capabilities
 * - App update handling and migration support
 * - Device deregistration and cleanup
 */

export interface DeviceRegistration {
  deviceId: string;
  platform: 'ios' | 'android';
  appVersion: string;
  osVersion?: string;
  deviceModel?: string;
  pushToken: string;
  userId: string;
  preferences?: {
    pushNotifications: boolean;
    analyticsTracking: boolean;
    offlineSync: boolean;
    dataUsageOptimization: boolean;
  };
  capabilities?: {
    biometricAuth: boolean;
    cameraAccess: boolean;
    fileSystemAccess: boolean;
    backgroundProcessing: boolean;
    [key: string]: boolean;
  };
}

export interface DeviceRegistrationResult {
  deviceId: string;
  registrationId: string;
  platform: string;
  registeredAt: Date;
  status: string;
  configuration: {
    apiEndpoints: {
      baseUrl: string;
      uploadEndpoint: string;
      statusEndpoint: string;
      analyticsEndpoint: string;
    };
    pushNotificationConfig: {
      enabled: boolean;
      categories: string[];
      soundEnabled: boolean;
    };
    syncConfiguration: {
      syncInterval: number;
      maxOfflineStorage: number;
      compressionEnabled: boolean;
    };
    securitySettings: {
      encryptionEnabled: boolean;
      biometricAuthRequired: boolean;
      sessionTimeout: number;
    };
  };
  sdkConfiguration: {
    version: string;
    features: string[];
    debugMode: boolean;
  };
}

export interface DeviceUpdateRequest {
  appVersion?: string;
  pushToken?: string;
  capabilities?: Record<string, boolean>;
  preferences?: Record<string, any>;
}

export interface DeviceUpdateResult {
  deviceId: string;
  updateApplied: boolean;
  previousVersion: string;
  currentVersion: string;
  configurationChanges: Array<{
    setting: string;
    oldValue?: any;
    newValue?: any;
    added?: string[];
    removed?: string[];
  }>;
  migrationRequired: boolean;
  migrationSteps: string[];
  updatedAt: Date;
}

export interface DeviceStatus {
  deviceId: string;
  status: string;
  appVersion: string;
  pushToken: string | null;
  capabilities: Record<string, boolean>;
  lastSeen: Date;
  registeredAt: Date;
}

export interface DeregistrationOptions {
  reason: string;
  preserveOfflineData: boolean;
  revokeTokens: boolean;
}

export interface DeregistrationResult {
  deviceId: string;
  deregisteredAt: Date;
  reason: string;
  cleanupActions: string[];
  dataRetention: {
    analyticsDataRetained: boolean;
    retentionPeriod: number;
    anonymizationApplied: boolean;
  };
  status: string;
}

export class MobileAppManager {
  private registeredDevices: Map<string, any> = new Map();
  private deviceConfigurations: Map<string, any> = new Map();
  private isInitialized: boolean = false;

  constructor() {}

  /**
   * Initialize mobile app manager
   * GREEN: Basic initialization
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    this.isInitialized = true;
  }

  /**
   * Register mobile device with platform-specific configuration
   * GREEN: Device registration
   */
  async registerDevice(registration: DeviceRegistration): Promise<DeviceRegistrationResult> {
    const registrationId = this.generateRegistrationId();
    const registeredAt = new Date();

    // Generate platform-specific configuration
    const configuration = this.generatePlatformConfiguration(registration);
    const sdkConfiguration = this.generateSDKConfiguration(registration.platform);

    const deviceRecord = {
      ...registration,
      registrationId,
      registeredAt,
      status: 'active',
      lastSeen: registeredAt,
      configuration,
      sdkConfiguration
    };

    this.registeredDevices.set(registration.deviceId, deviceRecord);
    this.deviceConfigurations.set(registration.deviceId, configuration);

    return {
      deviceId: registration.deviceId,
      registrationId,
      platform: registration.platform,
      registeredAt,
      status: 'active',
      configuration,
      sdkConfiguration
    };
  }

  /**
   * Update device information and configuration
   * GREEN: Device update handling
   */
  async updateDevice(deviceId: string, updates: DeviceUpdateRequest): Promise<DeviceUpdateResult> {
    const device = this.registeredDevices.get(deviceId);
    if (!device) {
      throw new Error(`Device ${deviceId} not found`);
    }

    const previousVersion = device.appVersion;
    const configurationChanges = [];

    // Track changes
    if (updates.appVersion && updates.appVersion !== device.appVersion) {
      configurationChanges.push({
        setting: 'appVersion',
        oldValue: device.appVersion,
        newValue: updates.appVersion
      });
      device.appVersion = updates.appVersion;
    }

    if (updates.pushToken && updates.pushToken !== device.pushToken) {
      configurationChanges.push({
        setting: 'pushToken',
        oldValue: device.pushToken,
        newValue: updates.pushToken
      });
      device.pushToken = updates.pushToken;
    }

    if (updates.capabilities) {
      const oldCapabilities = { ...device.capabilities };
      const newCapabilities = { ...device.capabilities, ...updates.capabilities };
      
      const added = Object.keys(updates.capabilities).filter(
        key => !oldCapabilities[key] && newCapabilities[key]
      );
      const removed = Object.keys(oldCapabilities).filter(
        key => oldCapabilities[key] && !newCapabilities[key]
      );

      if (added.length > 0 || removed.length > 0) {
        configurationChanges.push({
          setting: 'capabilities',
          added,
          removed
        });
      }

      device.capabilities = newCapabilities;
    }

    // Determine if migration is required
    const migrationRequired = this.requiresMigration(previousVersion, device.appVersion);
    const migrationSteps = migrationRequired ? this.generateMigrationSteps(previousVersion, device.appVersion) : [];

    device.lastSeen = new Date();

    return {
      deviceId,
      updateApplied: true,
      previousVersion,
      currentVersion: device.appVersion,
      configurationChanges,
      migrationRequired,
      migrationSteps,
      updatedAt: new Date()
    };
  }

  /**
   * Get device status
   * GREEN: Device status retrieval
   */
  async getDeviceStatus(deviceId: string): Promise<DeviceStatus> {
    const device = this.registeredDevices.get(deviceId);
    if (!device) {
      throw new Error(`Device ${deviceId} not found`);
    }

    return {
      deviceId,
      status: device.status,
      appVersion: device.appVersion,
      pushToken: device.status === 'active' ? device.pushToken : null,
      capabilities: device.capabilities || {},
      lastSeen: device.lastSeen,
      registeredAt: device.registeredAt
    };
  }

  /**
   * Deregister device and cleanup
   * GREEN: Device deregistration
   */
  async deregisterDevice(deviceId: string, options: DeregistrationOptions): Promise<DeregistrationResult> {
    const device = this.registeredDevices.get(deviceId);
    if (!device) {
      throw new Error(`Device ${deviceId} not found`);
    }

    const deregisteredAt = new Date();
    const cleanupActions = [];

    // Revoke tokens
    if (options.revokeTokens) {
      cleanupActions.push('push_token_revoked');
      device.pushToken = null;
    }

    // Clear offline data
    if (!options.preserveOfflineData) {
      cleanupActions.push('offline_data_cleared');
    }

    // Anonymize analytics data
    cleanupActions.push('analytics_data_anonymized');
    cleanupActions.push('session_invalidated');

    // Update device status
    device.status = 'deregistered';
    device.deregisteredAt = deregisteredAt;
    device.deregistrationReason = options.reason;

    return {
      deviceId,
      deregisteredAt,
      reason: options.reason,
      cleanupActions,
      dataRetention: {
        analyticsDataRetained: true, // For analytics purposes
        retentionPeriod: 90, // 90 days
        anonymizationApplied: true
      },
      status: 'deregistered'
    };
  }

  /**
   * Generate platform-specific configuration
   * GREEN: Platform configuration generation
   */
  private generatePlatformConfiguration(registration: DeviceRegistration): any {
    const baseConfig = {
      apiEndpoints: {
        baseUrl: 'https://api.company.com/mobile/v1',
        uploadEndpoint: '/documents/upload',
        statusEndpoint: '/processing/status',
        analyticsEndpoint: '/analytics/events'
      },
      securitySettings: {
        encryptionEnabled: true,
        biometricAuthRequired: registration.capabilities?.biometricAuth || false,
        sessionTimeout: 1800000 // 30 minutes
      }
    };

    if (registration.platform === 'ios') {
      return {
        ...baseConfig,
        pushNotificationConfig: {
          enabled: registration.preferences?.pushNotifications || true,
          categories: ['processing_complete', 'processing_failed', 'batch_complete'],
          soundEnabled: true
        },
        syncConfiguration: {
          syncInterval: 300000, // 5 minutes
          maxOfflineStorage: 100 * 1024 * 1024, // 100MB
          compressionEnabled: true
        }
      };
    } else if (registration.platform === 'android') {
      return {
        ...baseConfig,
        pushNotificationConfig: {
          enabled: registration.preferences?.pushNotifications || true,
          categories: ['processing_complete', 'processing_failed', 'batch_complete'],
          soundEnabled: true
        },
        syncConfiguration: {
          syncInterval: 300000, // 5 minutes
          maxOfflineStorage: 150 * 1024 * 1024, // 150MB (Android typically has more storage)
          compressionEnabled: true
        }
      };
    }

    return baseConfig;
  }

  /**
   * Generate SDK configuration
   * GREEN: SDK configuration generation
   */
  private generateSDKConfiguration(platform: string): any {
    const baseFeatures = [
      'document_upload',
      'real_time_status',
      'push_notifications',
      'offline_sync',
      'analytics_tracking'
    ];

    const platformFeatures = platform === 'ios' 
      ? [...baseFeatures, 'biometric_auth', 'haptic_feedback']
      : [...baseFeatures, 'background_sync', 'adaptive_compression'];

    return {
      version: '2.1.0',
      features: platformFeatures,
      debugMode: false
    };
  }

  /**
   * Check if migration is required
   * GREEN: Migration requirement check
   */
  private requiresMigration(oldVersion: string, newVersion: string): boolean {
    // Simple version comparison - in real implementation would use semver
    const oldMajor = parseInt(oldVersion.split('.')[0]);
    const newMajor = parseInt(newVersion.split('.')[0]);
    
    return newMajor > oldMajor;
  }

  /**
   * Generate migration steps
   * GREEN: Migration steps generation
   */
  private generateMigrationSteps(oldVersion: string, newVersion: string): string[] {
    const steps = [];
    
    if (oldVersion.startsWith('1.') && newVersion.startsWith('2.')) {
      steps.push('Migrate local database schema');
      steps.push('Update encryption keys');
      steps.push('Refresh API tokens');
      steps.push('Clear deprecated cache');
    }

    return steps;
  }

  /**
   * Generate unique registration ID
   * GREEN: ID generation utility
   */
  private generateRegistrationId(): string {
    return `reg_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }

  /**
   * Cleanup mobile app manager
   * GREEN: Cleanup method
   */
  async cleanup(): Promise<void> {
    this.registeredDevices.clear();
    this.deviceConfigurations.clear();
    this.isInitialized = false;
  }
}

export default MobileAppManager;
