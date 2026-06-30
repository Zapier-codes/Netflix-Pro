// src/store/zustand/watchHistory.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface WatchHistoryItem {
  id: string;
  title: string;
  mediaType: 'movie' | 'tv';
  tmdbId: string;
  season?: number;
  episode?: number;
  episodeTitle?: string;
  posterPath: string;
  watchedAt: string;
  progress: number;
  duration: number;
  isComplete: boolean;
}

interface WatchHistoryState {
  items: WatchHistoryItem[];
  addItem: (item: Omit<WatchHistoryItem, 'watchedAt'>) => void;
  removeItem: (id: string) => void;
  clearAll: () => void;
  getRecentlyWatched: (limit?: number) => WatchHistoryItem[];
  getWatchCount: (tmdbId: string) => number;
}

export const useWatchHistory = create<WatchHistoryState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) => {
        const newItem: WatchHistoryItem = {
          ...item,
          watchedAt: new Date().toISOString(),
        };
        set((state) => {
          const existingIndex = state.items.findIndex(i => i.id === item.id);
          if (existingIndex >= 0) {
            const updatedItems = [...state.items];
            updatedItems[existingIndex] = {
              ...updatedItems[existingIndex],
              ...newItem,
              watchedAt: new Date().toISOString(),
            };
            return { items: updatedItems };
          }
          const sortedItems = [newItem, ...state.items].slice(0, 200);
          return { items: sortedItems };
        });
      },

      removeItem: (id) => {
        set((state) => ({
          items: state.items.filter(item => item.id !== id)
        }));
      },

      clearAll: () => {
        set({ items: [] });
      },

      getRecentlyWatched: (limit = 20) => {
        const { items } = get();
        return items
          .sort((a, b) => new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime())
          .slice(0, limit);
      },

      getWatchCount: (tmdbId) => {
        const { items } = get();
        return items.filter(item => item.tmdbId === tmdbId).length;
      },
    }),
    {
      name: 'watch-history-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export const useWatchHistoryList = () => {
  const items = useWatchHistory((state) => state.items);
  return items;
};

export const useRecentlyWatched = (limit?: number) => {
  const items = useWatchHistory((state) => state.getRecentlyWatched(limit));
  return items;
};

export const useWatchHistoryCount = () => {
  const count = useWatchHistory((state) => state.items.length);
  return count;
};
