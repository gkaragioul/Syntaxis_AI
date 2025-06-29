import { v4 as uuidv4 } from 'uuid';
import { logger } from './logger';

// Keys that should always be redacted in logs.
const SENSITIVE_KEYS = [
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'jwt',
  'secret',
  'credentials',
];

function redactObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactObject);
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.includes(k.toLowerCase())) {
        result[k] = '[REDACTED]';
      } else {
        result[k] = redactObject(v);
      }
    }
    return result;
  }
  return value;
}

export class LogSanitizer {
  /**
   * Redact sensitive information and emit to logger.
   * Returns the generated logId so the caller can surface it to the user.
   */
  static sanitizeAndLog(
    data: unknown,
    level: 'info' | 'warn' | 'error' | 'debug' = 'info',
    message = 'sanitized-log',
  ): { logId: string; sanitizedData: unknown } {
    const sanitizedData = redactObject(data);
    const logId = uuidv4();
    logger.log({ level, message, logId, ...((sanitizedData as object) ?? {}) });
    return { logId, sanitizedData };
  }
}
