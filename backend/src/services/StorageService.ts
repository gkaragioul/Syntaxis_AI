import { logger } from '../utils/logger';
import { promises as fs } from 'fs';
import path from 'path';

export interface StorageOptions {
  directory?: string;
  maxFileSize?: number;
  allowedTypes?: string[];
  enableMetadata?: boolean;
  metadataDirectory?: string;
}

export interface FileMetadata {
  originalFilename: string;
  contentType: string;
  size: number;
  uploadedAt: Date;
  checksum: string;
  // Enhanced OCR metadata
  ocrProcessingStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  ocrResults?: {
    engine: string;
    confidence: number;
    processingTime: number;
    preprocessingSteps: string[];
    fallbackUsed: boolean;
    enginesUsed: string[];
  };
  // Processing history
  processingHistory?: Array<{
    timestamp: Date;
    action: string;
    status: string;
    metadata?: Record<string, any>;
  }>;
}

export class StorageService {
  private baseDirectory: string;
  private maxFileSize: number;
  private allowedTypes: string[];
  private enableMetadata: boolean;
  private metadataDirectory: string;

  constructor(options: StorageOptions = {}) {
    this.baseDirectory =
      options.directory || path.join(process.cwd(), 'storage');
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
    this.allowedTypes = options.allowedTypes || [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'text/plain', // Added for enhanced OCR testing
    ];
    this.enableMetadata = options.enableMetadata ?? true;
    this.metadataDirectory =
      options.metadataDirectory || path.join(this.baseDirectory, 'metadata');
  }

  async saveFile(
    fileContent: Buffer,
    filename: string,
    options: { contentType: string } = { contentType: 'application/pdf' },
  ): Promise<string> {
    try {
      // Validate file
      if (fileContent.length > this.maxFileSize) {
        throw new Error(
          `File size exceeds maximum allowed size of ${this.maxFileSize} bytes`,
        );
      }

      if (!this.allowedTypes.includes(options.contentType)) {
        throw new Error(`File type ${options.contentType} is not allowed`);
      }

      // Create storage directory if it doesn't exist
      await fs.mkdir(this.baseDirectory, { recursive: true });

      // Generate unique filename
      const timestamp = Date.now();
      const uniqueFilename = `${timestamp}-${filename}`;
      const filePath = path.join(this.baseDirectory, uniqueFilename);

      // Save file
      await fs.writeFile(filePath, fileContent);

      // Save metadata if enabled
      if (this.enableMetadata) {
        await this.saveFileMetadata(uniqueFilename, {
          originalFilename: filename,
          contentType: options.contentType,
          size: fileContent.length,
          uploadedAt: new Date(),
          checksum: this.calculateChecksum(fileContent),
          ocrProcessingStatus: 'pending',
          processingHistory: [
            {
              timestamp: new Date(),
              action: 'file_uploaded',
              status: 'completed',
              metadata: {
                size: fileContent.length,
                contentType: options.contentType,
              },
            },
          ],
        });
      }

      logger.info('File saved successfully', {
        filename: uniqueFilename,
        size: fileContent.length,
        contentType: options.contentType,
      });

      return uniqueFilename;
    } catch (error) {
      logger.error('Failed to save file', {
        filename,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async getFile(storagePath: string): Promise<Buffer> {
    try {
      const filePath = path.join(this.baseDirectory, storagePath);
      const fileContent = await fs.readFile(filePath);

      logger.info('File retrieved successfully', {
        storagePath,
        size: fileContent.length,
      });

      return fileContent;
    } catch (error) {
      logger.error('Failed to get file', {
        storagePath,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async deleteFile(storagePath: string): Promise<void> {
    try {
      const filePath = path.join(this.baseDirectory, storagePath);
      await fs.unlink(filePath);

      logger.info('File deleted successfully', { storagePath });
    } catch (error) {
      logger.error('Failed to delete file', {
        storagePath,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async getFileStats(storagePath: string): Promise<{
    size: number;
    created: Date;
    modified: Date;
  }> {
    try {
      const filePath = path.join(this.baseDirectory, storagePath);
      const stats = await fs.stat(filePath);

      return {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
      };
    } catch (error) {
      logger.error('Failed to get file metadata', {
        storagePath,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Save file metadata for enhanced OCR processing
   */
  async saveFileMetadata(
    filename: string,
    metadata: FileMetadata,
  ): Promise<void> {
    if (!this.enableMetadata) return;

    try {
      await fs.mkdir(this.metadataDirectory, { recursive: true });
      const metadataPath = path.join(
        this.metadataDirectory,
        `${filename}.json`,
      );
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

      logger.info('File metadata saved successfully', {
        filename,
        metadataPath,
      });
    } catch (error) {
      logger.error('Failed to save file metadata', {
        filename,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Don't throw error for metadata save failures
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(filename: string): Promise<FileMetadata | null> {
    if (!this.enableMetadata) return null;

    try {
      const metadataPath = path.join(
        this.metadataDirectory,
        `${filename}.json`,
      );
      const metadataContent = await fs.readFile(metadataPath, 'utf-8');
      return JSON.parse(metadataContent);
    } catch (error) {
      logger.warn('Failed to read file metadata', {
        filename,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Update OCR processing status in metadata
   */
  async updateOCRStatus(
    filename: string,
    status: 'pending' | 'processing' | 'completed' | 'failed',
    ocrResults?: FileMetadata['ocrResults'],
  ): Promise<void> {
    if (!this.enableMetadata) return;

    try {
      const metadata = await this.getFileMetadata(filename) as FileMetadata | null;
      if (!metadata) {
        logger.warn('No metadata found for file', { filename });
        return;
      }

      (metadata as any).ocrProcessingStatus = status;
      if (ocrResults) {
        (metadata as any).ocrResults = ocrResults;
      }

      // Add to processing history
      if (!(metadata as any).processingHistory) {
        (metadata as any).processingHistory = [];
      }
      (metadata as any).processingHistory.push({
        timestamp: new Date(),
        action: 'ocr_status_update',
        status,
        metadata: ocrResults ? { ocrResults } : undefined,
      });

      await this.saveFileMetadata(filename, metadata);
    } catch (error) {
      logger.error('Failed to update OCR status', {
        filename,
        status,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Calculate file checksum for integrity verification
   */
  private calculateChecksum(content: Buffer): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Get files by OCR processing status
   */
  async getFilesByOCRStatus(
    status: 'pending' | 'processing' | 'completed' | 'failed',
  ): Promise<string[]> {
    if (!this.enableMetadata) return [];

    try {
      await fs.mkdir(this.metadataDirectory, { recursive: true });
      const metadataFiles = await fs.readdir(this.metadataDirectory);
      const matchingFiles: string[] = [];

      for (const metadataFile of metadataFiles) {
        if (!metadataFile.endsWith('.json')) continue;

        const filename = metadataFile.replace('.json', '');
        const metadata = await this.getFileMetadata(filename);

        if (metadata && metadata.ocrProcessingStatus === status) {
          matchingFiles.push(filename);
        }
      }

      return matchingFiles;
    } catch (error) {
      logger.error('Failed to get files by OCR status', {
        status,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Clean up old metadata files
   */
  async cleanupOldMetadata(olderThanDays: number = 30): Promise<number> {
    if (!this.enableMetadata) return 0;

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const metadataFiles = await fs.readdir(this.metadataDirectory);
      let cleanedCount = 0;

      for (const metadataFile of metadataFiles) {
        if (!metadataFile.endsWith('.json')) continue;

        const filename = metadataFile.replace('.json', '');
        const metadata = await this.getFileMetadata(filename);

        if (metadata && new Date(metadata.uploadedAt) < cutoffDate) {
          const metadataPath = path.join(this.metadataDirectory, metadataFile);
          await fs.unlink(metadataPath);
          cleanedCount++;
        }
      }

      logger.info('Cleaned up old metadata files', {
        cleanedCount,
        olderThanDays,
      });

      return cleanedCount;
    } catch (error) {
      logger.error('Failed to cleanup old metadata', {
        olderThanDays,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0;
    }
  }
}
