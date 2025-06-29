import { api } from './api';
import { config } from '../config';

export interface UploadProgress {
    progress: number;
    status: 'uploading' | 'complete' | 'failed';
    error?: string;
}

export interface UploadInitResponse {
    uploadId: string;
    chunkSize: number;
}

export class ChunkedUploadService {
    private static readonly CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
    private static readonly MAX_CONCURRENT_CHUNKS = 3;
    private static readonly RETRY_ATTEMPTS = 3;
    private static readonly RETRY_DELAY = 1000; // 1 second

    /**
     * Initialize a new upload
     */
    public static async initializeUpload(
        file: File
    ): Promise<{ uploadId: string; chunkSize: number }> {
        const response = await api.post<UploadInitResponse>('/uploads/initialize', {
            filename: file.name,
            totalSize: file.size,
            mimeType: file.type,
        });

        return response.data;
    }

    /**
     * Upload a file in chunks
     */
    public static async uploadFile(
        file: File,
        onProgress: (progress: UploadProgress) => void,
        onError: (error: Error) => void
    ): Promise<string> {
        try {
            // Initialize upload
            const { uploadId, chunkSize } = await this.initializeUpload(file);
            const totalChunks = Math.ceil(file.size / chunkSize);
            let uploadedChunks = 0;

            // Create a queue of chunks to upload
            const chunks: number[] = Array.from({ length: totalChunks }, (_, i) => i);
            const activeUploads = new Set<number>();
            const failedChunks = new Set<number>();

            // Function to upload a single chunk
            const uploadChunk = async (chunkNumber: number): Promise<void> => {
                const start = chunkNumber * chunkSize;
                const end = Math.min(start + chunkSize, file.size);
                const chunk = file.slice(start, end);

                let attempts = 0;
                while (attempts < this.RETRY_ATTEMPTS) {
                    try {
                        const response = await api.post(
                            `/uploads/chunk/${uploadId}/${chunkNumber}`,
                            await chunk.arrayBuffer(),
                            {
                                headers: {
                                    'Content-Type': 'application/octet-stream',
                                },
                            }
                        );

                        const { progress, status } = response.data;
                        uploadedChunks++;

                        onProgress({
                            progress: Math.round((uploadedChunks / totalChunks) * 100),
                            status,
                        });

                        if (status === 'failed') {
                            throw new Error('Upload failed');
                        }

                        activeUploads.delete(chunkNumber);
                        return;
                    } catch (error) {
                        attempts++;
                        if (attempts === this.RETRY_ATTEMPTS) {
                            failedChunks.add(chunkNumber);
                            throw error;
                        }
                        await new Promise((resolve) =>
                            setTimeout(resolve, this.RETRY_DELAY * attempts)
                        );
                    }
                }
            };

            // Process chunks with concurrency control
            while (chunks.length > 0 || activeUploads.size > 0) {
                // Fill up to max concurrent uploads
                while (activeUploads.size < this.MAX_CONCURRENT_CHUNKS && chunks.length > 0) {
                    const chunkNumber = chunks.shift()!;
                    activeUploads.add(chunkNumber);
                    uploadChunk(chunkNumber).catch((error) => {
                        onError(error);
                        activeUploads.delete(chunkNumber);
                    });
                }

                // Wait for some uploads to complete
                if (activeUploads.size >= this.MAX_CONCURRENT_CHUNKS) {
                    await new Promise((resolve) => setTimeout(resolve, 100));
                }
            }

            // Check for failed chunks
            if (failedChunks.size > 0) {
                throw new Error(
                    `Failed to upload ${failedChunks.size} chunks. Please try again.`
                );
            }

            // Wait for final status
            const finalStatus = await this.getUploadStatus(uploadId);
            if (finalStatus.status === 'failed') {
                throw new Error(finalStatus.error || 'Upload failed');
            }

            return uploadId;
        } catch (error) {
            onError(error as Error);
            throw error;
        }
    }

    /**
     * Get upload status
     */
    public static async getUploadStatus(uploadId: string): Promise<UploadProgress> {
        const response = await api.get<UploadProgress>(`/uploads/status/${uploadId}`);
        return response.data;
    }

    /**
     * Cancel an upload
     */
    public static async cancelUpload(uploadId: string): Promise<void> {
        await api.delete(`/uploads/${uploadId}`);
    }
}

export default ChunkedUploadService; 