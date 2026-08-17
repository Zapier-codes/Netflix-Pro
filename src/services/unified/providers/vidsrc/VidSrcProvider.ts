// src/services/unified/providers/vidsrc/VidSrcProvider.ts

import { getStreamSourceOrder, DEFAULT_STREAM_SOURCES as storageDefaultSources } from '../../../../utils/storage';

// ============================================================================
// TYPES
// ============================================================================

export interface StreamSourceConfig {
  name: string;
  baseUrl: string;
  defaultBaseUrl: string;
  timeoutInSeconds: number;
  type: string;
}

export interface StorageSource {
  name: string;
  defaultBaseUrl: string;
  timeoutInSeconds: number;
  type: string;
}

// ============================================================================
// STATE
// ============================================================================

let currentStreamSources: StreamSourceConfig[] = [...storageDefaultSources.map((s: StorageSource) => ({
  name: s.name,
  baseUrl: s.defaultBaseUrl,
  defaultBaseUrl: s.defaultBaseUrl,
  timeoutInSeconds: s.timeoutInSeconds,
  type: s.type,
}))];

// ============================================================================
// EXPORTED FUNCTIONS
// ============================================================================

export const initializeStreamSources = async (): Promise<StreamSourceConfig[]> => {
  const orderedSourcesFromStorage = await getStreamSourceOrder();
  currentStreamSources = orderedSourcesFromStorage.map((source: StorageSource) => ({
    name: source.name,
    baseUrl: source.defaultBaseUrl,
    defaultBaseUrl: source.defaultBaseUrl,
    timeoutInSeconds: source.timeoutInSeconds,
    type: source.type,
  }));
  return currentStreamSources;
};

export const getActiveStreamSources = (): StreamSourceConfig[] => {
  if (!currentStreamSources || currentStreamSources.length === 0) {
    console.warn("[vidsrcApi] getActiveStreamSources: currentStreamSources not yet populated, returning mapped defaults.");
    return [...storageDefaultSources.map((s: StorageSource) => ({
      name: s.name,
      baseUrl: s.defaultBaseUrl,
      defaultBaseUrl: s.defaultBaseUrl,
      timeoutInSeconds: s.timeoutInSeconds,
      type: s.type,
    }))];
  }
  return currentStreamSources;
};

export const getStreamingUrl = (
  baseUrl: string,
  tmdbId: string,
  type: 'movie' | 'tv' = 'movie',
  season: number | null | undefined = null,
  episode: number | null | undefined = null
): string | null => {
  // FIXED: reject empty or non-string baseUrl before any string operations
  if (!baseUrl || typeof baseUrl !== 'string') {
    console.warn('[vidsrcApi] Invalid baseUrl provided:', baseUrl);
    return null;
  }

  let path: string;

  if (type === 'tv' && (season == null || episode == null)) {
    console.warn(`[vidsrcApi] TV show requires season and episode, got season: ${season}, episode: ${episode}`);
    return null;
  }

  // Normalize first so every branch uses a clean baseUrl
  baseUrl = baseUrl.replace(/\/+$/, '');

  // Handle vidsrc.cc special URL format
  if (baseUrl.includes('vidsrc.cc')) {
    let url = baseUrl;
    if (type === 'tv' && season != null && episode != null) {
      url += `/tv/${tmdbId}/${season}/${episode}`;
    } else if (type === 'movie') {
      url += `/movie/${tmdbId}`;
    } else {
      console.warn(`[vidsrcApi] Invalid type or missing season/episode for TV: ${type}`);
      return null;
    }
    return `${url}?autoPlay=false`;
  }

  // Standard URL format for other providers
  if (type === 'tv' && season != null && episode != null) {
    path = `/tv/${tmdbId}/${season}/${episode}`;
  } else if (type === 'movie') {
    path = `/movie/${tmdbId}`;
  } else {
    console.warn(`[vidsrcApi] Invalid type or missing season/episode for TV: ${type}`);
    return null;
  }

  return `${baseUrl}${path}`;
};

export const getMediaType = (media: { title?: string; name?: string }): 'movie' | 'tv' => {
  return media.title ? 'movie' : 'tv';
};

export default {
  initializeStreamSources,
  getActiveStreamSources,
  getStreamingUrl,
  getMediaType,
  DEFAULT_STREAM_SOURCES: storageDefaultSources,
};