// src/services/providers/NoProxyFetcher.ts

import { Fetcher, FetcherResponse, ReactNativeFetcher } from './ReactNativeFetcher';

/**
 * A fetcher that handles requests without needing an external proxy server.
 * It uses multiple strategies to bypass CORS and fetch HTML pages.
 */
export class NoProxyFetcher implements Fetcher {
  private baseFetcher: ReactNativeFetcher;
  private cache: Map<string, { data: FetcherResponse; timestamp: number }>;
  private cacheTTL: number;

  constructor(options?: {
    userAgent?: string;
    extraHeaders?: Record<string, string>;
    cacheTTL?: number; // milliseconds
  }) {
    this.baseFetcher = new ReactNativeFetcher({
      userAgent: options?.userAgent,
      extraHeaders: options?.extraHeaders,
    });
    this.cache = new Map();
    this.cacheTTL = options?.cacheTTL || 30000; // 30 seconds default
  }

  async fetch(url: string, init?: RequestInit): Promise<FetcherResponse> {
    // Check cache first
    const cacheKey = `${url}:${JSON.stringify(init?.headers || {})}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      console.log(`[NoProxyFetcher] Cache hit for: ${url}`);
      return cached.data;
    }

    // Try multiple fetch strategies
    const strategies = [
      () => this.fetchWithBrowserHeaders(url, init),
      () => this.fetchWithMobileHeaders(url, init),
      () => this.fetchThroughIFrameStrategy(url, init),
    ];

    let lastError: Error | null = null;
    for (const strategy of strategies) {
      try {
        const response = await strategy();
        if (response && response.status < 400) {
          // Cache the successful response
          this.cache.set(cacheKey, {
            data: response,
            timestamp: Date.now(),
          });
          return response;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`[NoProxyFetcher] Strategy failed:`, error);
      }
    }

    // If all strategies fail, try the base fetcher as last resort
    try {
      const response = await this.baseFetcher.fetch(url, init);
      if (response.status < 400) {
        this.cache.set(cacheKey, {
          data: response,
          timestamp: Date.now(),
        });
        return response;
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }

    throw lastError || new Error(`[NoProxyFetcher] All fetch strategies failed for: ${url}`);
  }

  /**
   * Strategy 1: Full browser headers
   */
  private async fetchWithBrowserHeaders(url: string, init?: RequestInit): Promise<FetcherResponse> {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0',
      ...(init?.headers as Record<string, string> || {}),
    };

    const response = await fetch(url, {
      ...init,
      headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return {
      url: response.url,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      text: () => response.text(),
      json: () => response.json(),
      blob: () => response.blob(),
      arrayBuffer: () => response.arrayBuffer(),
      body: response.body || undefined,
    };
  }

  /**
   * Strategy 2: Mobile headers (sometimes less restrictive)
   */
  private async fetchWithMobileHeaders(url: string, init?: RequestInit): Promise<FetcherResponse> {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      ...(init?.headers as Record<string, string> || {}),
    };

    const response = await fetch(url, {
      ...init,
      headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return {
      url: response.url,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      text: () => response.text(),
      json: () => response.json(),
      blob: () => response.blob(),
      arrayBuffer: () => response.arrayBuffer(),
      body: response.body || undefined,
    };
  }

  /**
   * Strategy 3: Try to fetch through a public CORS proxy (last resort)
   */
  private async fetchThroughIFrameStrategy(url: string, init?: RequestInit): Promise<FetcherResponse> {
    // Try public CORS proxies as fallback
    const proxies = [
      `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
      `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    ];

    for (const proxyUrl of proxies) {
      try {
        console.log(`[NoProxyFetcher] Trying public proxy: ${proxyUrl}`);
        const response = await fetch(proxyUrl, {
          ...init,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            ...(init?.headers as Record<string, string> || {}),
          },
        });

        if (response.ok) {
          return {
            url: response.url,
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            text: () => response.text(),
            json: () => response.json(),
            blob: () => response.blob(),
            arrayBuffer: () => response.arrayBuffer(),
            body: response.body || undefined,
          };
        }
      } catch (error) {
        console.warn(`[NoProxyFetcher] Public proxy ${proxyUrl} failed:`, error);
      }
    }

    throw new Error('[NoProxyFetcher] All public proxies failed');
  }
}

/**
 * Create a fetcher that doesn't need an external proxy server
 */
export function makeNoProxyFetcher(options?: {
  userAgent?: string;
  extraHeaders?: Record<string, string>;
  cacheTTL?: number;
}): Fetcher {
  const fetcher = new NoProxyFetcher(options);
  return {
    fetch: (url: string, init?: RequestInit) => fetcher.fetch(url, init),
  };
}