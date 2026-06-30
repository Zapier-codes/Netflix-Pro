// src/hooks/content/useContent.ts
import { useMemo } from 'react';
import {
  useGetTrendingQuery,
  useGetPopularMoviesQuery,
  useGetPopularTVShowsQuery,
  useGetTopRatedMoviesQuery,
  useGetTopRatedTVShowsQuery,
  useGetUpcomingMoviesQuery,
  useGetAiringTodayTVQuery,
  useGetOnTheAirTVQuery,
} from '../../store/rtk/api/contentApi';
import { shufflingEngine } from '../../utils/contentUtils';

export const useContent = () => {
  const sessionSeed = useMemo(() => Date.now().toString(), []);

  const trending = useGetTrendingQuery({ timeWindow: 'day' });
  const popularMovies = useGetPopularMoviesQuery({ page: 1 });
  const popularTVShows = useGetPopularTVShowsQuery({ page: 1 });
  const topRatedMovies = useGetTopRatedMoviesQuery({ page: 1 });
  const topRatedTVShows = useGetTopRatedTVShowsQuery({ page: 1 });
  const upcoming = useGetUpcomingMoviesQuery({ page: 1 });
  const airingToday = useGetAiringTodayTVQuery({ page: 1 });
  const onTheAir = useGetOnTheAirTVQuery({ page: 1 });

  const isLoading = 
    trending.isLoading ||
    popularMovies.isLoading ||
    popularTVShows.isLoading ||
    topRatedMovies.isLoading ||
    topRatedTVShows.isLoading ||
    upcoming.isLoading ||
    airingToday.isLoading ||
    onTheAir.isLoading;

  const allContent = useMemo(() => {
    const content = [
      { id: 'trending', title: 'Trending Now', type: 'trending', data: trending.data || [] },
      { id: 'popular-movies', title: 'Popular Movies', type: 'popular', data: popularMovies.data || [] },
      { id: 'popular-tv', title: 'Popular TV Shows', type: 'popular', data: popularTVShows.data || [] },
      { id: 'top-rated-movies', title: 'Top Rated Movies', type: 'top_rated', data: topRatedMovies.data || [] },
      { id: 'top-rated-tv', title: 'Top Rated TV Shows', type: 'top_rated', data: topRatedTVShows.data || [] },
      { id: 'upcoming', title: 'Upcoming Movies', type: 'upcoming', data: upcoming.data || [] },
      { id: 'airing-today', title: 'Airing Today', type: 'now_playing', data: airingToday.data || [] },
      { id: 'on-the-air', title: 'On The Air', type: 'now_playing', data: onTheAir.data || [] },
    ];

    shufflingEngine.reset(sessionSeed);
    return content.map(row => ({
      ...row,
      data: shufflingEngine.shuffle(row.data)
    }));
  }, [
    trending.data,
    popularMovies.data,
    popularTVShows.data,
    topRatedMovies.data,
    topRatedTVShows.data,
    upcoming.data,
    airingToday.data,
    onTheAir.data,
    sessionSeed,
  ]);

  return {
    rows: allContent,
    isLoading,
    isError: trending.isError || popularMovies.isError,
    refetch: () => {
      trending.refetch();
      popularMovies.refetch();
      popularTVShows.refetch();
      topRatedMovies.refetch();
      topRatedTVShows.refetch();
      upcoming.refetch();
      airingToday.refetch();
      onTheAir.refetch();
    },
  };
};

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

// src/hooks/device/useDevice.ts
import { useState, useEffect } from 'react';
import { deviceManager, DeviceProfile } from '../../services/device/DeviceManager';

export const useDevice = () => {
  const [profile, setProfile] = useState<DeviceProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const p = await deviceManager.initialize();
      setProfile(p);
      setLoading(false);
    };
    init();
  }, []);

  const refresh = async () => {
    setLoading(true);
    const p = await deviceManager.refresh();
    setProfile(p);
    setLoading(false);
  };

  return {
    profile,
    loading,
    displayName: profile ? ${profile.emoji} : '🌟Guest',
    refresh,
  };
};

// src/hooks/supabase/useSearchAggregation.ts
import { useState, useCallback } from 'react';
import { searchAggregationService } from '../../services/supabase/supabaseClient';

export const useSearchAggregation = () => {
  const [isRecording, setIsRecording] = useState(false);

  const recordSearch = useCallback(async (query: string, category?: string) => {
    setIsRecording(true);
    try {
      await searchAggregationService.recordSearch(query, category);
    } catch (error) {
      console.warn('[useSearchAggregation] Error:', error);
    } finally {
      setIsRecording(false);
    }
  }, []);

  const getTrending = useCallback(async (limit?: number, category?: string) => {
    try {
      return await searchAggregationService.getTrendingSearches(limit, category);
    } catch (error) {
      console.warn('[useSearchAggregation] Error:', error);
      return [];
    }
  }, []);

  const getCategories = useCallback(async () => {
    try {
      return await searchAggregationService.getSearchCategories();
    } catch (error) {
      console.warn('[useSearchAggregation] Error:', error);
      return [];
    }
  }, []);

  return {
    recordSearch,
    getTrending,
    getCategories,
    isRecording,
  };
};
