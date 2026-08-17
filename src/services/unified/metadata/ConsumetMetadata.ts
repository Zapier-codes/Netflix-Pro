/**
 * ConsumetMetadata - Local wrapper service around the raw Consumet
 * provider layer (src/api/consumet/consumetApi.ts).
 *
 * This is the middle layer referenced by ConsumetMetadataAdapter:
 *
 *   adapter -> local metadata wrapper (THIS FILE) -> raw provider (ConsumetApiService)
 *
 * Responsibilities:
 *  - Normalize movie/tv/anime shapes from ConsumetApiService into a single
 *    ConsumetContent shape the adapter can map into IMetadataResult.
 *  - Provide a small, adapter-facing API surface: searchContent, getRecent,
 *    getDetails - so the adapter never has to know about individual
 *    scraping providers (MultiMovies, Zoro, AnimePahe, etc.).
 *  - Cache results briefly in memory to avoid hammering the underlying
 *    scraping providers, which are slow and rate-limit-sensitive.
 */

import {
  consumetApiService,
  ConsumetMovie,
  ConsumetTVShow,
  ConsumetAnime,
} from '../providers/consumet/ConsumetProvider';

// â”€â”€â”€ PUBLIC TYPES â”€â”€â”€

export type ConsumetContentType = 'movie' | 'tv' | 'anime';
export type ConsumetSearchType = ConsumetContentType | 'all';

export interface ConsumetCastMember {
  name: string;
  role?: string;
}

/**
 * Unified shape consumed by ConsumetMetadataAdapter.mapConsumetContent().
 * Field names intentionally mirror what the adapter already reads.
 */
export interface ConsumetContent {
  id: string;
  title: string;
  type: ConsumetContentType;
  overview?: string;
  poster?: string;
  backdrop?: string;
  rating?: number;
  genres?: string[];
  releaseDate?: string;
  runtime?: number | string;
  status?: string;
  seasons?: number;
  episodes?: number;
  cast?: ConsumetCastMember[];
}

// â”€â”€â”€ CACHE â”€â”€â”€

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

class SimpleCache {
  private store = new Map<string, CacheEntry<any>>();

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number = DEFAULT_TTL_MS): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  clear(): void {
    this.store.clear();
  }
}

// â”€â”€â”€ SERVICE â”€â”€â”€

export class ConsumetMetadataService {
  private cache = new SimpleCache();

  /**
   * Search movies, tv, anime, or all three via the underlying
   * ConsumetApiService fallback-chain searches.
   */
  async searchContent(
    query: string,
    type: ConsumetSearchType = 'all',
    limit: number = 20
  ): Promise<ConsumetContent[]> {
    const cacheKey = `search:${type}:${query.toLowerCase()}:${limit}`;
    const cached = this.cache.get<ConsumetContent[]>(cacheKey);
    if (cached) return cached;

    try {
      const results = await this.fetchByType(type, async (t) => {
        switch (t) {
          case 'movie': {
            const movies = await consumetApiService.searchMoviesAllProviders(query);
            return movies.map((m) => this.mapMovie(m));
          }
          case 'tv': {
            const shows = await consumetApiService.searchTVAllProviders(query);
            return shows.map((s) => this.mapTVShow(s));
          }
          case 'anime': {
            const anime = await consumetApiService.searchAnimeAllProviders(query);
            return anime.map((a) => this.mapAnime(a));
          }
        }
      });

      const sliced = results.slice(0, limit);
      this.cache.set(cacheKey, sliced);
      return sliced;
    } catch (error) {
      console.error('[ConsumetMetadata] searchContent failed:', error);
      return [];
    }
  }

  /**
   * "Recent"/discover feed. The raw provider layer doesn't expose a
   * dedicated trending endpoint with a limit param, so we reuse its
   * recent/popular helpers (which internally do an empty-query search)
   * and cap the result client-side.
   */
  async getRecent(
    type: ConsumetSearchType = 'all',
    limit: number = 20
  ): Promise<ConsumetContent[]> {
    const cacheKey = `recent:${type}:${limit}`;
    const cached = this.cache.get<ConsumetContent[]>(cacheKey);
    if (cached) return cached;

    try {
      const results = await this.fetchByType(type, async (t) => {
        switch (t) {
          case 'movie': {
            const movies = await consumetApiService.getRecentMovies();
            return movies.map((m) => this.mapMovie(m));
          }
          case 'tv': {
            const shows = await consumetApiService.getRecentTVShows();
            return shows.map((s) => this.mapTVShow(s));
          }
          case 'anime': {
            const anime = await consumetApiService.getPopularAnime();
            return anime.map((a) => this.mapAnime(a));
          }
        }
      });

      const sliced = results.slice(0, limit);
      this.cache.set(cacheKey, sliced, 2 * 60 * 1000); // shorter TTL for "recent"
      return sliced;
    } catch (error) {
      console.error('[ConsumetMetadata] getRecent failed:', error);
      return [];
    }
  }

  /**
   * Fetch a single item's details by id + type.
   */
  async getDetails(id: string, type: ConsumetContentType): Promise<ConsumetContent | null> {
    const cacheKey = `details:${type}:${id}`;
    const cached = this.cache.get<ConsumetContent | null>(cacheKey);
    if (cached !== undefined) return cached;

    try {
      let mapped: ConsumetContent | null = null;

      switch (type) {
        case 'movie': {
          const info = await consumetApiService.getMovieInfo(id);
          mapped = info ? this.mapMovie(info) : null;
          break;
        }
        case 'tv': {
          const info = await consumetApiService.getTVInfo(id);
          mapped = info ? this.mapTVShow(info) : null;
          break;
        }
        case 'anime': {
          const info = await consumetApiService.getAnimeInfo(id);
          mapped = info ? this.mapAnime(info) : null;
          break;
        }
      }

      this.cache.set(cacheKey, mapped);
      return mapped;
    } catch (error) {
      console.error(`[ConsumetMetadata] getDetails failed for ${type} ${id}:`, error);
      return null;
    }
  }

  destroy(): void {
    this.cache.clear();
    console.log('[ConsumetMetadata] Destroyed');
  }

  // â”€â”€â”€ INTERNAL HELPERS â”€â”€â”€

  /**
   * Runs `fn` for each concrete content type implied by `type` (expanding
   * 'all' into movie+tv+anime), in parallel, and flattens/interleaves the
   * results so no single type dominates the front of the list.
   */
  private async fetchByType(
    type: ConsumetSearchType,
    fn: (t: ConsumetContentType) => Promise<ConsumetContent[]>
  ): Promise<ConsumetContent[]> {
    const types: ConsumetContentType[] =
      type === 'all' ? ['movie', 'tv', 'anime'] : [type];

    const settled = await Promise.allSettled(types.map((t) => fn(t)));
    const buckets = settled.map((r) => (r.status === 'fulfilled' ? r.value : []));

    settled.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.warn(`[ConsumetMetadata] ${types[i]} fetch failed:`, r.reason);
      }
    });

    if (buckets.length === 1) return buckets[0];

    // Interleave results across types (movie, tv, anime, movie, tv, anime, ...)
    const interleaved: ConsumetContent[] = [];
    const maxLen = Math.max(...buckets.map((b) => b.length), 0);
    for (let i = 0; i < maxLen; i++) {
      for (const bucket of buckets) {
        if (bucket[i]) interleaved.push(bucket[i]);
      }
    }
    return interleaved;
  }

  private mapMovie(item: ConsumetMovie): ConsumetContent {
    return {
      id: item.id || '',
      title: item.title || '',
      type: 'movie',
      overview: item.overview || '',
      poster: item.poster || undefined,
      backdrop: item.backdrop || undefined,
      rating: item.rating || 0,
      genres: item.genres || [],
      releaseDate: item.releaseDate || undefined,
      runtime: item.runtime || undefined,
      status: item.status || undefined,
    };
  }

  private mapTVShow(item: ConsumetTVShow): ConsumetContent {
    return {
      id: item.id || '',
      title: item.title || '',
      type: 'tv',
      overview: item.overview || '',
      poster: item.poster || undefined,
      backdrop: item.backdrop || undefined,
      rating: item.rating || 0,
      genres: item.genres || [],
      releaseDate: item.releaseDate || undefined,
      status: item.status || undefined,
      seasons: item.seasons || undefined,
      episodes: item.episodes || undefined,
    };
  }

  private mapAnime(item: ConsumetAnime): ConsumetContent {
    return {
      id: item.id || '',
      title: item.title || '',
      type: 'anime',
      overview: item.synopsis || '',
      poster: item.image || undefined,
      backdrop: item.cover || undefined,
      rating: item.rating || 0,
      genres: item.genres || [],
      status: item.status || undefined,
      episodes: item.totalEpisodes || undefined,
    };
  }
}

// Export singleton instance, matching consumetApiService's export pattern
export const consumetMetadataService = new ConsumetMetadataService();

export default consumetMetadataService;

