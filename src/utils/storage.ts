// src/utils/storage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export const STORAGE_KEYS = {
  DOWNLOADS_INDEX: 'downloads_index',
  DOWNLOAD_SETTINGS: 'download_settings',
  STREAM_SOURCES_ORDER: 'stream_sources_order',
  CHECK_UPDATES: 'check_updates',
  LAST_UPDATE_CHECK: 'last_update_check',
};

export const FLUX_SOURCE_URL = 'https://streamprovider.byteful.me/';

export const getDownloadsDirectory = (): string => {
  return 'downloads/';
};

export const getContentDirectory = (
  mediaType: string,
  tmdbId: string,
  season?: number | null,
  episode?: number | null
): string => {
  if (mediaType === 'movie') {
    return `${getDownloadsDirectory()}movies/${tmdbId}/`;
  } else if (mediaType === 'tv') {
    return `${getDownloadsDirectory()}tv/${tmdbId}/season_${season}/episode_${episode}/`;
  }
  return `${getDownloadsDirectory()}${tmdbId}/`;
};

export const generateDownloadId = (
  mediaType: string,
  tmdbId: string,
  season?: number | null,
  episode?: number | null
): string => {
  if (mediaType === 'movie') {
    return `movie_${tmdbId}`;
  }
  return `tv_${tmdbId}_s${season}_e${episode}`;
};

export const DOWNLOAD_STATUS = {
  QUEUED: 'queued',
  DOWNLOADING: 'downloading',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;