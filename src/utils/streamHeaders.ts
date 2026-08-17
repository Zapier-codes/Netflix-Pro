// src/utils/streamHeaders.ts

import { userAgents } from 'user-agents';

// ─── User-Agent Rotation ───
let cachedUserAgent: string | null = null;
let lastRotation = Date.now();
const ROTATION_INTERVAL_MS = 300000; // 5 minutes

/**
 * Get a random realistic user agent
 * Rotates every 5 minutes to avoid fingerprinting
 */
function getRandomUserAgent(): string {
  const now = Date.now();
  if (!cachedUserAgent || (now - lastRotation) > ROTATION_INTERVAL_MS) {
    try {
      const ua = new userAgents({
        deviceCategory: 'desktop',
        browser: ['chrome', 'firefox', 'safari', 'edge']
      });
      cachedUserAgent = ua.toString();
      lastRotation = now;
    } catch (error) {
      // Fallback if package fails
      cachedUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    }
  }
  return cachedUserAgent;
}

/**
 * Get a specific browser user agent
 */
export const getChromeUserAgent = (): string => {
  try {
    const ua = new userAgents({ browser: 'chrome', deviceCategory: 'desktop' });
    return ua.toString();
  } catch {
    return getRandomUserAgent();
  }
};

export const getFirefoxUserAgent = (): string => {
  try {
    const ua = new userAgents({ browser: 'firefox', deviceCategory: 'desktop' });
    return ua.toString();
  } catch {
    return getRandomUserAgent();
  }
};

export const getMobileUserAgent = (): string => {
  try {
    const ua = new userAgents({ deviceCategory: 'mobile' });
    return ua.toString();
  } catch {
    return 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
  }
};

/**
 * Build complete browser headers for a request
 * 
 * @param url - The URL being requested (for referer/origin extraction)
 * @param referer - Optional custom referer (defaults to URL's origin)
 * @param options - Additional options
 * @returns Complete headers object
 */
export const buildStreamHeaders = (
  url: string,
  referer?: string,
  options?: {
    mobile?: boolean;
    customHeaders?: Record<string, string>;
  }
): Record<string, string> => {
  // For local files, return empty headers
  if (url && url.startsWith('file://')) {
    return {};
  }

  const userAgent = options?.mobile ? getMobileUserAgent() : getRandomUserAgent();

  // Base headers - complete browser fingerprint
  const headers: Record<string, string> = {
    'User-Agent': userAgent,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0',
  };

  // Extract domain for Origin and Referer
  let originToUse = '';
  let refererToUse = '';

  if (referer) {
    try {
      const urlObj = new URL(referer);
      refererToUse = `${urlObj.protocol}//${urlObj.hostname}/`;
      originToUse = urlObj.origin;
    } catch {
      refererToUse = referer;
      try {
        originToUse = new URL(referer).origin;
      } catch {
        // Keep defaults
      }
    }
  } else if (url) {
    try {
      const videoUrlObj = new URL(url);
      originToUse = videoUrlObj.origin;
      refererToUse = videoUrlObj.origin + '/';
    } catch {
      // Keep defaults
    }
  }

  if (originToUse) headers['Origin'] = originToUse;
  if (refererToUse) headers['Referer'] = refererToUse;

  // Merge custom headers if provided
  if (options?.customHeaders) {
    Object.assign(headers, options.customHeaders);
  }

  return headers;
};

/**
 * Build browser headers for a specific domain
 * Useful when you know the target domain but not the full URL
 */
export const buildHeadersForDomain = (
  domain: string,
  options?: {
    mobile?: boolean;
    customHeaders?: Record<string, string>;
  }
): Record<string, string> => {
  const baseUrl = `https://${domain}/`;
  return buildStreamHeaders(baseUrl, baseUrl, options);
};

/**
 * Build headers for FFmpegKit downloads
 * Converts headers object to FFmpeg command-line arguments
 */
export const buildFFmpegHeaders = (
  url: string,
  referer?: string,
  options?: {
    mobile?: boolean;
    customHeaders?: Record<string, string>;
  }
): string[] => {
  const headers = buildStreamHeaders(url, referer, options);
  const headerArray: string[] = [];

  for (const [key, value] of Object.entries(headers)) {
    // Skip Accept-Encoding for FFmpeg as it can cause issues
    if (key === 'Accept-Encoding') continue;
    headerArray.push('-headers', `"${key}: ${value}"`);
  }

  return headerArray;
};

/**
 * Build headers for video stream requests (M3U8/MP4)
 * Optimized for streaming with range requests
 */
export const buildStreamingHeaders = (
  url: string,
  referer?: string,
  range?: { start?: number; end?: number }
): Record<string, string> => {
  const headers = buildStreamHeaders(url, referer);

  // Add streaming-specific headers
  headers['Accept'] = 'video/*, application/vnd.apple.mpegurl, application/x-mpegURL, */*';
  headers['Icy-MetaData'] = '1';
  
  if (range) {
    const rangeHeader = `bytes=${range.start || 0}-${range.end || ''}`;
    headers['Range'] = rangeHeader;
  }

  return headers;
};

/**
 * Parse User-Agent string to get browser info
 * Useful for debugging
 */
export const parseUserAgent = (userAgent: string): { browser: string; os: string; device: string } => {
  try {
    const ua = new userAgents(userAgent);
    return {
      browser: ua.browser || 'unknown',
      os: ua.os || 'unknown',
      device: ua.deviceCategory || 'unknown'
    };
  } catch {
    return { browser: 'unknown', os: 'unknown', device: 'unknown' };
  }
};

// ─── Export commonly used header presets ───
export const HEADER_PRESETS = {
  // Chrome browser
  chrome: () => {
    const ua = new userAgents({ browser: 'chrome', deviceCategory: 'desktop' });
    return {
      'User-Agent': ua.toString(),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
    };
  },

  // Firefox browser
  firefox: () => {
    const ua = new userAgents({ browser: 'firefox', deviceCategory: 'desktop' });
    return {
      'User-Agent': ua.toString(),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
    };
  },

  // Safari browser
  safari: () => {
    const ua = new userAgents({ browser: 'safari', deviceCategory: 'desktop' });
    return {
      'User-Agent': ua.toString(),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
    };
  },

  // Mobile browser
  mobile: () => {
    const ua = new userAgents({ deviceCategory: 'mobile' });
    return {
      'User-Agent': ua.toString(),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
    };
  },
};

// ─── Default export for backward compatibility ───
export default {
  buildStreamHeaders,
  buildHeadersForDomain,
  buildFFmpegHeaders,
  buildStreamingHeaders,
  getRandomUserAgent,
  getChromeUserAgent,
  getFirefoxUserAgent,
  getMobileUserAgent,
  parseUserAgent,
  HEADER_PRESETS,
};