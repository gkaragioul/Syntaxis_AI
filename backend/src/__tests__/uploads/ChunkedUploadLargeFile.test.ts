import { ChunkedUploadService } from '../../services/ChunkedUploadService';
import { ValidationError } from '../../utils/errors';
import { v4 as uuidv4 } from 'uuid';

// Mock Redis so we don't hit a real server during tests
jest.mock('../../config/redis', () => {
  const store: Record<string, string> = {};
  return {
    redis: {
      set: jest.fn((key: string, value: string) => {
        store[key] = value;
        return Promise.resolve('OK');
      }),
      get: jest.fn((key: string) => Promise.resolve(store[key] ?? null)),
      del: jest.fn((key: string) => {
        delete store[key];
        return Promise.resolve(1);
      }),
    },
  };
});

describe('ChunkedUploadService – large file & fuzz cases', () => {
  const service = new ChunkedUploadService();

  it('should reject files larger than configured maxFileSize', async () => {
    await expect(
      service.initializeUpload(
        'user-123',
        'huge.pdf',
        2 * 1024 * 1024 * 1024, // 2GB
        'application/pdf',
      ),
    ).rejects.toThrow(ValidationError);
  });

  it('should reject mismatched chunk size during upload', async () => {
    // Prepare a valid (small) upload first
    const totalSize = 10 * 1024 * 1024; // 10 MB
    const { uploadId, chunkSize } = await service.initializeUpload(
      'user-123',
      'small.pdf',
      totalSize,
      'application/pdf',
    );

    // Create mocked metadata in Redis for later retrieval
    const metadata = {
      id: uploadId,
      filename: 'small.pdf',
      totalChunks: Math.ceil(totalSize / chunkSize),
      chunkSize,
      totalSize,
      mimeType: 'application/pdf',
      userId: 'user-123',
      uploadedChunks: 0,
      status: 'uploading',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    // Persist into mocked redis
    const { redis } = await import('../../config/redis');
    await redis.set(`upload:${uploadId}`, JSON.stringify(metadata));

    // Attempt to upload a chunk with wrong size (should be chunkSize but we supply chunkSize - 10)
    const wrongChunk = Buffer.alloc(chunkSize - 10);

    await expect(
      service.uploadChunk(uploadId, 0, wrongChunk, 'user-123'),
    ).rejects.toThrow(ValidationError);
  });
});
