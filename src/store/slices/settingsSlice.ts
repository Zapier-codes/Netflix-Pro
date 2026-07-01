// src/store/slices/settingsSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SettingsState {
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
}

const defaultSettings: SettingsState = {
  theme: 'dark',
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

export const settingsSlice = createSlice({
  name: 'settings',
  initialState: defaultSettings,
  reducers: {
    setTheme: (state, action: PayloadAction<SettingsState['theme']>) => {
      state.theme = action.payload;
    },
    setWifiOnlyDownload: (state, action: PayloadAction<boolean>) => {
      state.wifiOnlyDownload = action.payload;
    },
    setMaxConcurrentDownloads: (state, action: PayloadAction<number>) => {
      state.maxConcurrentDownloads = action.payload;
    },
    setAutoDeleteWatchedDays: (state, action: PayloadAction<number>) => {
      state.autoDeleteWatchedDays = action.payload;
    },
    setAutoDeleteUnwatchedDays: (state, action: PayloadAction<number>) => {
      state.autoDeleteUnwatchedDays = action.payload;
    },
    setCheckForUpdates: (state, action: PayloadAction<boolean>) => {
      state.checkForUpdates = action.payload;
    },
    setDefaultPlayerQuality: (state, action: PayloadAction<string>) => {
      state.defaultPlayerQuality = action.payload;
    },
    setSubtitleLanguage: (state, action: PayloadAction<string>) => {
      state.subtitleLanguage = action.payload;
    },
    setSubtitleSize: (state, action: PayloadAction<number>) => {
      state.subtitleSize = action.payload;
    },
    setSkipIntro: (state, action: PayloadAction<boolean>) => {
      state.skipIntro = action.payload;
    },
    setSkipCredits: (state, action: PayloadAction<boolean>) => {
      state.skipCredits = action.payload;
    },
    setDataSaver: (state, action: PayloadAction<boolean>) => {
      state.dataSaver = action.payload;
    },
    setAutoPlayNext: (state, action: PayloadAction<boolean>) => {
      state.autoPlayNext = action.payload;
    },
    resetSettings: (state) => {
      Object.assign(state, defaultSettings);
    },
  },
});

export const {
  setTheme,
  setWifiOnlyDownload,
  setMaxConcurrentDownloads,
  setAutoDeleteWatchedDays,
  setAutoDeleteUnwatchedDays,
  setCheckForUpdates,
  setDefaultPlayerQuality,
  setSubtitleLanguage,
  setSubtitleSize,
  setSkipIntro,
  setSkipCredits,
  setDataSaver,
  setAutoPlayNext,
  resetSettings,
} = settingsSlice.actions;

export default settingsSlice.reducer;
