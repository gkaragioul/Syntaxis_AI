import { Request } from 'express';
import crypto from 'crypto';
import { UAParser } from 'ua-parser-js';

/**
 * Generate a unique device fingerprint based on various device characteristics
 * This is a simplified version - in production, you might want to use a more
 * sophisticated fingerprinting library or service
 */
export function generateDeviceFingerprint(req: Request): string {
  const ua = new UAParser(req.headers['user-agent'] as string);
  const browser = ua.getBrowser();
  const os = ua.getOS();
  const device = ua.getDevice();

  // Collect various device characteristics
  const components = [
    // Browser
    browser.name,
    browser.version,
    browser.major,
    // OS
    os.name,
    os.version,
    // Device
    device.type,
    device.vendor,
    device.model,
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
