/**
 * Error Handler Utility
 * Provides consistent error handling and user-friendly messages
 */

// Simple logger for error handling
const logger = {
  error: (message: string, details?: any) => console.error(message, details),
  warn: (message: string, details?: any) => console.warn(message, details),
};

export interface AppError {
  code: string;
  message: string;
  userMessage: string;
  details?: any;
  timestamp: string;
}

export class ErrorHandler {
  /**
   * Create a standardized app error
   */
  static createError(
    code: string,
    message: string,
    userMessage: string,
    details?: any
  ): AppError {
    return {
      code,
      message,
      userMessage,
      details,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Handle and log errors with user-friendly messages
   */
  static handle(error: any, context: string = 'Unknown'): AppError {
    let appError: AppError;

    if (error instanceof Error) {
      appError = this.createError(
        'ERROR',
        error.message,
        this.getUserMessage(error.message),
        { stack: error.stack }
      );
    } else if (typeof error === 'string') {
      appError = this.createError(
        'ERROR',
        error,
        this.getUserMessage(error)
      );
    } else {
      appError = this.createError(
        'UNKNOWN_ERROR',
        JSON.stringify(error),
        'An unexpected error occurred. Please try again.'
      );
    }

    logger.error(`[${context}] ${appError.message}`, appError.details);
    return appError;
  }

  /**
   * Convert technical error messages to user-friendly messages
   */
  private static getUserMessage(technicalMessage: string): string {
    const message = technicalMessage.toLowerCase();

    // Network errors
    if (message.includes('network') || message.includes('fetch')) {
      return 'Network error. Please check your connection and try again.';
    }

    // File errors
    if (message.includes('file') || message.includes('upload')) {
      return 'File operation failed. Please check the file and try again.';
    }

    // PDF errors
    if (message.includes('pdf')) {
      return 'Failed to process PDF. Please ensure the file is a valid PDF.';
    }

    // OCR errors
    if (message.includes('ocr') || message.includes('tesseract')) {
      return 'Failed to extract text from document. Please try again.';
    }

    // Storage errors
    if (message.includes('storage') || message.includes('database')) {
      return 'Failed to save data. Please try again.';
    }

    // Timeout errors
    if (message.includes('timeout')) {
      return 'Operation timed out. Please try again.';
    }

    // Permission errors
    if (message.includes('permission') || message.includes('denied')) {
      return 'Permission denied. Please check your access rights.';
    }

    // Default message
    return 'An error occurred. Please try again or contact support if the problem persists.';
  }

  /**
   * Validate file before processing
   */
  static validateFile(file: File, maxSize: number = 50 * 1024 * 1024): AppError | null {
    if (!file) {
      return this.createError(
        'INVALID_FILE',
        'No file provided',
        'Please select a file to upload.'
      );
    }

    if (file.type !== 'application/pdf') {
      return this.createError(
        'INVALID_FILE_TYPE',
        `Invalid file type: ${file.type}`,
        'Only PDF files are supported.'
      );
    }

    if (file.size > maxSize) {
      const maxSizeMB = Math.round(maxSize / 1024 / 1024);
      return this.createError(
        'FILE_TOO_LARGE',
        `File size ${file.size} exceeds maximum ${maxSize}`,
        `File size must be less than ${maxSizeMB}MB.`
      );
    }

    return null;
  }

  /**
   * Retry logic with exponential backoff
   */
  static async retry<T>(
    fn: () => Promise<T>,
    maxAttempts: number = 3,
    delayMs: number = 1000
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn(`Attempt ${attempt}/${maxAttempts} failed:`, lastError.message);

        if (attempt < maxAttempts) {
          const delay = delayMs * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Max retry attempts reached');
  }

  /**
   * Log error to analytics/monitoring service
   */
  static reportError(error: AppError, context?: string): void {
    // This can be extended to send errors to a monitoring service
    logger.error(`[REPORT] ${context || 'Error Report'}:`, {
      code: error.code,
      message: error.message,
      timestamp: error.timestamp,
      details: error.details,
    });
  }
}

export default ErrorHandler;

