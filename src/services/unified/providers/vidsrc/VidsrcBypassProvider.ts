// src/services/unified/providers/vidsrc/VidsrcBypassProvider.ts

import { IProvider, StreamSource, StreamOptions } from '../../types/ProviderTypes';
import { buildStreamHeaders } from '../../../../utils/streamHeaders';
import { extractWithFetchAndRegex } from '../../../../utils/streamExtractor';

// ─── CONFIRMED WORKING SOURCES (tested 2026-07-25) ───
// These are the only sources that returned 200 OK
const VERIFIED_SOURCES = [
  { name: 'vidsrc.to', baseUrl: 'https://vidsrc.to/', timeoutInSeconds: 15 },
  { name: 'vidsrc.me', baseUrl: 'https://vidsrc.me/', timeoutInSeconds: 15 },
  { name: 'vidsrc.pm', baseUrl: 'https://vidsrc.pm/', timeoutInSeconds: 15 },
  { name: '2embed.cc', baseUrl: 'https://2embed.cc/', timeoutInSeconds: 15 },
];

// ─── Fallback sources (may work for some content, but not verified) ───
const FALLBACK_SOURCES = [
  { name: 'vidsrc.cc', baseUrl: 'https://vidsrc.cc/', timeoutInSeconds: 10 },
  { name: 'embed.su', baseUrl: 'https://embed.su/', timeoutInSeconds: 10 },
  { name: 'vidlink.pro', baseUrl: 'https://vidlink.pro/', timeoutInSeconds: 10 },
  { name: 'vidfast.pro', baseUrl: 'https://vidfast.pro/', timeoutInSeconds: 10 },
  // These are known to be problematic, kept as last resort
  { name: 'cineby.gd', baseUrl: 'https://cineby.gd/', timeoutInSeconds: 10 },
  { name: 'vidsrc.icu', baseUrl: 'https://vidsrc.icu/', timeoutInSeconds: 10 },
  { name: 'FluxSource', baseUrl: 'https://streamprovider.byteful.me/', timeoutInSeconds: 15 },
];

/**
 * VidsrcBypassProvider - Extracts streams from multiple video sources
 * Uses browser headers and fetch+regex for reliable extraction
 * 
 * UPDATED: Uses verified working sources first (vidsrc.to, vidsrc.me, vidsrc.pm, 2embed.cc)
 */
export class VidsrcBypassProvider implements IProvider {
  name = 'VidsrcBypass';
  id = 'vidsrc-bypass';
  priority = 80;
  isHealthy = true;
  private timeoutMs = 15000;

  /**
   * Get streams for a given media item
   */
  async getStreams(options: StreamOptions): Promise<StreamSource[]> {
    const { id, type, season, episode } = options;

    console.log(`[VidsrcBypass] getStreams TMDB:${id} type:${type}`);

    if (!id) {
      console.warn('[VidsrcBypass] Missing ID');
      return [];
    }

    const tmdbId = String(id);
    const seasonNum = season ? parseInt(String(season), 10) : undefined;
    const episodeNum = episode ? parseInt(String(episode), 10) : undefined;

    // ─── Use verified sources first ───
    console.log('[VidsrcBypass] → verified sources');
    const verifiedResult = await this.fetchFromSources(tmdbId, type, seasonNum, episodeNum, VERIFIED_SOURCES);
    
    if (verifiedResult && verifiedResult.length > 0) {
      return verifiedResult;
    }

    // ─── If verified sources fail, try fallback sources ───
    console.log('[VidsrcBypass] → fallback sources');
    const fallbackResult = await this.fetchFromSources(tmdbId, type, seasonNum, episodeNum, FALLBACK_SOURCES);
    
    if (fallbackResult && fallbackResult.length > 0) {
      return fallbackResult;
    }

    console.warn('[VidsrcBypass] ❌ all sources exhausted');
    return [];
  }

  /**
   * Fetch from a list of sources
   */
  private async fetchFromSources(
    tmdbId: string,
    type: 'movie' | 'tv',
    season: number | undefined,
    episode: number | undefined,
    sources: any[]
  ): Promise<StreamSource[]> {
    console.log(`[VidsrcBypass] trying ${sources.length} sources`);

    for (const source of sources) {
      const sourceName = source.name || 'unknown';
      
      try {
        let embedUrl: string | null = null;

        // ─── Build URL based on source type ───
        const baseUrl = source.baseUrl.replace(/\/+$/, '');

        // Handle different source types
        if (sourceName.includes('vidsrc') || sourceName.includes('2embed') || sourceName.includes('embed')) {
          if (type === 'tv' && season && episode) {
            embedUrl = `${baseUrl}/embed/tv/${tmdbId}/${season}/${episode}`;
          } else {
            embedUrl = `${baseUrl}/embed/movie/${tmdbId}`;
          }
        } else if (sourceName === 'FluxSource' || sourceName === 'cineby.gd') {
          if (type === 'tv' && season && episode) {
            embedUrl = `${baseUrl}/tv/${tmdbId}/${season}/${episode}`;
          } else {
            embedUrl = `${baseUrl}/movie/${tmdbId}`;
          }
        } else {
          // Generic fallback
          if (type === 'tv' && season && episode) {
            embedUrl = `${baseUrl}/tv/${tmdbId}/${season}/${episode}`;
          } else {
            embedUrl = `${baseUrl}/movie/${tmdbId}`;
          }
        }

        if (!embedUrl) {
          console.log(`[VidsrcBypass] skip ${sourceName}: no valid URL`);
          continue;
        }

        // Validate URL
        try {
          new URL(embedUrl);
        } catch {
          console.log(`[VidsrcBypass] skip ${sourceName}: invalid URL format "${embedUrl}"`);
          continue;
        }

        console.log(`[VidsrcBypass] fetch: ${embedUrl}`);

        // ─── Use fetch+regex extractor with browser headers ───
        const timeoutMs = (source.timeoutInSeconds || 10) * 1000;
        const result = await extractWithFetchAndRegex(
          embedUrl,
          sourceName,
          baseUrl || embedUrl,
          timeoutMs
        );

        if (result && result.url) {
          console.log(`[VidsrcBypass] ✅ ${sourceName} HIT: ${result.url.substring(0, 50)}...`);
          
          return [{
            id: `vidsrc-${Date.now()}`,
            provider: sourceName,
            url: result.url,
            quality: result.quality || '1080p',
            type: result.type || 'hls',
            headers: result.headers || buildStreamHeaders(result.url, embedUrl),
            subtitles: [],
          }];
        }

        console.log(`[VidsrcBypass] ${sourceName}: no match`);

      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.warn(`[VidsrcBypass] ${sourceName} timeout after ${source.timeoutInSeconds}s`);
        } else if (error.message?.includes('Invalid URL')) {
          console.warn(`[VidsrcBypass] ${sourceName} invalid URL, skipping`);
        } else {
          console.warn(`[VidsrcBypass] ${sourceName} error:`, error?.message || error);
        }
      }
    }

    return [];
  }

  /**
   * Check if the provider is healthy
   */
  async checkHealth(): Promise<boolean> {
    try {
      const headers = buildStreamHeaders('https://vidsrc.to');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch('https://vidsrc.to', {
        method: 'HEAD',
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeout);
      this.isHealthy = response.ok;
      return this.isHealthy;
    } catch {
      this.isHealthy = false;
      return false;
    }
  }

  /**
   * Get available qualities for a stream
   */
  async getQualities(url: string, referer?: string): Promise<string[]> {
    try {
      const headers = buildStreamHeaders(url, referer);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        console.warn(`[VidsrcBypass] getQualities HTTP ${response.status}`);
        return ['1080p', '720p', '480p'];
      }

      const content = await response.text();

      // Parse M3U8 variants
      if (content.includes('#EXT-X-STREAM-INF')) {
        const qualities: string[] = [];
        const lines = content.split('\n');
        
        for (const line of lines) {
          if (line.includes('RESOLUTION=')) {
            const match = line.match(/RESOLUTION=(\d+)x(\d+)/);
            if (match) {
              const height = parseInt(match[2], 10);
              if (height >= 2160) qualities.push('2160p');
              else if (height >= 1080) qualities.push('1080p');
              else if (height >= 720) qualities.push('720p');
              else if (height >= 480) qualities.push('480p');
              else if (height >= 360) qualities.push('360p');
              else qualities.push(`${height}p`);
            }
          }
        }
        
        if (qualities.length > 0) {
          return qualities;
        }
        return ['1080p', '720p', '480p'];
      }

      return ['1080p', '720p', '480p'];
    } catch (error) {
      console.warn('[VidsrcBypass] getQualities error:', error);
      return ['1080p', '720p', '480p'];
    }
  }
}

export default VidsrcBypassProvider;