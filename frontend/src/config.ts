// API configuration - Support both Vite and Create React App environment variables
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// File upload configuration
export const FILE_UPLOAD_CONFIG = {
  maxFileSize: 100 * 1024 * 1024, // 100MB in bytes
  allowedFileTypes: ['application/pdf'],
  maxFilesPerBatch: 50,
} as const;

export const config = {
  uploads: {
    maxFileSize: FILE_UPLOAD_CONFIG.maxFileSize,
  },
} as const;

// Other configuration constants can be added here