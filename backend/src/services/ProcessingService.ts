import { logger } from '../utils/logger';
import Tesseract from 'tesseract.js';
import { createWorker } from 'tesseract.js';
import sharp from 'sharp';
import { ValidationError } from '../utils/errors';

export interface ProcessingOptions {
  type: 'invoice' | 'receipt' | 'document';
  options?: {
    deskew?: boolean;
    enhance?: boolean;
    denoise?: boolean;
    engine?: 'tesseract' | 'google-vision';
    language?: string;
    [key: string]: any;
  };
}

export interface ProcessingResult {
  text: string;
  confidence: number;
  pages: number;
  processingTime: number;
  metadata: {
    width: number;
    height: number;
    format: string;
    [key: string]: any;
  };
}

export class ProcessingService {
  private worker: Tesseract.Worker | null = null;
  private readonly defaultLanguage = 'eng';
  private readonly supportedLanguages = ['eng', 'fra', 'deu', 'spa', 'ita'];

  constructor() {
    this.initializeWorker();
  }

  private async initializeWorker() {
    try {
      this.worker = await createWorker(this.defaultLanguage);
      logger.info('Tesseract worker initialized');
    } catch (error) {
      logger.error('Failed to initialize Tesseract worker', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  private async preprocessImage(
    imageBuffer: Buffer,
    options: ProcessingOptions['options'],
  ): Promise<Buffer> {
    let processedImage = sharp(imageBuffer);

    // Convert to grayscale for better OCR
    processedImage = processedImage.grayscale();

    if (options?.enhance) {
      // Enhance contrast
      processedImage = processedImage.modulate({
        brightness: 1.1,
        contrast: 1.2,
        saturation: 0,
      });
    }

    if (options?.denoise) {
      // Apply noise reduction
      processedImage = processedImage.median(3);
    }

    if (options?.deskew) {
      // TODO: Implement deskewing
      // This requires more complex image analysis
      logger.warn('Deskewing not implemented yet');
    }

    return processedImage.toBuffer();
  }

  async processFile(
    fileContent: Buffer,
    options: ProcessingOptions,
  ): Promise<ProcessingResult> {
    const startTime = Date.now();

    try {
      // Always start with a fresh worker for each processing request to ensure
      // deterministic behaviour during tests and avoid memory leaks when
      // processing many files in production.
      if (this.worker) {
        await this.worker.terminate();
      }
      await this.initializeWorker();

      // Validate file type
      const metadata = await sharp(fileContent).metadata();
      if (
        !metadata.format ||
        !['jpeg', 'png', 'pdf'].includes(metadata.format)
      ) {
        throw new ValidationError('Unsupported file format');
      }

      // Preprocess image
      const processedImage = await this.preprocessImage(
        fileContent,
        options.options,
      );

      // Set language
      const language = options.options?.language || this.defaultLanguage;
      if (!this.supportedLanguages.includes(language)) {
        throw new ValidationError(`Unsupported language: ${language}`);
      }
      await this.worker.loadLanguage(language);
      await this.worker.initialize(language);

      // Perform OCR
      const result = await this.worker.recognize(processedImage);

      const processingTime = (Date.now() - startTime) / 1000; // Convert to seconds

      logger.info('File processing completed', {
        type: options.type,
        confidence: result.confidence,
        processingTime,
        language,
      });

      return {
        text: result.data.text,
        confidence: result.data.confidence / 100, // Convert to 0-1 scale
        pages: result.data.pages || 1,
        processingTime,
        metadata: {
          width: metadata.width || 0,
          height: metadata.height || 0,
          format: metadata.format || 'unknown',
          language,
        },
      };
    } catch (error) {
      logger.error('File processing failed', {
        type: options.type,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async terminate() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      logger.info('Tesseract worker terminated');
    }
  }
}
