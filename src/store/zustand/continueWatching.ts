// src/store/zustand/continueWatching.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ContinueWatchingItem {
  id: string;
  title: string;
  mediaType: 'movie' | 'tv';
  tmdbId: string;
  season?: number;
  episode?: number;
  episodeTitle?: string;
  posterPath: string;
  progress: number;
  currentTime: number;
  duration: number;
  lastWatchedAt: string;
  watchedAt: string;
}

interface ContinueWatchingState {
  items: ContinueWatchingItem[];
  addItem: (item: Omit<ContinueWatchingItem, 'lastWatchedAt' | 'watchedAt'>) => void;
  updateProgress: (id: string, progress: number, currentTime: number, duration: number) => void;
  removeItem: (id: string) => void;
  clearAll: () => void;
  getNextEpisode: (tmdbId: string, season: number, episode: number) => ContinueWatchingItem | null;
}

export const useContinueWatching = create<ContinueWatchingState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) => {
        const newItem: ContinueWatchingItem = {
          ...item,
          lastWatchedAt: new Date().toISOString(),
          watchedAt: new Date().toISOString(),
        };
        set((state) => {
          const existingIndex = state.items.findIndex(i => i.id === item.id);
          if (existingIndex >= 0) {
            const updatedItems = [...state.items];
            updatedItems[existingIndex] = {
              ...updatedItems[existingIndex],
              ...newItem,
              lastWatchedAt: new Date().toISOString(),
            };
            return { items: updatedItems };
          }
          const sortedItems = [newItem, ...state.items].slice(0, 50);
          return { items: sortedItems };
        });
      },

      updateProgress: (id, progress, currentTime, duration) => {
        set((state) => {
          const items = state.items.map(item => {
            if (item.id === id) {
              return {
                ...item,
                progress,
                currentTime,
                duration,
                lastWatchedAt: new Date().toISOString(),
              };
            }
            return item;
          });
          items.sort((a, b) => 
            new Date(b.lastWatchedAt).getTime() - new Date(a.lastWatchedAt).getTime()
          );
          return { items };
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

      getNextEpisode: (tmdbId, season, episode) => {
        const { items } = get();
        return items.find(
          item => item.tmdbId === tmdbId && 
          item.season === season && 
          item.episode === episode + 1
        ) || null;
      },
    }),
    {
      name: 'continue-watching-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export const useContinueWatchingList = () => {
  const items = useContinueWatching((state) => state.items);
  return items;
};

export const useContinueWatchingCount = () => {
  const count = useContinueWatching((state) => state.items.length);
  return count;
};

export const useIsInContinueWatching = (id: string) => {
  const exists = useContinueWatching((state) => 
    state.items.some(item => item.id === id)
  );
  return exists;
};
