import { Request } from 'express';
import { UAParser } from 'ua-parser-js';

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
  const ua = new UAParser(req.headers['user-agent'] as string);
  const browser = ua.getBrowser();
  const os = ua.getOS();
  const device = ua.getDevice();

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
    os: `${os.name} ${os.version}`,
    browser: `${browser.name} ${browser.version}`,
    deviceType: device.type || 'desktop',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] as string || 'unknown',
    screenResolution,
    timezone,
  };
}
