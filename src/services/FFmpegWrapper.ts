// src/services/FFmpegWrapper.ts
import { Platform } from 'react-native';

console.log('[FFMPEG_WRAPPER] Loading ffmpeg-kit wrapper...');

let FFmpegKit: any = null;
let FFmpegKitConfig: any = null;
let ReturnCode: any = null;
let Level: any = null;
let isLoaded = false;

export const loadFFmpeg = async () => {
  try {
    console.log('[FFMPEG_WRAPPER] Attempting to load ffmpeg-kit...');
    
    if (Platform.OS === 'web') {
      console.log('[FFMPEG_WRAPPER] Skipping ffmpeg-kit on web');
      return null;
    }

    const module = await import('ffmpeg-kit-react-native');
    
    FFmpegKit = module.FFmpegKit;
    FFmpegKitConfig = module.FFmpegKitConfig;
    ReturnCode = module.ReturnCode;
    Level = module.Level;
    isLoaded = true;
    
    console.log('[FFMPEG_WRAPPER] ✅ ffmpeg-kit loaded successfully');
    
    try {
      if (FFmpegKitConfig && FFmpegKitConfig.setLogLevel) {
        FFmpegKitConfig.setLogLevel(Level?.AV_LOG_QUIET || 0);
        console.log('[FFMPEG_WRAPPER] ✅ Log level set');
      }
    } catch (e) {
      console.warn('[FFMPEG_WRAPPER] ⚠️ Could not set log level:', e);
    }
    
    return { FFmpegKit, FFmpegKitConfig, ReturnCode, Level };
  } catch (error) {
    console.warn('[FFMPEG_WRAPPER] ⚠️ Could not load ffmpeg-kit:', error);
    isLoaded = false;
    return null;
  }
};

export const getFFmpegKit = () => FFmpegKit;
export const getFFmpegKitConfig = () => FFmpegKitConfig;
export const getReturnCode = () => ReturnCode;
export const getLevel = () => Level;
export const isFFmpegLoaded = () => isLoaded;

export default {
  loadFFmpeg,
  getFFmpegKit,
  getFFmpegKitConfig,
  getReturnCode,
  getLevel,
  isFFmpegLoaded,
};
