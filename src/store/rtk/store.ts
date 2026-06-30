// src/store/rtk/store.ts (updated with persist)
import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { contentApi } from './api/contentApi';
import { streamingApi } from './api/streamingApi';

const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  whitelist: ['settings', 'downloads'],
  blacklist: ['cache'],
};

const rootReducer = combineReducers({
  [contentApi.reducerPath]: contentApi.reducer,
  [streamingApi.reducerPath]: streamingApi.reducer,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    })
      .concat(contentApi.middleware)
      .concat(streamingApi.middleware),
});

export const persistor = persistStore(store);
setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
