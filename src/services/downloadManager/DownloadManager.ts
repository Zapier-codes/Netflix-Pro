// src/services/downloadManager/DownloadManager.ts
import networkMonitor from './NetworkMonitor';
import storageManager from './StorageManager';
import downloadQueue from './DownloadQueue';
import HLSDownloader from './HLSDownloader';
import MP4Downloader from './MP4Downloader';
import ffmpegConverter from './FFmpegConverter';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import {
  getDownloadSettings,
  initializeDownloadsDirectory,
  updateDownloadEntry,
  getDownloadEntry,
  deleteDownload,
  getAllDownloads,
  getCompletedDownloads,
  DOWNLOAD_STATUS,
  generateDownloadId,
  createDownloadEntry,
  markAsWatched as markDownloadAsWatched,
  getSecureBaseDirectory,
  getSecureContentDirectory,
  getEncodedFilePath,
  hideFileFromMediaScanner,
  encryptAndSaveVideo,
  saveContentMetadata,
  saveDownloadInfo,
  loadContentMetadata,
  loadDownloadInfo,
  getAvailableSubtitles,
  getSubtitlePath,
  saveSubtitle,
  ensureDirectoryExists,
  decryptFileToTemp,
  cleanupTempFile,
} from '../../utils/downloadStorage';
import { getImageUrl } from '../../api/tmdbApi';

// Note: getActiveStreamSources is now imported via require in fetchAndStartDownload
// to avoid circular dependency issues with the unified providers

class DownloadManager {
  private activeDownloads: Map<any, any>;
  private pendingFetches: Set<any>;
  private listeners: Set<any>;
  private isInitialized: boolean;
  private isProcessingQueue: boolean;
  private networkUnsubscribe: any;

  constructor() {
    this.activeDownloads = new Map();
    this.pendingFetches = new Set();
    this.listeners = new Set();
    this.isInitialized = false;
    this.isProcessingQueue = false;
    this.networkUnsubscribe = null;
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      await initializeDownloadsDirectory();
      await storageManager.initialize();
      await downloadQueue.initialize();
      await networkMonitor.start();
      await ffmpegConverter.initialize();

      this.networkUnsubscribe = networkMonitor.subscribe((state) => {
        this.handleNetworkChange(state);
      });

      this.isInitialized = true;
      this.processQueue();
    } catch (error) {
      console.warn('[DownloadManager] Initialization warning:', error);
      this.isInitialized = true;
    }
  }

  handleNetworkChange(networkState: any) {
    if (networkState.isConnected) {
      this.processQueue();
    } else {
      this.pauseAllActive();
    }
  }

  async canDownload() {
    const settings = await getDownloadSettings();
    return networkMonitor.canDownload(settings.wifiOnlyDownload);
  }

  async addToQueue(mediaInfo: any) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const entry = await downloadQueue.enqueue(mediaInfo);
      this.notifyListeners('queue-updated', downloadQueue.getAll());
      this.processQueue();
      return entry;
    } catch (error) {
      throw error;
    }
  }

  async addSeasonToQueue(mediaId: string, title: string, posterPath: string, seasonNumber: number, episodes: any[]) {
    const entries = [];

    for (const episode of episodes) {
      try {
        const alreadyDownloaded = await this.isDownloaded('tv', mediaId, seasonNumber, episode.episode_number);
        if (alreadyDownloaded) {
          continue;
        }

        const downloadId = generateDownloadId('tv', mediaId, seasonNumber, episode.episode_number);
        const inQueue = downloadQueue.isInQueue(downloadId);
        if (inQueue) {
          continue;
        }

        const mediaInfo = {
          mediaType: 'tv',
          tmdbId: mediaId,
          title,
          posterPath,
          season: seasonNumber,
          episode: episode.episode_number,
          episodeTitle: episode.name,
          streamUrl: null,
          streamReferer: null,
        };

        const entry = await this.addToQueue(mediaInfo);
        entries.push(entry);
      } catch (error) {
        console.warn('[DownloadManager] Failed to add episode to queue:', error);
      }
    }

    return entries;
  }

  async processQueue() {
    if (this.isProcessingQueue) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      if (!await this.canDownload()) {
        return;
      }

      const settings = await getDownloadSettings();
      const currentlyProcessing = this.activeDownloads.size + this.pendingFetches.size;
      const availableSlots = settings.maxConcurrentDownloads - currentlyProcessing;

      if (availableSlots <= 0) {
        return;
      }

      for (let i = 0; i < availableSlots; i++) {
        const next = downloadQueue.getNext();
        if (!next) break;

        if (this.pendingFetches.has(next.id)) {
          continue;
        }

        if (!next.streamUrl) {
          this.pendingFetches.add(next.id);
          this.fetchAndStartDownload(next).catch(error => {
            this.pendingFetches.delete(next.id);
            this.handleError(next.id, error);
          });

          continue;
        }

        await downloadQueue.updateStatus(next.id, DOWNLOAD_STATUS.DOWNLOADING);
        this.startDownload(next);
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  async fetchAndStartDownload(entry: any) {
    try {
      // Use require to avoid circular dependency with unified providers
      const { getActiveStreamSources } = require('../../services/unified/providers/vidsrc/VidSrcProvider');
      const sources = getActiveStreamSources();

      const fluxSource = sources.find((s: any) => s.name === 'FluxSource');

      if (!fluxSource) {
        throw new Error('FluxSource not available for downloads');
      }

      let fetchUrl;
      if (entry.mediaType === 'tv') {
        fetchUrl = `${fluxSource.baseUrl}?tmdbId=${entry.tmdbId}&season=${entry.season}&episode=${entry.episode}`;
      } else {
        fetchUrl = `${fluxSource.baseUrl}?tmdbId=${entry.tmdbId}`;
      }

      const timeoutMs = (fluxSource.timeoutInSeconds || 15) * 1000;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      let response;
      try {
        response = await fetch(fetchUrl, { signal: controller.signal });
      } finally {
        clearTimeout(timeoutId);
      }

      const result = await response.json();

      if (result.error || !result.url) {
        throw new Error(result.error || 'No stream URL found');
      }

      await this.setStreamUrlForDownload(entry.id, result.url, result.referer);

      this.pendingFetches.delete(entry.id);

      await downloadQueue.updateStatus(entry.id, DOWNLOAD_STATUS.DOWNLOADING);

      const updatedEntry = await getDownloadEntry(entry.id);
      if (updatedEntry) {
        this.startDownload(updatedEntry);
      }
    } catch (error: any) {
      this.pendingFetches.delete(entry.id);
      if (error.name === 'AbortError') {
        throw new Error('Stream URL fetch timed out');
      }
      throw error;
    }
  }

  async startDownload(entry: any) {
    if (this.activeDownloads.has(entry.id)) {
      return;
    }

    this.notifyListeners('download-started', entry);

    const onProgress = (progressData: any) => {
      this.handleProgress(entry.id, progressData);
    };

    const onComplete = (result: any) => {
      this.handleComplete(entry.id, result);
    };

    const onError = (error: any) => {
      this.handleError(entry.id, error);
    };

    let downloader: any;

    if (this.isHLS(entry.streamUrl)) {
      downloader = new HLSDownloader(entry, onProgress, onComplete, onError);
    } else {
      downloader = new MP4Downloader(entry, onProgress, onComplete, onError);
    }

    this.activeDownloads.set(entry.id, downloader);
    downloader.start();
  }

  isHLS(url: string) {
    if (!url) return false;
    return url.includes('.m3u8') || url.includes('m3u8');
  }

  handleProgress(downloadId: string, progressData: any) {
    const { progress, bytesDownloaded, totalBytes } = progressData;

    downloadQueue.updateProgress(downloadId, progress, bytesDownloaded, totalBytes);

    this.notifyListeners('download-progress', {
      id: downloadId,
      ...progressData,
    });
  }

  async handleComplete(downloadId: string, result: any) {
    this.activeDownloads.delete(downloadId);

    try {
      const entry = await getDownloadEntry(downloadId);
      if (!entry) {
        console.warn('[DownloadManager] Entry not found:', downloadId);
        return;
      }

      // --- Create industry-standard secure directory structure ---
      const contentDir = await getSecureContentDirectory(
        entry.mediaType,
        entry.tmdbId,
        entry.season,
        entry.episode
      );

      // Ensure all directories exist
      await ensureDirectoryExists(contentDir);
      await ensureDirectoryExists(`${contentDir}subtitles/`);
      await ensureDirectoryExists(`${contentDir}thumbnails/`);

      // --- Save metadata ---
      await saveContentMetadata(contentDir, {
        title: entry.title,
        posterPath: entry.posterPath,
        overview: entry.overview || '',
        voteAverage: entry.voteAverage || 0,
        releaseDate: entry.releaseDate || '',
        genres: entry.genres || [],
        runtime: entry.runtime || 0,
        seasonNumber: entry.season || undefined,
        episodeNumber: entry.episode || undefined,
        episodeTitle: entry.episodeTitle || undefined,
      });

      // --- Save download info ---
      await saveDownloadInfo(contentDir, {
        downloadId: entry.id,
        mediaType: entry.mediaType,
        tmdbId: entry.tmdbId,
        fileSize: result.fileSize || 0,
        downloadedAt: new Date().toISOString(),
        progress: 100,
        status: DOWNLOAD_STATUS.COMPLETED,
        season: entry.season || undefined,
        episode: entry.episode || undefined,
      });

      // --- Encrypt and save video ---
      const videoPath = await encryptAndSaveVideo(result.filePath, contentDir);

      // --- Download and save subtitles (if available) ---
      if (entry.subtitles && entry.subtitles.length > 0) {
        for (const sub of entry.subtitles) {
          try {
            const subContent = await this.fetchSubtitle(sub.url);
            if (subContent) {
              await saveSubtitle(contentDir, sub.language || 'en', subContent);
            }
          } catch (subError) {
            console.warn('[DownloadManager] Subtitle download error:', subError);
          }
        }
      }

      // --- Hide from media scanner ---
      await hideFileFromMediaScanner(contentDir);

      // --- Update entry with new file path ---
      await updateDownloadEntry(downloadId, {
        filePath: contentDir,
        fileSize: result.fileSize || 0,
        completedAt: new Date().toISOString(),
        progress: 100,
      });

      this.notifyListeners('download-complete', {
        id: downloadId,
        ...result,
        filePath: contentDir,
        isEncrypted: true,
        contentDir,
      });

    } catch (error) {
      console.error('[DownloadManager] Complete error:', error);
      await this.handleError(downloadId, error);
    }

    this.processQueue();
  }

  async fetchSubtitle(url: string): Promise<string | null> {
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      return await response.text();
    } catch (error) {
      console.warn('[DownloadManager] Fetch subtitle error:', error);
      return null;
    }
  }

  async handleError(downloadId: string, error: any) {
    this.activeDownloads.delete(downloadId);

    await downloadQueue.markFailed(downloadId, error.message);

    this.notifyListeners('download-error', {
      id: downloadId,
      error: error.message,
    });

    this.processQueue();
  }

  async pauseDownload(downloadId: string) {
    const downloader = this.activeDownloads.get(downloadId);
    if (downloader) {
      downloader.pause();
      await downloadQueue.pause(downloadId);
      this.activeDownloads.delete(downloadId);
      this.notifyListeners('download-paused', { id: downloadId });
    }
  }

  async resumeDownload(downloadId: string) {
    const entry = await getDownloadEntry(downloadId);
    if (entry && entry.status === DOWNLOAD_STATUS.PAUSED) {
      await downloadQueue.resume(downloadId);
      this.notifyListeners('download-resumed', { id: downloadId });
      this.processQueue();
    }
  }

  async cancelDownload(downloadId: string) {
    const downloader = this.activeDownloads.get(downloadId);
    if (downloader) {
      downloader.cancel();
      this.activeDownloads.delete(downloadId);
    }

    await downloadQueue.remove(downloadId);
    await deleteDownload(downloadId);

    this.notifyListeners('download-cancelled', { id: downloadId });
  }

  async pauseAllActive() {
    for (const [downloadId, downloader] of this.activeDownloads) {
      downloader.pause();
      await downloadQueue.pause(downloadId);
    }
    this.activeDownloads.clear();
    this.pendingFetches.clear();
    this.notifyListeners('all-paused', {});
  }

  async cancelAllDownloads() {
    const downloadIds: string[] = [];

    for (const [downloadId, downloader] of this.activeDownloads) {
      downloader.cancel();
      downloadIds.push(downloadId);
    }

    const queuedItems = downloadQueue.getAll();
    for (const item of queuedItems) {
      if (!downloadIds.includes(item.id)) {
        downloadIds.push(item.id);
      }
    }

    this.activeDownloads.clear();
    this.pendingFetches.clear();
    await downloadQueue.clear();

    for (const downloadId of downloadIds) {
      await deleteDownload(downloadId);
    }

    this.notifyListeners('all-cancelled', {});
  }

  async cancelAllAndRetry() {
    const itemsToRetry: any[] = [];

    for (const [downloadId, downloader] of this.activeDownloads) {
      downloader.cancel();
      const entry = await getDownloadEntry(downloadId);
      if (entry) {
        itemsToRetry.push({
          mediaType: entry.mediaType,
          tmdbId: entry.tmdbId,
          title: entry.title,
          posterPath: entry.posterPath,
          season: entry.season,
          episode: entry.episode,
          episodeTitle: entry.episodeTitle,
          streamUrl: null,
          streamReferer: null,
        });
      }
    }

    const queuedItems = downloadQueue.getAll();
    for (const item of queuedItems) {
      if (!this.activeDownloads.has(item.id)) {
        itemsToRetry.push({
          mediaType: item.mediaType,
          tmdbId: item.tmdbId,
          title: item.title,
          posterPath: item.posterPath,
          season: item.season,
          episode: item.episode,
          episodeTitle: item.episodeTitle,
          streamUrl: null,
          streamReferer: null,
        });
      }
    }

    this.activeDownloads.clear();
    this.pendingFetches.clear();
    await downloadQueue.clear();

    for (const item of itemsToRetry) {
      const downloadId = generateDownloadId(item.mediaType, item.tmdbId, item.season, item.episode);
      await deleteDownload(downloadId);
    }

    for (const item of itemsToRetry) {
      try {
        await this.addToQueue(item);
      } catch (error) {
        // Skip items that fail to re-queue
      }
    }

    this.notifyListeners('all-retried', { count: itemsToRetry.length });
    return itemsToRetry.length;
  }

  async retryDownload(downloadId: string) {
    const entry = await getDownloadEntry(downloadId);
    if (entry && entry.status === DOWNLOAD_STATUS.FAILED) {
      await deleteDownload(downloadId);

      const newEntry = await this.addToQueue({
        mediaType: entry.mediaType,
        tmdbId: entry.tmdbId,
        title: entry.title,
        posterPath: entry.posterPath,
        season: entry.season,
        episode: entry.episode,
        episodeTitle: entry.episodeTitle,
        streamUrl: entry.streamUrl,
        streamReferer: entry.streamReferer,
      });

      return newEntry;
    }
    return null;
  }

  async setStreamUrlForDownload(downloadId: string, streamUrl: string, streamReferer: string | null = null) {
    await updateDownloadEntry(downloadId, { streamUrl, streamReferer });

    const queueItem = downloadQueue.getById(downloadId);
    if (queueItem) {
      queueItem.streamUrl = streamUrl;
      queueItem.streamReferer = streamReferer;
    }
  }

  async markAsWatched(downloadId: string) {
    return markDownloadAsWatched(downloadId);
  }

  async getDownload(downloadId: string) {
    return getDownloadEntry(downloadId);
  }

  async getAllDownloads() {
    return getAllDownloads();
  }

  async getCompletedDownloads() {
    const downloads = await getCompletedDownloads();
    const validDownloads = [];

    for (const entry of downloads) {
      try {
        // Check if the content directory exists
        const contentDir = await getSecureContentDirectory(
          entry.mediaType,
          entry.tmdbId,
          entry.season,
          entry.episode
        );

        const info = await LegacyFileSystem.getInfoAsync(contentDir);
        if (info.exists) {
          // Load metadata and info
          const metadata = await loadContentMetadata(contentDir);
          const downloadInfo = await loadDownloadInfo(contentDir);
          const subtitles = await getAvailableSubtitles(contentDir);

          validDownloads.push({
            ...entry,
            metadata,
            downloadInfo,
            subtitles,
            contentDir,
          });
        } else {
          await deleteDownload(entry.id);
        }
      } catch (error) {
        validDownloads.push(entry);
      }
    }

    return validDownloads;
  }

  async getActiveDownloads() {
    return downloadQueue.getAll();
  }

  async isDownloaded(mediaType: string, tmdbId: string, season: number | null = null, episode: number | null = null) {
    const downloadId = generateDownloadId(mediaType, tmdbId, season, episode);
    const entry = await getDownloadEntry(downloadId);

    if (entry?.status !== DOWNLOAD_STATUS.COMPLETED) {
      return false;
    }

    const contentDir = await getSecureContentDirectory(mediaType, tmdbId, season, episode);
    try {
      const info = await LegacyFileSystem.getInfoAsync(contentDir);
      if (!info.exists) {
        await deleteDownload(downloadId);
        return false;
      }
      return true;
    } catch (error) {
      return true;
    }
  }

  async getDownloadStatus(mediaType: string, tmdbId: string, season: number | null = null, episode: number | null = null) {
    const downloadId = generateDownloadId(mediaType, tmdbId, season, episode);
    const entry = await getDownloadEntry(downloadId);

    if (!entry) return null;

    if (entry.status === DOWNLOAD_STATUS.COMPLETED) {
      const contentDir = await getSecureContentDirectory(mediaType, tmdbId, season, episode);
      try {
        const info = await LegacyFileSystem.getInfoAsync(contentDir);
        if (!info.exists) {
          await deleteDownload(downloadId);
          return null;
        }
      } catch (error) {
        // If we can't check, assume it exists
      }
    }

    return entry.status;
  }

  async getDownloadProgress(mediaType: string, tmdbId: string, season: number | null = null, episode: number | null = null) {
    const downloadId = generateDownloadId(mediaType, tmdbId, season, episode);

    const queueItem = downloadQueue.getById(downloadId);
    if (queueItem) {
      return queueItem.progress;
    }

    const entry = await getDownloadEntry(downloadId);
    return entry?.progress || 0;
  }

  // --- Get content for playback ---
  async getContentForPlayback(
    mediaType: string,
    tmdbId: string,
    season: number | null = null,
    episode: number | null = null
  ): Promise<{
    videoPath: string;
    metadata: any;
    subtitles: string[];
    contentDir: string;
  } | null> {
    try {
      const contentDir = await getSecureContentDirectory(mediaType, tmdbId, season, episode);
      const info = await LegacyFileSystem.getInfoAsync(contentDir);
      if (!info.exists) return null;

      const videoPath = `${contentDir}video.nfx`;
      const videoInfo = await LegacyFileSystem.getInfoAsync(videoPath);
      if (!videoInfo.exists) return null;

      const metadata = await loadContentMetadata(contentDir);
      const subtitles = await getAvailableSubtitles(contentDir);

      return {
        videoPath,
        metadata,
        subtitles,
        contentDir,
      };
    } catch (error) {
      console.error('[DownloadManager] Get content error:', error);
      return null;
    }
  }

  // --- Decrypt content for playback ---
  async getDecryptedPlaybackPath(
    mediaType: string,
    tmdbId: string,
    season: number | null = null,
    episode: number | null = null
  ): Promise<{ tempPath: string; metadata: any; subtitles: string[] } | null> {
    try {
      const content = await this.getContentForPlayback(mediaType, tmdbId, season, episode);
      if (!content) return null;

      const tempPath = await decryptFileToTemp(content.videoPath);
      if (!tempPath) return null;

      return {
        tempPath,
        metadata: content.metadata,
        subtitles: content.subtitles,
      };
    } catch (error) {
      console.error('[DownloadManager] Decrypt error:', error);
      return null;
    }
  }

  // --- Cleanup temp file ---
  async cleanupPlaybackTemp(tempPath: string): Promise<void> {
    await cleanupTempFile(tempPath);
  }

  subscribe(callback: (event: string, data: any) => void) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  notifyListeners(event: string, data: any) {
    this.listeners.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        // Listener error, ignore
      }
    });
  }

  destroy() {
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
    }
    networkMonitor.stop();
    ffmpegConverter.destroy();
    this.activeDownloads.clear();
    this.pendingFetches.clear();
    this.listeners.clear();
    this.isInitialized = false;
  }
}

const downloadManager = new DownloadManager();
export default downloadManager;
