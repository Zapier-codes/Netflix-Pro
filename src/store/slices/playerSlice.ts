// src/store/slices/playerSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface PlayerState {
  currentItem: {
    id: string;
    title: string;
    mediaType: 'movie' | 'tv';
    tmdbId: string;
    season?: number;
    episode?: number;
    streamUrl: string;
    subtitles?: string[];
  } | null;
  isPlaying: boolean;
  isBuffering: boolean;
  isPaused: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  quality: string;
  subtitlesEnabled: boolean;
  subtitleLanguage: string;
  pictureInPicture: boolean;
  fullscreen: boolean;
}

const initialState: PlayerState = {
  currentItem: null,
  isPlaying: false,
  isBuffering: false,
  isPaused: false,
  currentTime: 0,
  duration: 0,
  volume: 1,
  quality: 'auto',
  subtitlesEnabled: false,
  subtitleLanguage: 'en',
  pictureInPicture: false,
  fullscreen: false,
};

export const playerSlice = createSlice({
  name: 'player',
  initialState,
  reducers: {
    setCurrentItem: (state, action: PayloadAction<PlayerState['currentItem']>) => {
      state.currentItem = action.payload;
    },
    setIsPlaying: (state, action: PayloadAction<boolean>) => {
      state.isPlaying = action.payload;
    },
    setIsBuffering: (state, action: PayloadAction<boolean>) => {
      state.isBuffering = action.payload;
    },
    setIsPaused: (state, action: PayloadAction<boolean>) => {
      state.isPaused = action.payload;
    },
    setCurrentTime: (state, action: PayloadAction<number>) => {
      state.currentTime = action.payload;
    },
    setDuration: (state, action: PayloadAction<number>) => {
      state.duration = action.payload;
    },
    setVolume: (state, action: PayloadAction<number>) => {
      state.volume = action.payload;
    },
    setQuality: (state, action: PayloadAction<string>) => {
      state.quality = action.payload;
    },
    setSubtitlesEnabled: (state, action: PayloadAction<boolean>) => {
      state.subtitlesEnabled = action.payload;
    },
    setSubtitleLanguage: (state, action: PayloadAction<string>) => {
      state.subtitleLanguage = action.payload;
    },
    setPictureInPicture: (state, action: PayloadAction<boolean>) => {
      state.pictureInPicture = action.payload;
    },
    setFullscreen: (state, action: PayloadAction<boolean>) => {
      state.fullscreen = action.payload;
    },
    resetPlayer: (state) => {
      Object.assign(state, initialState);
    },
  },
});

export const {
  setCurrentItem,
  setIsPlaying,
  setIsBuffering,
  setIsPaused,
  setCurrentTime,
  setDuration,
  setVolume,
  setQuality,
  setSubtitlesEnabled,
  setSubtitleLanguage,
  setPictureInPicture,
  setFullscreen,
  resetPlayer,
} = playerSlice.actions;

export default playerSlice.reducer;
