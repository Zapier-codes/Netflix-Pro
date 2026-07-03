// src/services/downloadManager/FFmpegConverter.ts
import { FFmpegKit, FFmpegKitConfig, ReturnCode, Level } from 'ffmpeg-kit-react-native';
import { AppState } from 'react-native';
import * as LegacyFileSystem from 'expo-file-system/legacy';

class FFmpegConverter {
  private isConverting: boolean = false;
  private currentSessionId: string | null = null;
  private appState: string = 'active'; // Safe default
  private appStateSubscription: any = null;
  private onProgressCallback: ((data: any) => void) | null = null;
  private wasCancelledDueToBackground: boolean = false;
  private conversionQueue: Array<{
    segmentsDir: string;
    outputPath: string;
    onProgress: ((data: any) => void) | undefined;
    resolve: (value: any) => void;
    reject: (error: Error) => void;
  }> = [];
  private isProcessingQueue: boolean = false;
  private isInitialized: boolean = false;

  async initialize() {
    if (this.isInitialized) return;
    
    try {
      // Check if FFmpegKitConfig is available
      if (FFmpegKitConfig && typeof FFmpegKitConfig.setLogLevel === 'function') {
        FFmpegKitConfig.setLogLevel(Level.AV_LOG_QUIET);
        console.log('[FFmpegConverter] Initialized successfully');
      } else {
        console.warn('[FFmpegConverter] FFmpegKitConfig not available');
      }
      
      // Safely get current app state
      try {
        this.appState = AppState.currentState || 'active';
      } catch {
        this.appState = 'active';
      }
      
      // Only add listener if AppState is available
      if (AppState && typeof AppState.addEventListener === 'function') {
        this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);
      }
      
      this.isInitialized = true;
    } catch (error) {
      console.warn('[FFmpegConverter] Initialization failed:', error);
      // Don't throw - allow app to continue without FFmpeg
    }
  }

  destroy() {
    if (this.appStateSubscription) {
      try {
        this.appStateSubscription.remove();
      } catch (error) {
        // Ignore unsubscribe errors
      }
      this.appStateSubscription = null;
    }
    this.cancelConversion();
    this.conversionQueue = [];
    this.isInitialized = false;
  }

  handleAppStateChange = (nextAppState: string) => {
    if (this.appState === 'active' && nextAppState.match(/inactive|background/)) {
      if (this.isConverting) {
        this.wasCancelledDueToBackground = true;
        this.cancelConversion();
      }
    }
    this.appState = nextAppState;
  };

  async convertHLSToMP4(segmentsDir: string, outputPath: string, onProgress?: (data: any) => void) {
    // Ensure FFmpeg is initialized
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    return new Promise((resolve, reject) => {
      this.conversionQueue.push({
        segmentsDir,
        outputPath,
        onProgress: onProgress || undefined,
        resolve,
        reject
      });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.isProcessingQueue || this.conversionQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.conversionQueue.length > 0) {
      const job = this.conversionQueue.shift();
      if (!job) continue;
      try {
        const result = await this.executeConversion(job.segmentsDir, job.outputPath, job.onProgress);
        job.resolve(result);
      } catch (error) {
        job.reject(error instanceof Error ? error : new Error(String(error)));
      }
    }

    this.isProcessingQueue = false;
  }

  async executeConversion(segmentsDir: string, outputPath: string, onProgress?: (data: any) => void) {
    // Ensure FFmpeg is initialized
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    this.isConverting = true;
    this.wasCancelledDueToBackground = false;
    this.onProgressCallback = onProgress || null;

    try {
      const segmentsDirClean = segmentsDir.replace('file://', '');
      const outputPathClean = outputPath.replace('file://', '');

      const segmentFiles = await this.getSegmentFiles(segmentsDirClean);
      if (segmentFiles.length === 0) {
        throw new Error('No segment files found');
      }

      const hasInit = await this.hasInitSegment(segmentsDirClean);
      const isFragmentedMp4 = segmentFiles[0]?.endsWith('.m4s') || hasInit;

      // Create an HLS playlist with discontinuity markers for missing segments
      const playlistPath = `${segmentsDirClean}ffmpeg_playlist.m3u8`;
      let playlistContent = '#EXTM3U\n';
      playlistContent += '#EXT-X-VERSION:3\n';
      playlistContent += '#EXT-X-TARGETDURATION:10\n';
      playlistContent += '#EXT-X-MEDIA-SEQUENCE:0\n';
      playlistContent += '#EXT-X-PLAYLIST-TYPE:VOD\n';

      if (isFragmentedMp4 && hasInit) {
        playlistContent += `#EXT-X-MAP:URI="${segmentsDirClean}init.mp4"\n`;
      }

      // Parse segment numbers and detect gaps
      const segmentNumbers = segmentFiles.map(f => {
        const match = f.match(/segment_(\d+)/);
        return match ? parseInt(match[1]) : -1;
      }).filter(n => n >= 0);

      let lastSegmentNum = -1;
      for (let i = 0; i < segmentFiles.length; i++) {
        const currentNum = segmentNumbers[i] || i;

        // Add discontinuity marker if there's a gap in segment numbers
        if (lastSegmentNum >= 0 && currentNum !== lastSegmentNum + 1) {
          playlistContent += '#EXT-X-DISCONTINUITY\n';
        }

        playlistContent += '#EXTINF:4.5,\n';
        playlistContent += `${segmentsDirClean}${segmentFiles[i]}\n`;
        lastSegmentNum = currentNum;
      }

      playlistContent += '#EXT-X-ENDLIST\n';

      await LegacyFileSystem.writeAsStringAsync(playlistPath, playlistContent);

      // Use HLS demuxer which handles discontinuities properly
      const command = [
        '-allowed_extensions', 'ALL',
        '-i', playlistPath,
        '-c', 'copy',
        '-movflags', '+faststart',
        '-y',
        outputPathClean
      ].join(' ');

      if (onProgress) {
        FFmpegKitConfig.enableStatisticsCallback((statistics) => {
          if (this.onProgressCallback) {
            const time = statistics.getTime();
            this.onProgressCallback({
              time,
              phase: 'converting'
            });
          }
        });
      }

      const session = await FFmpegKit.execute(command);
      this.currentSessionId = session.getSessionId();

      const returnCode = await session.getReturnCode();

      // Clean up playlist file
      try {
        await LegacyFileSystem.deleteAsync(playlistPath, { idempotent: true });
      } catch (cleanupError) {
        // Ignore cleanup errors
      }

      if (ReturnCode.isSuccess(returnCode)) {
        const outputFileInfo = await LegacyFileSystem.getInfoAsync(outputPathClean);
        const fileSize = outputFileInfo.exists ? (outputFileInfo.size || 0) : 0;

        this.isConverting = false;
        this.currentSessionId = null;

        return {
          success: true,
          filePath: outputPath,
          fileSize
        };
      } else if (ReturnCode.isCancel(returnCode)) {
        this.isConverting = false;
        this.currentSessionId = null;

        return {
          success: false,
          cancelled: true,
          cancelledDueToBackground: this.wasCancelledDueToBackground
        };
      } else {
        const logs = await session.getAllLogsAsString();
        console.error(`[FFmpegConverter] Conversion failed:`, logs);
        this.isConverting = false;
        this.currentSessionId = null;

        throw new Error('FFmpeg conversion failed: ' + (logs || 'Unknown error'));
      }
    } catch (error) {
      this.isConverting = false;
      this.currentSessionId = null;
      throw error;
    }
  }

  async getSegmentFiles(segmentsDir: string): Promise<string[]> {
    try {
      const contents = await LegacyFileSystem.readDirectoryAsync(segmentsDir);
      const segmentFiles = contents
        .filter(file => file.endsWith('.ts') || file.endsWith('.m4s'))
        .filter(file => file.startsWith('segment_'))
        .sort((a, b) => {
          const numA = parseInt(a.match(/segment_(\d+)/)?.[1] || '0');
          const numB = parseInt(b.match(/segment_(\d+)/)?.[1] || '0');
          return numA - numB;
        });
      return segmentFiles;
    } catch (error) {
      return [];
    }
  }

  async hasInitSegment(segmentsDir: string): Promise<boolean> {
    try {
      const contents = await LegacyFileSystem.readDirectoryAsync(segmentsDir);
      return contents.includes('init.mp4');
    } catch (error) {
      return false;
    }
  }

  async cancelConversion() {
    if (this.currentSessionId) {
      try {
        await FFmpegKit.cancel(this.currentSessionId);
      } catch (error) {
        // Ignore cancellation errors
      }
    }
    this.isConverting = false;
    this.currentSessionId = null;
  }

  getIsConverting() {
    return this.isConverting;
  }
}

const ffmpegConverter = new FFmpegConverter();
export default ffmpegConverter;