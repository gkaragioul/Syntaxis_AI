import { PrismaClient, File, User } from '@prisma/client';
import { ValidationError, AuthorizationError } from '../utils/errors';
import { createWriteStream, promises as fs } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { pipeline } from 'stream/promises';

interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

interface FileFilters {
  status?: 'uploaded' | 'processing' | 'completed' | 'failed';
}

export class FileService {
  private readonly uploadDir: string;
  private readonly maxFileSize: number = 10 * 1024 * 1024; // 10MB
  private readonly allowedMimeTypes: string[] = ['application/pdf'];

  constructor(private prisma: PrismaClient) {
    this.uploadDir = join(process.cwd(), 'uploads');
    this.initializeUploadDirectory();
  }

  private async initializeUploadDirectory(): Promise<void> {
    try {
      await fs.access(this.uploadDir);
    } catch {
      await fs.mkdir(this.uploadDir, { recursive: true });
    }
  }

  async uploadFile(file: UploadedFile, userId: string): Promise<File> {
    // Validate file type
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new ValidationError(
        'file',
        file.mimetype,
        'Only PDF files are allowed',
      );
    }

    // Validate file size
    if (file.size > this.maxFileSize) {
      throw new ValidationError(
        'file',
        file.size,
        'File size exceeds 10MB limit',
      );
    }

    // Check user's monthly limit
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        subscriptionStatus: true,
        invoicesProcessedThisMonth: true,
        monthlyLimit: true,
      },
    });

    if (!user) {
      throw new ValidationError('user', userId, 'User not found');
    }

    if (user.invoicesProcessedThisMonth >= user.monthlyLimit) {
      throw new ValidationError(
        'user',
        user.invoicesProcessedThisMonth,
        'Monthly upload limit reached',
      );
    }

    // Generate unique filename
    const filename = `${uuidv4()}.pdf`;
    const filePath = join(this.uploadDir, filename);

    try {
      // Write file to disk
      await fs.writeFile(filePath, file.buffer);

      // Create file record in database
      const fileRecord = await this.prisma.file.create({
        data: {
          userId,
          filename,
          originalFilename: file.originalname,
          filePath,
          fileSize: file.size,
          mimeType: file.mimetype,
          status: 'uploaded',
        },
      });

      // Update user's processed count
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          invoicesProcessedThisMonth: {
            increment: 1,
          },
        },
      });

      return fileRecord;
    } catch (error) {
      // Clean up file if database operation fails
      try {
        await fs.unlink(filePath);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  async getFile(fileId: string, userId: string): Promise<File> {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new Error('File not found');
    }

    if (file.userId !== userId) {
      throw new AuthorizationError('Not authorized to access this file');
    }

    return file;
  }

  async listFiles(userId: string, filters?: FileFilters): Promise<File[]> {
    return this.prisma.file.findMany({
      where: {
        userId,
        ...(filters?.status && { status: filters.status }),
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async deleteFile(fileId: string, userId: string): Promise<void> {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new Error('File not found');
    }

    if (file.userId !== userId) {
      throw new AuthorizationError('Not authorized to delete this file');
    }

    try {
      // Delete file from disk
      await fs.unlink(file.filePath);
    } catch (error) {
      // Log error but continue with database deletion
      console.error(`Error deleting file from disk: ${error}`);
    }

    // Delete file record from database
    await this.prisma.file.delete({
      where: { id: fileId },
    });

    // Decrement user's processed count
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        invoicesProcessedThisMonth: {
          decrement: 1,
        },
      },
    });
  }

  async getFileStream(
    fileId: string,
    userId: string,
  ): Promise<NodeJS.ReadableStream> {
    const file = await this.getFile(fileId, userId);

    try {
      await fs.access(file.filePath);
    } catch {
      throw new Error('File not found on disk');
    }

    return fs.createReadStream(file.filePath);
  }
}
