/**
 * Local File Upload Service
 * Handles file uploads using Electron IPC for offline/portable functionality
 */

export interface UploadProgress {
  progress: number;
  status: 'uploading' | 'complete' | 'failed';
  error?: string;
}

export interface UploadResponse {
  success: boolean;
  fileId: string;
  filename: string;
  size: number;
  uploadedAt: string;
}

const isElectron = (): boolean => {
  try {
    return !!(typeof window !== 'undefined' && (window as any).electron?.isElectron);
  } catch {
    return false;
  }
};

const getElectronAPI = () => {
  return (window as any).electron;
};

export class LocalFileUploadService {
  /**
   * Upload a file using Electron IPC
   */
  public static async uploadFile(
    file: File,
    onProgress: (progress: UploadProgress) => void,
    onError: (error: Error) => void
  ): Promise<string> {
    try {
      if (!isElectron()) {
        throw new Error('File upload only works in Electron environment');
      }

      const electronAPI = getElectronAPI();
      
      // Read file as base64
      const fileData = await this.fileToBase64(file);
      
      // Simulate progress
      onProgress({
        progress: 25,
        status: 'uploading',
      });

      // Upload file via IPC
      const response: UploadResponse = await electronAPI.files.upload({
        name: file.name,
        type: file.type,
        size: file.size,
        data: fileData,
      });

      onProgress({
        progress: 100,
        status: 'complete',
      });

      return response.fileId;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError(err);
      throw err;
    }
  }

  /**
   * Convert file to base64
   */
  private static fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Extract base64 part (remove data:application/pdf;base64, prefix)
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * List uploaded files
   */
  public static async listFiles(): Promise<any[]> {
    try {
      if (!isElectron()) {
        return [];
      }

      const electronAPI = getElectronAPI();
      return await electronAPI.files.list();
    } catch (error) {
      console.error('Error listing files:', error);
      return [];
    }
  }

  /**
   * Delete a file
   */
  public static async deleteFile(fileId: string): Promise<boolean> {
    try {
      if (!isElectron()) {
        return false;
      }

      const electronAPI = getElectronAPI();
      return await electronAPI.files.delete(fileId);
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }
}

export default LocalFileUploadService;

