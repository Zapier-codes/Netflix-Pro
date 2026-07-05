/**
 * Unified Stream Types
 * Defines all type interfaces for stream providers and normalized stream data
 */

// ============================================================================
// STREAM SOURCE TYPES
// ============================================================================

export interface StreamSource {
  id: string;
  provider: string;
  quality: StreamQuality;
  url: string;
  headers?: Record<string, string>;
  type: 'hls' | 'dash' | 'mp4' | 'mkv' | 'm3u8' | 'iframe' | 'direct';
  language?: string;
  subtitleUrl?: string;
  subtitles?: UnifiedSubtitleTrack[];
  isProxyRequired?: boolean;
  expiresAt?: number;
  duration?: number;
  size?: number;
}

export type StreamQuality = 
  | '4K' 
  | '2160p' 
  | '1440p' 
  | '1080p' 
  | '720p' 
  | '480p' 
  | '360p' 
  | '240p' 
  | '144p'
  | 'auto'
  | 'unknown';

export interface StreamRequest {
  mediaType: 'movie' | 'show' | 'episode';
  tmdbId?: number;
  imdbId?: string;
  tvdbId?: number;
  season?: number;
  episode?: number;
  title?: string;
  year?: number;
  language?: string;
}

export interface StreamResponse {
  sources: StreamSource[];
  subtitles: UnifiedSubtitleTrack[];
  meta?: StreamMeta;
}

export interface StreamMeta {
  title: string;
  duration?: number;
  season?: number;
  episode?: number;
  episodeTitle?: string;
  poster?: string;
  backdrop?: string;
}

// ============================================================================
// SUBTITLE TYPES
// ============================================================================

export interface UnifiedSubtitleTrack {
  id: string;
  url: string;
  lang: string;
  language: string;
  label: string;
  format: 'srt' | 'vtt' | 'ass' | 'ssa';
  isDefault?: boolean;
  isForced?: boolean;
  isSDH?: boolean;
  provider: string;
  rating?: number;
  downloadCount?: number;
}

export interface SubtitleSearchRequest {
  imdbId?: string;
  tmdbId?: number;
  tvdbId?: number;
  title?: string;
  year?: number;
  season?: number;
  episode?: number;
  language?: string;
  forced?: boolean;
  hearingImpaired?: boolean;
}

export interface SubtitleProvider {
  name: string;
  search(request: SubtitleSearchRequest): Promise<UnifiedSubtitleTrack[]>;
  download(track: UnifiedSubtitleTrack): Promise<string>;
}

// ============================================================================
// PROVIDER TYPES
// ============================================================================

export interface StreamProvider {
  name: string;
  id: string;
  isEnabled: boolean;
  priority: number;
  supportsMovies: boolean;
  supportsShows: boolean;
  supportsEpisodes: boolean;
  
  getStreams(request: StreamRequest): Promise<StreamSource[]>;
  isAvailable(): Promise<boolean>;
}

export interface ProviderCapabilities {
  movies: boolean;
  shows: boolean;
  episodes: boolean;
  subtitles: boolean;
  metadata: boolean;
  maxQuality: StreamQuality;
  requiresAuth: boolean;
  supportsProxy: boolean;
}

// ============================================================================
// NORMALIZED TYPES
// ============================================================================

export interface NormalizedStream {
  id: string;
  url: string;
  quality: StreamQuality;
  originalQuality: string;
  provider: string;
  type: StreamSource['type'];
  headers: Record<string, string>;
  subtitles: UnifiedSubtitleTrack[];
  isHLS: boolean;
  isDASH: boolean;
  duration?: number;
  size?: number;
}

export interface StreamCacheEntry {
  key: string;
  data: NormalizedStream;
  expiresAt: number;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export class StreamError extends Error {
  constructor(
    message: string,
    public code: string,
    public provider?: string,
    public isRetryable: boolean = false
  ) {
    super(message);
    this.name = 'StreamError';
  }
}

export type StreamErrorCode = 
  | 'PROVIDER_UNAVAILABLE'
  | 'NO_SOURCES_FOUND'
  | 'INVALID_REQUEST'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'PARSE_ERROR'
  | 'PROXY_REQUIRED'
  | 'EXPIRED';

// ============================================================================
// CONFIG TYPES
// ============================================================================

export interface StreamProviderConfig {
  id: string;
  enabled: boolean;
  priority: number;
  timeout: number;
  retryCount: number;
  apiKey?: string;
  baseUrl?: string;
  customHeaders?: Record<string, string>;
}

export interface UnifiedStreamConfig {
  providers: StreamProviderConfig[];
  cacheEnabled: boolean;
  cacheDuration: number;
  maxSourcesPerProvider: number;
  preferProxy: boolean;
  defaultLanguage: string;
  fallbackLanguages: string[];
}