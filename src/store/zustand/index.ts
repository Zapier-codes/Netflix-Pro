// src/store/zustand/index.ts
export { useAppStore, useSettings, usePlayer, useUI, useNetworkStatus, useAppLoading, useAppInitialized } from './store';
export { 
  useContinueWatching, 
  useContinueWatchingList, 
  useContinueWatchingCount, 
  useIsInContinueWatching 
} from './continueWatching';
export { 
  useWatchHistory, 
  useWatchHistoryList, 
  useRecentlyWatched, 
  useWatchHistoryCount 
} from './watchHistory';
export {
  usePreloadedMediaStore,
  usePreloadedAllItems,
  usePreloadedCategory,
  usePreloadedRandomItems,
  usePreloadedItem,
  usePreloadedItemsByType,
  usePreloadedItemsByGenre,
  usePreloadedLoading,
  usePreloadedInitialized,
  usePreloadedError,
  usePreloadedLastFetched,
  usePreloadedIsStale,
} from './preloadedMediaStore';

// ─── Type exports ───
export type { AppState } from './store';
export type { ContinueWatchingItem } from './continueWatching';
export type { WatchHistoryItem } from './watchHistory';
export type { PreloadedCategory, PreloadedMediaState } from './preloadedMediaStore';