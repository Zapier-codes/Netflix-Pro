// src/services/unified/UnifiedMediaService.ts

import { MetadataAggregatorNew } from './metadata/MetadataAggregatorNew';
import { ProviderRegistry } from './ProviderRegistry';
import { StreamNormalizer } from './StreamNormalizer';
import { UnifiedSubtitles } from './subtitles/UnifiedSubtitles';
import {
  UnifiedMediaResult,
  UnifiedSearchOptions,
  UnifiedStreamOptions,
  UnifiedSubtitleOptions,
} from './types/ProviderTypes';
import { NormalizedStream } from './types/StreamTypes';
import { IMetadataResult, DiscoverFilters, SearchRequest, ISeason } from './types/MetadataTypes';

// ─── @movie-web/providers — properly initialized for React Native ───
import * as MovieWebProviders from '@movie-web/providers';
import type { Stream } from '@movie-web/providers';

// ─── tmdb-embed-providers ───
import { buildMovieSources, buildTvSources } from 'tmdb-embed-providers';

// ─── Supabase cache ───
import { supabase } from '../../lib/supabase';
import { CachedStreamData } from '../../types/CacheTypes';

// ─── Custom fetchers for React Native ───
const FETCH_TIMEOUT_MS = 15000;

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

/**
 * Custom fetcher that mimics a browser's requests to avoid CORS blocks
 */
class ReactNativeFetcher {
  private userAgent: string;
  private extraHeaders: Record<string, string>;

  constructor(options?: {
    userAgent?: string;
    extraHeaders?: Record<string, string>;
  }) {
    this.userAgent = options?.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    this.extraHeaders = options?.extraHeaders || {};
  }

  private getDefaultHeaders(url: string): Record<string, string> {
    try {
      const domain = new URL(url).hostname;
      return {
        'User-Agent': this.userAgent,
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
        'Referer': `https://${domain}/`,
        'Origin': `https://${domain}`,
        ...this.extraHeaders,
      };
    } catch {
      return {
        'User-Agent': this.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        ...this.extraHeaders,
      };
    }
  }

  async fetch(url: string, init?: RequestInit): Promise<Response> {
    const headers = {
      ...this.getDefaultHeaders(url),
      ...(init?.headers as Record<string, string> || {}),
    };

    try {
      const response = await fetch(url, {
        ...init,
        headers,
        redirect: 'manual',
      });

      // Handle redirects
      if (response.status === 301 || response.status === 302 || response.status === 307 || response.status === 308) {
        const location = response.headers.get('location');
        if (location) {
          console.log(`[Fetcher] Following redirect to: ${location}`);
          return this.fetch(location, init);
        }
      }

      return response;
    } catch (error) {
      console.warn('[Fetcher] Full headers fetch failed, trying fallback...', error);
      
      // Fallback: Minimal headers
      const fallbackHeaders = {
        'User-Agent': this.userAgent,
        'Accept': 'text/html,application/xhtml+xml',
      };
      
      return fetch(url, {
        ...init,
        headers: fallbackHeaders,
      });
    }
  }
}

/**
 * Fetcher that tries multiple strategies including public CORS proxies
 */
class NoProxyFetcher {
  private baseFetcher: ReactNativeFetcher;
  private cache: Map<string, { data: Response; timestamp: number }>;
  private cacheTTL: number;

  constructor(options?: {
    userAgent?: string;
    extraHeaders?: Record<string, string>;
    cacheTTL?: number;
  }) {
    this.baseFetcher = new ReactNativeFetcher({
      userAgent: options?.userAgent,
      extraHeaders: options?.extraHeaders,
    });
    this.cache = new Map();
    this.cacheTTL = options?.cacheTTL || 30000;
  }

  async fetch(url: string, init?: RequestInit): Promise<Response> {
    // Check cache
    const cacheKey = `${url}:${JSON.stringify(init?.headers || {})}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      console.log(`[NoProxyFetcher] Cache hit for: ${url}`);
      return cached.data.clone();
    }

    // Try strategies
    const strategies = [
      () => this.baseFetcher.fetch(url, init),
      () => this.fetchWithMobileHeaders(url, init),
      () => this.fetchThroughPublicProxy(url, init),
    ];

    let lastError: Error | null = null;
    for (const strategy of strategies) {
      try {
        const response = await strategy();
        if (response && response.ok) {
          // Clone and cache
          const clonedResponse = response.clone();
          this.cache.set(cacheKey, {
            data: clonedResponse,
            timestamp: Date.now(),
          });
          return response;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`[NoProxyFetcher] Strategy failed:`, error);
      }
    }

    throw lastError || new Error(`[NoProxyFetcher] All strategies failed for: ${url}`);
  }

  private async fetchWithMobileHeaders(url: string, init?: RequestInit): Promise<Response> {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      ...(init?.headers as Record<string, string> || {}),
    };

    return fetch(url, { ...init, headers });
  }

  private async fetchThroughPublicProxy(url: string, init?: RequestInit): Promise<Response> {
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
          return response;
        }
      } catch (error) {
        console.warn(`[NoProxyFetcher] Public proxy ${proxyUrl} failed:`, error);
      }
    }
    throw new Error('[NoProxyFetcher] All public proxies failed');
  }
}

/**
 * Create a fetcher for @movie-web/providers that works in React Native
 */
function makeReactNativeFetcherForMovieWeb() {
  const fetcher = new NoProxyFetcher({
    cacheTTL: 30000,
  });
  
  return {
    fetch: (url: string, init?: RequestInit) => fetcher.fetch(url, init),
  };
}

export class UnifiedMediaService {
  private metadataAggregator: MetadataAggregatorNew;
  private providerRegistry: ProviderRegistry;
  private subtitleService: UnifiedSubtitles;
  private initialized = false;
  private mwControls: any = null;
  
  // Dedupes concurrent extractStreamUrl calls
  private inFlightExtractions: Map<string, Promise<{
    url: string | null;
    provider: string | null;
    qualities: string[];
    fromCache: boolean;
  }>> = new Map();

  constructor() {
    this.metadataAggregator = new MetadataAggregatorNew();
    this.providerRegistry = new ProviderRegistry();
    this.subtitleService = new UnifiedSubtitles();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // ─── @movie-web/providers: Initialize with custom React Native fetcher ───
    try {
      const makeProviders = (MovieWebProviders as any).makeProviders;
      const targets = (MovieWebProviders as any).targets;
      const makeStandardFetcher = (MovieWebProviders as any).makeStandardFetcher;

      if (typeof makeProviders === 'function') {
        // Create our custom fetcher
        const customFetcher = makeReactNativeFetcherForMovieWeb();
        
        // Try to use makeStandardFetcher if available, otherwise use our custom fetcher
        let fetcher;
        if (typeof makeStandardFetcher === 'function') {
          // Wrap our custom fetch in makeStandardFetcher format
          fetcher = makeStandardFetcher(async (url: string, init?: RequestInit) => {
            const response = await customFetcher.fetch(url, init);
            return response;
          });
        } else {
          // Use our custom fetcher directly
          fetcher = customFetcher;
        }

        this.mwControls = makeProviders({
          fetcher: fetcher,
          // Also set proxiedFetcher for CORS-bypass requests
          proxiedFetcher: customFetcher,
          target: targets?.NATIVE ?? 'native',
        });
        console.log('[UnifiedMediaService] ✅ @movie-web/providers initialized with custom React Native fetcher');
      } else {
        console.warn('[UnifiedMediaService] ⚠️ makeProviders not exported');
        this.mwControls = null;
      }
    } catch (error: any) {
      console.error('[UnifiedMediaService] ❌ @movie-web/providers init failed:', error?.message || error);
      this.mwControls = null;
    }

    // Register streaming providers (legacy fallback)
    this.providerRegistry.registerMultiple([
      'vidsrc-bypass',
      'vidsrc',
      'moviebox',
      // REMOVED: 'xyra', 'consumet' - Currently down
    ]);

    await this.metadataAggregator.initialize();
    this.initialized = true;
    console.log('[UnifiedMediaService] ✅ Initialized');
  }

  async extractStreamUrl(
    tmdbId: number,
    type: 'movie' | 'tv',
    season?: number,
    episode?: number,
    options?: { excludeProviders?: string[] }
  ): Promise<{
    url: string | null;
    provider: string | null;
    qualities: string[];
    fromCache: boolean;
  }> {
    this.ensureInitialized();

    const excludeProviders = options?.excludeProviders?.filter(Boolean) ?? [];
    const excludeKey = excludeProviders.length > 0 ? `:exclude=${[...excludeProviders].sort().join(',')}` : '';
    const key = `${tmdbId}:${type}:${season ?? ''}:${episode ?? ''}${excludeKey}`;
    const existing = this.inFlightExtractions.get(key);
    if (existing) {
      console.log(`[UnifiedMediaService] ⏳ Joining in-flight extraction for ${key}`);
      return existing;
    }

    const promise = this.extractStreamUrlImpl(tmdbId, type, season, episode, excludeProviders).finally(() => {
      this.inFlightExtractions.delete(key);
    });
    this.inFlightExtractions.set(key, promise);
    return promise;
  }

  private async extractStreamUrlImpl(
    tmdbId: number,
    type: 'movie' | 'tv',
    season?: number,
    episode?: number,
    excludeProviders: string[] = []
  ): Promise<{
    url: string | null;
    provider: string | null;
    qualities: string[];
    fromCache: boolean;
  }> {
    console.log(`[UnifiedMediaService] 🔍 === START === TMDB:${tmdbId} ${type} s:${season} e:${episode}${excludeProviders.length ? ` (excluding: ${excludeProviders.join(', ')})` : ''}`);

    // ─── STEP 1: Cache ───
    const cached = await this.getCachedStream(tmdbId, type, season, episode);
    if (cached && !excludeProviders.includes(cached.provider)) {
      console.log(`[UnifiedMediaService] ✅ CACHE HIT: ${cached.provider}`);
      return { 
        url: cached.url, 
        provider: cached.provider, 
        qualities: cached.qualities || ['1080p', '720p', '480p'], 
        fromCache: true 
      };
    } else if (cached) {
      console.log(`[UnifiedMediaService] ⏩ CACHE SKIPPED: ${cached.provider} is excluded`);
    }

    // ─── STEP 2: Build embed URLs ───
    let providerUrls: string[] = [];
    try {
      providerUrls = type === 'movie'
        ? buildMovieSources(tmdbId)
        : buildTvSources(tmdbId, season || 1, episode || 1);
      console.log(`[UnifiedMediaService] 📋 Built ${providerUrls.length} URLs`);
    } catch (error) {
      console.error('[UnifiedMediaService] ❌ buildSources failed:', error);
      const imdbId = await this.getImdbId(tmdbId, type);
      providerUrls = this.buildFallbackUrls(imdbId, type, season, episode);
    }

    if (!providerUrls.length) {
      console.warn('[UnifiedMediaService] ❌ No URLs to try');
      return { url: null, provider: null, qualities: [], fromCache: false };
    }

    // ─── STEP 3: @movie-web/providers (with custom fetcher) ───
    if (this.mwControls && !excludeProviders.includes('movie-web')) {
      console.log(`[UnifiedMediaService] 🔎 STEP 3: @movie-web/providers`);
      const mwResult = await this.extractWithMovieWebProviders(tmdbId, type, season, episode);
      if (mwResult?.url) {
        console.log(`[UnifiedMediaService] ✅ @movie-web/providers HIT: ${mwResult.provider}`);
        const qualities = this.extractQualities(mwResult);
        await this.saveStreamToCache(tmdbId, type, mwResult.provider || 'movie-web', mwResult.url, qualities, season, episode);
        return { url: mwResult.url, provider: mwResult.provider || 'movie-web', qualities, fromCache: false };
      }
    } else if (excludeProviders.includes('movie-web')) {
      console.log(`[UnifiedMediaService] ⏩ STEP 3: SKIPPED (excluded)`);
    } else {
      console.log(`[UnifiedMediaService] ⏩ STEP 3: SKIPPED (not initialized)`);
    }

    // ─── STEP 4: Legacy providers ───
    console.log(`[UnifiedMediaService] 🔎 STEP 4: Legacy providers`);
    const legacyResult = await this.extractWithAllLegacyProviders(tmdbId, type, season, episode, excludeProviders);
    if (legacyResult?.url) {
      console.log(`[UnifiedMediaService] ✅ Legacy HIT: ${legacyResult.provider}`);
      const qualities = this.extractQualities(legacyResult);
      await this.saveStreamToCache(tmdbId, type, legacyResult.provider || 'legacy', legacyResult.url, qualities, season, episode);
      return { url: legacyResult.url, provider: legacyResult.provider || 'legacy', qualities, fromCache: false };
    }

    // ─── STEP 5: Smart regex on embed HTML (last resort) ───
    console.log(`[UnifiedMediaService] 🔎 STEP 5: Smart regex (${providerUrls.length} URLs)`);
    for (let i = 0; i < providerUrls.length; i++) {
      const embedUrl = providerUrls[i];
      if (!embedUrl?.startsWith('http')) continue;

      try {
        console.log(`[UnifiedMediaService] 🔎 [${i + 1}/${providerUrls.length}] regex: ${embedUrl}`);
        const stream = await this.extractWithSmartRegex(embedUrl);
        if (stream?.url) {
          console.log(`[UnifiedMediaService] ✅ Regex HIT: ${stream.url.substring(0, 60)}…`);
          const qualities = this.extractQualities(stream);
          await this.saveStreamToCache(tmdbId, type, embedUrl, stream.url, qualities, season, episode);
          return { url: stream.url, provider: embedUrl, qualities, fromCache: false };
        }
      } catch (error: any) {
        console.warn(`[UnifiedMediaService] ⚠️ [${i + 1}] regex failed:`, error?.message || error);
      }
    }

    console.warn('[UnifiedMediaService] ❌ === ALL FAILED ===');
    return { url: null, provider: null, qualities: [], fromCache: false };
  }

  /**
   * Extract using @movie-web/providers with the custom React Native fetcher
   */
  private async extractWithMovieWebProviders(
    tmdbId: number,
    type: 'movie' | 'tv',
    season: number | undefined,
    episode: number | undefined
  ): Promise<{ url: string; provider: string; type: string } | null> {
    try {
      // Get metadata for the media
      const meta: any = await this.metadataAggregator.getById(String(tmdbId), type).catch(() => null);
      const title: string = meta?.title || meta?.name || '';
      const releaseYear: number = Number(meta?.year) || new Date().getFullYear();
      const imdbId: string | undefined = meta?.imdb_id || undefined;

      if (!title) {
        console.warn('[UnifiedMediaService]   ↳ @movie-web/providers: no title available, skipping');
        return null;
      }

      const media = type === 'tv'
        ? {
            type: 'show' as const,
            title,
            releaseYear,
            tmdbId: String(tmdbId),
            imdbId,
            season: { number: Number(season || 1), tmdbId: String(tmdbId) },
            episode: { number: Number(episode || 1), tmdbId: String(tmdbId) },
          }
        : {
            type: 'movie' as const,
            title,
            releaseYear,
            tmdbId: String(tmdbId),
            imdbId,
          };

      console.log(`[UnifiedMediaService]   ↳ Running @movie-web/providers with custom fetcher...`);
      
      const result = await this.mwControls.runAll({ media });
      
      if (!result?.stream) {
        console.log('[UnifiedMediaService]   ↳ @movie-web/providers: no result');
        return null;
      }

      const stream = result.stream;
      let url: string | undefined;
      
      if (stream.type === 'hls') {
        url = stream.playlist;
      } else if (stream.type === 'file' && stream.qualities) {
        // Prefer the highest available quality
        for (const q of ['4k', '1080', '720', '480', '360', 'unknown']) {
          if (stream.qualities[q]?.url) {
            url = stream.qualities[q].url;
            break;
          }
        }
      }

      if (!url) {
        console.log('[UnifiedMediaService]   ↳ @movie-web/providers: result had no usable stream URL');
        return null;
      }

      const providerLabel = result.embedId || result.sourceId || 'movie-web';
      console.log(`[UnifiedMediaService]   ↳ ${providerLabel}: ✅ HIT`);
      return { url, provider: providerLabel, type: stream.type === 'hls' ? 'hls' : 'mp4' };
    } catch (error: any) {
      console.warn('[UnifiedMediaService]   ↳ @movie-web/providers THREW:', error?.message || error);
      return null;
    }
  }

  private async extractWithAllLegacyProviders(
    tmdbId: number,
    type: 'movie' | 'tv',
    season?: number,
    episode?: number,
    excludeProviders: string[] = []
  ): Promise<{ url: string; type: string; provider: string } | null> {
    const registry = this.providerRegistry as any;
    let providers: any[] = [];

    if (Array.isArray(registry?.providers)) {
      providers = registry.providers;
    } else if (typeof registry?.getAllProviders === 'function') {
      providers = registry.getAllProviders();
    } else {
      try {
        const best = this.providerRegistry.getBestProvider(type);
        if (best) providers = [best];
      } catch (e) {
        console.warn('[UnifiedMediaService] getBestProvider failed:', e);
      }
    }

    console.log(`[UnifiedMediaService]   ↳ ${providers.length} legacy providers registered`);

    for (const provider of providers) {
      const name = provider?.name || provider?.id || 'unknown';

      if (excludeProviders.includes(name)) {
        console.log(`[UnifiedMediaService]   ↳ Skip ${name}: excluded (previously failed)`);
        continue;
      }

      try {
        if (!provider || typeof provider.getStreams !== 'function') {
          console.log(`[UnifiedMediaService]   ↳ Skip ${name}: no getStreams`);
          continue;
        }

        console.log(`[UnifiedMediaService]   ↳ Calling ${name}…`);
        const sources = await provider.getStreams({ id: String(tmdbId), type, season, episode });

        if (sources?.length > 0 && sources[0]?.url) {
          try {
            new URL(sources[0].url);
            console.log(`[UnifiedMediaService]   ↳ ${name}: ✅ valid URL`);
            return { url: sources[0].url, type: sources[0].type || 'hls', provider: name };
          } catch {
            console.warn(`[UnifiedMediaService]   ↳ ${name}: invalid URL "${sources[0].url}"`);
          }
        } else {
          console.log(`[UnifiedMediaService]   ↳ ${name}: no sources`);
        }
      } catch (error: any) {
        console.warn(`[UnifiedMediaService]   ↳ ${name} THREW:`, error?.message || error);
      }
    }

    return null;
  }

  private async extractWithSmartRegex(embedUrl: string): Promise<{ url: string; type: string } | null> {
    try {
      const response = await fetchWithTimeout(embedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': embedUrl,
        },
      });
      
      if (!response.ok) {
        console.warn(`[UnifiedMediaService] HTTP ${response.status}: ${embedUrl}`);
        return null;
      }
      
      const html = await response.text();
      
      // Try multiple patterns to find video URL
      const patterns = [
        // JavaScript variable assignments
        /var\s+(?:source|src|url|stream|videoUrl|file|playlist)\s*=\s*["']([^"']+\.(?:m3u8|mp4|m4v)[^"']*)["']/i,
        /let\s+(?:source|src|url|stream|videoUrl|file|playlist)\s*=\s*["']([^"']+\.(?:m3u8|mp4|m4v)[^"']*)["']/i,
        /const\s+(?:source|src|url|stream|videoUrl|file|playlist)\s*=\s*["']([^"']+\.(?:m3u8|mp4|m4v)[^"']*)["']/i,
        // JSON object properties
        /["']?source["']?\s*:\s*["']([^"']+\.(?:m3u8|mp4|m4v)[^"']*)["']/i,
        /["']?file["']?\s*:\s*["']([^"']+\.(?:m3u8|mp4|m4v)[^"']*)["']/i,
        /["']?url["']?\s*:\s*["']([^"']+\.(?:m3u8|mp4|m4v)[^"']*)["']/i,
        /["']?hls["']?\s*:\s*["']([^"']+\.(?:m3u8|mp4|m4v)[^"']*)["']/i,
        // HTML tags
        /<source[^>]+src=["']([^"']+\.(?:m3u8|mp4|m4v)[^"']*)["']/i,
        /<video[^>]+src=["']([^"']+\.(?:m3u8|mp4|m4v)[^"']*)["']/i,
        // Direct URL patterns
        /(https?:\/\/[^\s"']+\.m3u8(?:\?[^\s"']*)?)/i,
        /(https?:\/\/[^\s"']+\.mp4(?:\?[^\s"']*)?)/i,
        /(https?:\/\/[^\s"']+\.m4v(?:\?[^\s"']*)?)/i,
        // Base64 encoded (common in some providers)
        /atob\(["']([A-Za-z0-9+/=]+)["']\)/i,
      ];

      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
          let url = match[1].trim();
          
          // Handle base64 decoding
          if (pattern.source.includes('atob')) {
            try {
              url = atob(url);
            } catch {
              continue;
            }
          }
          
          // Handle relative URLs
          if (!url.startsWith('http')) {
            try {
              url = new URL(url, embedUrl).href;
            } catch {
              continue;
            }
          }
          
          // Validate URL
          try {
            new URL(url);
            return { 
              url, 
              type: url.includes('.m3u8') ? 'hls' : url.includes('.mp4') ? 'mp4' : 'unknown' 
            };
          } catch {
            continue;
          }
        }
      }

      return null;
    } catch (error) {
      console.warn('[UnifiedMediaService] Smart regex extraction failed:', error);
      return null;
    }
  }

  private extractQualities(stream: any): string[] {
    if (stream.qualities && stream.qualities.length > 0) return stream.qualities;
    if (stream.quality) return [stream.quality];
    return ['1080p', '720p', '480p'];
  }

  private async getImdbId(tmdbId: number, type: 'movie' | 'tv'): Promise<string> {
    try {
      const result = await this.metadataAggregator.getById(String(tmdbId), type);
      if (result && (result as any).imdb_id) return (result as any).imdb_id;
      return `tt${String(tmdbId).padStart(7, '0')}`;
    } catch {
      return `tt${String(tmdbId).padStart(7, '0')}`;
    }
  }

  private buildFallbackUrls(imdbId: string, type: 'movie' | 'tv', season?: number, episode?: number): string[] {
    const s = season || 1;
    const e = episode || 1;
    return type === 'movie'
      ? [
          `https://vidsrc.to/embed/movie/${imdbId}`,
          `https://embed.su/embed/movie/${imdbId}`,
          `https://2embed.cc/embed/movie/${imdbId}`,
          `https://vidlink.pro/embed/movie/${imdbId}`,
          `https://vidfast.pro/embed/movie/${imdbId}`,
        ]
      : [
          `https://vidsrc.to/embed/tv/${imdbId}/${s}/${e}`,
          `https://embed.su/embed/tv/${imdbId}/${s}/${e}`,
          `https://2embed.cc/embed/tv/${imdbId}/${s}/${e}`,
          `https://vidlink.pro/embed/tv/${imdbId}/${s}/${e}`,
          `https://vidfast.pro/embed/tv/${imdbId}/${s}/${e}`,
        ];
  }

  private async getCachedStream(tmdbId: number, type: 'movie' | 'tv', season?: number, episode?: number): Promise<CachedStreamData | null> {
    try {
      const { data, error } = await supabase
        .from('cached_streams')
        .select('url, provider, qualities, extracted_at')
        .eq('tmdb_id', tmdbId)
        .eq('media_type', type)
        .eq('season', season || 0)
        .eq('episode', episode || 0)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .order('extracted_at', { ascending: false })
        .limit(1);
      if (error || !data || data.length === 0) return null;
      return { url: data[0].url, provider: data[0].provider, qualities: data[0].qualities || [], extractedAt: data[0].extracted_at };
    } catch {
      return null;
    }
  }

  private async saveStreamToCache(tmdbId: number, type: 'movie' | 'tv', provider: string, url: string, qualities: string[], season?: number, episode?: number): Promise<void> {
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      await supabase.from('cached_streams').upsert(
        {
          tmdb_id: tmdbId,
          media_type: type,
          season: season || 0,
          episode: episode || 0,
          provider,
          url,
          qualities,
          expires_at: expiresAt.toISOString(),
          is_active: true,
          last_checked_at: new Date().toISOString(),
        },
        { onConflict: 'tmdb_id, media_type, provider, season, episode', ignoreDuplicates: false }
      );
    } catch (error) {
      console.warn('[UnifiedMediaService] Cache save error:', error);
    }
  }

  // ─── Existing methods ───
  async search(options: UnifiedSearchOptions): Promise<UnifiedMediaResult[]> {
    this.ensureInitialized();
    const { query, type, year, limit = 20, ...filters } = options;
    const searchRequest: SearchRequest = {
      query: query || '',
      type: type ? [type] : ['movie', 'show'],
      limit,
      page: filters.page || 1,
      languages: filters.language ? [filters.language] : undefined,
      countries: filters.country ? [filters.country] : undefined,
      region: filters.region,
      genres: filters.genres,
      certifications: filters.certification ? [filters.certification] : undefined,
      ratings: filters.minRating ? `${filters.minRating},${filters.maxRating || 10}` : undefined,
      years: filters.startYear || filters.endYear ? `${filters.startYear || ''}-${filters.endYear || ''}` : year ? `${year}` : undefined,
      keywords: filters.keywords,
      withCast: filters.withCast,
      withCrew: filters.withCrew,
      withCompanies: filters.withCompanies,
      withoutGenres: filters.withoutGenres,
      watchProviders: filters.watchProviders,
      includeAdult: filters.includeAdult,
      language: filters.languageCode,
      watchRegion: filters.watchRegion,
      sortBy: filters.sortBy || 'popularity.desc',
      extended: 'full,images',
    };
    const metadataResults = await this.metadataAggregator.search(searchRequest);
    return metadataResults.map(meta => ({
      id: meta.id,
      title: meta.title,
      type: meta.type,
      year: meta.year,
      releaseDate: meta.releaseDate,
      poster: meta.poster,
      backdrop: meta.backdrop,
      overview: meta.overview,
      rating: meta.rating,
      genres: meta.genres,
      runtime: meta.runtime,
      cast: meta.cast,
      source: meta.source,
      sources: [],
      metadata: meta,
      originalLanguage: meta.originalLanguage,
      originCountry: meta.originCountry,
      originalTitle: meta.originalTitle,
      popularity: meta.popularity,
      voteCount: meta.voteCount,
      certification: meta.certification,
      tagline: meta.tagline,
      status: meta.status,
      belongsToCollection: meta.belongsToCollection,
      watchProviders: meta.watchProviders,
      keywords: meta.keywords,
      budget: meta.budget,
      revenue: meta.revenue,
      networks: meta.networks,
      spokenLanguages: meta.spokenLanguages,
      productionCompanies: meta.productionCompanies,
      productionCountries: meta.productionCountries,
      numberOfSeasons: meta.numberOfSeasons,
      numberOfEpisodes: meta.numberOfEpisodes,
      lastAirDate: meta.lastAirDate,
      inProduction: meta.inProduction,
      seasons: meta.seasons,
      displaySeasons: meta.displaySeasons,
    })).slice(0, limit);
  }

  async discover(filters: DiscoverFilters, limit: number = 20): Promise<UnifiedMediaResult[]> {
    this.ensureInitialized();
    const effectiveLimit = filters.limit ?? limit;
    const metadataResults = await this.metadataAggregator.discover(filters, effectiveLimit);
    return metadataResults.map(meta => ({
      id: meta.id,
      title: meta.title,
      type: meta.type,
      year: meta.year,
      releaseDate: meta.releaseDate,
      poster: meta.poster,
      backdrop: meta.backdrop,
      overview: meta.overview,
      rating: meta.rating,
      genres: meta.genres,
      runtime: meta.runtime,
      cast: meta.cast,
      source: meta.source,
      sources: [],
      metadata: meta,
      originalLanguage: meta.originalLanguage,
      originCountry: meta.originCountry,
      originalTitle: meta.originalTitle,
      popularity: meta.popularity,
      voteCount: meta.voteCount,
      certification: meta.certification,
      tagline: meta.tagline,
      status: meta.status,
      belongsToCollection: meta.belongsToCollection,
      watchProviders: meta.watchProviders,
      keywords: meta.keywords,
      budget: meta.budget,
      revenue: meta.revenue,
      networks: meta.networks,
      spokenLanguages: meta.spokenLanguages,
      productionCompanies: meta.productionCompanies,
      productionCountries: meta.productionCountries,
      numberOfSeasons: meta.numberOfSeasons,
      numberOfEpisodes: meta.numberOfEpisodes,
      lastAirDate: meta.lastAirDate,
      inProduction: meta.inProduction,
      seasons: meta.seasons,
      displaySeasons: meta.displaySeasons,
    })).slice(0, effectiveLimit);
  }

  async getTrending(limit: number = 20): Promise<IMetadataResult[]> {
    this.ensureInitialized();
    return this.metadataAggregator.getTrending(limit);
  }

  async getTrendingByCategory(category: string, limit: number = 20, region?: string): Promise<IMetadataResult[]> {
    this.ensureInitialized();
    return this.metadataAggregator.getTrendingByCategory(category, limit, region);
  }

  async getById(id: string, type: 'movie' | 'tv'): Promise<IMetadataResult | null> {
    this.ensureInitialized();
    try {
      return await this.metadataAggregator.getById(id, type);
    } catch (error) {
      console.error(`[UnifiedMediaService] ❌ getById failed:`, error);
      return null;
    }
  }

  async getTVDetails(tvId: string): Promise<IMetadataResult | null> {
    this.ensureInitialized();
    return this.getById(tvId, 'tv');
  }

  async preloadStreams(id: string, type: 'movie' | 'tv', season?: number, episode?: number): Promise<NormalizedStream[]> {
    this.ensureInitialized();
    try {
      return await this.getStreams({ id, type, season, episode, preferredQuality: 'auto' });
    } catch {
      return [];
    }
  }

  async preloadQualities(id: string, type: 'movie' | 'tv', season?: number, episode?: number): Promise<string[]> {
    this.ensureInitialized();
    try {
      const streams = await this.preloadStreams(id, type, season, episode);
      const set = new Set<string>();
      streams.forEach(s => { if (s.quality) set.add(s.quality); });
      return Array.from(set);
    } catch {
      return [];
    }
  }

  async batchGetTVDetails(tvIds: string[]): Promise<IMetadataResult[]> {
    this.ensureInitialized();
    const results = await Promise.allSettled(tvIds.map(id => this.getById(id, 'tv')));
    const out: IMetadataResult[] = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled' && r.value) out.push(r.value);
      else console.warn(`[UnifiedMediaService] ⚠️ batch failed for ${tvIds[i]}`);
    });
    return out;
  }

  async getStreams(options: UnifiedStreamOptions): Promise<NormalizedStream[]> {
    this.ensureInitialized();
    const { id, type, season, episode, preferredQuality = 'auto' } = options;
    const provider = this.providerRegistry.getBestProvider(type);
    if (!provider) throw new Error('No healthy streaming provider available');
    const sources = await provider.getStreams({ id, type, season, episode });
    return StreamNormalizer.normalizeAll(sources, provider.name, { preferredQuality });
  }

  async getSubtitles(options: UnifiedSubtitleOptions): Promise<any[]> {
    this.ensureInitialized();
    return this.subtitleService.getSubtitles({
      imdbId: options.imdbId,
      tmdbId: options.tmdbId,
      season: options.season,
      episode: options.episode,
      language: options.language ?? 'en',
    });
  }

  async getFullMedia(id: string, type: 'movie' | 'tv', options: { season?: number; episode?: number; preferredQuality?: string; subtitleLanguage?: string; } = {}) {
    this.ensureInitialized();
    const [metadata, streams, subtitles] = await Promise.allSettled([
      this.getById(id, type),
      this.getStreams({ id, type, season: options.season, episode: options.episode, preferredQuality: options.preferredQuality as any }),
      this.getSubtitles({ imdbId: id, season: options.season, episode: options.episode, language: options.subtitleLanguage }),
    ]);
    return {
      metadata: metadata.status === 'fulfilled' ? metadata.value : null,
      streams: streams.status === 'fulfilled' ? streams.value : [],
      subtitles: subtitles.status === 'fulfilled' ? subtitles.value : [],
    };
  }

  async healthCheck(): Promise<{ provider: string; isHealthy: boolean }[]> {
    if (!this.initialized) return [];
    return this.providerRegistry.healthCheck();
  }

  destroy(): void {
    this.providerRegistry.clear();
    this.initialized = false;
    console.log('[UnifiedMediaService] Destroyed');
  }

  private ensureInitialized(): void {
    if (!this.initialized) throw new Error('UnifiedMediaService not initialized. Call initialize() first.');
  }
}

export const unifiedMediaService = new UnifiedMediaService();
export default UnifiedMediaService;