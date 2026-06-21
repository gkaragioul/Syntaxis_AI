import { Request } from 'express';
import { parseUserAgent } from './userAgent';

interface DeviceInfo {
  os: string;
  browser: string;
  deviceType: string;
  ipAddress: string | undefined;
  userAgent: string;
  screenResolution?: string;
  timezone?: string;
}

export function getDeviceInfo(req: Request): DeviceInfo {
  const parsed = parseUserAgent(req.headers['user-agent'] as string);

  // Get screen resolution from headers if available
  const screenResolution =
    req.headers['sec-ch-viewport-width'] &&
    req.headers['sec-ch-viewport-height']
      ? `${req.headers['sec-ch-viewport-width']}x${req.headers['sec-ch-viewport-height']}`
      : undefined;

  // Get timezone from headers if available
  const timezone = req.headers['sec-ch-prefers-color-scheme'] as
    | string
    | undefined;

  return {
    os: `${parsed.os.name} ${parsed.os.version}`,
    browser: `${parsed.browser.name} ${parsed.browser.version}`,
    deviceType: parsed.device.type || 'desktop',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] as string || 'unknown',
    screenResolution,
    timezone,
  };
}
