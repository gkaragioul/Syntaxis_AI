/**
 * Sanitization utilities for data cleaning and validation
 */

/**
 * Sanitize data by removing potentially harmful content
 * @param data - The data to sanitize
 * @returns Sanitized data
 */
export function sanitizeData(data: any): any {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    // Remove potentially harmful characters and trim whitespace
    return data
      .trim()
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/['"]/g, ''); // Remove quotes
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item));
  }

  if (typeof data === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      // Sanitize the key and value
      const sanitizedKey = sanitizeData(key);
      const sanitizedValue = sanitizeData(value);
      sanitized[sanitizedKey] = sanitizedValue;
    }
    return sanitized;
  }

  return data;
}

/**
 * Sanitize a string for safe HTML display
 * @param str - The string to sanitize
 * @returns HTML-safe string
 */
export function sanitizeHtml(str: string): string {
  if (typeof str !== 'string') {
    return '';
  }

  const htmlEscapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  return str.replace(/[&<>"']/g, char => htmlEscapeMap[char]);
}

/**
 * Sanitize a string for safe SQL usage (basic protection)
 * @param str - The string to sanitize
 * @returns SQL-safe string
 */
export function sanitizeSql(str: string): string {
  if (typeof str !== 'string') {
    return '';
  }

  // Escape single quotes by doubling them
  return str.replace(/'/g, "''");
}

/**
 * Sanitize file paths to prevent directory traversal
 * @param filePath - The file path to sanitize
 * @returns Safe file path
 */
export function sanitizeFilePath(filePath: string): string {
  if (typeof filePath !== 'string') {
    return '';
  }

  // Remove directory traversal patterns
  return filePath
    .replace(/\.\./g, '')
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/');
}

