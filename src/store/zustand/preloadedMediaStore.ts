// src/store/zustand/preloadedMediaStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { IMetadataResult, ISeason } from '../../services/unified/types/MetadataTypes';
import { NormalizedStream } from '../../services/unified/types/StreamTypes';

export interface PreloadedCategory {
  trending: IMetadataResult[];
  popular: IMetadataResult[];
  topRated: IMetadataResult[];
  anime: IMetadataResult[];
  movies: IMetadataResult[];
  tvShows: IMetadataResult[];
}

export interface PreloadedTVDetails {
  id: string;
  title: string;
  numberOfSeasons: number;
  numberOfEpisodes: number;
  seasons: ISeason[];
  displaySeasons: number[];
  lastAirDate?: string;
  inProduction?: boolean;
  status?: string;
  networks?: any[];
}

export interface PreloadedStreamData {
  id: string;
  type: 'movie' | 'tv';
  season?: number;
  episode?: number;
  streams: NormalizedStream[];
  qualities: string[];
  extractedAt: string;
}

export interface PreloadedSeasonData {
  tvId: string;
  seasonNumber: number;
  episodes: any[];
  episodeCount: number;
  airDate?: string;
  name?: string;
  overview?: string;
}

// Staleness window for preloaded data (ms)
const STALE_AFTER_MS = 1000 * 60 * 30; // 30 minutes
const STREAM_STALE_AFTER_MS = 1000 * 60 * 60 * 2; // 2 hours

export interface PreloadedMediaState {
  // All preloaded items
  allItems: IMetadataResult[];
  categories: PreloadedCategory;

  // NEW: Preloaded TV details with seasons
  preloadedTVDetails: Record<string, PreloadedTVDetails>;
  
  // NEW: Preloaded stream data
  preloadedStreams: Record<string, PreloadedStreamData>;
  
  // NEW: Preloaded season data
  preloadedSeasons: Record<string, PreloadedSeasonData>;

  // Loading state
  isLoading: boolean;
  initialized: boolean;
  error: string | null;
  lastFetchedAt: string | null;
  lastStreamPreloadAt: string | null;

  // Actions
  setAllItems: (items: IMetadataResult[]) => void;
  setCategory: <K extends keyof PreloadedCategory>(
    category: K,
    items: IMetadataResult[]
  ) => void;
  setCategories: (categories: PreloadedCategory) => void;

  getRandomItems: (count: number, category?: keyof PreloadedCategory | 'all') => IMetadataResult[];
  getItemById: (id: string) => IMetadataResult | undefined;
  getItemsByType: (type: 'movie' | 'tv') => IMetadataResult[];
  getItemsByGenre: (genre: string) => IMetadataResult[];
  isStale: () => boolean;

  // ─── NEW: TV Details Actions ───
  setPreloadedTVDetails: (id: string, data: PreloadedTVDetails) => void;
  getPreloadedTVDetails: (id: string) => PreloadedTVDetails | undefined;
  hasPreloadedTVDetails: (id: string) => boolean;
  getAllPreloadedTVDetails: () => Record<string, PreloadedTVDetails>;

  // ─── NEW: Stream Data Actions ───
  setPreloadedStreams: (id: string, data: PreloadedStreamData) => void;
  getPreloadedStreams: (id: string) => PreloadedStreamData | undefined;
  hasPreloadedStreams: (id: string) => boolean;
  isStreamDataStale: (id: string) => boolean;

  // ─── NEW: Season Data Actions ───
  setPreloadedSeason: (tvId: string, seasonNumber: number, data: PreloadedSeasonData) => void;
  getPreloadedSeason: (tvId: string, seasonNumber: number) => PreloadedSeasonData | undefined;
  hasPreloadedSeason: (tvId: string, seasonNumber: number) => boolean;

  // ─── NEW: Batch Preload ───
  batchPreloadTVDetails: (details: PreloadedTVDetails[]) => void;
  batchPreloadStreams: (streams: PreloadedStreamData[]) => void;
  batchPreloadSeasons: (seasons: PreloadedSeasonData[]) => void;

  setLoading: (loading: boolean) => void;
  setInitialized: (initialized: boolean) => void;
  setError: (error: string | null) => void;
  setLastFetchedAt: (timestamp: string) => void;
  setLastStreamPreloadAt: (timestamp: string) => void;

  reset: () => void;
  clearCache: () => void;
  clearStreamCache: () => void;
  clearTVDetailsCache: () => void;
}

const initialState: Omit<PreloadedMediaState,
  'setAllItems' | 'setCategory' | 'setCategories' |
  'getRandomItems' | 'getItemById' | 'getItemsByType' | 'getItemsByGenre' | 'isStale' |
  'setPreloadedTVDetails' | 'getPreloadedTVDetails' | 'hasPreloadedTVDetails' | 'getAllPreloadedTVDetails' |
  'setPreloadedStreams' | 'getPreloadedStreams' | 'hasPreloadedStreams' | 'isStreamDataStale' |
  'setPreloadedSeason' | 'getPreloadedSeason' | 'hasPreloadedSeason' |
  'batchPreloadTVDetails' | 'batchPreloadStreams' | 'batchPreloadSeasons' |
  'setLoading' | 'setInitialized' | 'setError' | 'setLastFetchedAt' | 'setLastStreamPreloadAt' |
  'reset' | 'clearCache' | 'clearStreamCache' | 'clearTVDetailsCache'
> = {
  allItems: [],
  categories: {
    trending: [],
    popular: [],
    topRated: [],
    anime: [],
    movies: [],
    tvShows: [],
  },
  preloadedTVDetails: {},
  preloadedStreams: {},
  preloadedSeasons: {},
  isLoading: false,
  initialized: false,
  error: null,
  lastFetchedAt: null,
  lastStreamPreloadAt: null,
};

// Fisher-Yates shuffle for random selection
const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export const usePreloadedMediaStore = create<PreloadedMediaState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setAllItems: (items) => {
        set({ allItems: items });
      },

      setCategory: (category, items) => {
        set((state) => ({
          categories: {
            ...state.categories,
            [category]: items,
          },
        }));
      },

      setCategories: (categories) => {
        set({ categories });
      },

      getRandomItems: (count: number, category: keyof PreloadedCategory | 'all' = 'all') => {
        const state = get();
        let items: IMetadataResult[] = [];

        if (category === 'all') {
          items = state.allItems;
        } else {
          items = state.categories[category] || [];
        }

        if (items.length === 0) return [];

        if (items.length <= count) {
          return shuffleArray(items);
        }

        const shuffled = shuffleArray(items);
        return shuffled.slice(0, count);
      },

      getItemById: (id: string) => {
        const state = get();
        return state.allItems.find(item => item.id === id);
      },

      getItemsByType: (type: 'movie' | 'tv') => {
        const state = get();
        return state.allItems.filter(item => item.type === type);
      },

      getItemsByGenre: (genre: string) => {
        const state = get();
        return state.allItems.filter(item =>
          Array.isArray((item as any).genres) &&
          (item as any).genres.some(
            (g: any) => (typeof g === 'string' ? g : g?.name)?.toLowerCase() === genre.toLowerCase()
          )
        );
      },

      isStale: () => {
        const { lastFetchedAt } = get();
        if (!lastFetchedAt) return true;
        return Date.now() - new Date(lastFetchedAt).getTime() > STALE_AFTER_MS;
      },

      // ─── NEW: TV Details Actions ───
      setPreloadedTVDetails: (id, data) => {
        set((state) => ({
          preloadedTVDetails: {
            ...state.preloadedTVDetails,
            [id]: data,
          },
        }));
      },

      getPreloadedTVDetails: (id) => {
        const state = get();
        return state.preloadedTVDetails[id];
      },

      hasPreloadedTVDetails: (id) => {
        const state = get();
        return !!state.preloadedTVDetails[id];
      },

      getAllPreloadedTVDetails: () => {
        const state = get();
        return state.preloadedTVDetails;
      },

      // ─── NEW: Stream Data Actions ───
      setPreloadedStreams: (id, data) => {
        set((state) => ({
          preloadedStreams: {
            ...state.preloadedStreams,
            [id]: data,
          },
        }));
      },

      getPreloadedStreams: (id) => {
        const state = get();
        return state.preloadedStreams[id];
      },

      hasPreloadedStreams: (id) => {
        const state = get();
        return !!state.preloadedStreams[id];
      },

      isStreamDataStale: (id) => {
        const state = get();
        const data = state.preloadedStreams[id];
        if (!data) return true;
        if (!data.extractedAt) return true;
        return Date.now() - new Date(data.extractedAt).getTime() > STREAM_STALE_AFTER_MS;
      },

      // ─── NEW: Season Data Actions ───
      setPreloadedSeason: (tvId, seasonNumber, data) => {
        const key = `${tvId}_s${seasonNumber}`;
        set((state) => ({
          preloadedSeasons: {
            ...state.preloadedSeasons,
            [key]: data,
          },
        }));
      },

      getPreloadedSeason: (tvId, seasonNumber) => {
        const state = get();
        const key = `${tvId}_s${seasonNumber}`;
        return state.preloadedSeasons[key];
      },

      hasPreloadedSeason: (tvId, seasonNumber) => {
        const state = get();
        const key = `${tvId}_s${seasonNumber}`;
        return !!state.preloadedSeasons[key];
      },

      // ─── NEW: Batch Preload Actions ───
      batchPreloadTVDetails: (details) => {
        set((state) => {
          const newDetails = { ...state.preloadedTVDetails };
          details.forEach((detail) => {
            newDetails[detail.id] = detail;
          });
          return { preloadedTVDetails: newDetails };
        });
      },

      batchPreloadStreams: (streams) => {
        set((state) => {
          const newStreams = { ...state.preloadedStreams };
          streams.forEach((stream) => {
            newStreams[stream.id] = stream;
          });
          return { preloadedStreams: newStreams };
        });
      },

      batchPreloadSeasons: (seasons) => {
        set((state) => {
          const newSeasons = { ...state.preloadedSeasons };
          seasons.forEach((season) => {
            const key = `${season.tvId}_s${season.seasonNumber}`;
            newSeasons[key] = season;
          });
          return { preloadedSeasons: newSeasons };
        });
      },

      setLoading: (isLoading) => set({ isLoading }),

      setInitialized: (initialized) => set({ initialized }),

      setError: (error) => set({ error }),

      setLastFetchedAt: (lastFetchedAt) => set({ lastFetchedAt }),

      setLastStreamPreloadAt: (lastStreamPreloadAt) => set({ lastStreamPreloadAt }),

      reset: () => set(initialState),

      clearCache: () => {
        set({
          allItems: [],
          categories: {
            trending: [],
            popular: [],
            topRated: [],
            anime: [],
            movies: [],
            tvShows: [],
          },
          preloadedTVDetails: {},
          preloadedStreams: {},
          preloadedSeasons: {},
          initialized: false,
          lastFetchedAt: null,
          lastStreamPreloadAt: null,
        });
      },

      clearStreamCache: () => {
        set({
          preloadedStreams: {},
          lastStreamPreloadAt: null,
        });
      },

      clearTVDetailsCache: () => {
        set({
          preloadedTVDetails: {},
          preloadedSeasons: {},
        });
      },
    }),
    {
      name: 'preloaded-media-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        allItems: state.allItems,
        categories: state.categories,
        preloadedTVDetails: state.preloadedTVDetails,
        preloadedStreams: state.preloadedStreams,
        preloadedSeasons: state.preloadedSeasons,
        initialized: state.initialized,
        lastFetchedAt: state.lastFetchedAt,
        lastStreamPreloadAt: state.lastStreamPreloadAt,
      }),
    }
  )
);

// ─── Selector Hooks ───

export const usePreloadedAllItems = () => {
  return usePreloadedMediaStore((state) => state.allItems);
};

export const usePreloadedCategory = (category: keyof PreloadedCategory) => {
  return usePreloadedMediaStore((state) => state.categories[category]);
};

export const usePreloadedRandomItems = (count: number, category?: keyof PreloadedCategory | 'all') => {
  return usePreloadedMediaStore((state) => state.getRandomItems(count, category));
};

export const usePreloadedItem = (id: string) => {
  return usePreloadedMediaStore((state) => state.getItemById(id));
};

export const usePreloadedItemsByType = (type: 'movie' | 'tv') => {
  return usePreloadedMediaStore((state) => state.getItemsByType(type));
};

export const usePreloadedItemsByGenre = (genre: string) => {
  return usePreloadedMediaStore((state) => state.getItemsByGenre(genre));
};

export const usePreloadedLoading = () => {
  return usePreloadedMediaStore((state) => state.isLoading);
};

export const usePreloadedInitialized = () => {
  return usePreloadedMediaStore((state) => state.initialized);
};

export const usePreloadedError = () => {
  return usePreloadedMediaStore((state) => state.error);
};

export const usePreloadedLastFetched = () => {
  return usePreloadedMediaStore((state) => state.lastFetchedAt);
};

export const usePreloadedIsStale = () => {
  return usePreloadedMediaStore((state) => state.isStale());
};

// ─── NEW: TV Details Selectors ───
export const usePreloadedTVDetails = (id: string) => {
  return usePreloadedMediaStore((state) => state.getPreloadedTVDetails(id));
};

export const useHasPreloadedTVDetails = (id: string) => {
  return usePreloadedMediaStore((state) => state.hasPreloadedTVDetails(id));
};

export const useAllPreloadedTVDetails = () => {
  return usePreloadedMediaStore((state) => state.getAllPreloadedTVDetails());
};

// ─── NEW: Stream Selectors ───
export const usePreloadedStreams = (id: string) => {
  return usePreloadedMediaStore((state) => state.getPreloadedStreams(id));
};

export const useHasPreloadedStreams = (id: string) => {
  return usePreloadedMediaStore((state) => state.hasPreloadedStreams(id));
};

export const useIsStreamDataStale = (id: string) => {
  return usePreloadedMediaStore((state) => state.isStreamDataStale(id));
};

// ─── NEW: Season Selectors ───
export const usePreloadedSeason = (tvId: string, seasonNumber: number) => {
  return usePreloadedMediaStore((state) => state.getPreloadedSeason(tvId, seasonNumber));
};

export const useHasPreloadedSeason = (tvId: string, seasonNumber: number) => {
  return usePreloadedMediaStore((state) => state.hasPreloadedSeason(tvId, seasonNumber));
};

export default usePreloadedMediaStore;