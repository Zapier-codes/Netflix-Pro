// src/store/store.ts
import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { useDispatch, useSelector, TypedUseSelectorHook } from 'react-redux';
import { contentApi } from './api/contentApi';
import { downloadsApi } from './api/downloadsApi';
import settingsReducer from './slices/settingsSlice';
import downloadsReducer from './slices/downloadsSlice';
import playerReducer from './slices/playerSlice';
import cacheReducer from './slices/cacheSlice';

export const store = configureStore({
  reducer: {
    // RTK Query APIs
    [contentApi.reducerPath]: contentApi.reducer,
    [downloadsApi.reducerPath]: downloadsApi.reducer,
    // Traditional Redux slices
    settings: settingsReducer,
    downloads: downloadsReducer,
    player: playerReducer,
    cache: cacheReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types
        ignoredActions: [
          'persist/PERSIST',
          'persist/REHYDRATE',
          'contentApi/executeQuery/fulfilled',
          'contentApi/executeQuery/rejected',
          'contentApi/executeMutation/fulfilled',
          'contentApi/executeMutation/rejected',
          'downloadsApi/executeQuery/fulfilled',
          'downloadsApi/executeQuery/rejected',
        ],
        // Ignore these field paths in actions
        ignoredActionPaths: [
          'meta.baseQueryMeta.request',
          'meta.baseQueryMeta.response',
          'payload.timestamp',
          'payload.createdAt',
          'meta.arg.originalArgs',
        ],
        // Ignore these paths in state
        ignoredPaths: [
          'cache.timestamp',
          'cache.data',
          'contentApi.queries',
          'contentApi.mutations',
          'downloadsApi.queries',
        ],
      },
    })
      .concat(contentApi.middleware)
      .concat(downloadsApi.middleware),
  devTools: process.env.NODE_ENV !== 'production',
});

// Setup listeners for refetchOnFocus/refetchOnReconnect
setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;