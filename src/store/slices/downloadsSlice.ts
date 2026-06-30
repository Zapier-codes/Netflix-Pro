// src/store/slices/downloadsSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface DownloadItem {
  id: string;
  title: string;
  mediaType: 'movie' | 'tv';
  tmdbId: string;
  season?: number;
  episode?: number;
  posterPath: string;
  progress: number;
  status: 'queued' | 'downloading' | 'paused' | 'completed' | 'failed';
  filePath?: string;
  fileSize?: number;
  queuedAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface DownloadsState {
  items: DownloadItem[];
  activeDownloads: string[];
  queuedDownloads: string[];
  completedDownloads: string[];
  pausedDownloads: string[];
  failedDownloads: string[];
  totalSize: number;
}

const initialState: DownloadsState = {
  items: [],
  activeDownloads: [],
  queuedDownloads: [],
  completedDownloads: [],
  pausedDownloads: [],
  failedDownloads: [],
  totalSize: 0,
};

export const downloadsSlice = createSlice({
  name: 'downloads',
  initialState,
  reducers: {
    addDownload: (state, action: PayloadAction<DownloadItem>) => {
      state.items.push(action.payload);
      state.queuedDownloads.push(action.payload.id);
    },
    updateDownloadProgress: (state, action: PayloadAction<{ id: string; progress: number; downloadedBytes: number }>) => {
      const item = state.items.find(i => i.id === action.payload.id);
      if (item) {
        item.progress = action.payload.progress;
      }
    },
    updateDownloadStatus: (state, action: PayloadAction<{ id: string; status: DownloadItem['status'] }>) => {
      const item = state.items.find(i => i.id === action.payload.id);
      if (item) {
        // Remove from all status lists
        state.queuedDownloads = state.queuedDownloads.filter(id => id !== action.payload.id);
        state.activeDownloads = state.activeDownloads.filter(id => id !== action.payload.id);
        state.pausedDownloads = state.pausedDownloads.filter(id => id !== action.payload.id);
        state.completedDownloads = state.completedDownloads.filter(id => id !== action.payload.id);
        state.failedDownloads = state.failedDownloads.filter(id => id !== action.payload.id);
        
        item.status = action.payload.status;
        
        // Add to appropriate list
        if (action.payload.status === 'queued') {
          state.queuedDownloads.push(action.payload.id);
        } else if (action.payload.status === 'downloading') {
          state.activeDownloads.push(action.payload.id);
        } else if (action.payload.status === 'paused') {
          state.pausedDownloads.push(action.payload.id);
        } else if (action.payload.status === 'completed') {
          state.completedDownloads.push(action.payload.id);
        } else if (action.payload.status === 'failed') {
          state.failedDownloads.push(action.payload.id);
        }
      }
    },
    removeDownload: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter(i => i.id !== action.payload);
      state.queuedDownloads = state.queuedDownloads.filter(id => id !== action.payload);
      state.activeDownloads = state.activeDownloads.filter(id => id !== action.payload);
      state.pausedDownloads = state.pausedDownloads.filter(id => id !== action.payload);
      state.completedDownloads = state.completedDownloads.filter(id => id !== action.payload);
      state.failedDownloads = state.failedDownloads.filter(id => id !== action.payload);
    },
    clearCompleted: (state) => {
      const completedIds = state.completedDownloads;
      state.items = state.items.filter(i => !completedIds.includes(i.id));
      state.completedDownloads = [];
    },
    retryFailed: (state, action: PayloadAction<string>) => {
      state.failedDownloads = state.failedDownloads.filter(id => id !== action.payload);
      state.queuedDownloads.push(action.payload);
      const item = state.items.find(i => i.id === action.payload);
      if (item) {
        item.status = 'queued';
        item.progress = 0;
      }
    },
  },
});

export const {
  addDownload,
  updateDownloadProgress,
  updateDownloadStatus,
  removeDownload,
  clearCompleted,
  retryFailed,
} = downloadsSlice.actions;

export default downloadsSlice.reducer;
