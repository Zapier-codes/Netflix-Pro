// src/store/api/contentApi.ts
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const contentApi = createApi({
  reducerPath: 'contentApi',
  baseQuery: fetchBaseQuery({ 
    baseUrl: 'https://consumet-api.com',
  }),
  tagTypes: ['StreamLinks', 'Subtitles', 'SearchResults'],
  keepUnusedDataFor: 600,
  endpoints: (builder) => ({
    searchMovies: builder.query({
      query: ({ query, page = 1 }) => /movies/?page=,
      transformResponse: (response: any) => response.results || [],
      providesTags: ['SearchResults'],
    }),
    getStreamLinks: builder.query({
      query: ({ type, id, season, episode }) => {
        let url = //;
        if (season && episode) {
          url += ?season=&episode=;
        }
        return url;
      },
      transformResponse: (response: any) => response.sources || [],
      providesTags: ['StreamLinks'],
    }),
    getSubtitles: builder.query({
      query: ({ id, season, episode }) => {
        let url = /subtitles/;
        if (season && episode) {
          url += ?season=&episode=;
        }
        return url;
      },
      transformResponse: (response: any) => response.subtitles || [],
      providesTags: ['Subtitles'],
    }),
  }),
});

export const {
  useSearchMoviesQuery,
  useGetStreamLinksQuery,
  useGetSubtitlesQuery,
} = contentApi;
