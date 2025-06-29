export interface ErrorMessage {
  code: string;
  userMessage: string;
  nextSteps: string;
  helpUrl: string;
  logId?: string;
}

export const ErrorCodes = {
  PDF_CORRUPT: 'PDF_CORRUPT',
  TEMPLATE_MISMATCH: 'TEMPLATE_MISMATCH',
  LICENSE_EXPIRED: 'LICENSE_EXPIRED',
  DEVICE_CONFLICT: 'DEVICE_CONFLICT',
  EXPORT_FAILED: 'EXPORT_FAILED',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  // Add more as needed
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
