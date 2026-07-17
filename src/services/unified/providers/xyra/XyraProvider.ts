// src/services/unified/providers/xyra/XyraProvider.ts

/**
 * XyraProvider - Streaming provider that wraps the Xyra API.
 * Provides movie/series search, details, and download links.
 * Uses the Xyra API at https://api.xyra.stream/v1/moviesdrive
 */

import { 
  IStreamProvider, 
  StreamProviderId, 
  StreamBackendConfig,
  StreamSource,
  StreamQuality,
} from '../../types/ProviderTypes';
import { xyraApiService, XyraMovie, XyraMovieInfo, XyraDownload } from '../../../../api/xyra/xyraApi';

export interface XyraProviderConfig extends StreamBackendConfig {
  apiKey?: string;
}

export class XyraProvider implements IStreamProvider {
  readonly name = 'Xyra';
  readonly id: StreamProviderId = 'xyra';
  readonly priority = 3;
  private config: XyraProviderConfig;
  private initialized = false;

  constructor(config: XyraProviderConfig = {}) {
    this.config = {
      defaultQuality: 'auto',
      timeout: 30000,
      retryCount: 2,
      ...config,
    };
  }

  /**
   * Initialize the provider.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    console.log('[XyraProvider] Initializing...');
    this.initialized = true;
    console.log('[XyraProvider] ✅ Initialized');
  }

  /**
   * Health check - verify the API is accessible.
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await xyraApiService.getHome(1);
      return Array.isArray(result);
    } catch (error) {
      console.warn('[XyraProvider] Health check failed:', error);
      return false;
    }
  }

  /**
   * Search for content using Xyra API.
   */
  async search(options: {
    query: string;
    type?: 'movie' | 'tv';
    limit?: number;
    page?: number;
    genres?: string[];
    year?: number;
  }): Promise<any[]> {
    console.log(`[XyraProvider] 🔍 Searching for: "${options.query}"`);

    try {
      await this.initialize();

      const { query, type, limit = 20, page = 1 } = options;

      // Search using Xyra API
      let results = await xyraApiService.searchDramas(query, page);

      console.log(`[XyraProvider] 📥 Raw results: ${results.length}`);

      if (!results || results.length === 0) {
        console.warn(`[XyraProvider] ⚠️ No results found for "${query}"`);
        return [];
      }

      // Filter by type if specified
      if (type) {
        results = results.filter((item: XyraMovie) => {
          if (type === 'movie') return item.type === 'movie';
          if (type === 'tv') return item.type === 'series';
          return true;
        });
      }

      // Map to unified format
      const mapped = results.slice(0, limit).map((item: XyraMovie) => this.mapToUnified(item));
      
      console.log(`[XyraProvider] ✅ Returning ${mapped.length} results`);
      return mapped;
    } catch (error) {
      console.error('[XyraProvider] ❌ Search failed:', error);
      return [];
    }
  }

  /**
   * Get trending content from Xyra.
   */
  async getTrending(limit: number = 20): Promise<any[]> {
    console.log(`[XyraProvider] 📊 Getting trending (limit: ${limit})`);

    try {
      await this.initialize();

      const results = await xyraApiService.getTrendingDramas();
      
      console.log(`[XyraProvider] 📥 Trending results: ${results.length}`);

      if (!results || results.length === 0) {
        return [];
      }

      const mapped = results.slice(0, limit).map((item: XyraMovie) => this.mapToUnified(item));
      console.log(`[XyraProvider] ✅ Returning ${mapped.length} trending results`);
      return mapped;
    } catch (error) {
      console.error('[XyraProvider] ❌ GetTrending failed:', error);
      return [];
    }
  }

  /**
   * Get trending by category.
   */
  async getTrendingByCategory(category: string, limit: number = 20, region?: string): Promise<any[]> {
    console.log(`[XyraProvider] 📊 Getting trending by category: ${category}`);

    try {
      await this.initialize();

      // Xyra doesn't have category filtering, so we get home and filter
      const results = await xyraApiService.getHome(1);
      
      if (!results || results.length === 0) {
        return [];
      }

      // Filter by category (genre)
      let filtered = results;
      if (category && category !== 'all') {
        // We'd need to get full info to filter by category
        // For now, just return all
        filtered = results;
      }

      const mapped = filtered.slice(0, limit).map((item: XyraMovie) => this.mapToUnified(item));
      console.log(`[XyraProvider] ✅ Returning ${mapped.length} results for category: ${category}`);
      return mapped;
    } catch (error) {
      console.error('[XyraProvider] ❌ GetTrendingByCategory failed:', error);
      return [];
    }
  }

  /**
   * Get detailed information about a specific title.
   */
  async getDetails(id: string, type: 'movie' | 'tv'): Promise<any | null> {
    console.log(`[XyraProvider] 🔍 Getting details for: ${id} (${type})`);

    try {
      await this.initialize();

      const info = await xyraApiService.getMovieInfo(id);
      
      if (!info) {
        console.warn(`[XyraProvider] ⚠️ No details found for ID: ${id}`);
        return null;
      }

      const mapped = this.mapInfoToUnified(info);
      console.log(`[XyraProvider] ✅ Found details for: ${mapped.title}`);
      return mapped;
    } catch (error) {
      console.error(`[XyraProvider] ❌ GetDetails failed for ${id}:`, error);
      return null;
    }
  }

  /**
   * Get streaming sources for a specific title.
   * Implements IStreamProvider interface.
   */
  async getStreams(options: {
    id: string;
    type: 'movie' | 'tv';
    season?: number;
    episode?: number;
  }): Promise<StreamSource[]> {
    console.log(`[XyraProvider] 🎬 Getting streams for: ${options.id} (${options.type})`);

    try {
      await this.initialize();

      const { id, type } = options;

      // Get download qualities from Xyra
      const downloads = await xyraApiService.getDownloadQualities(id);

      if (!downloads || downloads.length === 0) {
        console.warn(`[XyraProvider] ⚠️ No streams found for ID: ${id}`);
        return [];
      }

      // Map downloads to StreamSource format
      // ─── FIXED: Added required `id` and `provider` properties ───
      const sources: StreamSource[] = downloads.map((dl: XyraDownload) => ({
        id: `${id}-${dl.quality}`,           // ← REQUIRED: unique stream ID
        provider: 'xyra',                     // ← REQUIRED: provider identifier
        url: dl.url,
        quality: this.mapQuality(dl.quality),
        type: dl.url.includes('.m3u8') ? 'hls' : 'mp4',
        headers: {},
      }));

      console.log(`[XyraProvider] ✅ Found ${sources.length} streams`);
      return sources;
    } catch (error) {
      console.error(`[XyraProvider] ❌ GetStreams failed for ${options.id}:`, error);
      return [];
    }
  }

  /**
   * Get download URLs for a specific title.
   */
  async getDownloadUrls(id: string): Promise<{ quality: string; url: string }[]> {
    console.log(`[XyraProvider] 📥 Getting download URLs for: ${id}`);

    try {
      await this.initialize();

      const downloads = await xyraApiService.getDownloadQualities(id);
      
      if (!downloads || downloads.length === 0) {
        console.warn(`[XyraProvider] ⚠️ No downloads found for ID: ${id}`);
        return [];
      }

      return downloads.map((dl: XyraDownload) => ({
        quality: dl.quality,
        url: dl.url,
      }));
    } catch (error) {
      console.error(`[XyraProvider] ❌ GetDownloadUrls failed for ${id}:`, error);
      return [];
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PRIVATE MAPPING HELPERS
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Map XyraMovie to unified format.
   */
  private mapToUnified(item: XyraMovie): any {
    return {
      id: item.id,
      title: item.title,
      type: item.type === 'series' ? 'tv' : 'movie',
      poster: item.image || '',
      backdrop: '',
      overview: '',
      rating: 0,
      year: undefined,
      releaseDate: undefined,
      genres: [],
      runtime: undefined,
      cast: [],
      source: 'xyra',
      link: item.link,
      quality: item.quality,
      image: item.image,
    };
  }

  /**
   * Map XyraMovieInfo to unified format.
   */
  private mapInfoToUnified(info: XyraMovieInfo): any {
    return {
      id: info.id,
      title: info.title,
      type: info.type === 'series' ? 'tv' : 'movie',
      poster: info.image || '',
      backdrop: '',
      overview: info.description || '',
      rating: 0,
      year: undefined,
      releaseDate: undefined,
      genres: info.categories || [],
      runtime: undefined,
      cast: [],
      source: 'xyra',
      imdbId: info.imdb_id,
      downloads: info.downloads || [],
      downloadCount: info.download_count || 0,
      related: info.related || [],
    };
  }

  /**
   * Map Xyra quality string to StreamQuality.
   */
  private mapQuality(quality: string): StreamQuality {
    const q = quality.toLowerCase();
    if (q.includes('1080') || q.includes('full hd')) return '1080p';
    if (q.includes('720') || q.includes('hd')) return '720p';
    if (q.includes('480')) return '480p';
    if (q.includes('360')) return '360p';
    if (q.includes('4k') || q.includes('2160')) return '2160p';
    return 'auto';
  }

  /**
   * Clear all resources.
   */
  destroy(): void {
    this.initialized = false;
    console.log('[XyraProvider] Destroyed');
  }
}

export default XyraProvider;