import { Request } from 'express';
import crypto from 'crypto';
import { parseUserAgent } from './userAgent';

/**
 * Generate a unique device fingerprint based on various device characteristics
 * This is a simplified version - in production, you might want to use a more
 * sophisticated fingerprinting library or service
 */
export function generateDeviceFingerprint(req: Request): string {
  const parsed = parseUserAgent(req.headers['user-agent'] as string);

  // Collect various device characteristics
  const components = [
    // Browser
    parsed.browser.name,
    parsed.browser.version,
    parsed.browser.major,
    // OS
    parsed.os.name,
    parsed.os.version,
    // Device
    parsed.device.type,
    parsed.device.vendor,
    parsed.device.model,
    // Headers
    req.headers['accept-language'],
    req.headers['sec-ch-ua'],
    req.headers['sec-ch-ua-platform'],
    req.headers['sec-ch-ua-mobile'],
    // IP (first 3 octets only for privacy)
    req.ip?.split('.').slice(0, 3).join('.'),
  ].filter(Boolean); // Remove undefined/null values

  // Create a hash of the components
  const hash = crypto.createHash('sha256');
  hash.update(components.join('|'));
  return hash.digest('hex');
}
