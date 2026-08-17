// src/utils/storage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const CONTINUE_WATCHING_KEY = 'continueWatching';
const EPISODE_PROGRESS_KEY_PREFIX = 'episodeProgress_';
const STREAM_CACHE_KEY = 'streamCache';
const CACHE_EXPIRATION_MS = 3 * 24 * 60 * 60 * 1000; // 3 days expiration
const AUTO_PLAY_KEY = 'autoPlayEnabled';
const SEARCH_HISTORY_KEY = 'searchHistory';
const MAX_SEARCH_HISTORY_ITEMS = 15;
const LAST_SUBTITLE_LANG_KEY = 'lastSubtitleLanguage';
const SUBTITLES_ENABLED_KEY = 'subtitlesEnabled'; // New key for enabled state

export const STORAGE_KEYS = {
  DOWNLOADS_INDEX: 'downloads_index',
  DOWNLOAD_SETTINGS: 'download_settings',
  CHECK_UPDATES: 'check_updates',
  LAST_UPDATE_CHECK: 'last_update_check',
};

// --- Downloads Directory / Content Path Helpers ---

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

// --- Continue Watching / Watch Progress ---

export const saveWatchProgress = async (mediaId: string, data: any) => {
  try {
    const watchDataString = await AsyncStorage.getItem(CONTINUE_WATCHING_KEY);
    const watchData = watchDataString ? JSON.parse(watchDataString) : {};

    watchData[mediaId] = {
      ...data,
      lastWatched: new Date().toISOString(),
    };

    await AsyncStorage.setItem(CONTINUE_WATCHING_KEY, JSON.stringify(watchData));

    if (data.mediaType === 'tv' && data.season && data.episode) {
      await saveEpisodeWatchProgress(mediaId, data.season, data.episode, {
        position: data.position,
        duration: data.duration,
        lastWatched: watchData[mediaId].lastWatched,
      });
    }
    return true;
  } catch (error) {
    console.error('Error saving watch progress:', error);
    return false;
  }
};

export const getWatchProgress = async (mediaId: string) => {
  try {
    const watchDataString = await AsyncStorage.getItem(CONTINUE_WATCHING_KEY);
    const watchData = watchDataString ? JSON.parse(watchDataString) : {};
    return watchData[mediaId] || null;
  } catch (error) {
    console.error('Error getting watch progress for continue watching:', error);
    return null;
  }
};

const getEpisodeProgressKey = (mediaId: string, seasonNumber: number, episodeNumber: number) => {
  return `${EPISODE_PROGRESS_KEY_PREFIX}tv_${mediaId}_s${seasonNumber}_e${episodeNumber}`;
};

export const saveEpisodeWatchProgress = async (mediaId: string, seasonNumber: number, episodeNumber: number, progressData: any) => {
  try {
    const key = getEpisodeProgressKey(mediaId, seasonNumber, episodeNumber);
    const dataToSave = {
      ...progressData,
      lastWatched: progressData.lastWatched || new Date().toISOString(),
    };
    await AsyncStorage.setItem(key, JSON.stringify(dataToSave));
    return true;
  } catch (error) {
    console.error(`Error saving episode watch progress for S${seasonNumber}E${episodeNumber}:`, error);
    return false;
  }
};

export const getEpisodeWatchProgress = async (mediaId: string, seasonNumber: number, episodeNumber: number) => {
  try {
    const key = getEpisodeProgressKey(mediaId, seasonNumber, episodeNumber);
    const progressString = await AsyncStorage.getItem(key);
    return progressString ? JSON.parse(progressString) : null;
  } catch (error) {
    console.error(`Error getting episode watch progress for S${seasonNumber}E${episodeNumber}:`, error);
    return null;
  }
};

export const getShowWatchProgress = async (mediaId: string) => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const episodeProgressKeys = keys.filter(key => key.startsWith(`${EPISODE_PROGRESS_KEY_PREFIX}tv_${mediaId}_`));
    const progressEntries = await AsyncStorage.multiGet(episodeProgressKeys);

    const showProgress: Record<number, Record<number, any>> = {};
    progressEntries.forEach(([key, value]) => {
      if (value) {
        const parts = key.replace(`${EPISODE_PROGRESS_KEY_PREFIX}tv_${mediaId}_s`, '').split('_e');
        const seasonNumber = parseInt(parts[0], 10);
        const episodeNumber = parseInt(parts[1], 10);
        if (!showProgress[seasonNumber]) {
          showProgress[seasonNumber] = {};
        }
        showProgress[seasonNumber][episodeNumber] = JSON.parse(value);
      }
    });
    return showProgress;
  } catch (error) {
    console.error('Error getting show watch progress:', error);
    return {};
  }
};

export const getContinueWatchingList = async () => {
  try {
    const watchDataString = await AsyncStorage.getItem(CONTINUE_WATCHING_KEY);
    const watchData = watchDataString ? JSON.parse(watchDataString) : {};

    // The key in watchData is now the mediaId
    return Object.entries(watchData)
      .map(([mediaId, data]) => ({
        id: mediaId,
        ...data as any,
      }))
      .sort((a, b) => {
        return new Date(b.lastWatched).getTime() - new Date(a.lastWatched).getTime();
      });
  } catch (error) {
    console.error('Error getting continue watching list:', error);
    return [];
  }
};

// Clear a specific show/movie from continue watching
export const removeFromContinueWatching = async (mediaId: string) => {
  try {
    const watchDataString = await AsyncStorage.getItem(CONTINUE_WATCHING_KEY);
    const watchData = watchDataString ? JSON.parse(watchDataString) : {};

    delete watchData[mediaId];
    await AsyncStorage.setItem(CONTINUE_WATCHING_KEY, JSON.stringify(watchData));
    return true;
  } catch (error) {
    console.error('Error removing from continue watching:', error);
    return false;
  }
};

// --- Stream Cache Functions ---

// Save a stream URL, its referer, and sourceName to the cache
export const saveStreamUrl = async (contentId: string, url: string, referer: string | null, sourceName: string | null) => {
  if (!contentId || !url) return false; // referer can be null, sourceName can be null
  try {
    const cacheString = await AsyncStorage.getItem(STREAM_CACHE_KEY);
    const cache = cacheString ? JSON.parse(cacheString) : {};
    cache[contentId] = {
      url: url,
      referer: referer, // Store the referer
      sourceName: sourceName, // Store the sourceName
      timestamp: Date.now(),
    };
    await AsyncStorage.setItem(STREAM_CACHE_KEY, JSON.stringify(cache));
    return true;
  } catch (error) {
    console.error('Error saving stream URL to cache:', error);
    return false;
  }
};

// Get a cached stream URL if it's not expired
export const getCachedStreamUrl = async (contentId: string) => {
  if (!contentId) return null;
  try {
    const cacheString = await AsyncStorage.getItem(STREAM_CACHE_KEY);
    const cache = cacheString ? JSON.parse(cacheString) : {};
    const entry = cache[contentId];

    if (entry && entry.url && entry.timestamp) { // referer and sourceName might be null
      const isExpired = (Date.now() - entry.timestamp) > CACHE_EXPIRATION_MS;
      if (!isExpired) {
        // Return an object containing url, referer, and sourceName
        return {
          url: entry.url,
          referer: entry.referer !== undefined ? entry.referer : null,
          sourceName: entry.sourceName !== undefined ? entry.sourceName : null
        };
      } else {
        delete cache[contentId];
        await AsyncStorage.setItem(STREAM_CACHE_KEY, JSON.stringify(cache));
        return null; // Return null if expired
      }
    }
    return null; // Return null if no valid entry
  } catch (error) {
    console.error('Error getting cached stream URL:', error);
    return null;
  }
};

// Clear a specific stream URL from the cache
export const clearSpecificStreamFromCache = async (contentId: string) => {
  if (!contentId) {
    console.warn('clearSpecificStreamFromCache called with no contentId');
    return;
  }
  try {
    const cacheString = await AsyncStorage.getItem(STREAM_CACHE_KEY);
    const cache = cacheString ? JSON.parse(cacheString) : {};
    if (cache[contentId]) {
      delete cache[contentId];
      await AsyncStorage.setItem(STREAM_CACHE_KEY, JSON.stringify(cache));
    }
  } catch (e) {
    console.error(`Failed to clear cached stream URL for ${contentId} from main cache object.`, e);
  }
};

export const clearStreamCache = async () => { // This clears the ENTIRE cache
  try {
    await AsyncStorage.removeItem(STREAM_CACHE_KEY);
  } catch (error) {
    console.error('Error clearing stream cache:', error);
  }
};

// --- Auto Play Setting ---

// Save the auto-play setting
export const saveAutoPlaySetting = async (isEnabled: boolean) => {
  try {
    await AsyncStorage.setItem(AUTO_PLAY_KEY, JSON.stringify(isEnabled));
    return true;
  } catch (error) {
    console.error('Error saving auto-play setting:', error);
    return false;
  }
};

// Get the auto-play setting
export const getAutoPlaySetting = async () => {
  try {
    const settingString = await AsyncStorage.getItem(AUTO_PLAY_KEY);
    return settingString ? JSON.parse(settingString) : true;
  } catch (error) {
    console.error('Error getting auto-play setting:', error);
    return true;
  }
};

// --- Search History Functions ---

// Save a search query to history
export const saveSearchQuery = async (query: string) => {
  if (!query || typeof query !== 'string' || !query.trim()) return false;
  const trimmedQuery = query.trim();
  try {
    const historyString = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
    let history = historyString ? JSON.parse(historyString) : [];
    // Remove existing entry if it's already there to move it to the top
    history = history.filter((item: string) => item !== trimmedQuery);
    // Add new query to the beginning
    history.unshift(trimmedQuery);
    // Limit history size
    if (history.length > MAX_SEARCH_HISTORY_ITEMS) {
      history = history.slice(0, MAX_SEARCH_HISTORY_ITEMS);
    }
    await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
    return true;
  } catch (error) {
    console.error('Error saving search query:', error);
    return false;
  }
};

// Get search history
export const getSearchHistory = async () => {
  try {
    const historyString = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
    return historyString ? JSON.parse(historyString) : [];
  } catch (error) {
    console.error('Error getting search history:', error);
    return [];
  }
};

// Remove a specific search query from history
export const removeSearchQuery = async (queryToRemove: string) => {
  if (!queryToRemove || typeof queryToRemove !== 'string' || !queryToRemove.trim()) return false;
  const trimmedQuery = queryToRemove.trim();
  try {
    const historyString = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
    let history = historyString ? JSON.parse(historyString) : [];
    history = history.filter((item: string) => item !== trimmedQuery);
    await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
    return true;
  } catch (error) {
    console.error('Error removing search query:', error);
    return false;
  }
};

// Clear all search history
export const clearSearchHistory = async () => {
  try {
    await AsyncStorage.removeItem(SEARCH_HISTORY_KEY);
    return true;
  } catch (error) {
    console.error('Error clearing search history:', error);
    return false;
  }
};

// --- Subtitle Preference Functions ---

export const saveSubtitleLanguagePreference = async (languageCode: string | null) => {
  try {
    // languageCode can be a string (e.g., 'en') or null (for 'None'/disabled)
    if (languageCode === null) {
      await AsyncStorage.setItem(LAST_SUBTITLE_LANG_KEY, 'none'); // Store 'none' as a special string
    } else {
      await AsyncStorage.setItem(LAST_SUBTITLE_LANG_KEY, languageCode);
    }
    return true;
  } catch (error) {
    console.error('Error saving subtitle language preference:', error);
    return false;
  }
};

export const getSubtitleLanguagePreference = async () => {
  try {
    const languageCode = await AsyncStorage.getItem(LAST_SUBTITLE_LANG_KEY);
    if (languageCode === 'none') {
      return null; // Convert 'none' back to null (subtitles disabled)
    }
    return languageCode; // Returns the code string or null if not set
  } catch (error) {
    console.error('Error getting subtitle language preference:', error);
    return null; // Default to null on error
  }
};

// Legacy function names for backward compatibility
export const saveLastSelectedSubtitleLanguage = saveSubtitleLanguagePreference;
export const getLastSelectedSubtitleLanguage = getSubtitleLanguagePreference;

// --- End Subtitle Preference Functions ---

export default {
  saveWatchProgress,
  getWatchProgress,
  getContinueWatchingList,
  saveEpisodeWatchProgress,
  getEpisodeWatchProgress,
  getShowWatchProgress,
  removeFromContinueWatching,
  saveStreamUrl,
  getCachedStreamUrl,
  clearSpecificStreamFromCache,
  clearStreamCache,
  saveAutoPlaySetting,
  getAutoPlaySetting,
  saveSearchQuery,
  getSearchHistory,
  removeSearchQuery,
  clearSearchHistory,
  saveSubtitleLanguagePreference,
  getSubtitleLanguagePreference,
  saveLastSelectedSubtitleLanguage,
  getLastSelectedSubtitleLanguage,
  // Downloads helpers
  STORAGE_KEYS,
  getDownloadsDirectory,
  getContentDirectory,
  generateDownloadId,
  DOWNLOAD_STATUS,
};