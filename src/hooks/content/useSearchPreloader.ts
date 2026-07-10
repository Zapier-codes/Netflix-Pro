// src/hooks/content/useSearchPreloader.ts
import { useState, useEffect } from 'react';
import { searchAggregationService } from '../../services/supabase/searchAggregationService';
import { cacheManager } from '../../services/cache/CacheManager';
import { fetchTrending } from '../../services/unified/metadata/TMDBMetadata';

const FALLBACK_TRENDING = ['Stranger Things', 'The Last of Us', 'Breaking Bad', 'Game of Thrones'];
const FALLBACK_CATEGORIES = ['movies', 'tv', 'drama', 'anime', 'comedy', 'action', 'horror', 'sci-fi'];

export const useSearchPreloader = () => {
  const [trendingSearches, setTrendingSearches] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const preload = async () => {
      setLoading(true);
      try {
        const cachedTrending = await cacheManager.get<string[]>('trending_searches');
        const cachedCategories = await cacheManager.get<string[]>('search_categories');
        if (cachedTrending && cachedCategories) {
          setTrendingSearches(cachedTrending);
          setCategories(cachedCategories);
          setLoading(false);
          return;
        }

        const [trending, cats] = await Promise.all([
          searchAggregationService.getTrendingSearches(20),
          searchAggregationService.getSearchCategories(),
        ]);

        // Supabase has no search history yet (new install / empty table)
        // → fall back to the TMDB trending engine so the UI isn't empty.
        let finalTrending = trending;
        if (finalTrending.length === 0) {
          try {
            const trendingContent = await fetchTrending('day', 'all');
            finalTrending = (trendingContent || [])
              .map((item: any) => item.title || item.name)
              .filter(Boolean)
              .slice(0, 20);
          } catch {
            finalTrending = FALLBACK_TRENDING;
          }
        }
        if (finalTrending.length === 0) finalTrending = FALLBACK_TRENDING;

        const finalCategories = cats.length > 0 ? cats : FALLBACK_CATEGORIES;

        setTrendingSearches(finalTrending);
        setCategories(finalCategories);
        await cacheManager.set('trending_searches', finalTrending, 300000);
        await cacheManager.set('search_categories', finalCategories, 300000);
      } catch (error) {
        console.warn('[useSearchPreloader] Error:', error);
        setTrendingSearches(FALLBACK_TRENDING);
        setCategories(FALLBACK_CATEGORIES);
      } finally {
        setLoading(false);
      }
    };

    preload();
  }, []);

  return { trendingSearches, categories, loading };
};