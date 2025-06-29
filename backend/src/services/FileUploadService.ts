import { Transaction } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import { FileUpload, FileUploadStatus } from '../models/FileUpload';
import { BatchJob, BatchJobStatus } from '../models/BatchJob';
import { BatchJobFile, BatchJobFileStatus } from '../models/BatchJobFile';
import { ExtractedData, ExtractedDataType } from '../models/ExtractedData';
import { sequelize } from '../config/database';
import { StorageService } from './StorageService';
import { EncryptionService } from './EncryptionService';
import { ProcessingService } from './ProcessingService';
import { ValidationError } from '../utils/errors';
import { ErrorCodes } from '../types/ErrorMessage';

export class FileUploadService {
  private storageService: StorageService;
  private encryptionService: EncryptionService;
  private processingService: ProcessingService;

  constructor(
    storageService: StorageService,
    encryptionService: EncryptionService,
    processingService: ProcessingService,
  ) {
    this.storageService = storageService;
    this.encryptionService = encryptionService;
    this.processingService = processingService;
  }

  /**
   * Upload a single file and create a batch job for it
   */
  public async uploadFile(
    userId: string,
    file: Express.Multer.File,
  ): Promise<{ fileUpload: FileUpload; batchJob: BatchJob }> {
    // Validate file
    this.validateFile(file);

    // Generate encryption key
    const encryptionKeyId = await this.encryptionService.generateKey();

    // Start transaction
    return await sequelize.transaction(async (transaction) => {
      // Upload file to storage
      const storagePath = await this.storageService.uploadFile(file.buffer, {
        userId,
        originalFilename: file.originalname,
        mimeType: file.mimetype,
      });

      // Create file upload record
      const fileUpload = await FileUpload.create(
        {
          userId,
          originalFilename: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
          storagePath,
          encryptionKeyId,
          status: 'uploaded',
        },
        { transaction },
      );

      // Create batch job
      const batchJob = await BatchJob.create(
        {
          userId,
          status: 'pending',
          totalFiles: 1,
        },
        { transaction },
      );

      // Create batch job file record
      await BatchJobFile.create(
        {
          batchJobId: batchJob.id,
          fileUploadId: fileUpload.id,
          position: 0,
          status: 'pending',
        },
        { transaction },
      );

      // Start processing
      await this.startProcessing(batchJob.id, transaction);

      return { fileUpload, batchJob };
    });
  }

  /**
   * Upload multiple files in a batch
   */
  public async uploadBatch(
    userId: string,
    files: Express.Multer.File[],
  ): Promise<{ fileUploads: FileUpload[]; batchJob: BatchJob }> {
    // Validate all files
    files.forEach((file) => this.validateFile(file));

    // Generate encryption keys for all files
    const encryptionKeyIds = await Promise.all(
      files.map(() => this.encryptionService.generateKey()),
    );

    // Start transaction
    return await sequelize.transaction(async (transaction) => {
      // Create batch job first
      const batchJob = await BatchJob.create(
        {
          userId,
          status: 'pending',
          totalFiles: files.length,
        },
        { transaction },
      );

      // Upload files and create records
      const fileUploads = await Promise.all(
        files.map(async (file, index) => {
          // Upload to storage
          const storagePath = await this.storageService.uploadFile(
            file.buffer,
            {
              userId,
              originalFilename: file.originalname,
              mimeType: file.mimetype,
            },
          );

          // Create file upload record
          const fileUpload = await FileUpload.create(
            {
              userId,
              originalFilename: file.originalname,
              fileSize: file.size,
              mimeType: file.mimetype,
              storagePath,
              encryptionKeyId: encryptionKeyIds[index],
              status: 'uploaded',
            },
            { transaction },
          );

          // Create batch job file record
          await BatchJobFile.create(
            {
              batchJobId: batchJob.id,
              fileUploadId: fileUpload.id,
              position: index,
              status: 'pending',
            },
            { transaction },
          );

          return fileUpload;
        }),
      );

      // Start processing
      await this.startProcessing(batchJob.id, transaction);

      return { fileUploads, batchJob };
    });
  }

  /**
   * Get batch job status
   */
  public async getBatchJobStatus(
    batchJobId: string,
    userId: string,
  ): Promise<BatchJob> {
    const batchJob = await BatchJob.findOne({
      where: { id: batchJobId, userId },
      include: [
        {
          model: BatchJobFile,
          include: [
            {
              model: FileUpload,
              attributes: ['id', 'originalFilename', 'status', 'errorMessage'],
            },
          ],
        },
      ],
    });

    if (!batchJob) {
      throw new ValidationError('Batch job not found');
    }

    return batchJob;
  }

  /**
   * Get file upload status
   */
  public async getFileUploadStatus(
    fileUploadId: string,
    userId: string,
  ): Promise<FileUpload> {
    const fileUpload = await FileUpload.findOne({
      where: { id: fileUploadId, userId },
      include: [
        {
          model: ExtractedData,
          attributes: ['id', 'dataType', 'confidenceScore'],
        },
      ],
    });

    if (!fileUpload) {
      throw new ValidationError('File upload not found');
    }

    return fileUpload;
  }

  /**
   * Start processing a batch job
   */
  private async startProcessing(
    batchJobId: string,
    transaction: Transaction,
  ): Promise<void> {
    // Update batch job status
    await BatchJob.update(
      { status: 'processing' },
      { where: { id: batchJobId }, transaction },
    );

    // Get all pending files
    const batchJobFiles = await BatchJobFile.findAll({
      where: { batchJobId, status: 'pending' },
      include: [{ model: FileUpload }],
      transaction,
    });

    // Process each file
    await Promise.all(
      batchJobFiles.map(async (batchJobFile) => {
        try {
          // Update file status
          await FileUpload.update(
            { status: 'processing' },
            { where: { id: batchJobFile.fileUploadId }, transaction },
          );

          await BatchJobFile.update(
            { status: 'processing' },
            {
              where: { batchJobId, fileUploadId: batchJobFile.fileUploadId },
              transaction,
            },
          );

          // Process file
          const result = await this.processingService.processFile(
            batchJobFile.fileUpload!,
            batchJobId,
          );

          // Store extracted data
          await ExtractedData.create(
            {
              fileUploadId: batchJobFile.fileUploadId,
              batchJobId,
              dataType: result.type,
              content: result.content,
              confidenceScore: result.confidenceScore,
              encryptionKeyId: batchJobFile.fileUpload!.encryptionKeyId,
            },
            { transaction },
          );

          // Update file status
          await FileUpload.update(
            { status: 'completed', processedAt: new Date() },
            { where: { id: batchJobFile.fileUploadId }, transaction },
          );

          await BatchJobFile.update(
            { status: 'completed' },
            {
              where: { batchJobId, fileUploadId: batchJobFile.fileUploadId },
              transaction,
            },
          );

          // Update batch job progress
          await BatchJob.increment('processedFiles', {
            where: { id: batchJobId },
            transaction,
          });
        } catch (error) {
          // Handle processing error
          await this.handleProcessingError(
            batchJobId,
            batchJobFile.fileUploadId,
            error as Error,
            transaction,
          );
        }
      }),
    );

    // Check if batch job is complete
    const batchJob = await BatchJob.findByPk(batchJobId, { transaction });
    if (batchJob && batchJob.isComplete()) {
      await BatchJob.update(
        {
          status: batchJob.failedFiles > 0 ? 'failed' : 'completed',
          completedAt: new Date(),
        },
        { where: { id: batchJobId }, transaction },
      );
    }
  }

  /**
   * Handle processing error for a file
   */
  private async handleProcessingError(
    batchJobId: string,
    fileUploadId: string,
    error: Error,
    transaction: Transaction,
  ): Promise<void> {
    // Update file status
    await FileUpload.update(
      {
        status: 'failed',
        errorMessage: error.message,
      },
      { where: { id: fileUploadId }, transaction },
    );

    await BatchJobFile.update(
      {
        status: 'failed',
        errorMessage: error.message,
      },
      { where: { batchJobId, fileUploadId }, transaction },
    );

    // Update batch job progress
    await BatchJob.increment('failedFiles', {
      where: { id: batchJobId },
      transaction,
    });

    // Add error to batch job summary
    const batchJob = await BatchJob.findByPk(batchJobId, { transaction });
    if (batchJob) {
      await batchJob.addError(fileUploadId, error.message);
    }
  }

  /**
   * Validate file before upload
   */
  private validateFile(file: Express.Multer.File): void {
    // Check file size (100MB limit)
    if (file.size > 104857600) {
      const error: any = new Error('File size exceeds 100MB limit');
      error.code = ErrorCodes.PDF_CORRUPT;
      error.userMessage = 'The file is too large to upload.';
      error.nextSteps = 'Please select a PDF file smaller than 100MB.';
      error.helpUrl = 'https://help.example.com/pdf-upload-errors'; // TODO
      error.statusCode = 400;
      throw error;
    }

    // Check file type
    if (file.mimetype !== 'application/pdf') {
      const error: any = new Error('Only PDF files are supported');
      error.code = ErrorCodes.PDF_CORRUPT;
      error.userMessage = 'Only PDF files are supported.';
      error.nextSteps = 'Please upload a valid PDF file.';
      error.helpUrl = 'https://help.example.com/pdf-upload-errors'; // TODO
      error.statusCode = 400;
      throw error;
    }

    // Check if file is empty
    if (file.size === 0) {
      const error: any = new Error('File is empty');
      error.code = ErrorCodes.PDF_CORRUPT;
      error.userMessage = 'The uploaded file is empty.';
      error.nextSteps = 'Please check the file and try again.';
      error.helpUrl = 'https://help.example.com/pdf-upload-errors'; // TODO
      error.statusCode = 400;
      throw error;
    }
  }
}

export default FileUploadService;
