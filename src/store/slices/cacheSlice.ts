// src/store/slices/cacheSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface CacheState {
  lastRefresh: number;
  homeData: {
    trending: any[];
    popular: any[];
    topRated: any[];
    upcoming: any[];
  };
  movieDetails: Record<number, any>;
  tvDetails: Record<number, any>;
  searchCache: Record<string, any[]>;
  streamCache: Record<string, any[]>;
  subtitleCache: Record<string, any[]>;
}

const initialState: CacheState = {
  lastRefresh: 0,
  homeData: {
    trending: [],
    popular: [],
    topRated: [],
    upcoming: [],
  },
  movieDetails: {},
  tvDetails: {},
  searchCache: {},
  streamCache: {},
  subtitleCache: {},
};

export const cacheSlice = createSlice({
  name: 'cache',
  initialState,
  reducers: {
    updateLastRefresh: (state) => {
      state.lastRefresh = Date.now();
    },
    cacheHomeData: (state, action: PayloadAction<Partial<CacheState['homeData']>>) => {
      Object.assign(state.homeData, action.payload);
    },
    cacheMovieDetails: (state, action: PayloadAction<{ id: number; data: any }>) => {
      state.movieDetails[action.payload.id] = action.payload.data;
    },
    cacheTVDetails: (state, action: PayloadAction<{ id: number; data: any }>) => {
      state.tvDetails[action.payload.id] = action.payload.data;
    },
    cacheSearch: (state, action: PayloadAction<{ query: string; results: any[] }>) => {
      state.searchCache[action.payload.query] = action.payload.results;
    },
    cacheStream: (state, action: PayloadAction<{ key: string; data: any[] }>) => {
      state.streamCache[action.payload.key] = action.payload.data;
    },
    cacheSubtitles: (state, action: PayloadAction<{ key: string; data: any[] }>) => {
      state.subtitleCache[action.payload.key] = action.payload.data;
    },
    clearCache: (state) => {
      Object.assign(state, initialState);
    },
  },
});

export const {
  updateLastRefresh,
  cacheHomeData,
  cacheMovieDetails,
  cacheTVDetails,
  cacheSearch,
  cacheStream,
  cacheSubtitles,
  clearCache,
} = cacheSlice.actions;

export default cacheSlice.reducer;
