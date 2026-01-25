/**
 * Sharp Library Mock Validation Tests
 * 
 * Task 1.1.1: Sharp Library Mocking - TDD Red Phase
 * 
 * These tests validate that our Sharp library mock works correctly
 * and supports all the operations used in the OCR service.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import sharp from 'sharp';

describe('Sharp Library Mock', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('Basic Sharp Operations', () => {
    it('should create Sharp instance from buffer', () => {
      // RED: This test should initially fail until Sharp mock is properly configured
      const buffer = Buffer.from('test image data');
      const instance = sharp(buffer);
      
      expect(instance).toBeDefined();
      expect(typeof instance.resize).toBe('function');
      expect(typeof instance.grayscale).toBe('function');
      expect(typeof instance.toBuffer).toBe('function');
    });

    it('should create Sharp instance from file path', () => {
      const instance = sharp('/path/to/image.jpg');
      
      expect(instance).toBeDefined();
      expect(typeof instance.metadata).toBe('function');
    });

    it('should support method chaining', () => {
      const instance = sharp(Buffer.from('test'))
        .resize(800, 600)
        .grayscale()
        .sharpen();
      
      expect(instance).toBeDefined();
      expect(typeof instance.toBuffer).toBe('function');
    });
  });

  describe('Image Processing Methods', () => {
    let sharpInstance: any;

    beforeEach(() => {
      sharpInstance = sharp(Buffer.from('test image'));
    });

    it('should support resize operation', () => {
      const result = sharpInstance.resize(800, 600);
      
      expect(result).toBe(sharpInstance); // Should return this for chaining
      expect(sharpInstance.resize).toHaveBeenCalledWith(800, 600);
    });

    it('should support grayscale operation', () => {
      const result = sharpInstance.grayscale();
      
      expect(result).toBe(sharpInstance);
      expect(sharpInstance.grayscale).toHaveBeenCalled();
    });

    it('should support threshold operation', () => {
      const result = sharpInstance.threshold(128);
      
      expect(result).toBe(sharpInstance);
      expect(sharpInstance.threshold).toHaveBeenCalledWith(128);
    });

    it('should support blur operation', () => {
      const result = sharpInstance.blur(2);
      
      expect(result).toBe(sharpInstance);
      expect(sharpInstance.blur).toHaveBeenCalledWith(2);
    });

    it('should support sharpen operation', () => {
      const result = sharpInstance.sharpen();
      
      expect(result).toBe(sharpInstance);
      expect(sharpInstance.sharpen).toHaveBeenCalled();
    });

    it('should support modulate operation', () => {
      const result = sharpInstance.modulate({ brightness: 1.2, saturation: 0.8 });
      
      expect(result).toBe(sharpInstance);
      expect(sharpInstance.modulate).toHaveBeenCalledWith({ brightness: 1.2, saturation: 0.8 });
    });
  });

  describe('Output Methods', () => {
    let sharpInstance: any;

    beforeEach(() => {
      sharpInstance = sharp(Buffer.from('test image'));
    });

    it('should support toBuffer operation', async () => {
      const buffer = await sharpInstance.toBuffer();
      
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.toString()).toBe('processed image');
      expect(sharpInstance.toBuffer).toHaveBeenCalled();
    });

    it('should support toFile operation', async () => {
      const result = await sharpInstance.toFile('/path/to/output.jpg');
      
      expect(result).toBeDefined();
      expect(result.format).toBe('jpeg');
      expect(result.width).toBe(1000);
      expect(result.height).toBe(800);
      expect(sharpInstance.toFile).toHaveBeenCalledWith('/path/to/output.jpg');
    });

    it('should support format-specific methods', () => {
      const jpegResult = sharpInstance.jpeg({ quality: 80 });
      expect(jpegResult).toBe(sharpInstance);
      expect(sharpInstance.jpeg).toHaveBeenCalledWith({ quality: 80 });

      const pngResult = sharpInstance.png({ compressionLevel: 6 });
      expect(pngResult).toBe(sharpInstance);
      expect(sharpInstance.png).toHaveBeenCalledWith({ compressionLevel: 6 });
    });
  });

  describe('Metadata Operations', () => {
    let sharpInstance: any;

    beforeEach(() => {
      sharpInstance = sharp(Buffer.from('test image'));
    });

    it('should support metadata operation', async () => {
      const metadata = await sharpInstance.metadata();
      
      expect(metadata).toBeDefined();
      expect(metadata.width).toBe(1000);
      expect(metadata.height).toBe(800);
      expect(metadata.format).toBe('jpeg');
      expect(metadata.channels).toBe(3);
      expect(sharpInstance.metadata).toHaveBeenCalled();
    });

    it('should support stats operation', async () => {
      const stats = await sharpInstance.stats();
      
      expect(stats).toBeDefined();
      expect(stats.channels).toBeDefined();
      expect(Array.isArray(stats.channels)).toBe(true);
      expect(sharpInstance.stats).toHaveBeenCalled();
    });
  });

  describe('Static Methods', () => {
    it('should support cache method', () => {
      sharp.cache(false);
      expect(sharp.cache).toHaveBeenCalledWith(false);
    });

    it('should support concurrency method', () => {
      sharp.concurrency(4);
      expect(sharp.concurrency).toHaveBeenCalledWith(4);
    });

    it('should support counters method', () => {
      const counters = sharp.counters();
      expect(counters).toBeDefined();
      expect(counters.queue).toBe(0);
      expect(counters.process).toBe(0);
    });

    it('should provide format information', () => {
      expect(sharp.format).toBeDefined();
      expect(sharp.format.jpeg).toBeDefined();
      expect(sharp.format.png).toBeDefined();
      expect(sharp.format.webp).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle mock errors gracefully', async () => {
      const sharpInstance = sharp(Buffer.from('test'));
      
      // Mock an error scenario
      sharpInstance.toBuffer.mockRejectedValueOnce(new Error('Processing failed'));
      
      await expect(sharpInstance.toBuffer()).rejects.toThrow('Processing failed');
    });

    it('should allow custom mock behavior', async () => {
      const sharpInstance = sharp(Buffer.from('test'));
      
      // Customize mock behavior
      sharpInstance.metadata.mockResolvedValueOnce({
        width: 1920,
        height: 1080,
        format: 'png',
        channels: 4,
      });
      
      const metadata = await sharpInstance.metadata();
      expect(metadata.width).toBe(1920);
      expect(metadata.height).toBe(1080);
      expect(metadata.format).toBe('png');
    });
  });

  describe('OCR Service Integration', () => {
    it('should support typical OCR preprocessing pipeline', async () => {
      // Simulate the image processing pipeline used in OCR service
      const inputBuffer = Buffer.from('original image data');
      
      const processedBuffer = await sharp(inputBuffer)
        .resize(1200, null, { withoutEnlargement: true })
        .grayscale()
        .modulate({ brightness: 1.1, contrast: 1.2 })
        .threshold(128)
        .sharpen()
        .toBuffer();
      
      expect(processedBuffer).toBeInstanceOf(Buffer);
      expect(processedBuffer.toString()).toBe('processed image');
    });

    it('should support metadata extraction for OCR', async () => {
      const sharpInstance = sharp('/path/to/invoice.pdf');
      
      const metadata = await sharpInstance.metadata();
      
      expect(metadata.width).toBeGreaterThan(0);
      expect(metadata.height).toBeGreaterThan(0);
      expect(metadata.format).toBeDefined();
    });

    it('should support multiple format outputs', async () => {
      const sharpInstance = sharp(Buffer.from('test'));
      
      // Test different output formats
      const jpegResult = await sharpInstance.jpeg({ quality: 90 }).toBuffer();
      expect(jpegResult).toBeInstanceOf(Buffer);
      
      const pngResult = await sharpInstance.png({ compressionLevel: 9 }).toBuffer();
      expect(pngResult).toBeInstanceOf(Buffer);
    });
  });

  describe('Performance and Memory', () => {
    it('should create new instances for each call', () => {
      const instance1 = sharp(Buffer.from('test1'));
      const instance2 = sharp(Buffer.from('test2'));
      
      expect(instance1).not.toBe(instance2);
      expect(instance1.resize).not.toBe(instance2.resize);
    });

    it('should support concurrent operations', async () => {
      const operations = Array.from({ length: 5 }, (_, i) => 
        sharp(Buffer.from(`test${i}`))
          .resize(800, 600)
          .grayscale()
          .toBuffer()
      );
      
      const results = await Promise.all(operations);
      
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toBeInstanceOf(Buffer);
      });
    });
  });
});
