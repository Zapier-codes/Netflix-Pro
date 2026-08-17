// src/hooks/content/useSearchPreloader.ts
import { useState, useEffect } from 'react';
import { cacheManager } from '../../services/cache/CacheManager';
import { unifiedMediaService } from '../../services/unified/UnifiedMediaService';
import { IMetadataResult } from '../../services/unified/types/MetadataTypes';

const CATEGORIES = ['movies', 'tv', 'drama', 'anime', 'comedy', 'action', 'horror', 'sci-fi'];

const RECENCY_WINDOW_DAYS = 30;

// Must match GRID_COLUMNS * GRID_ROWS in SearchScreen.tsx (4 * 3) — the
// "Popular Searches" grid always needs a full page of this many items.
const TARGET_COUNT = 12;

/**
 * Keep only content released within the last ~30 days.
 * - Sources with a real `releaseDate` (TMDB, MovieBox) are checked precisely.
 * - Sources without one (Kuryana only ever has `year`) fall back to a
 *   year-only comparison — they're never excluded outright, just checked
 *   at whatever precision is available.
 */
const isRecentEnough = (item: IMetadataResult): boolean => {
  if (item.releaseDate) {
    const releaseTime = new Date(item.releaseDate).getTime();
    if (!isNaN(releaseTime)) {
      const ageInDays = (Date.now() - releaseTime) / (1000 * 60 * 60 * 24);
      return ageInDays <= RECENCY_WINDOW_DAYS;
    }
  }

  if (item.year) {
    const currentYear = new Date().getFullYear();
    return item.year === currentYear;
  }

  // No date info at all — can't verify recency, so leave it out.
  return false;
};

export const useSearchPreloader = () => {
  const [trendingItems, setTrendingItems] = useState<IMetadataResult[]>([]);
  const [categories] = useState<string[]>(CATEGORIES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const preload = async () => {
      setLoading(true);
      try {
        const cached = await cacheManager.get<IMetadataResult[]>('trending_search_items');
        if (cached && cached.length > 0) {
          setTrendingItems(cached);
          setLoading(false);
          return;
        }

        await unifiedMediaService.initialize();
        // Fetch a larger pool than we need. The recency filter below is a
        // preference, not a hard cap — see backfill step.
        const trending = await unifiedMediaService.getTrending(60);
        const withPosters = trending.filter(item => !!item.poster);

        // Recent items first (these are what we actually want to show)...
        const recent = withPosters.filter(isRecentEnough);

        // ...but if recency alone doesn't add up to a full grid page, backfill
        // with the next-best trending items (still poster-only, original
        // popularity order preserved) so the grid is never short/uneven.
        let finalItems = recent;
        if (finalItems.length < TARGET_COUNT) {
          const recentSet = new Set(recent);
          const backfill = withPosters.filter(item => !recentSet.has(item));
          finalItems = [...recent, ...backfill].slice(0, TARGET_COUNT);
        } else {
          finalItems = finalItems.slice(0, TARGET_COUNT);
        }

        setTrendingItems(finalItems);
        await cacheManager.set('trending_search_items', finalItems, 300000);
      } catch (error) {
        console.warn('[useSearchPreloader] Error:', error);
        setTrendingItems([]);
      } finally {
        setLoading(false);
      }
    };

    preload();
  }, []);

  return { trendingItems, categories, loading };
};