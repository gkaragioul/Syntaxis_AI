import axios from 'axios';
import { API_BASE_URL } from '../config';

export interface BatchJobStatus {
    id: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    totalFiles: number;
    processedFiles: number;
    failedFiles: number;
    errorSummary?: Record<string, string>;
    createdAt: string;
    updatedAt: string;
    getProgress: () => number;
}

export class FileUploadService {
    private static readonly API_URL = `${API_BASE_URL}/api/files`;

    /**
     * Upload a batch of files
     */
    static async uploadBatch(files: File[]): Promise<{ batchJobId: string }> {
        const formData = new FormData();
        files.forEach((file) => {
            formData.append('files', file);
        });

        const response = await axios.post<{ batchJobId: string }>(
            `${this.API_URL}/upload-batch`,
            formData,
            {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round(
                        (progressEvent.loaded * 100) / (progressEvent.total ?? 1)
                    );
                    // You can emit this progress to a global state manager if needed
                    console.log(`Upload progress: ${percentCompleted}%`);
                },
            }
        );

        return response.data;
    }

    /**
     * Get the status of a batch upload job
     */
    static async getBatchJobStatus(batchJobId: string): Promise<BatchJobStatus> {
        const response = await axios.get<BatchJobStatus>(
            `${this.API_URL}/batch-status/${batchJobId}`
        );
        return {
            ...response.data,
            getProgress: () => {
                const { totalFiles, processedFiles } = response.data;
                if (totalFiles === 0) return 0;
                return Math.round((processedFiles / totalFiles) * 100);
            },
        };
    }

    /**
     * Cancel a batch upload job
     */
    static async cancelBatchJob(batchJobId: string): Promise<void> {
        await axios.post(`${this.API_URL}/cancel-batch/${batchJobId}`);
    }

    /**
     * Get a list of recent batch jobs
     */
    static async getRecentBatchJobs(limit: number = 10): Promise<BatchJobStatus[]> {
        const response = await axios.get<BatchJobStatus[]>(`${this.API_URL}/recent-batches`, {
            params: { limit },
        });
        return response.data.map((job) => ({
            ...job,
            getProgress: () => {
                const { totalFiles, processedFiles } = job;
                if (totalFiles === 0) return 0;
                return Math.round((processedFiles / totalFiles) * 100);
            },
        }));
    }

    /**
     * Delete a batch job and its associated files
     */
    static async deleteBatchJob(batchJobId: string): Promise<void> {
        await axios.delete(`${this.API_URL}/batch/${batchJobId}`);
    }
} 