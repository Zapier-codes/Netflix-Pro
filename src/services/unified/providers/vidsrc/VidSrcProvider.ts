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

// This will hold the dynamically ordered sources.
// It's initialized with defaults from storage.js and then updated.
let currentStreamSources: StreamSourceConfig[] = [...storageDefaultSources.map((s: StorageSource) => ({
  name: s.name,
  baseUrl: s.defaultBaseUrl,  // Use defaultBaseUrl as baseUrl
  defaultBaseUrl: s.defaultBaseUrl,  // Keep the original defaultBaseUrl
  timeoutInSeconds: s.timeoutInSeconds,
  type: s.type,
}))];

// ============================================================================
// EXPORTED FUNCTIONS
// ============================================================================

/**
 * Initialize and refresh the stream source order from storage.
 */
export const initializeStreamSources = async (): Promise<StreamSourceConfig[]> => {
  const orderedSourcesFromStorage = await getStreamSourceOrder();
  currentStreamSources = orderedSourcesFromStorage.map((source: StorageSource) => ({
    name: source.name,
    baseUrl: source.defaultBaseUrl,  // Use defaultBaseUrl as baseUrl
    defaultBaseUrl: source.defaultBaseUrl,  // Keep the original defaultBaseUrl
    timeoutInSeconds: source.timeoutInSeconds,
    type: source.type,
  }));
  return currentStreamSources;
};

/**
 * Get the current active stream sources.
 * Returns defaults if not yet initialized.
 */
export const getActiveStreamSources = (): StreamSourceConfig[] => {
  if (!currentStreamSources || currentStreamSources.length === 0) {
    console.warn("[vidsrcApi] getActiveStreamSources: currentStreamSources not yet populated, returning mapped defaults.");
    return [...storageDefaultSources.map((s: StorageSource) => ({
      name: s.name,
      baseUrl: s.defaultBaseUrl,  // Use defaultBaseUrl as baseUrl
      defaultBaseUrl: s.defaultBaseUrl,  // Keep the original defaultBaseUrl
      timeoutInSeconds: s.timeoutInSeconds,
      type: s.type,
    }))];
  }
  return currentStreamSources;
};

/**
 * Get streaming URL for a given source's baseUrl, movie or TV show.
 * 
 * @param baseUrl - The base URL of the streaming source
 * @param tmdbId - The TMDB ID of the movie or show
 * @param type - The media type ('movie' or 'tv')
 * @param season - Optional season number for TV shows
 * @param episode - Optional episode number for TV shows
 * @returns The constructed streaming URL or null if invalid
 */
export const getStreamingUrl = (
  baseUrl: string,
  tmdbId: string,
  type: 'movie' | 'tv' = 'movie',
  season: number | null | undefined = null,
  episode: number | null | undefined = null
): string | null => {
  let path: string;

  // Validate TV shows have season and episode
  if (type === 'tv' && (season == null || episode == null)) {
    console.warn(`[vidsrcApi] TV show requires season and episode, got season: ${season}, episode: ${episode}`);
    return null;
  }

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

/**
 * Determine the media type (movie or tv) from a media object.
 */
export const getMediaType = (media: { title?: string; name?: string }): 'movie' | 'tv' => {
  return media.title ? 'movie' : 'tv';
};

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  initializeStreamSources,
  getActiveStreamSources,
  getStreamingUrl,
  getMediaType,
  DEFAULT_STREAM_SOURCES: storageDefaultSources,
};