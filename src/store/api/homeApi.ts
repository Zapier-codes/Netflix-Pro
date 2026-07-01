// src/store/api/homeApi.ts
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const homeApi = createApi({
  reducerPath: 'homeApi',
  baseQuery: fetchBaseQuery({ 
    baseUrl: 'https://api.themoviedb.org/3',
  }),
  tagTypes: ['HomeData', 'MovieDetails', 'TVDetails'],
  keepUnusedDataFor: 3600,
  endpoints: (builder) => ({
    getTrending: builder.query({
      query: ({ timeWindow = 'day' }) => /trending/all/,
      transformResponse: (response: any) => response.results,
      providesTags: ['HomeData'],
    }),
    getPopular: builder.query({
      query: ({ page = 1 }) => /movie/popular?page=,
      transformResponse: (response: any) => response.results,
      providesTags: ['HomeData'],
    }),
    getTopRated: builder.query({
      query: ({ page = 1 }) => /movie/top_rated?page=,
      transformResponse: (response: any) => response.results,
      providesTags: ['HomeData'],
    }),
    getUpcoming: builder.query({
      query: ({ page = 1 }) => /movie/upcoming?page=,
      transformResponse: (response: any) => response.results,
      providesTags: ['HomeData'],
    }),
  }),
});

export const {
  useGetTrendingQuery,
  useGetPopularQuery,
  useGetTopRatedQuery,
  useGetUpcomingQuery,
} = homeApi;
