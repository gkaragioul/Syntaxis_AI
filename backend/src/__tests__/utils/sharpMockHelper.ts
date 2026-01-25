/**
 * Sharp Mock Helper for TDD
 * 
 * Task 1.1.1: Fix Sharp library mocking in OCR service tests
 * 
 * This utility provides a centralized way to set up Sharp mocks
 * that work with the OCR service's import pattern.
 */

import { jest } from '@jest/globals';

export interface MockSharpInstance {
  grayscale: jest.MockedFunction<any>;
  modulate: jest.MockedFunction<any>;
  threshold: jest.MockedFunction<any>;
  median: jest.MockedFunction<any>;
  blur: jest.MockedFunction<any>;
  sharpen: jest.MockedFunction<any>;
  resize: jest.MockedFunction<any>;
  rotate: jest.MockedFunction<any>;
  flip: jest.MockedFunction<any>;
  flop: jest.MockedFunction<any>;
  crop: jest.MockedFunction<any>;
  extend: jest.MockedFunction<any>;
  extract: jest.MockedFunction<any>;
  trim: jest.MockedFunction<any>;
  toColorspace: jest.MockedFunction<any>;
  toColourspace: jest.MockedFunction<any>;
  composite: jest.MockedFunction<any>;
  toBuffer: jest.MockedFunction<any>;
  toFile: jest.MockedFunction<any>;
  png: jest.MockedFunction<any>;
  jpeg: jest.MockedFunction<any>;
  webp: jest.MockedFunction<any>;
  tiff: jest.MockedFunction<any>;
  avif: jest.MockedFunction<any>;
  metadata: jest.MockedFunction<any>;
  stats: jest.MockedFunction<any>;
}

export interface MockSharpFactory {
  mockSharp: jest.MockedFunction<any>;
  mockInstance: MockSharpInstance;
  resetMocks: () => void;
  setupSuccessfulProcessing: () => void;
  setupFailedProcessing: (errorMessage?: string) => void;
}

/**
 * Creates a comprehensive Sharp mock that supports all OCR service operations
 */
export const createSharpMock = (): MockSharpFactory => {
  const mockInstance: MockSharpInstance = {
    // Image processing methods - all return this for chaining
    grayscale: jest.fn().mockReturnThis(),
    modulate: jest.fn().mockReturnThis(),
    threshold: jest.fn().mockReturnThis(),
    median: jest.fn().mockReturnThis(),
    blur: jest.fn().mockReturnThis(),
    sharpen: jest.fn().mockReturnThis(),
    resize: jest.fn().mockReturnThis(),
    rotate: jest.fn().mockReturnThis(),
    flip: jest.fn().mockReturnThis(),
    flop: jest.fn().mockReturnThis(),
    crop: jest.fn().mockReturnThis(),
    extend: jest.fn().mockReturnThis(),
    extract: jest.fn().mockReturnThis(),
    trim: jest.fn().mockReturnThis(),
    
    // Color space methods
    toColorspace: jest.fn().mockReturnThis(),
    toColourspace: jest.fn().mockReturnThis(),
    
    // Composite methods
    composite: jest.fn().mockReturnThis(),
    
    // Output methods
    toBuffer: jest.fn(() => Promise.resolve(Buffer.from('processed image data'))),
    toFile: jest.fn(() => Promise.resolve({ 
      format: 'jpeg', 
      width: 1000, 
      height: 800, 
      channels: 3, 
      premultiplied: false, 
      size: 12345 
    })),
    
    // Format methods
    png: jest.fn().mockReturnThis(),
    jpeg: jest.fn().mockReturnThis(),
    webp: jest.fn().mockReturnThis(),
    tiff: jest.fn().mockReturnThis(),
    avif: jest.fn().mockReturnThis(),
    
    // Metadata method
    metadata: jest.fn(() => Promise.resolve({ 
      width: 1000, 
      height: 800, 
      format: 'jpeg',
      channels: 3,
      density: 300,
      hasProfile: false,
      hasAlpha: false,
      orientation: 1
    })),
    
    // Statistics methods
    stats: jest.fn(() => Promise.resolve({
      channels: [
        { min: 0, max: 255, sum: 128000, squaresSum: 16384000, mean: 128, stdev: 64 }
      ]
    })),
  };

  // Create the main Sharp function that returns a new instance
  const mockSharp = jest.fn(() => {
    // Return a new instance for each call to support concurrent operations
    return { ...mockInstance };
  });

  const resetMocks = () => {
    Object.values(mockInstance).forEach(mock => {
      if (jest.isMockFunction(mock)) {
        mock.mockClear();
      }
    });
    mockSharp.mockClear();
  };

  const setupSuccessfulProcessing = () => {
    // Reset all mocks first
    resetMocks();
    
    // Set up successful processing chain
    mockInstance.metadata.mockResolvedValue({
      width: 1000,
      height: 800,
      format: 'jpeg',
      channels: 3,
      density: 300,
      hasProfile: false,
      hasAlpha: false,
      orientation: 1
    });
    
    mockInstance.toBuffer.mockResolvedValue(Buffer.from('processed image data'));
    
    // Ensure all processing methods return this for chaining
    Object.keys(mockInstance).forEach(key => {
      const method = mockInstance[key as keyof MockSharpInstance];
      if (jest.isMockFunction(method) && !['toBuffer', 'toFile', 'metadata', 'stats'].includes(key)) {
        method.mockReturnThis();
      }
    });
  };

  const setupFailedProcessing = (errorMessage = 'Sharp processing failed') => {
    resetMocks();
    
    // Set up failed processing
    mockInstance.metadata.mockRejectedValue(new Error(errorMessage));
    mockInstance.toBuffer.mockRejectedValue(new Error(errorMessage));
  };

  return {
    mockSharp,
    mockInstance,
    resetMocks,
    setupSuccessfulProcessing,
    setupFailedProcessing,
  };
};

/**
 * Sets up Sharp mock for the entire test suite
 * Call this in beforeAll or beforeEach
 *
 * This handles the specific import pattern used by OCR service:
 * import sharp from 'sharp';
 */
export const setupSharpMock = (): MockSharpFactory => {
  const mockFactory = createSharpMock();

  // Mock the Sharp module to handle default import pattern
  jest.doMock('sharp', () => {
    // OCR service uses: import sharp from 'sharp'
    // Then calls: sharp(buffer)
    // So we need to return the function directly as default export
    return mockFactory.mockSharp;
  });

  return mockFactory;
};

/**
 * Sets up Sharp mock for namespace import pattern
 * Use this for tests that import Sharp as: import * as sharp from 'sharp'
 */
export const setupSharpMockForNamespace = (): MockSharpFactory => {
  const mockFactory = createSharpMock();

  // Mock for namespace import pattern
  jest.doMock('sharp', () => {
    return {
      __esModule: true,
      default: mockFactory.mockSharp,
      // For namespace imports, also provide the function directly
      ...mockFactory.mockInstance,
    };
  });

  return mockFactory;
};

/**
 * Cleans up Sharp mock after tests
 * Call this in afterAll or afterEach
 */
export const cleanupSharpMock = () => {
  jest.dontMock('sharp');
  jest.resetModules();
};
