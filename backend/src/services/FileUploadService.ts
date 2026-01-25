import { prisma } from '../prisma';
import { logger } from '../utils/logger';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs/promises';

import { BatchAnalysisService } from './analysis/BatchAnalysisService';

export class FileUploadService {
  private batchAnalysisService: BatchAnalysisService;

  constructor() {
    logger.info('FileUploadService initialized with Prisma');
    this.batchAnalysisService = new BatchAnalysisService(prisma);
  }

  // ... (calculateFileHash private method remains same)

  // ... (uploadFile method remains same)

  public async uploadBatch(userId: string, files: any[]) {
    try {
      logger.info('FileUploadService.uploadBatch started', { userId, fileCount: files.length });

      // Create batch job
      const batchJob = await prisma.batchJob.create({
        data: {
          userId,
          batchName: `Batch Upload ${new Date().toISOString()}`,
          status: 'pending',
          totalFiles: files.length,
          processedFiles: 0,
          failedFiles: 0,
        }
      });

      // Upload all files in the batch
      const uploadedFiles = [];
      let processedCount = 0;
      let failedCount = 0;

      for (const file of files) {
        try {
          const fileHash = await this.calculateFileHash(file.buffer);

          const fileRecord = await prisma.file.create({
            data: {
              userId,
              batchJobId: batchJob.id,
              filename: `${Date.now()}-${file.originalname}`,
              originalFilename: file.originalname,
              filePath: file.path || `/uploads/${userId}/${Date.now()}-${file.originalname}`,
              fileSize: BigInt(file.size), // Ensure BigInt
              mimeType: file.mimetype,
              fileHash,
              status: 'uploaded',
              uploadStatus: 'completed',
              processingStatus: 'pending',
              uploadedAt: new Date(),
            }
          });

          uploadedFiles.push(fileRecord);
          processedCount++;

        } catch (error: any) {
          logger.error('Failed to upload file in batch', { error: error.message, filename: file.originalname });
          failedCount++;
        }
      }

      // Update batch job status to 'uploaded' (or 'pending' analysis)
      await prisma.batchJob.update({
        where: { id: batchJob.id },
        data: {
          processedFiles: processedCount,
          failedFiles: failedCount,
          status: 'uploaded', // Ready for analysis
        }
      });

      logger.info('Batch upload completed, triggering analysis', { 
        batchJobId: batchJob.id, 
        totalFiles: files.length 
      });

      // Trigger Async Analysis
      // Fire and forget (or use a queue in production)
      this.batchAnalysisService.analyzeBatch(batchJob.id, userId).catch(err => {
          logger.error(`Async batch analysis failed for ${batchJob.id}`, { error: err });
      });

      return { fileUploads: uploadedFiles, batchJob };

    } catch (error: any) {
      logger.error('FileUploadService.uploadBatch failed', { error: error.message, userId });
      throw error;
    }
  }

  public async getBatchJobStatus(batchJobId: string, userId: string) {
    return await prisma.batchJob.findUnique({
      where: { id: batchJobId, userId },
      include: { 
          files: {
              include: {
                  matchedTemplate: {
                      select: { id: true, name: true, vendorName: true }
                  }
              }
          } 
      }
    });
  }

  public async getFileUploadStatus(fileUploadId: string, userId: string) {
    return await prisma.file.findUnique({
      where: { id: fileUploadId, userId }
    });
  }
}

export default FileUploadService;
