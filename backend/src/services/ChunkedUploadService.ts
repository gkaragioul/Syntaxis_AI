import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { ValidationError } from '../utils/errors';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';

interface ChunkMetadata {
  id: string;
  filename: string;
  totalChunks: number;
  chunkSize: number;
  totalSize: number;
  mimeType: string;
  userId: string;
  uploadedChunks: number;
  status: 'uploading' | 'complete' | 'failed';
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class ChunkedUploadService {
  private readonly tempDir: string;
  private readonly chunkSize: number;

  constructor() {
    this.tempDir = config.uploads.tempDir;
    this.chunkSize = config.uploads.chunkSize;
    this.ensureTempDir();
  }

  private async ensureTempDir(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create temp directory', { error });
      throw new Error('Failed to initialize upload service');
    }
  }

  /**
   * Initialize a new chunked upload
   */
  public async initializeUpload(
    userId: string,
    filename: string,
    totalSize: number,
    mimeType: string,
  ): Promise<{ uploadId: string; chunkSize: number }> {
    // Validate file type
    if (!config.uploads.allowedTypes.includes(mimeType)) {
      throw new ValidationError('Invalid file type');
    }

    // Validate file size
    if (totalSize > config.uploads.maxFileSize) {
      throw new ValidationError('File too large');
    }

    const uploadId = uuidv4();
    const totalChunks = Math.ceil(totalSize / this.chunkSize);

    const metadata: ChunkMetadata = {
      id: uploadId,
      filename,
      totalChunks,
      chunkSize: this.chunkSize,
      totalSize,
      mimeType,
      userId,
      uploadedChunks: 0,
      status: 'uploading',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Store metadata in Redis
    await redis.set(
      `upload:${uploadId}`,
      JSON.stringify(metadata),
      'EX',
      3600, // 1 hour expiry
    );

    return { uploadId, chunkSize: this.chunkSize };
  }

  /**
   * Upload a chunk of a file
   */
  public async uploadChunk(
    uploadId: string,
    chunkNumber: number,
    chunkData: Buffer,
    userId: string,
  ): Promise<{ progress: number; status: string }> {
    // Get upload metadata
    const metadataStr = await redis.get(`upload:${uploadId}`);
    if (!metadataStr) {
      throw new ValidationError('Upload not found or expired');
    }

    const metadata: ChunkMetadata = JSON.parse(metadataStr);

    // Validate user
    if (metadata.userId !== userId) {
      throw new ValidationError('Unauthorized');
    }

    // Validate chunk number
    if (chunkNumber < 0 || chunkNumber >= metadata.totalChunks) {
      throw new ValidationError('Invalid chunk number');
    }

    // Validate chunk size
    const expectedChunkSize =
      chunkNumber === metadata.totalChunks - 1
        ? metadata.totalSize % this.chunkSize || this.chunkSize
        : this.chunkSize;
    if (chunkData.length !== expectedChunkSize) {
      throw new ValidationError('Invalid chunk size');
    }

    // Write chunk to temp file
    const chunkPath = path.join(this.tempDir, `${uploadId}-${chunkNumber}`);
    await fs.writeFile(chunkPath, chunkData);

    // Update metadata
    metadata.uploadedChunks++;
    metadata.updatedAt = new Date();
    const progress = Math.round(
      (metadata.uploadedChunks / metadata.totalChunks) * 100,
    );

    // Check if upload is complete
    if (metadata.uploadedChunks === metadata.totalChunks) {
      metadata.status = 'complete';
      // Trigger file assembly
      this.assembleFile(metadata).catch((error) => {
        logger.error('Failed to assemble file', { uploadId, error });
        this.updateMetadata(uploadId, {
          status: 'failed',
          error: error.message,
        });
      });
    }

    // Update metadata in Redis
    await this.updateMetadata(uploadId, metadata);

    return {
      progress,
      status: metadata.status,
    };
  }

  /**
   * Get upload status
   */
  public async getUploadStatus(
    uploadId: string,
    userId: string,
  ): Promise<{ progress: number; status: string; error?: string }> {
    const metadataStr = await redis.get(`upload:${uploadId}`);
    if (!metadataStr) {
      throw new ValidationError('Upload not found or expired');
    }

    const metadata: ChunkMetadata = JSON.parse(metadataStr);

    // Validate user
    if (metadata.userId !== userId) {
      throw new ValidationError('Unauthorized');
    }

    return {
      progress: Math.round(
        (metadata.uploadedChunks / metadata.totalChunks) * 100,
      ),
      status: metadata.status,
      error: metadata.error,
    };
  }

  /**
   * Cancel an upload
   */
  public async cancelUpload(uploadId: string, userId: string): Promise<void> {
    const metadataStr = await redis.get(`upload:${uploadId}`);
    if (!metadataStr) {
      throw new ValidationError('Upload not found or expired');
    }

    const metadata: ChunkMetadata = JSON.parse(metadataStr);

    // Validate user
    if (metadata.userId !== userId) {
      throw new ValidationError('Unauthorized');
    }

    // Delete all chunks
    await this.cleanupChunks(uploadId, metadata.totalChunks);

    // Delete metadata
    await redis.del(`upload:${uploadId}`);
  }

  private async updateMetadata(
    uploadId: string,
    updates: Partial<ChunkMetadata>,
  ): Promise<void> {
    const metadataStr = await redis.get(`upload:${uploadId}`);
    if (!metadataStr) return;

    const metadata: ChunkMetadata = JSON.parse(metadataStr);
    const updatedMetadata = { ...metadata, ...updates, updatedAt: new Date() };

    await redis.set(
      `upload:${uploadId}`,
      JSON.stringify(updatedMetadata),
      'EX',
      3600, // 1 hour expiry
    );
  }

  private async cleanupChunks(
    uploadId: string,
    totalChunks: number,
  ): Promise<void> {
    const chunkPaths = Array.from({ length: totalChunks }, (_, i) =>
      path.join(this.tempDir, `${uploadId}-${i}`),
    );

    await Promise.all(
      chunkPaths.map(async (chunkPath) => {
        try {
          await fs.unlink(chunkPath);
        } catch (error) {
          // Ignore errors for non-existent files
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            logger.error('Failed to delete chunk', { chunkPath, error });
          }
        }
      }),
    );
  }

  private async assembleFile(metadata: ChunkMetadata): Promise<string> {
    const finalPath = path.join(
      config.uploads.dir,
      `${metadata.id}-${metadata.filename}`,
    );
    const writeStream = await fs.open(finalPath, 'w');

    try {
      // Write chunks in order
      for (let i = 0; i < metadata.totalChunks; i++) {
        const chunkPath = path.join(this.tempDir, `${metadata.id}-${i}`);
        const chunkData = await fs.readFile(chunkPath);
        await writeStream.write(chunkData);
      }

      // Clean up chunks
      await this.cleanupChunks(metadata.id, metadata.totalChunks);

      return finalPath;
    } catch (error) {
      // Clean up the partial file
      try {
        await fs.unlink(finalPath);
      } catch (unlinkError) {
        logger.error('Failed to clean up partial file', {
          finalPath,
          error: unlinkError,
        });
      }

      throw error;
    } finally {
      await writeStream.close();
    }
  }
}

export default new ChunkedUploadService();
