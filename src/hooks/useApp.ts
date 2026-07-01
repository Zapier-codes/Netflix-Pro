// src/hooks/useApp.ts
import { useAppStore } from '../store/zustand/store';

export const useApp = () => {
  const state = useAppStore();
  return state;
};

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
    setCurrentTime: state.setCurrentTime,
    setDuration: state.setDuration,
    setIsPlaying: state.setIsPlaying,
    setIsBuffering: state.setIsBuffering,
    setVolume: state.setVolume,
    setQuality: state.setQuality,
    setSubtitlesEnabled: state.setSubtitlesEnabled,
    setPictureInPicture: state.setPictureInPicture,
    setFullscreen: state.setFullscreen,
    resetPlayer: state.resetPlayer,
  };
};

export const useUI = () => {
  const state = useAppStore();
  return {
    isLoading: state.isLoading,
    isInitialized: state.isInitialized,
    hasCachedData: state.hasCachedData,
    networkStatus: state.networkStatus,
    setLoading: state.setLoading,
    setInitialized: state.setInitialized,
    setHasCachedData: state.setHasCachedData,
    setNetworkStatus: state.setNetworkStatus,
  };
};

export default useApp;
