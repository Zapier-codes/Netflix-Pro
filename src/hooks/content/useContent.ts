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
} from '../../store/api/contentApi';
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