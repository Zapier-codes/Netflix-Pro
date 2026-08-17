// src/hooks/useLicensedPlaybackSource.ts
//
// Replaces the old useStreamExtraction hook (multi-provider scrape/bypass
// pipeline, deleted in the piracy-removal pass). A licensed backend
// returns one direct, playable URL per title — there's no source
// cascade, no embed/iframe fallback, and no torrent fallback to manage,
// so this hook is intentionally much smaller than what it replaces.

import { useEffect, useState, useCallback } from 'react';
import { getPlaybackSource, LicensedPlaybackSource } from '../services/licensedPlayback/LicensedPlaybackService';

export interface UseLicensedPlaybackSourceParams {
  mediaId: string;
  mediaType: string; // 'movie' | 'tv'
  season?: number;
  episode?: number;
  isOffline?: boolean;
  offlineFilePath?: string;
  directStreamUrl?: string | null; // pre-resolved URL passed in via navigation params, if any
}

export interface UseLicensedPlaybackSourceResult {
  videoUrl: string | null;
  isResolved: boolean;
  isLoading: boolean;
  error: string | null;
}

export function useLicensedPlaybackSource(params: UseLicensedPlaybackSourceParams): UseLicensedPlaybackSourceResult {
  const { mediaId, mediaType, season, episode, isOffline, offlineFilePath, directStreamUrl } = params;

  const [videoUrl, setVideoUrl] = useState<string | null>(directStreamUrl || null);
  const [isResolved, setIsResolved] = useState<boolean>(!!directStreamUrl || !!isOffline);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const resolve = useCallback(async () => {
    if (isOffline && offlineFilePath) {
      setVideoUrl(offlineFilePath);
      setIsResolved(true);
      return;
    }
    if (directStreamUrl) {
      setVideoUrl(directStreamUrl);
      setIsResolved(true);
      return;
    }
    if (!mediaId) return;

    setIsLoading(true);
    setError(null);
    try {
      const source: LicensedPlaybackSource = await getPlaybackSource({
        tmdbId: mediaId,
        mediaType: mediaType === 'tv' ? 'tv' : 'movie',
        season,
        episode,
      });
      setVideoUrl(source.url);
      setIsResolved(true);
    } catch (err) {
      console.warn('[useLicensedPlaybackSource] Failed to resolve playback source:', err);
      setError(err instanceof Error ? err.message : 'Playback is not available for this title yet.');
      setIsResolved(true);
    } finally {
      setIsLoading(false);
    }
  }, [mediaId, mediaType, season, episode, isOffline, offlineFilePath, directStreamUrl]);

  useEffect(() => {
    resolve();
  }, [resolve]);

  return { videoUrl, isResolved, isLoading, error };
}

export default useLicensedPlaybackSource;
