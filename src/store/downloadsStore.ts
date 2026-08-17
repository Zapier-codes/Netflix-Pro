// src/store/downloadsStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface DownloadItem {
  id: string;
  title: string;
  mediaType: 'movie' | 'tv';
  tmdbId: string;
  posterPath: string;
  quality: string;
  size: string;
  sizeBytes: number;
  provider: string;
  season?: number;
  episode?: number;
  episodeTitle?: string;
  downloadedAt: string;
  filePath: string;
  progress?: number;
  status?: 'pending' | 'downloading' | 'completed' | 'failed';
  error?: string;
}

interface DownloadsState {
  items: DownloadItem[];
  addDownload: (item: Omit<DownloadItem, 'downloadedAt' | 'progress' | 'status'>) => void;
  updateProgress: (id: string, progress: number) => void;
  setComplete: (id: string) => void;
  setFailed: (id: string, error: string) => void;
  removeDownload: (id: string) => void;
  clearAll: () => void;
  getDownloadById: (id: string) => DownloadItem | undefined;
  getDownloadsByMediaId: (tmdbId: string) => DownloadItem[];
  getDownloadsByStatus: (status: DownloadItem['status']) => DownloadItem[];
  getTotalSize: () => number;
  getDownloadCount: () => number;
}

export const useDownloads = create<DownloadsState>()(
  persist(
    (set, get) => ({
      items: [],

      addDownload: (item) => {
        const newItem: DownloadItem = {
          ...item,
          downloadedAt: new Date().toISOString(),
          progress: 0,
          status: 'pending',
        };
        set((state) => ({
          items: [...state.items, newItem]
        }));
      },

      updateProgress: (id, progress) => {
        set((state) => ({
          items: state.items.map(item =>
            item.id === id
              ? { ...item, progress, status: 'downloading' as const }
              : item
          )
        }));
      },

      setComplete: (id) => {
        set((state) => ({
          items: state.items.map(item =>
            item.id === id
              ? { ...item, progress: 100, status: 'completed' as const }
              : item
          )
        }));
      },

      setFailed: (id, error) => {
        set((state) => ({
          items: state.items.map(item =>
            item.id === id
              ? { ...item, status: 'failed' as const, error }
              : item
          )
        }));
      },

      removeDownload: (id) => {
        set((state) => ({
          items: state.items.filter(item => item.id !== id)
        }));
      },

      clearAll: () => {
        set({ items: [] });
      },

      getDownloadById: (id) => {
        return get().items.find(item => item.id === id);
      },

      getDownloadsByMediaId: (tmdbId) => {
        return get().items.filter(item => item.tmdbId === tmdbId);
      },

      getDownloadsByStatus: (status) => {
        return get().items.filter(item => item.status === status);
      },

      getTotalSize: () => {
        return get().items.reduce((total, item) => total + (item.sizeBytes || 0), 0);
      },

      getDownloadCount: () => {
        return get().items.length;
      },
    }),
    {
      name: 'downloads-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export const useDownloadProgress = (id: string) => {
  const item = useDownloads((state) => state.items.find(i => i.id === id));
  return item?.progress || 0;
};

export const useIsDownloading = (id: string) => {
  const item = useDownloads((state) => state.items.find(i => i.id === id));
  return item?.status === 'downloading' || item?.status === 'pending';
};

export const useDownloadedItems = () => {
  const items = useDownloads((state) => state.items);
  return items.filter(item => item.status === 'completed');
};

export default useDownloads;