// src/store/store.ts
import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { homeApi } from './api/homeApi';
import { contentApi } from './api/contentApi';
import { downloadsApi } from './api/downloadsApi';
import settingsReducer from './slices/settingsSlice';
import downloadsReducer from './slices/downloadsSlice';
import playerReducer from './slices/playerSlice';
import cacheReducer from './slices/cacheSlice';

export const store = configureStore({
  reducer: {
    [homeApi.reducerPath]: homeApi.reducer,
    [contentApi.reducerPath]: contentApi.reducer,
    [downloadsApi.reducerPath]: downloadsApi.reducer,
    settings: settingsReducer,
    downloads: downloadsReducer,
    player: playerReducer,
    cache: cacheReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware()
      .concat(homeApi.middleware)
      .concat(contentApi.middleware)
      .concat(downloadsApi.middleware),
});

setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
