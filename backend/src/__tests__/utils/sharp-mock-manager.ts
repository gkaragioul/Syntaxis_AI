// @ts-nocheck
/**
 * Sharp Mock Manager
 * 
 * TDD Phase: GREEN - Minimal implementation to make Sharp mocking tests pass
 * Task: 1.1.1 - Sharp Library Mocking (Priority 2)
 * 
 * This class provides comprehensive Sharp library mocking with:
 * - Module-level Sharp constructor mocking
 * - Mock instance creation with method chaining
 * - Preset configurations for common scenarios
 * - Call tracking and statistics
 * - Error simulation capabilities
 */

import { jest } from '@jest/globals';

export interface SharpMockInstance {
  // Image processing methods
  resize: jest.Mock;
  rotate: jest.Mock;
  flip: jest.Mock;
  flop: jest.Mock;
  grayscale: jest.Mock;
  blur: jest.Mock;
  sharpen: jest.Mock;
  modulate: jest.Mock;
  threshold: jest.Mock;
  median: jest.Mock;
  
  // Format methods
  jpeg: jest.Mock;
  png: jest.Mock;
  webp: jest.Mock;
  tiff: jest.Mock;
  raw: jest.Mock;
  
  // Output methods
  toBuffer: jest.Mock;
  toFile: jest.Mock;
  
  // Information methods
  metadata: jest.Mock;
  stats: jest.Mock;
  
  // Additional methods
  clone: jest.Mock;
  extract: jest.Mock;
  trim: jest.Mock;
}

export interface SharpCallStatistics {
  constructorCalls: number;
  methodCalls: Record<string, number>;
  totalCalls: number;
  errors: number;
}

export interface SharpPresets {
  [presetName: string]: () => void;
}

export class SharpMockManager {
  private mockSharp: jest.Mock | null = null;
  private isInitialized: boolean = false;
  private callTracking: boolean = false;
  private callStats: SharpCallStatistics = {
    constructorCalls: 0,
    methodCalls: {},
    totalCalls: 0,
    errors: 0
  };
  private presets: SharpPresets = {};

  constructor() {
    this.initializePresets();
  }

  /**
   * Initialize Sharp mock manager
   * GREEN: Basic initialization
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Get the mocked Sharp constructor from Jest
    const sharp = require('sharp');
    this.mockSharp = sharp as jest.Mock;

    this.isInitialized = true;
  }

  /**
   * Get the mocked Sharp constructor
   * GREEN: Simple getter
   */
  getMockSharp(): jest.Mock {
    if (!this.mockSharp) {
      throw new Error('Sharp mock manager not initialized');
    }
    return this.mockSharp;
  }

  /**
   * Create a mock Sharp instance
   * GREEN: Create mock instance with all required methods
   */
  createMockInstance(): SharpMockInstance {
    const mockInstance: SharpMockInstance = {
      // Image processing methods - all return this for chaining
      resize: jest.fn().mockReturnThis(),
      rotate: jest.fn().mockReturnThis(),
      flip: jest.fn().mockReturnThis(),
      flop: jest.fn().mockReturnThis(),
      grayscale: jest.fn().mockReturnThis(),
      blur: jest.fn().mockReturnThis(),
      sharpen: jest.fn().mockReturnThis(),
      modulate: jest.fn().mockReturnThis(),
      threshold: jest.fn().mockReturnThis(),
      median: jest.fn().mockReturnThis(),
      
      // Format methods - all return this for chaining
      jpeg: jest.fn().mockReturnThis(),
      png: jest.fn().mockReturnThis(),
      webp: jest.fn().mockReturnThis(),
      tiff: jest.fn().mockReturnThis(),
      raw: jest.fn().mockReturnThis(),
      
      // Output methods - return promises
      toBuffer: jest.fn().mockResolvedValue(Buffer.from('mock-image-data')),
      toFile: jest.fn().mockResolvedValue({
        format: 'jpeg',
        width: 800,
        height: 600,
        channels: 3,
        premultiplied: false,
        size: 45678
      }),
      
      // Information methods - return promises
      metadata: jest.fn().mockResolvedValue({
        format: 'jpeg',
        width: 1920,
        height: 1080,
        channels: 3,
        depth: 'uchar',
        density: 72,
        chromaSubsampling: '4:2:0',
        isProgressive: false,
        hasProfile: false,
        hasAlpha: false,
        orientation: 1
      }),
      stats: jest.fn().mockResolvedValue({
        channels: [
          { min: 0, max: 255, sum: 12345678, squaresSum: 987654321, mean: 128.5, stdev: 45.2, minX: 10, minY: 20, maxX: 100, maxY: 200 }
        ],
        isOpaque: true,
        entropy: 7.234
      }),
      
      // Additional methods
      clone: jest.fn().mockReturnThis(),
      extract: jest.fn().mockReturnThis(),
      trim: jest.fn().mockReturnThis()
    };

    // Setup call tracking if enabled
    if (this.callTracking) {
      this.setupCallTracking(mockInstance);
    }

    return mockInstance;
  }

  /**
   * Reset all mocks
   * GREEN: Basic mock reset
   */
  resetMocks(): void {
    if (this.mockSharp) {
      this.mockSharp.mockReset();
    }
    
    // Reset call statistics
    this.callStats = {
      constructorCalls: 0,
      methodCalls: {},
      totalCalls: 0,
      errors: 0
    };
  }

  /**
   * Clear all mocks
   * GREEN: Basic mock clearing
   */
  clearMocks(): void {
    if (this.mockSharp) {
      this.mockSharp.mockClear();
    }
    
    // Clear call statistics
    this.callStats = {
      constructorCalls: 0,
      methodCalls: {},
      totalCalls: 0,
      errors: 0
    };
  }

  /**
   * Get available presets
   * GREEN: Return preset configurations
   */
  getPresets(): SharpPresets {
    return { ...this.presets };
  }

  /**
   * Apply a preset configuration
   * GREEN: Basic preset application
   */
  applyPreset(presetName: string): void {
    const preset = this.presets[presetName];
    if (!preset) {
      throw new Error(`Unknown preset: ${presetName}`);
    }
    preset();
  }

  /**
   * Enable call tracking
   * GREEN: Enable statistics tracking
   */
  enableCallTracking(): void {
    this.callTracking = true;
  }

  /**
   * Disable call tracking
   * GREEN: Disable statistics tracking
   */
  disableCallTracking(): void {
    this.callTracking = false;
  }

  /**
   * Get call statistics
   * GREEN: Return current statistics
   */
  getCallStatistics(): SharpCallStatistics {
    return { ...this.callStats };
  }

  /**
   * Cleanup Sharp mock manager
   * GREEN: Basic cleanup
   */
  async cleanup(): Promise<void> {
    this.clearMocks();
    this.isInitialized = false;
    this.callTracking = false;
  }

  /**
   * Initialize preset configurations
   * GREEN: Setup common preset scenarios
   */
  private initializePresets(): void {
    this.presets = {
      'successful-jpeg-processing': () => {
        const mockInstance = this.createMockInstance();
        mockInstance.toBuffer.mockResolvedValue(Buffer.from('processed-jpeg-data'));
        this.mockSharp?.mockReturnValue(mockInstance);
      },
      
      'successful-png-processing': () => {
        const mockInstance = this.createMockInstance();
        mockInstance.toBuffer.mockResolvedValue(Buffer.from('processed-png-data'));
        this.mockSharp?.mockReturnValue(mockInstance);
      },
      
      'metadata-extraction': () => {
        const mockInstance = this.createMockInstance();
        mockInstance.metadata.mockResolvedValue({
          format: 'jpeg',
          width: 1920,
          height: 1080,
          channels: 3,
          density: 300
        });
        this.mockSharp?.mockReturnValue(mockInstance);
      },
      
      'processing-error': () => {
        const mockInstance = this.createMockInstance();
        mockInstance.toBuffer.mockRejectedValue(new Error('Processing failed'));
        this.mockSharp?.mockReturnValue(mockInstance);
      },
      
      'memory-limit-error': () => {
        const mockInstance = this.createMockInstance();
        mockInstance.metadata.mockRejectedValue(new Error('Memory limit exceeded'));
        this.mockSharp?.mockReturnValue(mockInstance);
      },
      
      'file-not-found-error': () => {
        this.mockSharp?.mockImplementation(() => {
          throw new Error('ENOENT: no such file or directory');
        });
      }
    };
  }

  /**
   * Setup call tracking for mock instance
   * GREEN: Basic call tracking setup
   */
  private setupCallTracking(mockInstance: SharpMockInstance): void {
    // Track constructor calls
    if (this.mockSharp) {
      const originalMock = this.mockSharp;
      this.mockSharp = jest.fn((...args) => {
        this.callStats.constructorCalls++;
        this.callStats.totalCalls++;
        return originalMock(...args);
      });
    }

    // Track method calls
    Object.entries(mockInstance).forEach(([methodName, mockMethod]) => {
      if (jest.isMockFunction(mockMethod)) {
        const originalImplementation = mockMethod.getMockImplementation();
        mockMethod.mockImplementation((...args) => {
          if (!this.callStats.methodCalls[methodName]) {
            this.callStats.methodCalls[methodName] = 0;
          }
          this.callStats.methodCalls[methodName]++;
          this.callStats.totalCalls++;
          
          if (originalImplementation) {
            return originalImplementation(...args);
          }
          return mockInstance; // Default to returning this for chaining
        });
      }
    });
  }

  /**
   * Validate mock configuration
   * GREEN: Basic validation
   */
  async validateConfiguration(): Promise<{
    isValid: boolean;
    issues: string[];
    mockCoverage: {
      constructorMocked: boolean;
      commonMethodsMocked: boolean;
      errorHandlingMocked: boolean;
      metadataMocked: boolean;
    };
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check if Sharp constructor is mocked
    const constructorMocked = !!this.mockSharp;
    if (!constructorMocked) {
      issues.push('Sharp constructor not mocked');
    }

    // Check if common methods are available
    const mockInstance = this.createMockInstance();
    const commonMethods = ['resize', 'grayscale', 'toBuffer', 'metadata'];
    const commonMethodsMocked = commonMethods.every(method => 
      mockInstance[method as keyof SharpMockInstance] && 
      jest.isMockFunction(mockInstance[method as keyof SharpMockInstance])
    );

    if (!commonMethodsMocked) {
      issues.push('Not all common methods are mocked');
    }

    // Check error handling
    const errorHandlingMocked = Object.keys(this.presets).some(preset => 
      preset.includes('error')
    );

    // Check metadata mocking
    const metadataMocked = !!mockInstance.metadata;

    const mockCoverage = {
      constructorMocked,
      commonMethodsMocked,
      errorHandlingMocked,
      metadataMocked
    };

    if (issues.length === 0) {
      recommendations.push('Sharp mocking is properly configured');
    } else {
      recommendations.push('Address the identified issues to improve mock coverage');
    }

    return {
      isValid: issues.length === 0,
      issues,
      mockCoverage,
      recommendations
    };
  }
}

export default SharpMockManager;
