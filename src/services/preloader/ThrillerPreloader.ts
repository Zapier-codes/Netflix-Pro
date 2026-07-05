// src/services/preloader/ThrillerPreloader.ts
import { cacheManager } from '../cache/CacheManager';
import { getImageUrl } from '../unified/metadata/TMDBMetadata';
import { search, getStreamInfo, StreamInfoItem, InfoItem } from '../../../modules/mavin-engine';

export interface ThrillerItem {
  id: string;
  tmdbId: number;
  title: string;
  posterPath: string;
  backdropPath: string;
  overview: string;
  voteAverage: number;
  videoUrl?: string;
  duration?: number;
  uploaderName?: string;
  viewCount?: number;
  isLoaded: boolean;
}

const INDEX_KEY = 'thriller_index_v1';
const BATCH_TIMESTAMP_KEY = 'thriller_batch_timestamp_v1';

// ─── Weekly rotation: trailers stay cached for 7 days, not 1 hour. ───
// The batch of up to 36 items is meant to be generated once and reused
// all week; only a background weekly-refresh job should trigger a new
// round of searches, not a normal per-hour cache expiry.
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const INDEX_TTL = ONE_WEEK_MS;
const CACHE_TTL = ONE_WEEK_MS;

// ─── Eager preload promise tracking ───
let eagerPreloadPromise: Promise<ThrillerItem[]> | null = null;
let eagerPreloadMovies: any[] | null = null;

export class ThrillerPreloader {
  private static instance: ThrillerPreloader;

  static getInstance(): ThrillerPreloader {
    if (!ThrillerPreloader.instance) {
      ThrillerPreloader.instance = new ThrillerPreloader();
    }
    return ThrillerPreloader.instance;
  }

  // ─── Index helpers ───
  private async getIndex(): Promise<number[]> {
    try {
      const index = await cacheManager.get<number[]>(INDEX_KEY);
      return Array.isArray(index) ? index : [];
    } catch {
      return [];
    }
  }

  private async addToIndex(tmdbId: number): Promise<void> {
    try {
      const index = await this.getIndex();
      if (!index.includes(tmdbId)) {
        index.push(tmdbId);
        await cacheManager.set(INDEX_KEY, index, INDEX_TTL);
      }
    } catch (e) {
      console.warn('[ThrillerPreloader] Failed to update cache index:', e);
    }
  }

  private async removeFromIndex(tmdbId: number): Promise<void> {
    try {
      const index = await this.getIndex();
      const next = index.filter((id) => id !== tmdbId);
      if (next.length !== index.length) {
        await cacheManager.set(INDEX_KEY, next, INDEX_TTL);
      }
    } catch (e) {
      console.warn('[ThrillerPreloader] Failed to update cache index:', e);
    }
  }

  // ─── Batch timestamp helpers (drives the weekly refresh job) ───
  private async getBatchTimestamp(): Promise<number | null> {
    try {
      const ts = await cacheManager.get<number>(BATCH_TIMESTAMP_KEY);
      return typeof ts === 'number' ? ts : null;
    } catch {
      return null;
    }
  }

  private async setBatchTimestamp(): Promise<void> {
    try {
      await cacheManager.set(BATCH_TIMESTAMP_KEY, Date.now(), ONE_WEEK_MS);
    } catch (e) {
      console.warn('[ThrillerPreloader] Failed to set batch timestamp:', e);
    }
  }

  /**
   * True if the current batch is older than a week (or has never been
   * generated). A background job should call this periodically — not
   * on every app open — and call preloadTrailers() again if stale.
   */
  async isBatchStale(): Promise<boolean> {
    const ts = await this.getBatchTimestamp();
    if (!ts) return true;
    return Date.now() - ts > ONE_WEEK_MS;
  }

  /**
   * Call from a background scheduler (not blocking the UI). Regenerates
   * the batch only if it's actually past its weekly window.
   */
  async checkAndRefreshWeeklyBatch(movies: any[]): Promise<void> {
    const stale = await this.isBatchStale();
    if (!stale) return;

    console.log('[ThrillerPreloader] 🔄 Weekly batch is stale, refreshing in background...');
    await this.clearCache();
    await this.preloadTrailers(movies);
    await this.setBatchTimestamp();
  }

  // ─── EAGER PRELOAD: Call this BEFORE the user reaches HomeScreen ───
  // Returns immediately if already preloading same movies. Call from root layout.
  async eagerPreload(movies: any[]): Promise<ThrillerItem[]> {
    if (
      eagerPreloadPromise &&
      eagerPreloadMovies &&
      this.areMovieListsEqual(eagerPreloadMovies, movies)
    ) {
      return eagerPreloadPromise;
    }

    eagerPreloadMovies = [...movies];
    eagerPreloadPromise = this.preloadTrailers(movies);

    try {
      const result = await eagerPreloadPromise;
      return result;
    } catch (error) {
      eagerPreloadPromise = null;
      eagerPreloadMovies = null;
      throw error;
    }
  }

  // ─── Wait for eager preload to complete (non-blocking check) ───
  async awaitEagerPreload(movies: any[]): Promise<ThrillerItem[]> {
    if (
      eagerPreloadPromise &&
      eagerPreloadMovies &&
      this.areMovieListsEqual(eagerPreloadMovies, movies)
    ) {
      return eagerPreloadPromise;
    }

    const movieIds = movies.map((m) => m.id);
    const cached = await this.getCachedTrailers(movieIds);

    const cachedIds = new Set(cached.map((c) => c.tmdbId));
    const allCached = movieIds.every((id) => cachedIds.has(id));

    if (allCached) {
      return cached;
    }

    return this.eagerPreload(movies);
  }

  private areMovieListsEqual(a: any[], b: any[]): boolean {
    if (a.length !== b.length) return false;
    const idsA = new Set(a.map((m) => m.id));
    const idsB = new Set(b.map((m) => m.id));
    if (idsA.size !== idsB.size) return false;
    for (const id of idsA) {
      if (!idsB.has(id)) return false;
    }
    return true;
  }

  // ─── Preload trailers for a list of movies ───
  async preloadTrailers(movies: any[]): Promise<ThrillerItem[]> {
    const results: ThrillerItem[] = [];

    const batchSize = 3;
    for (let i = 0; i < movies.length; i += batchSize) {
      const batch = movies.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (movie) => {
          try {
            return await this.processMovie(movie);
          } catch (error) {
            console.error(`[ThrillerPreloader] Error processing movie ${movie.id}:`, error);
            return this.createFallbackItem(movie);
          }
        })
      );
      results.push(...batchResults);
    }

    await this.setBatchTimestamp();
    return results;
  }

  // ─── Process a single movie ───
  private async processMovie(movie: any): Promise<ThrillerItem> {
    const cacheKey = `thriller_${movie.id}`;

    const cached = await cacheManager.get<ThrillerItem>(cacheKey);
    if (cached && cached.isLoaded) {
      return cached;
    }

    const trailer = await this.fetchTrailer(movie);

    const item: ThrillerItem = {
      id: `thriller_${movie.id}`,
      tmdbId: movie.id,
      title: movie.title || movie.name || 'Untitled',
      posterPath: movie.poster_path || '',
      backdropPath: movie.backdrop_path || '',
      overview: movie.overview || '',
      voteAverage: movie.vote_average || 0,
      videoUrl: trailer?.url,
      duration: trailer?.duration || 0,
      uploaderName: trailer?.uploaderName || 'YouTube',
      viewCount: trailer?.viewCount || 0,
      isLoaded: !!trailer?.url,
    };

    if (item.isLoaded) {
      await cacheManager.set(cacheKey, item, CACHE_TTL);
      await this.addToIndex(movie.id);
    } else {
      try {
        await cacheManager.delete(cacheKey);
      } catch {}
      await this.removeFromIndex(movie.id);
    }

    return item;
  }

  // ─── Fetch trailer from MavinEngine ───
  private async fetchTrailer(movie: any): Promise<{
    url: string;
    duration: number;
    uploaderName: string;
    viewCount: number;
  } | null> {
    try {
      const year = movie.release_date?.split('-')[0] || '';
      const searchQuery = `${movie.title} ${year} official trailer`.trim();

      console.log(`[ThrillerPreloader] Searching for: ${searchQuery}`);

      const searchResult = await search(searchQuery, 'videos');

      if (!searchResult || !('results' in searchResult) || !searchResult.results?.length) {
        console.log(`[ThrillerPreloader] No search results for: ${searchQuery}`);
        return null;
      }

      const videoResults = searchResult.results.filter(
        (r: InfoItem): r is StreamInfoItem => r.type === 'stream'
      );

      if (videoResults.length === 0) {
        console.log(`[ThrillerPreloader] No video-type results for: ${searchQuery}`);
        return null;
      }

      const bestMatch = this.selectBestTrailer(videoResults);
      if (!bestMatch) {
        return null;
      }

      const streamInfo = await getStreamInfo(bestMatch.url);

      if (!streamInfo || !streamInfo.success) {
        console.log(
          `[ThrillerPreloader] getStreamInfo failed for ${bestMatch.url}: ${streamInfo?.error || 'unknown error'}`
        );
        return null;
      }

      const candidateStreams =
        streamInfo.videoStreams?.length ? streamInfo.videoStreams : streamInfo.videoOnlyStreams;

      if (!candidateStreams || candidateStreams.length === 0) {
        console.log(`[ThrillerPreloader] No playable video streams for ${bestMatch.url}`);
        return null;
      }

      const videoStream = this.selectBestStream(candidateStreams);
      if (!videoStream) {
        return null;
      }

      return {
        url: videoStream.url,
        duration: streamInfo.duration || 0,
        uploaderName: streamInfo.uploaderName || 'YouTube',
        viewCount: streamInfo.viewCount || 0,
      };
    } catch (error) {
      console.error('[ThrillerPreloader] Fetch trailer error:', error);
      return null;
    }
  }

  // ─── Select the best trailer from search results ───
  private selectBestTrailer(results: StreamInfoItem[]): StreamInfoItem | null {
    if (!results || results.length === 0) return null;

    const scored = results.map((item) => {
      let score = 0;
      const title = (item.name || '').toLowerCase();

      if (title.includes('official trailer')) score += 50;
      if (title.includes('official')) score += 30;
      if (title.includes('trailer')) score += 20;

      if (item.viewCount) {
        score += Math.min(Math.log10(item.viewCount + 1) * 10, 30);
      }

      if (title.length < 60) score += 10;

      if (title.includes('review')) score -= 20;
      if (title.includes('compilation')) score -= 20;
      if (title.includes('podcast')) score -= 20;
      if (title.includes('reaction')) score -= 20;

      if (item.isShortFormContent) score -= 40;
      if (item.isLive) score -= 100;

      return { item, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.item || null;
  }

  // ─── Select the best video stream ───
  private selectBestStream(streams: { url: string; height: number }[]): { url: string; height: number } | null {
    if (!streams || streams.length === 0) return null;

    const sorted = [...streams].sort((a, b) => (b.height || 0) - (a.height || 0));

    const best = sorted[0];
    if (best.height > 1080) {
      const cap = sorted.find((s) => s.height <= 1080 && s.height >= 720);
      return cap || best;
    }

    return best;
  }

  // ─── Create a fallback item without a trailer ───
  private createFallbackItem(movie: any): ThrillerItem {
    return {
      id: `thriller_${movie.id}`,
      tmdbId: movie.id,
      title: movie.title || movie.name || 'Untitled',
      posterPath: movie.poster_path || '',
      backdropPath: movie.backdrop_path || '',
      overview: movie.overview || '',
      voteAverage: movie.vote_average || 0,
      isLoaded: false,
    };
  }

  // ─── Get preloaded items from cache ───
  async getCachedTrailers(movieIds: number[]): Promise<ThrillerItem[]> {
    const results: ThrillerItem[] = [];

    for (const id of movieIds) {
      const cacheKey = `thriller_${id}`;
      try {
        const cached = await cacheManager.get<ThrillerItem>(cacheKey);
        if (cached) {
          results.push(cached);
        }
      } catch {
        // Missing key or backend error
      }
    }

    return results;
  }

  // ─── Clear thriller cache ───
  async clearCache(): Promise<void> {
    const index = await this.getIndex();
    for (const tmdbId of index) {
      try {
        await cacheManager.delete(`thriller_${tmdbId}`);
      } catch (e) {
        console.warn(`[ThrillerPreloader] Failed to delete cache for ${tmdbId}:`, e);
      }
    }
    try {
      await cacheManager.delete(INDEX_KEY);
    } catch (e) {
      console.warn('[ThrillerPreloader] Failed to delete cache index:', e);
    }
    try {
      await cacheManager.delete(BATCH_TIMESTAMP_KEY);
    } catch (e) {
      console.warn('[ThrillerPreloader] Failed to delete batch timestamp:', e);
    }

    eagerPreloadPromise = null;
    eagerPreloadMovies = null;
  }

  // ─── Get cache status ───
  async getCacheStatus(): Promise<{
    totalItems: number;
    loadedItems: number;
    timestamp: number;
  }> {
    const index = await this.getIndex();

    let loadedCount = 0;
    for (const tmdbId of index) {
      const item = await cacheManager.get<ThrillerItem>(`thriller_${tmdbId}`);
      if (item && item.isLoaded) loadedCount++;
    }

    return {
      totalItems: index.length,
      loadedItems: loadedCount,
      timestamp: Date.now(),
    };
  }
}

export const thrillerPreloader = ThrillerPreloader.getInstance();
