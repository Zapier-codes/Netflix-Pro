// src/hooks/content/useSearchPreloader.ts
import { useState, useEffect } from 'react';
import { searchAggregationService } from '../../services/supabase/supabaseClient';
import { cacheManager } from '../../services/cache/CacheManager';

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

        setTrendingSearches(trending);
        setCategories(cats);

        await cacheManager.set('trending_searches', trending, 300000);
        await cacheManager.set('search_categories', cats, 300000);
      } catch (error) {
        console.warn('[useSearchPreloader] Error:', error);
        setTrendingSearches(['Stranger Things', 'The Last of Us', 'Breaking Bad', 'Game of Thrones']);
        setCategories(['movies', 'tv', 'drama', 'anime']);
      } finally {
        setLoading(false);
      }
    };

    preload();
  }, []);

  return { trendingSearches, categories, loading };
};