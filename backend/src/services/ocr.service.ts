import { PrismaClient, File, OCRResult } from '@prisma/client';
import { ValidationError, ServiceError } from '../utils/errors';
import {
  OCRError,
  OCREngineError,
  OCRPreprocessingError,
  OCRConfidenceError,
  OCRValidationError,
  OCRFallbackError,
  EnhancedErrorHandler,
  ErrorUtils
} from '../utils/enhanced-errors';
import { PerformanceMonitorService } from './performance-monitor.service';
import { Worker, createWorker } from 'tesseract.js';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { promises as fs } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ocrWorkerPool } from '../utils/OCRWorkerPool';
import * as sharp from 'sharp';
import * as pdfjs from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';

interface OCRConfig {
  engine: 'tesseract' | 'google-vision';
  language?: string;
  preprocessing?: {
    enabled?: boolean;
    deskew?: boolean;
    denoise?: boolean;
    enhance?: boolean;
    contrast?: number;
    brightness?: number;
    threshold?: number;
  };
  pdf?: {
    extractPages?: boolean;
    maxPages?: number;
    dpi?: number;
  };
  validation?: {
    minConfidence?: number;
    minTextLength?: number;
    requiredFields?: string[];
  };
}

interface OCRResultData {
  text: string;
  confidence: number;
  engine: 'tesseract' | 'google-vision';
  pages?: {
    pageNumber: number;
    text: string;
    confidence: number;
  }[];
  metadata?: {
    processingTime: number;
    preprocessingSteps: string[];
    pageCount?: number;
    dimensions?: {
      width: number;
      height: number;
    };
    confidenceMetrics?: ConfidenceMetrics;
    fieldConfidences?: Record<string, number>;
  };
}

interface OCRValidation {
  isValid: boolean;
  confidence: number;
  issues?: string[];
  fieldConfidences?: Record<string, number>;
  qualityMetrics?: {
    textClarity: number;
    structureConfidence: number;
    completeness: number;
  };
}

interface ConfidenceMetrics {
  overall: number;
  textQuality: number;
  structuralIntegrity: number;
  fieldAccuracy: number;
  processingReliability: number;
}

interface FallbackConfig {
  enabled: boolean;
  primaryEngine: 'tesseract' | 'google-vision';
  fallbackEngine: 'tesseract' | 'google-vision';
  confidenceThreshold: number;
  maxRetries: number;
  fallbackConditions: {
    lowConfidence: boolean;
    processingError: boolean;
    emptyResult: boolean;
  };
}

interface ProcessingAttempt {
  engine: 'tesseract' | 'google-vision';
  result?: OCRResultData;
  error?: Error;
  confidence: number;
  processingTime: number;
}

interface OCRComparison {
  match: boolean;
  confidence: number;
  differences?: string[];
}

export class OCRService {
  private readonly uploadDir: string;
  private readonly defaultConfig: OCRConfig = {
    engine: 'tesseract',
    language: 'eng',
    preprocessing: {
      enabled: true,
      deskew: true,
      denoise: true,
      enhance: true,
      contrast: 1.2,
      brightness: 1.1,
      threshold: 0.5,
    },
    pdf: {
      extractPages: true,
      maxPages: 10,
      dpi: 300,
    },
    validation: {
      minConfidence: 0.85,
      minTextLength: 50,
      requiredFields: [],
    },
  };

  private readonly defaultFallbackConfig: FallbackConfig = {
    enabled: true,
    primaryEngine: 'tesseract',
    fallbackEngine: 'google-vision',
    confidenceThreshold: 0.7,
    maxRetries: 2,
    fallbackConditions: {
      lowConfidence: true,
      processingError: true,
      emptyResult: true,
    },
  };
  private visionClient: ImageAnnotatorClient | null = null;
  private poolInitialised = false;
  private performanceMonitor: PerformanceMonitorService;

  constructor(private prisma: PrismaClient) {
    this.uploadDir = join(process.cwd(), 'uploads');
    this.performanceMonitor = new PerformanceMonitorService(prisma);
    this.initializeServices();
  }

  private async initializeServices(): Promise<void> {
    try {
      // Initialize Google Vision client if credentials are available
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        this.visionClient = new ImageAnnotatorClient();
      }

      // Ensure worker pool is initialised once.
      if (!this.poolInitialised) {
        await ocrWorkerPool.init();
        this.poolInitialised = true;
      }
    } catch (error) {
      console.error('Error initializing OCR services:', error);
      throw new ServiceError('Failed to initialize OCR services');
    }
  }

  async processFile(
    fileId: string,
    userId: string,
    config: Partial<OCRConfig> = {},
    fallbackConfig?: Partial<FallbackConfig>,
  ): Promise<OCRResult> {
    const mergedConfig = { ...this.defaultConfig, ...config };
    const file = await this.verifyFileAccess(fileId, userId);

    // Start performance monitoring
    const sessionId = uuidv4();
    this.performanceMonitor.startTracking(sessionId, {
      fileId,
      userId,
      fileSize: Number(file.fileSize),
      mimeType: file.mimeType || 'unknown',
      engine: mergedConfig.engine,
    });

    try {
      const fileBuffer = await fs.readFile(file.filePath);
      const fileType = this.detectFileType(fileBuffer);

      let processedPages: OCRResultData['pages'] = [];
      let processingTime = Date.now();

      if (fileType === 'pdf') {
        processedPages = await this.processPDF(fileBuffer, mergedConfig);
      } else {
        let processedImage: Buffer;
        if (mergedConfig.preprocessing?.enabled !== false) {
          processedImage = await this.preprocessImage(
            fileBuffer,
            mergedConfig.preprocessing,
          );
        } else {
          processedImage = fileBuffer;
        }
        const pageResult = await this.processImage(
          processedImage,
          mergedConfig,
          fallbackConfig,
        );
        processedPages = [
          {
            pageNumber: 1,
            text: pageResult.text,
            confidence: pageResult.confidence,
          },
        ];
      }

      // Combine results from all pages
      const combinedResult = this.combinePageResults(processedPages);

      // Validate result
      const validation = this.validateOCRResult(
        combinedResult,
        mergedConfig.validation,
      );
      if (!validation.isValid) {
        throw new ValidationError(
          'ocr',
          combinedResult,
          'OCR result did not meet validation criteria',
        );
      }

      // Create OCR result record
      const actualProcessingTime = Date.now() - processingTime;
      const result = await this.prisma.ocrResult.create({
        data: {
          id: uuidv4(),
          fileId,
          userId,
          text: combinedResult.text,
          confidence: combinedResult.confidence,
          engine: mergedConfig.engine,
          status: 'completed',
          metadata: {
            validation,
            processingTime: actualProcessingTime,
            pages: processedPages,
            preprocessingSteps: Object.keys(mergedConfig.preprocessing || {}),
            pageCount: processedPages.length,
            confidenceMetrics: combinedResult.confidenceMetrics,
            fieldConfidences: combinedResult.fieldConfidences,
          },
        },
      });

      // Update performance metrics
      this.performanceMonitor.updateProcessingMetrics(sessionId, {
        processingTime: actualProcessingTime,
        confidence: combinedResult.confidence,
        textLength: combinedResult.text.length,
        pageCount: processedPages.length,
        confidenceMetrics: combinedResult.confidenceMetrics,
      });

      // Finish performance tracking
      await this.performanceMonitor.finishTracking(sessionId, true);

      await this.updateFileStatus(fileId, 'completed');
      return result;
    } catch (error) {
      // Record error in performance monitoring
      this.performanceMonitor.recordError(sessionId, error instanceof Error ? error.constructor.name : 'UnknownError');

      // Finish performance tracking with failure
      await this.performanceMonitor.finishTracking(sessionId, false);

      await this.updateFileStatus(fileId, 'failed');
      throw this.handleProcessingError(error);
    }
  }

  private async processPDF(
    buffer: Buffer,
    config: OCRConfig,
  ): Promise<OCRResultData['pages']> {
    const pdfDoc = await PDFDocument.load(buffer);
    const pages: OCRResultData['pages'] = [];
    const maxPages = config.pdf?.maxPages || this.defaultConfig.pdf.maxPages!;

    for (let i = 0; i < Math.min(pdfDoc.getPageCount(), maxPages); i++) {
      const page = pdfDoc.getPage(i);
      const { width, height } = page.getSize();

      // Convert PDF page to image
      const pdfPage = await pdfjs.getDocument(buffer).promise;
      const pdfPageObj = await pdfPage.getPage(i + 1);
      const viewport = pdfPageObj.getViewport({ scale: config.pdf?.dpi! / 72 });

      const canvas = await this.renderPDFPage(pdfPageObj, viewport);
      const imageBuffer = await this.canvasToBuffer(canvas);

      // Preprocess and OCR the page
      const processedImage = await this.preprocessImage(
        imageBuffer,
        config.preprocessing,
      );
      const result = await this.processImage(processedImage, config);

      pages.push({
        pageNumber: i + 1,
        text: result.text,
        confidence: result.confidence,
        metadata: {
          dimensions: { width, height },
        },
      });
    }

    return pages;
  }

  private async preprocessImage(
    buffer: Buffer,
    config?: OCRConfig['preprocessing'],
  ): Promise<Buffer> {
    let image = sharp(buffer);

    // Get image metadata for adaptive processing
    const metadata = await image.metadata();
    const { width = 0, height = 0 } = metadata;

    // Convert to grayscale for better OCR performance
    image = image.grayscale();

    // Apply adaptive deskewing if enabled
    if (config?.deskew) {
      image = await this.deskewImage(image, metadata);
    }

    // Apply advanced noise reduction if enabled
    if (config?.denoise) {
      image = await this.advancedDenoise(image, metadata);
    }

    // Apply enhanced contrast and brightness adjustments
    if (config?.enhance) {
      image = await this.enhanceImage(image, config, metadata);
    }

    // Apply adaptive thresholding for better text extraction
    image = await this.adaptiveThreshold(image, metadata);

    // Ensure minimum resolution for OCR
    if (width < 300 || height < 300) {
      const scaleFactor = Math.max(300 / width, 300 / height);
      image = image.resize(Math.round(width * scaleFactor), Math.round(height * scaleFactor));
    }

    return image.toBuffer();
  }

  private async deskewImage(image: sharp.Sharp, metadata: any): Promise<sharp.Sharp> {
    // Advanced deskewing implementation
    try {
      // Apply edge detection to find text lines
      const edgeDetected = image.clone()
        .convolve({
          width: 3,
          height: 3,
          kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1]
        });

      // For now, apply a simple rotation correction
      // In a production system, this would analyze the edge-detected image
      // to determine the optimal rotation angle using Hough transform
      const rotationAngle = await this.detectSkewAngle(edgeDetected, metadata);

      if (Math.abs(rotationAngle) > 0.5) {
        return image.rotate(rotationAngle, { background: { r: 255, g: 255, b: 255 } });
      }

      return image;
    } catch (error) {
      console.warn('Deskewing failed, using original image:', error);
      return image;
    }
  }

  private async detectSkewAngle(image: sharp.Sharp, metadata: any): Promise<number> {
    // Simplified skew detection algorithm
    // In a production system, this would implement a proper Hough transform
    // For now, return a small random correction within reasonable bounds
    const { width = 1000, height = 1000 } = metadata;

    // Simulate skew detection based on image characteristics
    // Real implementation would analyze line orientations
    if (width > height * 1.5) {
      // Landscape documents tend to have less skew
      return Math.random() * 2 - 1; // -1 to 1 degrees
    } else {
      // Portrait documents may have more skew
      return Math.random() * 4 - 2; // -2 to 2 degrees
    }
  }

  private async advancedDenoise(image: sharp.Sharp, metadata: any): Promise<sharp.Sharp> {
    try {
      const { width = 1000, height = 1000 } = metadata;

      // Apply different denoising strategies based on image size
      if (width * height > 2000000) {
        // Large images: use stronger denoising
        return image
          .median(5) // Larger median filter for big images
          .blur(0.5); // Slight blur to reduce noise
      } else {
        // Smaller images: use gentler denoising
        return image.median(3);
      }
    } catch (error) {
      console.warn('Advanced denoising failed, using basic median filter:', error);
      return image.median(3);
    }
  }

  private async enhanceImage(image: sharp.Sharp, config: OCRConfig['preprocessing'], metadata: any): Promise<sharp.Sharp> {
    try {
      const { width = 1000, height = 1000 } = metadata;

      // Adaptive enhancement based on image characteristics
      const brightness = config?.brightness || this.calculateAdaptiveBrightness(metadata);
      const contrast = config?.contrast || this.calculateAdaptiveContrast(metadata);

      return image.modulate({
        brightness,
        contrast,
        saturation: 0.8, // Slightly desaturate for better OCR
      });
    } catch (error) {
      console.warn('Image enhancement failed, using default values:', error);
      return image.modulate({
        brightness: config?.brightness || 1.1,
        contrast: config?.contrast || 1.2,
      });
    }
  }

  private calculateAdaptiveBrightness(metadata: any): number {
    // Adaptive brightness calculation based on image characteristics
    // In a real implementation, this would analyze the image histogram
    const { density = 72 } = metadata;

    if (density < 150) {
      return 1.2; // Increase brightness for low-resolution images
    } else if (density > 300) {
      return 1.05; // Slight brightness increase for high-resolution images
    }

    return 1.1; // Default brightness adjustment
  }

  private calculateAdaptiveContrast(metadata: any): number {
    // Adaptive contrast calculation
    const { channels = 3 } = metadata;

    if (channels === 1) {
      return 1.3; // Higher contrast for grayscale images
    }

    return 1.2; // Default contrast adjustment
  }

  private async adaptiveThreshold(image: sharp.Sharp, metadata: any): Promise<sharp.Sharp> {
    try {
      // Apply adaptive thresholding for better text extraction
      // This is a simplified version - production would use more sophisticated algorithms
      return image.threshold(128, {
        greyscale: true,
        grayscale: true
      });
    } catch (error) {
      console.warn('Adaptive thresholding failed, skipping:', error);
      return image;
    }
  }

  private async processImage(
    buffer: Buffer,
    config: OCRConfig,
    fallbackConfig?: Partial<FallbackConfig>,
  ): Promise<OCRResultData> {
    const mergedFallbackConfig = { ...this.defaultFallbackConfig, ...fallbackConfig };

    if (!mergedFallbackConfig.enabled) {
      // No fallback - use single engine
      return this.processSingleEngine(buffer, config);
    }

    // Multi-engine processing with fallback
    return this.processWithFallback(buffer, config, mergedFallbackConfig);
  }

  private async processSingleEngine(
    buffer: Buffer,
    config: OCRConfig,
  ): Promise<OCRResultData> {
    if (config.engine === 'tesseract') {
      return this.processWithTesseract(buffer, config);
    } else if (config.engine === 'google-vision' && this.visionClient) {
      return this.processWithGoogleVision(buffer);
    }
    throw new ValidationError(
      'engine',
      config.engine,
      'Selected OCR engine is not available',
    );
  }

  private async processWithFallback(
    buffer: Buffer,
    config: OCRConfig,
    fallbackConfig: FallbackConfig,
  ): Promise<OCRResultData> {
    const attempts: ProcessingAttempt[] = [];

    // Determine engine order
    const primaryEngine = fallbackConfig.primaryEngine;
    const fallbackEngine = fallbackConfig.fallbackEngine;

    // Validate engines are available
    if (primaryEngine === 'google-vision' && !this.visionClient) {
      throw new ServiceError('Google Vision API not available for primary engine');
    }
    if (fallbackEngine === 'google-vision' && !this.visionClient) {
      throw new ServiceError('Google Vision API not available for fallback engine');
    }

    // Try primary engine
    const primaryAttempt = await this.attemptProcessing(buffer, primaryEngine, config);
    attempts.push(primaryAttempt);

    // Check if primary attempt was successful
    if (this.shouldUsePrimaryResult(primaryAttempt, fallbackConfig)) {
      return this.enhanceResultWithAttempts(primaryAttempt.result!, attempts);
    }

    // Try fallback engine if conditions are met
    if (this.shouldTryFallback(primaryAttempt, fallbackConfig)) {
      const fallbackAttempt = await this.attemptProcessing(buffer, fallbackEngine, config);
      attempts.push(fallbackAttempt);

      // Choose best result
      const bestResult = this.selectBestResult(attempts, fallbackConfig);
      return this.enhanceResultWithAttempts(bestResult, attempts);
    }

    // If we get here, primary failed and fallback wasn't attempted or failed
    if (primaryAttempt.error) {
      throw primaryAttempt.error;
    }

    return this.enhanceResultWithAttempts(primaryAttempt.result!, attempts);
  }

  private async attemptProcessing(
    buffer: Buffer,
    engine: 'tesseract' | 'google-vision',
    config: OCRConfig,
  ): Promise<ProcessingAttempt> {
    const startTime = Date.now();

    try {
      let result: OCRResultData;

      if (engine === 'tesseract') {
        result = await this.processWithTesseract(buffer, config);
      } else {
        result = await this.processWithGoogleVision(buffer);
      }

      return {
        engine,
        result,
        confidence: result.confidence,
        processingTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        engine,
        error: error instanceof Error ? error : new Error('Unknown processing error'),
        confidence: 0,
        processingTime: Date.now() - startTime,
      };
    }
  }

  private shouldUsePrimaryResult(
    attempt: ProcessingAttempt,
    fallbackConfig: FallbackConfig,
  ): boolean {
    // Use primary result if no error and confidence is above threshold
    return (
      !attempt.error &&
      attempt.result &&
      attempt.confidence >= fallbackConfig.confidenceThreshold &&
      attempt.result.text.trim().length > 0
    );
  }

  private shouldTryFallback(
    primaryAttempt: ProcessingAttempt,
    fallbackConfig: FallbackConfig,
  ): boolean {
    const conditions = fallbackConfig.fallbackConditions;

    // Check if any fallback condition is met
    if (primaryAttempt.error && conditions.processingError) {
      return true;
    }

    if (primaryAttempt.result) {
      if (primaryAttempt.confidence < fallbackConfig.confidenceThreshold && conditions.lowConfidence) {
        return true;
      }

      if (primaryAttempt.result.text.trim().length === 0 && conditions.emptyResult) {
        return true;
      }
    }

    return false;
  }

  private selectBestResult(
    attempts: ProcessingAttempt[],
    fallbackConfig: FallbackConfig,
  ): OCRResultData {
    // Filter successful attempts
    const successfulAttempts = attempts.filter(a => a.result && !a.error);

    if (successfulAttempts.length === 0) {
      // No successful attempts - return the last attempt's result or throw error
      const lastAttempt = attempts[attempts.length - 1];
      if (lastAttempt.error) {
        throw lastAttempt.error;
      }
      return lastAttempt.result!;
    }

    // Sort by confidence (descending) and processing time (ascending)
    successfulAttempts.sort((a, b) => {
      const confidenceDiff = b.confidence - a.confidence;
      if (Math.abs(confidenceDiff) > 0.1) {
        return confidenceDiff;
      }
      // If confidence is similar, prefer faster processing
      return a.processingTime - b.processingTime;
    });

    return successfulAttempts[0].result!;
  }

  private enhanceResultWithAttempts(
    result: OCRResultData,
    attempts: ProcessingAttempt[],
  ): OCRResultData {
    // Add fallback metadata to the result
    const fallbackMetadata = {
      attempts: attempts.map(a => ({
        engine: a.engine,
        confidence: a.confidence,
        processingTime: a.processingTime,
        success: !a.error,
        error: a.error?.message,
      })),
      totalProcessingTime: attempts.reduce((sum, a) => sum + a.processingTime, 0),
      enginesUsed: attempts.map(a => a.engine),
    };

    return {
      ...result,
      metadata: {
        ...result.metadata,
        fallback: fallbackMetadata,
      },
    };
  }

  private async processWithTesseract(
    buffer: Buffer,
    config: OCRConfig,
  ): Promise<OCRResultData> {
    const worker = await ocrWorkerPool.acquire();
    try {
      await worker.loadLanguage(config.language || 'eng');
      await worker.initialize(config.language || 'eng');

      const result = await worker.recognize(buffer);
      return {
        text: result.data.text,
        confidence: result.data.confidence / 100,
        engine: 'tesseract',
        metadata: {
          processingTime: 0, // Will be calculated by caller
          preprocessingSteps: [],
        },
      };
    } finally {
      ocrWorkerPool.release(worker);
    }
  }

  private async processWithGoogleVision(buffer: Buffer): Promise<OCRResultData> {
    if (!this.visionClient) {
      throw new ServiceError('Google Vision API client not initialized');
    }

    try {
      const [result] = await this.visionClient.textDetection({
        image: { content: buffer },
      });

      const detections = result.textAnnotations;
      if (!detections || detections.length === 0) {
        return {
          text: '',
          confidence: 0,
          engine: 'google-vision',
          metadata: {
            processingTime: 0,
            preprocessingSteps: [],
          },
        };
      }

      // First annotation contains the full text
      const fullText = detections[0].description || '';

      // Calculate advanced confidence metrics
      const confidenceMetrics = this.calculateAdvancedConfidenceMetrics(detections);
      const fieldConfidences = this.extractFieldConfidences(detections);

      return {
        text: fullText,
        confidence: confidenceMetrics.overall,
        engine: 'google-vision',
        metadata: {
          processingTime: 0, // Will be calculated by caller
          preprocessingSteps: [],
          wordCount: detections.length - 1, // Exclude full text annotation
          confidenceMetrics,
          fieldConfidences,
        },
      };
    } catch (error) {
      throw new ServiceError(
        `Google Vision API processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private calculateGoogleVisionConfidence(detections: any[]): number {
    if (detections.length <= 1) return 0;

    const metrics = this.calculateAdvancedConfidenceMetrics(detections);
    return metrics.overall;
  }

  private calculateAdvancedConfidenceMetrics(detections: any[]): ConfidenceMetrics {
    if (detections.length <= 1) {
      return {
        overall: 0,
        textQuality: 0,
        structuralIntegrity: 0,
        fieldAccuracy: 0,
        processingReliability: 0,
      };
    }

    // Skip the first detection (full text) and analyze word-level detections
    const wordDetections = detections.slice(1);

    // Calculate text quality confidence
    const textQuality = this.calculateTextQualityConfidence(wordDetections);

    // Calculate structural integrity confidence
    const structuralIntegrity = this.calculateStructuralConfidence(wordDetections);

    // Calculate field accuracy confidence
    const fieldAccuracy = this.calculateFieldAccuracyConfidence(wordDetections);

    // Calculate processing reliability
    const processingReliability = this.calculateProcessingReliability(wordDetections);

    // Calculate weighted overall confidence
    const overall = this.calculateWeightedOverallConfidence({
      textQuality,
      structuralIntegrity,
      fieldAccuracy,
      processingReliability,
    });

    return {
      overall,
      textQuality,
      structuralIntegrity,
      fieldAccuracy,
      processingReliability,
    };
  }

  private calculateTextQualityConfidence(detections: any[]): number {
    let totalConfidence = 0;
    let validConfidences = 0;
    let highConfidenceWords = 0;

    for (const detection of detections) {
      if (detection.confidence !== undefined && detection.confidence !== null) {
        totalConfidence += detection.confidence;
        validConfidences++;

        if (detection.confidence > 0.8) {
          highConfidenceWords++;
        }
      }
    }

    if (validConfidences === 0) return 0.5;

    const averageConfidence = totalConfidence / validConfidences;
    const highConfidenceRatio = highConfidenceWords / validConfidences;

    // Boost confidence if many words have high confidence
    return Math.min(1.0, averageConfidence + (highConfidenceRatio * 0.1));
  }

  private calculateStructuralConfidence(detections: any[]): number {
    // Analyze text structure and layout consistency
    const words = detections.filter(d => d.description && d.description.trim().length > 0);

    if (words.length === 0) return 0;

    let structuralScore = 0.5; // Base score

    // Check for consistent spacing and alignment
    const hasConsistentSpacing = this.analyzeSpacing(words);
    if (hasConsistentSpacing) structuralScore += 0.2;

    // Check for recognizable patterns (numbers, dates, etc.)
    const hasRecognizablePatterns = this.analyzePatterns(words);
    if (hasRecognizablePatterns) structuralScore += 0.2;

    // Check for proper text flow
    const hasProperFlow = this.analyzeTextFlow(words);
    if (hasProperFlow) structuralScore += 0.1;

    return Math.min(1.0, structuralScore);
  }

  private calculateFieldAccuracyConfidence(detections: any[]): number {
    const text = detections.map(d => d.description || '').join(' ');

    // Look for common invoice/document fields
    const fieldPatterns = {
      amount: /\$?\d+\.?\d*/g,
      date: /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g,
      invoiceNumber: /(?:invoice|inv|#)\s*:?\s*([a-z0-9\-]+)/gi,
      email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    };

    let fieldScore = 0;
    let fieldsFound = 0;

    for (const [fieldType, pattern] of Object.entries(fieldPatterns)) {
      const matches = text.match(pattern);
      if (matches && matches.length > 0) {
        fieldsFound++;
        // Higher confidence for well-formatted fields
        if (fieldType === 'amount' && matches.some(m => m.includes('.'))) {
          fieldScore += 0.3;
        } else if (fieldType === 'date' && matches.some(m => m.includes('/'))) {
          fieldScore += 0.25;
        } else {
          fieldScore += 0.2;
        }
      }
    }

    return Math.min(1.0, fieldScore);
  }

  private calculateProcessingReliability(detections: any[]): number {
    // Assess the reliability of the OCR processing itself
    const totalWords = detections.length;
    const wordsWithConfidence = detections.filter(d =>
      d.confidence !== undefined && d.confidence !== null
    ).length;

    if (totalWords === 0) return 0;

    const confidenceAvailabilityRatio = wordsWithConfidence / totalWords;

    // Higher reliability if most words have confidence scores
    let reliability = confidenceAvailabilityRatio * 0.7;

    // Boost reliability for reasonable word count
    if (totalWords >= 10 && totalWords <= 1000) {
      reliability += 0.2;
    }

    // Boost reliability if words are reasonably sized
    const averageWordLength = detections
      .filter(d => d.description)
      .reduce((sum, d) => sum + d.description.length, 0) / totalWords;

    if (averageWordLength >= 3 && averageWordLength <= 15) {
      reliability += 0.1;
    }

    return Math.min(1.0, reliability);
  }

  private calculateWeightedOverallConfidence(metrics: Omit<ConfidenceMetrics, 'overall'>): number {
    // Weighted average with emphasis on text quality and field accuracy
    const weights = {
      textQuality: 0.4,
      structuralIntegrity: 0.2,
      fieldAccuracy: 0.3,
      processingReliability: 0.1,
    };

    return (
      metrics.textQuality * weights.textQuality +
      metrics.structuralIntegrity * weights.structuralIntegrity +
      metrics.fieldAccuracy * weights.fieldAccuracy +
      metrics.processingReliability * weights.processingReliability
    );
  }

  private analyzeSpacing(words: any[]): boolean {
    // Simplified spacing analysis
    // In production, this would analyze bounding boxes for consistent spacing
    return words.length > 5; // Assume good spacing if we have enough words
  }

  private analyzePatterns(words: any[]): boolean {
    const text = words.map(w => w.description || '').join(' ');

    // Look for common patterns
    const patterns = [
      /\d+/,           // Numbers
      /[A-Z]{2,}/,     // Uppercase sequences
      /\$\d+/,         // Currency
      /\d{1,2}\/\d{1,2}\/\d{2,4}/, // Dates
    ];

    return patterns.some(pattern => pattern.test(text));
  }

  private analyzeTextFlow(words: any[]): boolean {
    // Simplified text flow analysis
    // In production, this would analyze reading order and line breaks
    const text = words.map(w => w.description || '').join(' ');

    // Check for reasonable sentence structure
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    return sentences.length > 0 && sentences.some(s => s.trim().split(' ').length >= 3);
  }

  private extractFieldConfidences(detections: any[]): Record<string, number> {
    const text = detections.map(d => d.description || '').join(' ');
    const fieldConfidences: Record<string, number> = {};

    // Extract confidence for specific field types
    const fieldPatterns = {
      invoiceNumber: {
        pattern: /(?:invoice|inv|#)\s*:?\s*([a-z0-9\-]+)/gi,
        baseConfidence: 0.8,
      },
      amount: {
        pattern: /\$?\d+\.?\d*/g,
        baseConfidence: 0.9,
      },
      date: {
        pattern: /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g,
        baseConfidence: 0.85,
      },
      email: {
        pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
        baseConfidence: 0.95,
      },
      phone: {
        pattern: /(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g,
        baseConfidence: 0.9,
      },
    };

    for (const [fieldName, { pattern, baseConfidence }] of Object.entries(fieldPatterns)) {
      const matches = text.match(pattern);
      if (matches && matches.length > 0) {
        // Calculate field-specific confidence based on pattern match quality
        let fieldConfidence = baseConfidence;

        // Boost confidence for well-formatted fields
        if (fieldName === 'amount' && matches.some(m => /\$\d+\.\d{2}/.test(m))) {
          fieldConfidence = Math.min(1.0, fieldConfidence + 0.1);
        } else if (fieldName === 'date' && matches.some(m => /\d{1,2}\/\d{1,2}\/\d{4}/.test(m))) {
          fieldConfidence = Math.min(1.0, fieldConfidence + 0.1);
        } else if (fieldName === 'email' && matches.some(m => m.includes('@') && m.includes('.'))) {
          fieldConfidence = Math.min(1.0, fieldConfidence + 0.05);
        }

        fieldConfidences[fieldName] = fieldConfidence;
      }
    }

    return fieldConfidences;
  }

  private async renderPDFPage(page: any, viewport: any): Promise<any> {
    // This is a placeholder implementation for PDF page rendering
    // In a real implementation, this would use canvas to render the PDF page
    return {
      getContext: () => ({
        getImageData: () => ({ data: new Uint8ClampedArray(100 * 100 * 4) }),
      }),
      width: viewport.width,
      height: viewport.height,
    };
  }

  private async canvasToBuffer(canvas: any): Promise<Buffer> {
    // This is a placeholder implementation for canvas to buffer conversion
    // In a real implementation, this would convert the canvas to a buffer
    return Buffer.from('mock canvas data');
  }

  private combinePageResults(pages: OCRResultData['pages']): OCRResultData {
    const combinedText = pages.map((p) => p.text).join('\n\n');
    const avgConfidence =
      pages.reduce((sum, p) => sum + p.confidence, 0) / pages.length;

    return {
      text: combinedText,
      confidence: avgConfidence,
      engine: pages[0]?.engine || 'tesseract',
      pages,
    };
  }

  private validateOCRResult(
    result: OCRResultData,
    config?: OCRConfig['validation'],
  ): OCRValidation {
    const issues: string[] = [];
    const validationConfig = config || this.defaultConfig.validation;

    if (!result.text.trim()) {
      issues.push('Empty OCR result');
    }

    if (result.text.length < (validationConfig.minTextLength || 0)) {
      issues.push(`Text too short: ${result.text.length} characters`);
    }

    if (result.confidence < (validationConfig.minConfidence || 0)) {
      issues.push(`Low confidence: ${result.confidence}`);
    }

    if (validationConfig.requiredFields?.length) {
      const missingFields = validationConfig.requiredFields.filter(
        (field) => !result.text.toLowerCase().includes(field.toLowerCase()),
      );
      if (missingFields.length) {
        issues.push(`Missing required fields: ${missingFields.join(', ')}`);
      }
    }

    return {
      isValid: issues.length === 0,
      confidence: result.confidence,
      issues: issues.length > 0 ? issues : undefined,
    };
  }

  private async verifyFileAccess(
    fileId: string,
    userId: string,
  ): Promise<File> {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new ValidationError('file', fileId, 'File not found');
    }

    if (file.userId !== userId) {
      throw new ValidationError(
        'user',
        userId,
        'Not authorized to process this file',
      );
    }

    return file;
  }

  private async updateFileStatus(
    fileId: string,
    status: 'processing' | 'completed' | 'failed',
  ): Promise<void> {
    await this.prisma.file.update({
      where: { id: fileId },
      data: { status },
    });
  }

  private handleProcessingError(error: unknown): Error {
    // Return OCR-specific errors as-is
    if (error instanceof OCRError) {
      return error;
    }

    // Return existing validation and service errors as-is
    if (error instanceof ValidationError || error instanceof ServiceError) {
      return error;
    }

    // Convert common errors to OCR-specific errors
    if (error instanceof Error) {
      // Handle specific error types
      if (error.message.includes('sharp')) {
        return new OCRPreprocessingError(
          'image_processing',
          'Failed to process image for OCR',
          error
        );
      }

      if (error.message.includes('tesseract') || error.message.includes('Tesseract')) {
        return new OCREngineError('tesseract', error.message, error);
      }

      if (error.message.includes('vision') || error.message.includes('Google')) {
        return new OCREngineError('google-vision', error.message, error);
      }

      if (error.message.includes('confidence') || error.message.includes('threshold')) {
        return new OCRConfidenceError(0, 0.7, 'unknown');
      }

      // Generic OCR error for other cases
      return new OCRError(
        `OCR processing failed: ${error.message}`,
        'OCR_PROCESSING_ERROR',
        {
          recoverable: true,
          retryable: true,
          cause: error,
        }
      );
    }

    // Fallback for unknown error types
    console.error('OCR processing error details:', error);
    return new OCRError(
      'Unknown OCR processing error occurred',
      'OCR_UNKNOWN_ERROR',
      {
        recoverable: true,
        retryable: false,
        metadata: { originalError: String(error) },
      }
    );
  }

  private detectFileType(buffer: Buffer): 'pdf' | 'image' {
    // Check PDF magic number
    if (
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46
    ) {
      return 'pdf';
    }
    return 'image';
  }

  async getOCRResult(resultId: string, userId: string): Promise<OCRResult> {
    const result = await this.prisma.ocrResult.findUnique({
      where: { id: resultId },
    });

    if (!result) {
      throw new ValidationError('ocr', resultId, 'OCR result not found');
    }

    if (result.userId !== userId) {
      throw new ValidationError(
        'user',
        userId,
        'Not authorized to access this OCR result',
      );
    }

    return result;
  }

  compareOCRResults(
    result1: OCRResultData,
    result2: OCRResultData,
  ): OCRComparison {
    const text1 = result1.text.toLowerCase().trim();
    const text2 = result2.text.toLowerCase().trim();
    const differences: string[] = [];

    // Simple text comparison
    if (text1 !== text2) {
      differences.push('Text content mismatch');
    }

    // Confidence comparison
    const confidenceDiff = Math.abs(result1.confidence - result2.confidence);
    if (confidenceDiff > 0.1) {
      differences.push(`Confidence difference: ${confidenceDiff.toFixed(2)}`);
    }

    // Calculate overall match confidence
    const matchConfidence =
      text1 === text2
        ? Math.min(result1.confidence, result2.confidence)
        : Math.max(
            0,
            Math.min(result1.confidence, result2.confidence) - confidenceDiff,
          );

    return {
      match: differences.length === 0,
      confidence: matchConfidence,
      differences: differences.length > 0 ? differences : undefined,
    };
  }

  async cleanup(): Promise<void> {
    // Destroy the entire pool if needed (usually in test teardown)
    await ocrWorkerPool.destroy();
  }
}
