export interface ParsedUserAgent {
  browser: {
    name?: string;
    version?: string;
    major?: string;
  };
  os: {
    name?: string;
    version?: string;
  };
  device: {
    type?: string;
    vendor?: string;
    model?: string;
  };
}

export function parseUserAgent(userAgent = ''): ParsedUserAgent {
  const browser = parseBrowser(userAgent);
  const os = parseOs(userAgent);
  const device = parseDevice(userAgent);

  return { browser, os, device };
}

function parseBrowser(userAgent: string): ParsedUserAgent['browser'] {
  const browserPatterns: Array<[string, RegExp]> = [
    ['Microsoft Edge', /Edg\/([\d.]+)/],
    ['Chrome', /Chrome\/([\d.]+)/],
    ['Firefox', /Firefox\/([\d.]+)/],
    ['Safari', /Version\/([\d.]+).*Safari/],
  ];

  for (const [name, pattern] of browserPatterns) {
    const match = userAgent.match(pattern);
    if (match) {
      const version = match[1];
      return { name, version, major: version.split('.')[0] };
    }
  }

  return { name: 'unknown', version: 'unknown', major: 'unknown' };
}

function parseOs(userAgent: string): ParsedUserAgent['os'] {
  const osPatterns: Array<[string, RegExp]> = [
    ['Windows', /Windows NT ([\d.]+)/],
    ['macOS', /Mac OS X ([\d_]+)/],
    ['iOS', /(?:iPhone|iPad).*OS ([\d_]+)/],
    ['Android', /Android ([\d.]+)/],
    ['Linux', /Linux/],
  ];

  for (const [name, pattern] of osPatterns) {
    const match = userAgent.match(pattern);
    if (match) {
      const version = match[1]?.replace(/_/g, '.') ?? 'unknown';
      return { name, version };
    }
  }

  return { name: 'unknown', version: 'unknown' };
}

function parseDevice(userAgent: string): ParsedUserAgent['device'] {
  if (/iPad/i.test(userAgent)) return { type: 'tablet', vendor: 'Apple', model: 'iPad' };
  if (/iPhone/i.test(userAgent)) return { type: 'mobile', vendor: 'Apple', model: 'iPhone' };
  if (/Android/i.test(userAgent) && /Mobile/i.test(userAgent)) return { type: 'mobile', vendor: 'Android' };
  if (/Android/i.test(userAgent)) return { type: 'tablet', vendor: 'Android' };
  return { type: 'desktop' };
}
