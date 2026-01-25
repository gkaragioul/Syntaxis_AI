import {
  ProcessingService,
  ProcessingOptions,
} from '../../services/ProcessingService';
import { ValidationError } from '../../utils/errors';
import { createWorker } from 'tesseract.js';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

// Mock Tesseract.js
jest.mock('tesseract.js', () => ({
  createWorker: jest.fn().mockResolvedValue({
    loadLanguage: jest.fn().mockResolvedValue(undefined),
    initialize: jest.fn().mockResolvedValue(undefined),
    recognize: jest.fn().mockResolvedValue({
      data: {
        text: 'Sample OCR text',
        confidence: 95,
        pages: 1,
      },
    }),
    terminate: jest.fn().mockResolvedValue(undefined),
  }),
}));

// Mock sharp
jest.mock('sharp', () => {
  const mockSharp = jest.fn().mockReturnValue({
    metadata: jest.fn().mockResolvedValue({
      format: 'jpeg',
      width: 2480,
      height: 3508,
    }),
    grayscale: jest.fn().mockReturnThis(),
    modulate: jest.fn().mockReturnThis(),
    median: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('mock image data')),
  });
  return mockSharp;
});

describe('ProcessingService', () => {
  let processingService: ProcessingService;
  let mockImageBuffer: Buffer;

  beforeAll(async () => {
    // Create a test image buffer
    mockImageBuffer = Buffer.from('mock image data');
  });

  beforeEach(() => {
    jest.clearAllMocks();
    processingService = new ProcessingService();
  });

  afterEach(async () => {
    await processingService.terminate();
  });

  describe('processFile', () => {
    const defaultOptions: ProcessingOptions = {
      type: 'invoice',
      options: {
        enhance: true,
        denoise: true,
        language: 'eng',
      },
    };

    it('should process image successfully', async () => {
      const result = await processingService.processFile(
        mockImageBuffer,
        defaultOptions,
      );

      expect(result).toEqual({
        text: 'Sample OCR text',
        confidence: 0.95,
        pages: 1,
        processingTime: expect.any(Number),
        metadata: {
          width: 2480,
          height: 3508,
          format: 'jpeg',
          language: 'eng',
        },
      });

      // Verify image preprocessing
      expect(sharp).toHaveBeenCalledWith(mockImageBuffer);
      const sharpInstance = (sharp as jest.Mock).mock.results[0].value;
      expect(sharpInstance.grayscale).toHaveBeenCalled();
      expect(sharpInstance.modulate).toHaveBeenCalledWith({
        brightness: 1.1,
        contrast: 1.2,
        saturation: 0,
      });
      expect(sharpInstance.median).toHaveBeenCalledWith(3);

      // Verify OCR processing
      expect(createWorker).toHaveBeenCalledWith('eng');
      const worker = await (createWorker as jest.Mock).mock.results[0].value;
      expect(worker.loadLanguage).toHaveBeenCalledWith('eng');
      expect(worker.initialize).toHaveBeenCalledWith('eng');
      expect(worker.recognize).toHaveBeenCalled();
    });

    it('should handle unsupported file format', async () => {
      (sharp as jest.Mock).mockImplementationOnce(() => ({
        metadata: jest.fn().mockResolvedValue({
          format: 'gif',
          width: 100,
          height: 100,
        }),
        grayscale: jest.fn().mockReturnThis(),
        modulate: jest.fn().mockReturnThis(),
        median: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue(mockImageBuffer),
      }));

      await expect(
        processingService.processFile(mockImageBuffer, defaultOptions),
      ).rejects.toThrow(ValidationError);
    });

    it('should handle unsupported language', async () => {
      await expect(
        processingService.processFile(mockImageBuffer, {
          ...defaultOptions,
          options: { ...defaultOptions.options, language: 'xyz' },
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('should handle OCR processing errors', async () => {
      const mockError = new Error('OCR processing failed');
      (createWorker as jest.Mock).mockImplementationOnce(() => ({
        loadLanguage: jest.fn().mockRejectedValue(mockError),
        initialize: jest.fn(),
        recognize: jest.fn(),
        terminate: jest.fn(),
      }));

      await expect(
        processingService.processFile(mockImageBuffer, defaultOptions),
      ).rejects.toThrow(mockError);
    });

    it('should process with different languages', async () => {
      const languages = ['fra', 'deu', 'spa', 'ita'];

      for (const language of languages) {
        const result = await processingService.processFile(mockImageBuffer, {
          ...defaultOptions,
          options: { ...defaultOptions.options, language },
        });

        expect(result.metadata.language).toBe(language);
        const worker = await (createWorker as jest.Mock).mock.results[0].value;
        expect(worker.loadLanguage).toHaveBeenCalledWith(language);
        expect(worker.initialize).toHaveBeenCalledWith(language);
      }
    });

    it('should handle image preprocessing options', async () => {
      const options: ProcessingOptions = {
        type: 'invoice',
        options: {
          enhance: false,
          denoise: false,
          language: 'eng',
        },
      };

      await processingService.processFile(mockImageBuffer, options);

      const sharpInstance = (sharp as jest.Mock).mock.results[0].value;
      expect(sharpInstance.grayscale).toHaveBeenCalled();
      expect(sharpInstance.modulate).not.toHaveBeenCalled();
      expect(sharpInstance.median).not.toHaveBeenCalled();
    });
  });

  describe('terminate', () => {
    it('should terminate worker', async () => {
      await processingService.terminate();
      const worker = await (createWorker as jest.Mock).mock.results[0].value;
      expect(worker.terminate).toHaveBeenCalled();
    });

    it('should handle multiple terminations', async () => {
      await processingService.terminate();
      await processingService.terminate();
      const worker = await (createWorker as jest.Mock).mock.results[0].value;
      expect(worker.terminate).toHaveBeenCalledTimes(1);
    });
  });
});
