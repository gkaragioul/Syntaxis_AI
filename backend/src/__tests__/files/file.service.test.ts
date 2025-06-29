import { describe, it, expect, beforeEach, jest } from '../jest-globals';
import { PrismaClient } from '@prisma/client';
import { FileService } from '../../services/FileService';
import { ValidationError, AuthorizationError } from '../../utils/errors';
import { mockServices } from '../mocks/services';
import { TEST_USER, TEST_FILE } from '../setup';

describe('FileService', () => {
  let fileService: FileService;
  let prisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    prisma = new PrismaClient() as jest.Mocked<PrismaClient>;
    fileService = new FileService(
      prisma,
      mockServices.storage,
      mockServices.queue,
    );
  });

  describe('uploadFile', () => {
    it('should upload a valid PDF file successfully', async () => {
      const file = {
        ...TEST_FILE,
        originalname: 'test.pdf',
        mimetype: 'application/pdf',
        size: 1024 * 1024, // 1MB
      };

      prisma.file.create.mockResolvedValueOnce({
        ...file,
        id: 'test-file-id',
        userId: TEST_USER.id,
        status: 'PENDING',
      });

      const result = await fileService.uploadFile(TEST_USER.id, file);

      expect(result).toBeDefined();
      expect(result.id).toBe('test-file-id');
      expect(result.userId).toBe(TEST_USER.id);
      expect(result.status).toBe('PENDING');

      expect(mockServices.storage.uploadFile).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.stringContaining('test.pdf'),
      );
    });

    it('should throw ValidationError for non-PDF files', async () => {
      const file = {
        ...TEST_FILE,
        originalname: 'test.txt',
        mimetype: 'text/plain',
        size: 1024,
      };

      await expect(fileService.uploadFile(TEST_USER.id, file)).rejects.toThrow(
        ValidationError,
      );
      expect(prisma.file.create).not.toHaveBeenCalled();
    });

    it('should throw ValidationError for files larger than 10MB', async () => {
      const file = {
        ...TEST_FILE,
        originalname: 'large.pdf',
        mimetype: 'application/pdf',
        size: 11 * 1024 * 1024, // 11MB
      };

      await expect(fileService.uploadFile(TEST_USER.id, file)).rejects.toThrow(
        ValidationError,
      );
      expect(prisma.file.create).not.toHaveBeenCalled();
    });

    it('should throw ValidationError if user exceeds monthly upload limit', async () => {
      const file = {
        ...TEST_FILE,
        originalname: 'test.pdf',
        mimetype: 'application/pdf',
        size: 1024 * 1024,
      };

      prisma.file.count.mockResolvedValueOnce(100); // User has reached limit

      await expect(fileService.uploadFile(TEST_USER.id, file)).rejects.toThrow(
        ValidationError,
      );
      expect(prisma.file.create).not.toHaveBeenCalled();
    });
  });

  describe('getFile', () => {
    it('should return file metadata for authorized user', async () => {
      const file = {
        ...TEST_FILE,
        id: 'test-file-id',
        userId: TEST_USER.id,
      };

      prisma.file.findUnique.mockResolvedValueOnce(file);

      const result = await fileService.getFile(TEST_USER.id, file.id);

      expect(result).toBeDefined();
      expect(result.id).toBe(file.id);
      expect(result.userId).toBe(TEST_USER.id);
    });

    it('should throw AuthorizationError for unauthorized access', async () => {
      const file = {
        ...TEST_FILE,
        id: 'test-file-id',
        userId: 'other-user-id',
      };

      prisma.file.findUnique.mockResolvedValueOnce(file);

      await expect(fileService.getFile(TEST_USER.id, file.id)).rejects.toThrow(
        AuthorizationError,
      );
    });

    it('should throw error if file not found', async () => {
      prisma.file.findUnique.mockResolvedValueOnce(null);

      await expect(
        fileService.getFile(TEST_USER.id, 'nonexistent-file-id'),
      ).rejects.toThrow('File not found');
    });
  });

  describe('listFiles', () => {
    it('should return list of files for user', async () => {
      const files = [
        {
          ...TEST_FILE,
          id: 'file-1',
          userId: TEST_USER.id,
        },
        {
          ...TEST_FILE,
          id: 'file-2',
          userId: TEST_USER.id,
        },
      ];

      prisma.file.findMany.mockResolvedValueOnce(files);

      const result = await fileService.listFiles(TEST_USER.id);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('file-1');
      expect(result[1].id).toBe('file-2');
    });

    it('should filter files by status', async () => {
      const files = [
        {
          ...TEST_FILE,
          id: 'file-1',
          userId: TEST_USER.id,
          status: 'COMPLETED',
        },
      ];

      prisma.file.findMany.mockResolvedValueOnce(files);

      const result = await fileService.listFiles(TEST_USER.id, {
        status: 'COMPLETED',
      });

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('COMPLETED');
      expect(prisma.file.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'COMPLETED',
          }),
        }),
      );
    });
  });

  describe('deleteFile', () => {
    it('should delete file for authorized user', async () => {
      const file = {
        ...TEST_FILE,
        id: 'test-file-id',
        userId: TEST_USER.id,
      };

      prisma.file.findUnique.mockResolvedValueOnce(file);
      prisma.file.delete.mockResolvedValueOnce(file);

      await fileService.deleteFile(TEST_USER.id, file.id);

      expect(mockServices.storage.deleteFile).toHaveBeenCalledWith(file.id);
      expect(prisma.file.delete).toHaveBeenCalledWith({
        where: { id: file.id },
      });
    });

    it('should throw AuthorizationError for unauthorized deletion', async () => {
      const file = {
        ...TEST_FILE,
        id: 'test-file-id',
        userId: 'other-user-id',
      };

      prisma.file.findUnique.mockResolvedValueOnce(file);

      await expect(
        fileService.deleteFile(TEST_USER.id, file.id),
      ).rejects.toThrow(AuthorizationError);
      expect(mockServices.storage.deleteFile).not.toHaveBeenCalled();
      expect(prisma.file.delete).not.toHaveBeenCalled();
    });
  });
});
