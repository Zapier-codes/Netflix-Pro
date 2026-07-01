// src/store/api/downloadsApi.ts
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const downloadsApi = createApi({
  reducerPath: 'downloadsApi',
  baseQuery: fetchBaseQuery({ 
    baseUrl: 'file://',
  }),
  tagTypes: ['Downloads', 'DownloadProgress'],
  keepUnusedDataFor: 300,
  endpoints: (builder) => ({
    getDownloads: builder.query({
      query: () => '/downloads',
      providesTags: ['Downloads'],
    }),
    getDownloadProgress: builder.query({
      query: ({ id }) => /downloads//progress,
      providesTags: (result, error, { id }) => [{ type: 'DownloadProgress', id }],
    }),
  }),
});

export const {
  useGetDownloadsQuery,
  useGetDownloadProgressQuery,
} = downloadsApi;
