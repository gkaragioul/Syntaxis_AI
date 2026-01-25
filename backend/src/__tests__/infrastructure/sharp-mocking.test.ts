/**
 * Sharp Library Mocking Tests
 *
 * TDD Phase: RED - These tests should fail initially
 * Task: 1.1.1 - Sharp Library Mocking (Priority 2)
 *
 * Following the scratchpad plan (lines 160-241), these tests define the expected behavior
 * for Sharp library mocking with extreme modularity and best practices:
 *
 * 1. Proper module-level mocking of Sharp library
 * 2. Mock Sharp instance creation and method chaining
 * 3. Mock image processing operations
 * 4. Mock metadata extraction
 * 5. Mock error handling and edge cases
 *
 * This addresses the Sharp library mocking issues identified in the scratchpad.
 */

import { SharpMockManager } from '../utils/sharp-mock-manager';
import { jest } from '@jest/globals';

// Mock Sharp at module level
jest.mock('sharp', () => {
  return jest.fn();
});

describe('Sharp Library Mocking Infrastructure - TDD Foundation Repair', () => {
  let sharpMockManager: SharpMockManager;
  let mockSharp: jest.Mock;

  beforeAll(async () => {
    // RED: These should fail - we need SharpMockManager class
    sharpMockManager = new SharpMockManager();
    await sharpMockManager.initialize();
  });

  beforeEach(async () => {
    // Reset mocks before each test
    sharpMockManager.resetMocks();

    // Get the mocked Sharp constructor
    mockSharp = sharpMockManager.getMockSharp();
  });

  afterEach(() => {
    sharpMockManager.clearMocks();
  });

  afterAll(async () => {
    await sharpMockManager.cleanup();
  });

  describe('Sharp Module-Level Mocking', () => {
    it('should properly mock Sharp constructor at module level', async () => {
      // RED: This test should fail - we need proper Sharp constructor mocking
      const mockSharpInstance = sharpMockManager.createMockInstance();
      mockSharp.mockReturnValue(mockSharpInstance);

      // Test Sharp constructor call
      const sharp = require('sharp');
      const instance = sharp('test-image.jpg');

      expect(sharp).toHaveBeenCalledWith('test-image.jpg');
      expect(instance).toBe(mockSharpInstance);
      expect(mockSharp).toHaveBeenCalledTimes(1);
    });

    it('should mock Sharp constructor with buffer input', async () => {
      // RED: This test should fail - we need buffer input mocking
      const testBuffer = Buffer.from('fake-image-data');
      const mockSharpInstance = sharpMockManager.createMockInstance();
      mockSharp.mockReturnValue(mockSharpInstance);

      const sharp = require('sharp');
      const instance = sharp(testBuffer);

      expect(sharp).toHaveBeenCalledWith(testBuffer);
      expect(instance).toBe(mockSharpInstance);
    });

    it('should mock Sharp constructor with options', async () => {
      // RED: This test should fail - we need options mocking
      const options = { density: 300, page: 0 };
      const mockSharpInstance = sharpMockManager.createMockInstance();
      mockSharp.mockReturnValue(mockSharpInstance);

      const sharp = require('sharp');
      const instance = sharp('test.pdf', options);

      expect(sharp).toHaveBeenCalledWith('test.pdf', options);
      expect(instance).toBe(mockSharpInstance);
    });

    it('should handle Sharp constructor errors', async () => {
      // RED: This test should fail - we need error handling
      const error = new Error('Invalid image format');
      mockSharp.mockImplementation(() => {
        throw error;
      });

      const sharp = require('sharp');

      expect(() => sharp('invalid-file.xyz')).toThrow('Invalid image format');
      expect(mockSharp).toHaveBeenCalledWith('invalid-file.xyz');
    });
  });

  describe('Sharp Instance Method Chaining', () => {
    it('should mock Sharp method chaining for image processing', async () => {
      // RED: This test should fail - we need method chaining mocks
      const mockInstance = sharpMockManager.createMockInstance();
      const mockBuffer = Buffer.from('processed-image-data');

      // Setup method chaining mocks
      mockInstance.resize.mockReturnValue(mockInstance);
      mockInstance.jpeg.mockReturnValue(mockInstance);
      mockInstance.toBuffer.mockResolvedValue(mockBuffer);

      mockSharp.mockReturnValue(mockInstance);

      // Test method chaining
      const sharp = require('sharp');
      const result = await sharp('input.jpg')
        .resize(800, 600)
        .jpeg({ quality: 80 })
        .toBuffer();

      expect(mockInstance.resize).toHaveBeenCalledWith(800, 600);
      expect(mockInstance.jpeg).toHaveBeenCalledWith({ quality: 80 });
      expect(mockInstance.toBuffer).toHaveBeenCalled();
      expect(result).toBe(mockBuffer);
    });

    it('should mock complex image transformation chains', async () => {
      // RED: This test should fail - we need complex transformation mocking
      const mockInstance = sharpMockManager.createMockInstance();
      const mockBuffer = Buffer.from('transformed-image');

      // Setup complex transformation chain
      mockInstance.rotate.mockReturnValue(mockInstance);
      mockInstance.flip.mockReturnValue(mockInstance);
      mockInstance.flop.mockReturnValue(mockInstance);
      mockInstance.grayscale.mockReturnValue(mockInstance);
      mockInstance.blur.mockReturnValue(mockInstance);
      mockInstance.sharpen.mockReturnValue(mockInstance);
      mockInstance.png.mockReturnValue(mockInstance);
      mockInstance.toBuffer.mockResolvedValue(mockBuffer);

      mockSharp.mockReturnValue(mockInstance);

      const sharp = require('sharp');
      const result = await sharp('input.jpg')
        .rotate(90)
        .flip()
        .flop()
        .grayscale()
        .blur(2)
        .sharpen()
        .png({ compressionLevel: 9 })
        .toBuffer();

      expect(mockInstance.rotate).toHaveBeenCalledWith(90);
      expect(mockInstance.flip).toHaveBeenCalled();
      expect(mockInstance.flop).toHaveBeenCalled();
      expect(mockInstance.grayscale).toHaveBeenCalled();
      expect(mockInstance.blur).toHaveBeenCalledWith(2);
      expect(mockInstance.sharpen).toHaveBeenCalled();
      expect(mockInstance.png).toHaveBeenCalledWith({ compressionLevel: 9 });
      expect(result).toBe(mockBuffer);
    });

    it('should mock file output operations', async () => {
      // RED: This test should fail - we need file output mocking
      const mockInstance = sharpMockManager.createMockInstance();
      const outputPath = '/tmp/output.jpg';

      mockInstance.resize.mockReturnValue(mockInstance);
      mockInstance.jpeg.mockReturnValue(mockInstance);
      mockInstance.toFile.mockResolvedValue({
        format: 'jpeg',
        width: 800,
        height: 600,
        channels: 3,
        premultiplied: false,
        size: 45678
      });

      mockSharp.mockReturnValue(mockInstance);

      const sharp = require('sharp');
      const info = await sharp('input.jpg')
        .resize(800, 600)
        .jpeg({ quality: 85 })
        .toFile(outputPath);

      expect(mockInstance.toFile).toHaveBeenCalledWith(outputPath);
      expect(info).toEqual({
        format: 'jpeg',
        width: 800,
        height: 600,
        channels: 3,
        premultiplied: false,
        size: 45678
      });
    });
  });

  describe('Sharp Metadata Extraction Mocking', () => {
    it('should mock metadata() method for image information', async () => {
      // RED: This test should fail - we need metadata mocking
      const mockInstance = sharpMockManager.createMockInstance();
      const mockMetadata = {
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
        orientation: 1,
        exif: Buffer.from('exif-data'),
        icc: Buffer.from('icc-profile')
      };

      mockInstance.metadata.mockResolvedValue(mockMetadata);
      mockSharp.mockReturnValue(mockInstance);

      const sharp = require('sharp');
      const metadata = await sharp('test-image.jpg').metadata();

      expect(mockInstance.metadata).toHaveBeenCalled();
      expect(metadata).toEqual(mockMetadata);
    });

    it('should mock stats() method for image statistics', async () => {
      // RED: This test should fail - we need stats mocking
      const mockInstance = sharpMockManager.createMockInstance();
      const mockStats = {
        channels: [
          { min: 0, max: 255, sum: 12345678, squaresSum: 987654321, mean: 128.5, stdev: 45.2, minX: 10, minY: 20, maxX: 100, maxY: 200 },
          { min: 0, max: 255, sum: 11234567, squaresSum: 876543210, mean: 125.3, stdev: 42.1, minX: 15, minY: 25, maxX: 105, maxY: 205 },
          { min: 0, max: 255, sum: 13456789, squaresSum: 1098765432, mean: 132.7, stdev: 48.3, minX: 5, minY: 15, maxX: 95, maxY: 195 }
        ],
        isOpaque: true,
        entropy: 7.234
      };

      mockInstance.stats.mockResolvedValue(mockStats);
      mockSharp.mockReturnValue(mockInstance);

      const sharp = require('sharp');
      const stats = await sharp('test-image.jpg').stats();

      expect(mockInstance.stats).toHaveBeenCalled();
      expect(stats).toEqual(mockStats);
    });
  });

  describe('Sharp Error Handling and Edge Cases', () => {
    it('should mock Sharp processing errors', async () => {
      // RED: This test should fail - we need error mocking
      const mockInstance = sharpMockManager.createMockInstance();
      const processingError = new Error('Image processing failed: Unsupported format');

      mockInstance.resize.mockReturnValue(mockInstance);
      mockInstance.toBuffer.mockRejectedValue(processingError);

      mockSharp.mockReturnValue(mockInstance);

      const sharp = require('sharp');

      await expect(
        sharp('corrupted-image.jpg')
          .resize(800, 600)
          .toBuffer()
      ).rejects.toThrow('Image processing failed: Unsupported format');

      expect(mockInstance.resize).toHaveBeenCalledWith(800, 600);
      expect(mockInstance.toBuffer).toHaveBeenCalled();
    });

    it('should mock memory limit errors', async () => {
      // RED: This test should fail - we need memory error mocking
      const mockInstance = sharpMockManager.createMockInstance();
      const memoryError = new Error('Image too large: exceeds memory limit');

      mockInstance.metadata.mockRejectedValue(memoryError);
      mockSharp.mockReturnValue(mockInstance);

      const sharp = require('sharp');

      await expect(
        sharp('huge-image.tiff').metadata()
      ).rejects.toThrow('Image too large: exceeds memory limit');
    });
  });

  describe('Sharp Mock Manager Integration', () => {
    it('should provide mock presets for common scenarios', async () => {
      // RED: This test should fail - we need preset functionality
      const presets = sharpMockManager.getPresets();

      expect(presets).toEqual({
        'successful-jpeg-processing': expect.any(Function),
        'successful-png-processing': expect.any(Function),
        'metadata-extraction': expect.any(Function),
        'processing-error': expect.any(Function),
        'memory-limit-error': expect.any(Function),
        'file-not-found-error': expect.any(Function)
      });

      // Test applying a preset
      sharpMockManager.applyPreset('successful-jpeg-processing');

      const sharp = require('sharp');
      const result = await sharp('test.jpg')
        .resize(800, 600)
        .jpeg({ quality: 80 })
        .toBuffer();

      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('should track Sharp method call statistics', async () => {
      // RED: This test should fail - we need call tracking
      sharpMockManager.enableCallTracking();

      const mockInstance = sharpMockManager.createMockInstance();
      mockInstance.resize.mockReturnValue(mockInstance);
      mockInstance.jpeg.mockReturnValue(mockInstance);
      mockInstance.toBuffer.mockResolvedValue(Buffer.from('test'));

      mockSharp.mockReturnValue(mockInstance);

      const sharp = require('sharp');
      await sharp('test.jpg')
        .resize(800, 600)
        .jpeg({ quality: 80 })
        .toBuffer();

      const stats = sharpMockManager.getCallStatistics();

      expect(stats).toEqual({
        constructorCalls: 1,
        methodCalls: {
          resize: 1,
          jpeg: 1,
          toBuffer: 1
        },
        totalCalls: 4,
        errors: 0
      });
    });
  });
});
