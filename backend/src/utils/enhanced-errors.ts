import { logger } from './logger';

/**
 * Enhanced error types for OCR processing
 */
export class OCRError extends Error {
  public readonly code: string;
  public readonly engine?: string;
  public readonly confidence?: number;
  public readonly metadata?: Record<string, any>;
  public readonly recoverable: boolean;
  public readonly retryable: boolean;

  constructor(
    message: string,
    code: string,
    options: {
      engine?: string;
      confidence?: number;
      metadata?: Record<string, any>;
      recoverable?: boolean;
      retryable?: boolean;
      cause?: Error;
    } = {}
  ) {
    super(message);
    this.name = 'OCRError';
    this.code = code;
    this.engine = options.engine;
    this.confidence = options.confidence;
    this.metadata = options.metadata;
    this.recoverable = options.recoverable ?? true;
    this.retryable = options.retryable ?? true;

    if (options.cause) {
      this.cause = options.cause;
    }
  }
}

/**
 * Specific OCR error types
 */
export class OCREngineError extends OCRError {
  constructor(engine: string, message: string, cause?: Error) {
    super(`OCR Engine ${engine} failed: ${message}`, 'OCR_ENGINE_ERROR', {
      engine,
      recoverable: true,
      retryable: true,
      cause,
    });
  }
}

export class OCRPreprocessingError extends OCRError {
  constructor(step: string, message: string, cause?: Error) {
    super(`Preprocessing step '${step}' failed: ${message}`, 'OCR_PREPROCESSING_ERROR', {
      metadata: { preprocessingStep: step },
      recoverable: true,
      retryable: false,
      cause,
    });
  }
}

export class OCRConfidenceError extends OCRError {
  constructor(actualConfidence: number, requiredConfidence: number, engine: string) {
    super(
      `OCR confidence ${actualConfidence} below required threshold ${requiredConfidence}`,
      'OCR_LOW_CONFIDENCE',
      {
        engine,
        confidence: actualConfidence,
        metadata: { requiredConfidence },
        recoverable: true,
        retryable: true,
      }
    );
  }
}

export class OCRValidationError extends OCRError {
  constructor(field: string, value: any, reason: string) {
    super(`Validation failed for field '${field}': ${reason}`, 'OCR_VALIDATION_ERROR', {
      metadata: { field, value, reason },
      recoverable: false,
      retryable: false,
    });
  }
}

export class OCRFallbackError extends OCRError {
  constructor(primaryEngine: string, fallbackEngine: string, errors: Error[]) {
    super(
      `All OCR engines failed. Primary: ${primaryEngine}, Fallback: ${fallbackEngine}`,
      'OCR_FALLBACK_EXHAUSTED',
      {
        metadata: { primaryEngine, fallbackEngine, errors: errors.map(e => e.message) },
        recoverable: false,
        retryable: false,
      }
    );
  }
}

/**
 * Enhanced error handler for OCR processing
 */
export class EnhancedErrorHandler {
  private static readonly MAX_RETRY_ATTEMPTS = 3;
  private static readonly RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff

  /**
   * Handle OCR processing errors with enhanced recovery strategies
   */
  static async handleOCRError(
    error: Error,
    context: {
      fileId: string;
      userId: string;
      engine: string;
      attempt: number;
      maxAttempts?: number;
    }
  ): Promise<{
    shouldRetry: boolean;
    shouldFallback: boolean;
    delay?: number;
    fallbackEngine?: string;
    userMessage: string;
    logData: Record<string, any>;
  }> {
    const maxAttempts = context.maxAttempts || this.MAX_RETRY_ATTEMPTS;
    const isOCRError = error instanceof OCRError;

    // Determine error handling strategy
    let shouldRetry = false;
    let shouldFallback = false;
    let delay: number | undefined;
    let fallbackEngine: string | undefined;
    let userMessage: string;

    if (isOCRError) {
      const ocrError = error as OCRError;
      shouldRetry = ocrError.retryable && context.attempt < maxAttempts;
      shouldFallback = ocrError.recoverable && !shouldRetry;

      // Determine fallback engine
      if (shouldFallback) {
        fallbackEngine = context.engine === 'tesseract' ? 'google-vision' : 'tesseract';
      }

      // Set retry delay
      if (shouldRetry && context.attempt < this.RETRY_DELAYS.length) {
        delay = this.RETRY_DELAYS[context.attempt - 1];
      }

      // Generate user-friendly message
      userMessage = this.generateUserMessage(ocrError);
    } else {
      // Handle non-OCR errors
      shouldRetry = context.attempt < maxAttempts;
      shouldFallback = context.attempt >= maxAttempts;
      
      if (shouldRetry) {
        delay = this.RETRY_DELAYS[Math.min(context.attempt - 1, this.RETRY_DELAYS.length - 1)];
      }

      if (shouldFallback) {
        fallbackEngine = context.engine === 'tesseract' ? 'google-vision' : 'tesseract';
      }

      userMessage = 'An unexpected error occurred during OCR processing. Please try again.';
    }

    // Prepare log data
    const logData = {
      fileId: context.fileId,
      userId: context.userId,
      engine: context.engine,
      attempt: context.attempt,
      maxAttempts,
      errorType: error.constructor.name,
      errorCode: isOCRError ? (error as OCRError).code : 'UNKNOWN_ERROR',
      errorMessage: error.message,
      shouldRetry,
      shouldFallback,
      fallbackEngine,
      delay,
      ...(isOCRError ? {
        confidence: (error as OCRError).confidence,
        recoverable: (error as OCRError).recoverable,
        retryable: (error as OCRError).retryable,
        metadata: (error as OCRError).metadata,
      } : {}),
    };

    // Log the error with appropriate level
    if (shouldRetry) {
      logger.warn('OCR processing error - retrying', logData);
    } else if (shouldFallback) {
      logger.warn('OCR processing error - attempting fallback', logData);
    } else {
      logger.error('OCR processing error - no recovery possible', logData);
    }

    return {
      shouldRetry,
      shouldFallback,
      delay,
      fallbackEngine,
      userMessage,
      logData,
    };
  }

  /**
   * Generate user-friendly error messages
   */
  private static generateUserMessage(error: OCRError): string {
    switch (error.code) {
      case 'OCR_ENGINE_ERROR':
        return `The ${error.engine} OCR engine encountered an issue. We're trying an alternative approach.`;
      
      case 'OCR_PREPROCESSING_ERROR':
        return 'There was an issue preparing your document for processing. Please ensure the image is clear and readable.';
      
      case 'OCR_LOW_CONFIDENCE':
        return 'The text recognition confidence is lower than expected. We\'re trying to improve the results.';
      
      case 'OCR_VALIDATION_ERROR':
        return 'Some extracted information couldn\'t be validated. Please review the results carefully.';
      
      case 'OCR_FALLBACK_EXHAUSTED':
        return 'We tried multiple OCR engines but couldn\'t process your document successfully. Please try with a clearer image.';
      
      default:
        return 'An error occurred during text recognition. Please try again or contact support if the issue persists.';
    }
  }

  /**
   * Create recovery suggestions based on error type
   */
  static getRecoverySuggestions(error: OCRError): string[] {
    const suggestions: string[] = [];

    switch (error.code) {
      case 'OCR_ENGINE_ERROR':
        suggestions.push('Try using a different OCR engine');
        suggestions.push('Check if the document format is supported');
        break;
      
      case 'OCR_PREPROCESSING_ERROR':
        suggestions.push('Ensure the image is high quality and well-lit');
        suggestions.push('Try scanning at a higher resolution');
        suggestions.push('Make sure the text is clearly visible');
        break;
      
      case 'OCR_LOW_CONFIDENCE':
        suggestions.push('Improve image quality (higher resolution, better lighting)');
        suggestions.push('Ensure text is not skewed or rotated');
        suggestions.push('Try with a cleaner background');
        break;
      
      case 'OCR_VALIDATION_ERROR':
        suggestions.push('Review the extracted data manually');
        suggestions.push('Ensure all required fields are visible in the document');
        break;
      
      case 'OCR_FALLBACK_EXHAUSTED':
        suggestions.push('Try with a different document format (PDF instead of image)');
        suggestions.push('Scan the document at higher quality');
        suggestions.push('Contact support for assistance');
        break;
    }

    return suggestions;
  }

  /**
   * Track error patterns for monitoring and improvement
   */
  static trackErrorPattern(error: OCRError, context: Record<string, any>): void {
    const errorPattern = {
      timestamp: new Date().toISOString(),
      errorCode: error.code,
      engine: error.engine,
      confidence: error.confidence,
      metadata: error.metadata,
      context,
    };

    // Log for monitoring systems
    logger.info('OCR error pattern tracked', {
      pattern: errorPattern,
      service: 'error-tracking',
    });

    // Here you could also send to external monitoring services
    // like Sentry, DataDog, etc.
  }
}

/**
 * Utility functions for error handling
 */
export const ErrorUtils = {
  /**
   * Check if an error is retryable
   */
  isRetryable(error: Error): boolean {
    if (error instanceof OCRError) {
      return error.retryable;
    }
    
    // Default retry logic for non-OCR errors
    const retryableErrors = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ECONNREFUSED',
    ];
    
    return retryableErrors.some(code => error.message.includes(code));
  },

  /**
   * Check if an error is recoverable with fallback
   */
  isRecoverable(error: Error): boolean {
    if (error instanceof OCRError) {
      return error.recoverable;
    }
    
    // Most errors are recoverable with fallback
    return true;
  },

  /**
   * Extract error details for logging
   */
  extractErrorDetails(error: Error): Record<string, any> {
    const details: Record<string, any> = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };

    if (error instanceof OCRError) {
      details.code = error.code;
      details.engine = error.engine;
      details.confidence = error.confidence;
      details.metadata = error.metadata;
      details.recoverable = error.recoverable;
      details.retryable = error.retryable;
    }

    return details;
  },
};
