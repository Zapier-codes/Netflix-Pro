// src/store/zustand/store.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AppState {
  // Settings
  theme: 'light' | 'dark' | 'system';
  wifiOnlyDownload: boolean;
  maxConcurrentDownloads: number;
  autoDeleteWatchedDays: number;
  autoDeleteUnwatchedDays: number;
  checkForUpdates: boolean;
  defaultPlayerQuality: string;
  subtitleLanguage: string;
  subtitleSize: number;
  skipIntro: boolean;
  skipCredits: boolean;
  dataSaver: boolean;
  autoPlayNext: boolean;
  
  // Player state
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isBuffering: boolean;
  volume: number;
  quality: string;
  subtitlesEnabled: boolean;
  pictureInPicture: boolean;
  fullscreen: boolean;
  
  // UI state
  isLoading: boolean;
  isInitialized: boolean;
  hasCachedData: boolean;
  networkStatus: 'online' | 'offline' | 'connecting';
  
  // Actions
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  toggleTheme: () => void;
  setWifiOnlyDownload: (enabled: boolean) => void;
  setMaxConcurrentDownloads: (count: number) => void;
  setAutoDeleteWatchedDays: (days: number) => void;
  setAutoDeleteUnwatchedDays: (days: number) => void;
  setCheckForUpdates: (enabled: boolean) => void;
  setDefaultPlayerQuality: (quality: string) => void;
  setSubtitleLanguage: (lang: string) => void;
  setSubtitleSize: (size: number) => void;
  setSkipIntro: (enabled: boolean) => void;
  setSkipCredits: (enabled: boolean) => void;
  setDataSaver: (enabled: boolean) => void;
  setAutoPlayNext: (enabled: boolean) => void;
  resetSettings: () => void;
  
  // Player actions
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setIsBuffering: (buffering: boolean) => void;
  setVolume: (volume: number) => void;
  setQuality: (quality: string) => void;
  setSubtitlesEnabled: (enabled: boolean) => void;
  setPictureInPicture: (enabled: boolean) => void;
  setFullscreen: (enabled: boolean) => void;
  resetPlayer: () => void;
  
  // UI actions
  setLoading: (loading: boolean) => void;
  setInitialized: (initialized: boolean) => void;
  setHasCachedData: (hasCache: boolean) => void;
  setNetworkStatus: (status: 'online' | 'offline' | 'connecting') => void;
}

const defaultSettings = {
  theme: 'dark' as const,
  wifiOnlyDownload: true,
  maxConcurrentDownloads: 3,
  autoDeleteWatchedDays: 7,
  autoDeleteUnwatchedDays: 30,
  checkForUpdates: true,
  defaultPlayerQuality: 'auto',
  subtitleLanguage: 'en',
  subtitleSize: 100,
  skipIntro: true,
  skipCredits: false,
  dataSaver: false,
  autoPlayNext: true,
};

const defaultPlayerState = {
  currentTime: 0,
  duration: 0,
  isPlaying: false,
  isBuffering: false,
  volume: 1,
  quality: 'auto',
  subtitlesEnabled: false,
  pictureInPicture: false,
  fullscreen: false,
};

const defaultUIState = {
  isLoading: true,
  isInitialized: false,
  hasCachedData: false,
  networkStatus: 'connecting' as const,
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...defaultSettings,
      ...defaultPlayerState,
      ...defaultUIState,

      // Settings actions
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => {
        const { theme } = get();
        if (theme === 'dark') set({ theme: 'light' });
        else if (theme === 'light') set({ theme: 'system' });
        else set({ theme: 'dark' });
      },
      setWifiOnlyDownload: (enabled) => set({ wifiOnlyDownload: enabled }),
      setMaxConcurrentDownloads: (count) => set({ maxConcurrentDownloads: count }),
      setAutoDeleteWatchedDays: (days) => set({ autoDeleteWatchedDays: days }),
      setAutoDeleteUnwatchedDays: (days) => set({ autoDeleteUnwatchedDays: days }),
      setCheckForUpdates: (enabled) => set({ checkForUpdates: enabled }),
      setDefaultPlayerQuality: (quality) => set({ defaultPlayerQuality: quality }),
      setSubtitleLanguage: (lang) => set({ subtitleLanguage: lang }),
      setSubtitleSize: (size) => set({ subtitleSize: size }),
      setSkipIntro: (enabled) => set({ skipIntro: enabled }),
      setSkipCredits: (enabled) => set({ skipCredits: enabled }),
      setDataSaver: (enabled) => set({ dataSaver: enabled }),
      setAutoPlayNext: (enabled) => set({ autoPlayNext: enabled }),
      resetSettings: () => set({ ...defaultSettings }),

      // Player actions
      setCurrentTime: (time) => set({ currentTime: time }),
      setDuration: (duration) => set({ duration }),
      setIsPlaying: (playing) => set({ isPlaying: playing }),
      setIsBuffering: (buffering) => set({ isBuffering: buffering }),
      setVolume: (volume) => set({ volume }),
      setQuality: (quality) => set({ quality }),
      setSubtitlesEnabled: (enabled) => set({ subtitlesEnabled: enabled }),
      setPictureInPicture: (enabled) => set({ pictureInPicture: enabled }),
      setFullscreen: (enabled) => set({ fullscreen: enabled }),
      resetPlayer: () => set({ ...defaultPlayerState }),

      // UI actions
      setLoading: (loading) => set({ isLoading: loading }),
      setInitialized: (initialized) => set({ isInitialized: initialized }),
      setHasCachedData: (hasCache) => set({ hasCachedData: hasCache }),
      setNetworkStatus: (status) => set({ networkStatus: status }),
    }),
    {
      name: 'app-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        theme: state.theme,
        wifiOnlyDownload: state.wifiOnlyDownload,
        maxConcurrentDownloads: state.maxConcurrentDownloads,
        autoDeleteWatchedDays: state.autoDeleteWatchedDays,
        autoDeleteUnwatchedDays: state.autoDeleteUnwatchedDays,
        checkForUpdates: state.checkForUpdates,
        defaultPlayerQuality: state.defaultPlayerQuality,
        subtitleLanguage: state.subtitleLanguage,
        subtitleSize: state.subtitleSize,
        skipIntro: state.skipIntro,
        skipCredits: state.skipCredits,
        dataSaver: state.dataSaver,
        autoPlayNext: state.autoPlayNext,
        volume: state.volume,
        quality: state.quality,
        subtitlesEnabled: state.subtitlesEnabled,
      }),
    }
  )
);

export const useSettings = () => {
  const state = useAppStore();
  return {
    theme: state.theme,
    wifiOnlyDownload: state.wifiOnlyDownload,
    maxConcurrentDownloads: state.maxConcurrentDownloads,
    autoDeleteWatchedDays: state.autoDeleteWatchedDays,
    autoDeleteUnwatchedDays: state.autoDeleteUnwatchedDays,
    checkForUpdates: state.checkForUpdates,
    defaultPlayerQuality: state.defaultPlayerQuality,
    subtitleLanguage: state.subtitleLanguage,
    subtitleSize: state.subtitleSize,
    skipIntro: state.skipIntro,
    skipCredits: state.skipCredits,
    dataSaver: state.dataSaver,
    autoPlayNext: state.autoPlayNext,
  };
};

export const usePlayer = () => {
  const state = useAppStore();
  return {
    currentTime: state.currentTime,
    duration: state.duration,
    isPlaying: state.isPlaying,
    isBuffering: state.isBuffering,
    volume: state.volume,
    quality: state.quality,
    subtitlesEnabled: state.subtitlesEnabled,
    pictureInPicture: state.pictureInPicture,
    fullscreen: state.fullscreen,
  };
};

export default useAppStore;
