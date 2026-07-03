// src/store/api/contentApi.ts
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const TMDB_API_KEY = process.env.EXPO_PUBLIC_TMDB_API_KEY || 'fa953c513c37da857fb3155738358ff0';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

export const contentApi = createApi({
  reducerPath: 'contentApi',
  baseQuery: fetchBaseQuery({ 
    baseUrl: TMDB_BASE_URL,
  }),
  tagTypes: ['Trending', 'Popular', 'TopRated', 'Upcoming', 'NowPlaying', 'StreamLinks', 'Subtitles', 'SearchResults'],
  keepUnusedDataFor: 3600,
  endpoints: (builder) => ({
    // ============================================
    // TMDB CONTENT ENDPOINTS
    // ============================================
    
    getTrending: builder.query({
      query: ({ timeWindow = 'day' }) => 
        `/trending/all/${timeWindow}?api_key=${TMDB_API_KEY}`,
      transformResponse: (response: any) => response.results || [],
      providesTags: ['Trending'],
    }),
    
    getPopularMovies: builder.query({
      query: ({ page = 1 }) => 
        `/movie/popular?page=${page}&api_key=${TMDB_API_KEY}`,
      transformResponse: (response: any) => response.results || [],
      providesTags: ['Popular'],
    }),
    
    getPopularTVShows: builder.query({
      query: ({ page = 1 }) => 
        `/tv/popular?page=${page}&api_key=${TMDB_API_KEY}`,
      transformResponse: (response: any) => response.results || [],
      providesTags: ['Popular'],
    }),
    
    getTopRatedMovies: builder.query({
      query: ({ page = 1 }) => 
        `/movie/top_rated?page=${page}&api_key=${TMDB_API_KEY}`,
      transformResponse: (response: any) => response.results || [],
      providesTags: ['TopRated'],
    }),
    
    getTopRatedTVShows: builder.query({
      query: ({ page = 1 }) => 
        `/tv/top_rated?page=${page}&api_key=${TMDB_API_KEY}`,
      transformResponse: (response: any) => response.results || [],
      providesTags: ['TopRated'],
    }),
    
    getUpcomingMovies: builder.query({
      query: ({ page = 1 }) => 
        `/movie/upcoming?page=${page}&api_key=${TMDB_API_KEY}`,
      transformResponse: (response: any) => response.results || [],
      providesTags: ['Upcoming'],
    }),
    
    getAiringTodayTV: builder.query({
      query: ({ page = 1 }) => 
        `/tv/airing_today?page=${page}&api_key=${TMDB_API_KEY}`,
      transformResponse: (response: any) => response.results || [],
      providesTags: ['NowPlaying'],
    }),
    
    getOnTheAirTV: builder.query({
      query: ({ page = 1 }) => 
        `/tv/on_the_air?page=${page}&api_key=${TMDB_API_KEY}`,
      transformResponse: (response: any) => response.results || [],
      providesTags: ['NowPlaying'],
    }),
    
    // ============================================
    // CONSUMET API ENDPOINTS (Streaming)
    // ============================================
    
    searchMovies: builder.query({
      query: ({ query, page = 1 }) => 
        `/movies/${query}?page=${page}`,
      transformResponse: (response: any) => response.results || [],
      providesTags: ['SearchResults'],
    }),
    
    getStreamLinks: builder.query({
      query: ({ type, id, season, episode }) => {
        let url = `/media/${type}/${id}`;
        if (season && episode) {
          url += `?season=${season}&episode=${episode}`;
        }
        return url;
      },
      transformResponse: (response: any) => response.sources || [],
      providesTags: ['StreamLinks'],
    }),
    
    getSubtitles: builder.query({
      query: ({ id, season, episode }) => {
        let url = `/subtitles/${id}`;
        if (season && episode) {
          url += `?season=${season}&episode=${episode}`;
        }
        return url;
      },
      transformResponse: (response: any) => response.subtitles || [],
      providesTags: ['Subtitles'],
    }),
  }),
});

// ============================================
// EXPORTS
// ============================================

// TMDB Content Exports
export const {
  useGetTrendingQuery,
  useGetPopularMoviesQuery,
  useGetPopularTVShowsQuery,
  useGetTopRatedMoviesQuery,
  useGetTopRatedTVShowsQuery,
  useGetUpcomingMoviesQuery,
  useGetAiringTodayTVQuery,
  useGetOnTheAirTVQuery,
} = contentApi;

// Consumet API Exports
export const {
  useSearchMoviesQuery,
  useGetStreamLinksQuery,
  useGetSubtitlesQuery,
} = contentApi;

export default contentApi;