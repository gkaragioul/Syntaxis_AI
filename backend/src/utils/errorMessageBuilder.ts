import { ErrorMessage, ErrorCode } from '../types/ErrorMessage';
import { errorMessageTemplates } from '../config/errorMessages';

/**
 * Build a user-facing error message from an error code, with optional logId and dynamic details.
 */
export function buildErrorMessage({
  code,
  logId,
  userMessage,
  nextSteps,
  helpUrl,
}: {
  code: ErrorCode;
  logId?: string;
  userMessage?: string;
  nextSteps?: string;
  helpUrl?: string;
}): ErrorMessage {
  const template =
    errorMessageTemplates[code] || errorMessageTemplates.UNKNOWN_ERROR;
  return {
    code,
    userMessage: userMessage || template.userMessage,
    nextSteps: nextSteps || template.nextSteps,
    helpUrl: helpUrl || template.helpUrl,
    ...(logId ? { logId } : {}),
  };
}
