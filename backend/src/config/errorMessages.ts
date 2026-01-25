import { ErrorCodes, ErrorMessage } from '../types/ErrorMessage';
import { config } from '../config';

const getHelpUrl = (path: string) => {
  const baseUrl = config.app?.url || process.env.APP_URL || 'https://syntaxisai.com';
  return `${baseUrl}/help${path}`;
};

export const errorMessageTemplates: Record<
  string,
  Omit<ErrorMessage, 'logId'>
> = {
  [ErrorCodes.PDF_CORRUPT]: {
    code: ErrorCodes.PDF_CORRUPT,
    userMessage: 'The PDF file you uploaded is corrupt or not supported.',
    nextSteps:
      'Please check the file integrity and try re-uploading. If the problem persists, try a different file or contact support.',
    helpUrl: getHelpUrl('/pdf-upload-errors'),
  },
  [ErrorCodes.TEMPLATE_MISMATCH]: {
    code: ErrorCodes.TEMPLATE_MISMATCH,
    userMessage:
      'The selected extraction template is not compatible with this document.',
    nextSteps:
      'Edit the template to match your document or create a new template. See our guide for template compatibility.',
    helpUrl: getHelpUrl('/template-mismatch'),
  },
  [ErrorCodes.LICENSE_EXPIRED]: {
    code: ErrorCodes.LICENSE_EXPIRED,
    userMessage: 'Your license has expired.',
    nextSteps:
      'Renew your license to continue using the platform. Visit the license management page for renewal options.',
    helpUrl: getHelpUrl('/license-renewal'),
  },
  [ErrorCodes.DEVICE_CONFLICT]: {
    code: ErrorCodes.DEVICE_CONFLICT,
    userMessage: 'There is a conflict with your registered devices.',
    nextSteps:
      'Manage your devices to resolve the conflict. You may need to deactivate an old device or contact support.',
    helpUrl: getHelpUrl('/device-management'),
  },
  [ErrorCodes.EXPORT_FAILED]: {
    code: ErrorCodes.EXPORT_FAILED,
    userMessage: 'The export operation failed due to an internal error.',
    nextSteps:
      'Try exporting again. If the issue continues, download the error report or contact support.',
    helpUrl: getHelpUrl('/export-errors'),
  },
  [ErrorCodes.UNKNOWN_ERROR]: {
    code: ErrorCodes.UNKNOWN_ERROR,
    userMessage: 'An unexpected error occurred.',
    nextSteps: 'Please try again. If the problem persists, contact support.',
    helpUrl: getHelpUrl('/general-errors'),
  },
};
