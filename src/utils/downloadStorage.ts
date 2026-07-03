// src/utils/downloadStorage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';

const DOWNLOADS_INDEX_KEY = 'downloads_index';
const DOWNLOAD_SETTINGS_KEY = 'download_settings';
const DOWNLOAD_QUEUE_KEY = 'download_queue';

// ─── Encryption Key with Salt ───
const getEncryptionKey = async (): Promise<string> => {
  const baseKey = 'netflix-pro-secure-key-2024';
  const salt = 'X7fK9pL2mN4qR8sT1uV5wY3zA6cE9gH7jM0pQ2sT4uV6wX8yZ0';
  const combined = baseKey + salt;
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    combined
  );
  return hash.substring(0, 32);
};

// ─── Industry-Standard Secure Directory Structure ───
// /data/data/com.netflixpro.app/files/.netflix/
//   └── abc123def/  (show/movie identifier)
//         ├── metadata.json  (title, poster, overview, rating, etc.)
//         ├── poster.jpg
//         ├── backdrop.jpg
//         ├── video.nfx  (encrypted video)
//         ├── subtitles/
//         │   ├── en.srt
//         │   ├── es.srt
//         │   └── fr.srt
//         └── info.json  (download date, size, progress, etc.)

const generateSecureDirName = async (): Promise<string> => {
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    'netflix-pro-secure-downloads-2024'
  );
  return hash.substring(0, 16);
};

let SECURE_BASE_DIR: string | null = null;

export const getSecureBaseDirectory = async (): Promise<string> => {
  if (SECURE_BASE_DIR) return SECURE_BASE_DIR;
  
  // Industry standard: app-private directory with custom name
  const baseDir = `${LegacyFileSystem.documentDirectory}.netflix/`;
  SECURE_BASE_DIR = baseDir;
  return baseDir;
};

// ─── Get content directory with full metadata structure ───
export const getSecureContentDirectory = async (
  mediaType: string,
  tmdbId: string,
  season: number | null = null,
  episode: number | null = null
): Promise<string> => {
  const baseDir = await getSecureBaseDirectory();
  const secureDir = await generateSecureDirName();
  
  if (mediaType === 'tv') {
    return `${baseDir}${secureDir}/tv/${tmdbId}/s${season}/e${episode}/`;
  }
  return `${baseDir}${secureDir}/movies/${tmdbId}/`;
};

// ─── Metadata file paths ───
export const getMetadataFilePath = (contentDir: string): string => {
  return `${contentDir}metadata.json`;
};

export const getPosterPath = (contentDir: string): string => {
  return `${contentDir}poster.jpg`;
};

export const getBackdropPath = (contentDir: string): string => {
  return `${contentDir}backdrop.jpg`;
};

export const getVideoPath = (contentDir: string): string => {
  return `${contentDir}video.nfx`;
};

export const getSubtitlesDirectory = (contentDir: string): string => {
  return `${contentDir}subtitles/`;
};

export const getSubtitlePath = (contentDir: string, language: string): string => {
  return `${getSubtitlesDirectory(contentDir)}${language}.srt`;
};

export const getInfoFilePath = (contentDir: string): string => {
  return `${contentDir}info.json`;
};

// ─── Save metadata for content ───
export const saveContentMetadata = async (
  contentDir: string,
  metadata: {
    title: string;
    posterPath?: string;
    backdropPath?: string;
    overview?: string;
    voteAverage?: number;
    releaseDate?: string;
    genres?: string[];
    runtime?: number;
    seasons?: number;
    episodes?: number;
    seasonNumber?: number;
    episodeNumber?: number;
    episodeTitle?: string;
    airDate?: string;
  }
): Promise<void> => {
  try {
    const metadataPath = getMetadataFilePath(contentDir);
    await LegacyFileSystem.writeAsStringAsync(
      metadataPath,
      JSON.stringify(metadata, null, 2)
    );
  } catch (error) {
    console.warn('[downloadStorage] Save metadata error:', error);
  }
};

export const loadContentMetadata = async (contentDir: string): Promise<any> => {
  try {
    const metadataPath = getMetadataFilePath(contentDir);
    const info = await LegacyFileSystem.getInfoAsync(metadataPath);
    if (!info.exists) return null;
    const content = await LegacyFileSystem.readAsStringAsync(metadataPath);
    return JSON.parse(content);
  } catch (error) {
    console.warn('[downloadStorage] Load metadata error:', error);
    return null;
  }
};

// ─── Save download info ───
export const saveDownloadInfo = async (
  contentDir: string,
  info: {
    downloadId: string;
    mediaType: string;
    tmdbId: string;
    fileSize: number;
    downloadedAt: string;
    progress: number;
    status: string;
    season?: number;
    episode?: number;
  }
): Promise<void> => {
  try {
    const infoPath = getInfoFilePath(contentDir);
    await LegacyFileSystem.writeAsStringAsync(
      infoPath,
      JSON.stringify(info, null, 2)
    );
  } catch (error) {
    console.warn('[downloadStorage] Save info error:', error);
  }
};

export const loadDownloadInfo = async (contentDir: string): Promise<any> => {
  try {
    const infoPath = getInfoFilePath(contentDir);
    const info = await LegacyFileSystem.getInfoAsync(infoPath);
    if (!info.exists) return null;
    const content = await LegacyFileSystem.readAsStringAsync(infoPath);
    return JSON.parse(content);
  } catch (error) {
    console.warn('[downloadStorage] Load info error:', error);
    return null;
  }
};

// ─── Save subtitle ───
export const saveSubtitle = async (
  contentDir: string,
  language: string,
  content: string
): Promise<void> => {
  try {
    const subDir = getSubtitlesDirectory(contentDir);
    await ensureDirectoryExists(subDir);
    const subPath = getSubtitlePath(contentDir, language);
    await LegacyFileSystem.writeAsStringAsync(subPath, content);
  } catch (error) {
    console.warn('[downloadStorage] Save subtitle error:', error);
  }
};

export const getAvailableSubtitles = async (contentDir: string): Promise<string[]> => {
  try {
    const subDir = getSubtitlesDirectory(contentDir);
    const info = await LegacyFileSystem.getInfoAsync(subDir);
    if (!info.exists) return [];
    const files = await LegacyFileSystem.readDirectoryAsync(subDir);
    return files
      .filter(f => f.endsWith('.srt'))
      .map(f => f.replace('.srt', ''));
  } catch (error) {
    return [];
  }
};

// ─── Encrypt and save video ───
export const encryptAndSaveVideo = async (
  sourcePath: string,
  contentDir: string
): Promise<string> => {
  const videoPath = getVideoPath(contentDir);
  await encryptFile(sourcePath, videoPath);
  return videoPath;
};

// ─── Delete entire content directory ───
export const deleteContentDirectory = async (contentDir: string): Promise<void> => {
  try {
    const info = await LegacyFileSystem.getInfoAsync(contentDir);
    if (info.exists) {
      await LegacyFileSystem.deleteAsync(contentDir, { idempotent: true });
    }
  } catch (error) {
    console.warn('[downloadStorage] Delete content error:', error);
  }
};

// ─── File Extension Encoding ───
const ENCODED_EXT = '.nfx';

export const getEncodedFilePath = (basePath: string): string => {
  let encoded = basePath
    .replace(/\.mp4$/i, ENCODED_EXT)
    .replace(/\.m3u8$/i, ENCODED_EXT)
    .replace(/\.mkv$/i, ENCODED_EXT)
    .replace(/\.avi$/i, ENCODED_EXT);
  
  if (encoded === basePath) {
    encoded = basePath + ENCODED_EXT;
  }
  
  return encoded;
};

// ─── Hide from media scanner ───
export const hideFileFromMediaScanner = async (dirPath: string): Promise<void> => {
  try {
    const nomediaPath = `${dirPath}/.nomedia`;
    const info = await LegacyFileSystem.getInfoAsync(nomediaPath);
    if (!info.exists) {
      await LegacyFileSystem.writeAsStringAsync(nomediaPath, '');
    }
  } catch (error) {
    // Ignore errors
  }
};

// ─── XOR Encryption ───
export const encryptFile = async (sourcePath: string, destPath: string): Promise<void> => {
  try {
    const key = await getEncryptionKey();
    const fileContent = await LegacyFileSystem.readAsStringAsync(sourcePath, {
      encoding: LegacyFileSystem.EncodingType.Base64,
    });
    
    const binaryString = atob(fileContent);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const fileSalt = new Uint8Array(16);
    const timestamp = Date.now();
    for (let i = 0; i < 16; i++) {
      fileSalt[i] = (timestamp >> (i * 8)) & 0xFF;
    }
    
    const keyBytes = new TextEncoder().encode(key);
    const saltKey = new Uint8Array(48);
    saltKey.set(keyBytes, 0);
    saltKey.set(fileSalt, 32);
    
    const encryptedBytes = new Uint8Array(bytes.length + 16);
    encryptedBytes.set(fileSalt, 0);
    
    for (let i = 0; i < bytes.length; i++) {
      encryptedBytes[i + 16] = bytes[i] ^ saltKey[i % saltKey.length];
    }
    
    let binary = '';
    for (let i = 0; i < encryptedBytes.length; i++) {
      binary += String.fromCharCode(encryptedBytes[i]);
    }
    const encryptedBase64 = btoa(binary);
    
    await LegacyFileSystem.writeAsStringAsync(destPath, encryptedBase64, {
      encoding: LegacyFileSystem.EncodingType.Base64,
    });
  } catch (error) {
    console.error('[Encrypt] Error:', error);
    await LegacyFileSystem.copyAsync({ from: sourcePath, to: destPath });
  }
};

export const decryptFile = async (sourcePath: string): Promise<string> => {
  try {
    const key = await getEncryptionKey();
    const encryptedContent = await LegacyFileSystem.readAsStringAsync(sourcePath, {
      encoding: LegacyFileSystem.EncodingType.Base64,
    });
    
    const binaryString = atob(encryptedContent);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const fileSalt = bytes.slice(0, 16);
    const encryptedData = bytes.slice(16);
    
    const keyBytes = new TextEncoder().encode(key);
    const saltKey = new Uint8Array(48);
    saltKey.set(keyBytes, 0);
    saltKey.set(fileSalt, 32);
    
    const decryptedBytes = new Uint8Array(encryptedData.length);
    for (let i = 0; i < encryptedData.length; i++) {
      decryptedBytes[i] = encryptedData[i] ^ saltKey[i % saltKey.length];
    }
    
    let binary = '';
    for (let i = 0; i < decryptedBytes.length; i++) {
      binary += String.fromCharCode(decryptedBytes[i]);
    }
    return btoa(binary);
  } catch (error) {
    console.error('[Decrypt] Error:', error);
    return null;
  }
};

export const decryptFileToTemp = async (encryptedPath: string): Promise<string | null> => {
  try {
    const decryptedBase64 = await decryptFile(encryptedPath);
    if (!decryptedBase64) return null;
    
    const tempPath = `${LegacyFileSystem.cacheDirectory}temp_${Date.now()}.mp4`;
    await LegacyFileSystem.writeAsStringAsync(tempPath, decryptedBase64, {
      encoding: LegacyFileSystem.EncodingType.Base64,
    });
    
    return tempPath;
  } catch (error) {
    console.error('[Decrypt] Temp error:', error);
    return null;
  }
};

export const cleanupTempFile = async (tempPath: string): Promise<void> => {
  try {
    const info = await LegacyFileSystem.getInfoAsync(tempPath);
    if (info.exists) {
      await LegacyFileSystem.deleteAsync(tempPath, { idempotent: true });
    }
  } catch (error) {
    // Ignore cleanup errors
  }
};

// ─── Ensure directory exists ───
export const ensureDirectoryExists = async (dirPath: string): Promise<boolean> => {
  try {
    const info = await LegacyFileSystem.getInfoAsync(dirPath);
    if (!info.exists) {
      await LegacyFileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
    }
    return true;
  } catch (error) {
    return false;
  }
};

// ─── Initialize secure directory structure ───
export const initializeDownloadsDirectory = async (): Promise<void> => {
  try {
    const baseDir = await getSecureBaseDirectory();
    const info = await LegacyFileSystem.getInfoAsync(baseDir);
    if (!info.exists) {
      await LegacyFileSystem.makeDirectoryAsync(baseDir, { intermediates: true });
      await hideFileFromMediaScanner(baseDir);
    }
  } catch (error) {
    console.warn('[downloadStorage] Init error:', error);
  }
};

// ─── DOWNLOAD STATUS ───
export const DOWNLOAD_STATUS = {
  QUEUED: 'queued',
  DOWNLOADING: 'downloading',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

// ─── Default Settings ───
export const DEFAULT_DOWNLOAD_SETTINGS = {
  wifiOnlyDownload: true,
  maxConcurrentDownloads: 1,
  autoDeleteUnwatchedDays: 14,
  autoDeleteWatchedDays: 0,
};

// ─── AsyncStorage Functions ───
export const generateDownloadId = (mediaType: string, tmdbId: string, season: number | null = null, episode: number | null = null) => {
  if (mediaType === 'tv' && season !== null && episode !== null) {
    return `tv_${tmdbId}_s${season}_e${episode}`;
  }
  return `movie_${tmdbId}`;
};

export const saveDownloadSettings = async (settings: any) => {
  try {
    const currentSettings = await getDownloadSettings();
    const newSettings = { ...currentSettings, ...settings };
    await AsyncStorage.setItem(DOWNLOAD_SETTINGS_KEY, JSON.stringify(newSettings));
    return true;
  } catch (error) {
    return false;
  }
};

export const getDownloadSettings = async () => {
  try {
    const settingsString = await AsyncStorage.getItem(DOWNLOAD_SETTINGS_KEY);
    if (settingsString) {
      return { ...DEFAULT_DOWNLOAD_SETTINGS, ...JSON.parse(settingsString) };
    }
    return DEFAULT_DOWNLOAD_SETTINGS;
  } catch (error) {
    return DEFAULT_DOWNLOAD_SETTINGS;
  }
};

export const getDownloadsIndex = async () => {
  try {
    const indexString = await AsyncStorage.getItem(DOWNLOADS_INDEX_KEY);
    if (indexString) {
      return JSON.parse(indexString);
    }
    return { version: 1, lastUpdated: new Date().toISOString(), downloads: {} };
  } catch (error) {
    return { version: 1, lastUpdated: new Date().toISOString(), downloads: {} };
  }
};

export const saveDownloadsIndex = async (index: any) => {
  try {
    index.lastUpdated = new Date().toISOString();
    await AsyncStorage.setItem(DOWNLOADS_INDEX_KEY, JSON.stringify(index));
    return true;
  } catch (error) {
    return false;
  }
};

export const getDownloadEntry = async (downloadId: string) => {
  try {
    const index = await getDownloadsIndex();
    return index.downloads[downloadId] || null;
  } catch (error) {
    return null;
  }
};

export const saveDownloadEntry = async (entry: any) => {
  try {
    const index = await getDownloadsIndex();
    index.downloads[entry.id] = entry;
    await saveDownloadsIndex(index);
    return true;
  } catch (error) {
    return false;
  }
};

export const updateDownloadEntry = async (downloadId: string, updates: any) => {
  try {
    const index = await getDownloadsIndex();
    if (index.downloads[downloadId]) {
      index.downloads[downloadId] = { ...index.downloads[downloadId], ...updates };
      await saveDownloadsIndex(index);
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
};

export const removeDownloadEntry = async (downloadId: string) => {
  try {
    const index = await getDownloadsIndex();
    if (index.downloads[downloadId]) {
      delete index.downloads[downloadId];
      await saveDownloadsIndex(index);
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
};

export const getAllDownloads = async () => {
  try {
    const index = await getDownloadsIndex();
    return Object.values(index.downloads);
  } catch (error) {
    return [];
  }
};

export const getDownloadsByStatus = async (status: string) => {
  try {
    const downloads = await getAllDownloads();
    return downloads.filter(d => d.status === status);
  } catch (error) {
    return [];
  }
};

export const getCompletedDownloads = async () => {
  return getDownloadsByStatus(DOWNLOAD_STATUS.COMPLETED);
};

export const getActiveDownloads = async () => {
  try {
    const downloads = await getAllDownloads();
    return downloads.filter(d =>
      d.status === DOWNLOAD_STATUS.QUEUED ||
      d.status === DOWNLOAD_STATUS.DOWNLOADING ||
      d.status === DOWNLOAD_STATUS.PAUSED
    );
  } catch (error) {
    return [];
  }
};

export const isDownloaded = async (mediaType: string, tmdbId: string, season: number | null = null, episode: number | null = null) => {
  try {
    const downloadId = generateDownloadId(mediaType, tmdbId, season, episode);
    const entry = await getDownloadEntry(downloadId);
    return entry?.status === DOWNLOAD_STATUS.COMPLETED;
  } catch (error) {
    return false;
  }
};

export const getDownloadStatus = async (mediaType: string, tmdbId: string, season: number | null = null, episode: number | null = null) => {
  try {
    const downloadId = generateDownloadId(mediaType, tmdbId, season, episode);
    const entry = await getDownloadEntry(downloadId);
    return entry?.status || null;
  } catch (error) {
    return null;
  }
};

export const createDownloadEntry = (mediaInfo: any) => {
  const { mediaType, tmdbId, title, posterPath, season, episode, episodeTitle, streamUrl, streamReferer } = mediaInfo;
  const downloadId = generateDownloadId(mediaType, tmdbId, season, episode);
  const contentDir = `${LegacyFileSystem.documentDirectory}downloads/${mediaType}/${tmdbId}/`;

  return {
    id: downloadId,
    tmdbId,
    mediaType,
    title,
    posterPath,
    season: season || null,
    episode: episode || null,
    episodeTitle: episodeTitle || null,
    status: DOWNLOAD_STATUS.QUEUED,
    progress: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    queuedAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    lastWatchedAt: null,
    filePath: contentDir,
    fileSize: 0,
    streamUrl,
    streamReferer: streamReferer || null,
    errorMessage: null,
    retryCount: 0,
  };
};

export const markAsWatched = async (downloadId: string) => {
  try {
    await updateDownloadEntry(downloadId, { lastWatchedAt: new Date().toISOString() });
    return true;
  } catch (error) {
    return false;
  }
};

export const getDownloadStorageUsage = async () => {
  try {
    const index = await getDownloadsIndex();
    const downloads = Object.values(index.downloads);
    let totalSize = 0;
    for (const download of downloads) {
      if (download.status === DOWNLOAD_STATUS.COMPLETED && download.fileSize) {
        totalSize += download.fileSize;
      }
    }
    return totalSize;
  } catch (error) {
    return 0;
  }
};

export const deleteDownloadFiles = async (downloadId: string) => {
  try {
    const entry = await getDownloadEntry(downloadId);
    if (entry) {
      const contentDir = `${LegacyFileSystem.documentDirectory}downloads/${entry.mediaType}/${entry.tmdbId}/`;
      const contentDirInfo = await LegacyFileSystem.getInfoAsync(contentDir);
      if (contentDirInfo.exists) {
        await LegacyFileSystem.deleteAsync(contentDir, { idempotent: true });
      }
    }
    return true;
  } catch (error) {
    return false;
  }
};

export const deleteDownload = async (downloadId: string) => {
  try {
    await deleteDownloadFiles(downloadId);
    await removeDownloadEntry(downloadId);
    return true;
  } catch (error) {
    return false;
  }
};

export const clearAllDownloads = async () => {
  try {
    const baseDir = await getSecureBaseDirectory();
    const info = await LegacyFileSystem.getInfoAsync(baseDir);
    if (info.exists) {
      await LegacyFileSystem.deleteAsync(baseDir, { idempotent: true });
    }
    await initializeDownloadsDirectory();
    await AsyncStorage.setItem(DOWNLOADS_INDEX_KEY, JSON.stringify({
      version: 1,
      lastUpdated: new Date().toISOString(),
      downloads: {}
    }));
    await AsyncStorage.removeItem(DOWNLOAD_QUEUE_KEY);
    return true;
  } catch (error) {
    return false;
  }
};

export const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};