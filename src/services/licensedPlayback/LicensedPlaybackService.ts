// src/services/licensedPlayback/LicensedPlaybackService.ts
//
// Client for a licensed video backend that the app owner provides and
// operates themselves (a real licensing/streaming deal, not a scraped or
// bypassed source). This file intentionally contains no provider logic,
// no scraping, and no embedded API keys for any third-party site — it's
// a thin, generic HTTP client pointed at a URL/key supplied via env vars.
//
// Configure via (e.g. in a local .env, never committed):
//   EXPO_PUBLIC_LICENSED_BACKEND_URL=https://your-backend.example.com
//   EXPO_PUBLIC_LICENSED_BACKEND_API_KEY=your-key
//
// Expected backend contract (adjust to match your real API and update the
// request/response shapes below accordingly):
//   GET  {baseUrl}/v1/playback?tmdbId=...&mediaType=movie|tv&season=&episode=
//        -> { url: string, type: 'hls' | 'dash' | 'mp4', headers?: Record<string,string>, expiresAt?: string }
//   GET  {baseUrl}/v1/download?tmdbId=...&mediaType=movie|tv&season=&episode=
//        -> { url: string, headers?: Record<string,string> }

export type LicensedMediaType = 'movie' | 'tv';

export interface LicensedPlaybackSource {
  url: string;
  type: 'hls' | 'dash' | 'mp4';
  headers?: Record<string, string>;
  expiresAt?: string;
}

export interface LicensedDownloadSource {
  url: string;
  headers?: Record<string, string>;
}

export interface LicensedPlaybackRequest {
  tmdbId: string | number;
  mediaType: LicensedMediaType;
  season?: number;
  episode?: number;
}

const BASE_URL = process.env.EXPO_PUBLIC_LICENSED_BACKEND_URL ?? '';
const API_KEY = process.env.EXPO_PUBLIC_LICENSED_BACKEND_API_KEY ?? '';

/** True once EXPO_PUBLIC_LICENSED_BACKEND_URL has been set. */
export function isLicensedBackendConfigured(): boolean {
  return BASE_URL.length > 0;
}

function buildQuery(req: LicensedPlaybackRequest): string {
  const params = new URLSearchParams({
    tmdbId: String(req.tmdbId),
    mediaType: req.mediaType,
  });
  if (req.mediaType === 'tv') {
    if (req.season != null) params.set('season', String(req.season));
    if (req.episode != null) params.set('episode', String(req.episode));
  }
  return params.toString();
}

async function callBackend<T>(path: string, req: LicensedPlaybackRequest, timeoutMs = 15000): Promise<T> {
  if (!isLicensedBackendConfigured()) {
    throw new Error(
      'No licensed video backend configured. Set EXPO_PUBLIC_LICENSED_BACKEND_URL ' +
      '(and EXPO_PUBLIC_LICENSED_BACKEND_API_KEY if your backend requires it) to enable playback.'
    );
  }

  const url = `${BASE_URL.replace(/\/$/, '')}${path}?${buildQuery(req)}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: API_KEY ? { Authorization: `Bearer ${API_KEY}` } : undefined,
    });

    if (!response.ok) {
      throw new Error(`Licensed backend returned ${response.status} for ${path}`);
    }

    const data = await response.json();
    if (!data || !data.url) {
      throw new Error('Licensed backend response missing a playback url');
    }
    return data as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Resolve a playable source for the given title from the licensed backend.
 * Throws if no backend is configured or the backend has no source for
 * this title — callers should catch this and show a clear
 * "not available" state rather than falling back to any other source.
 */
export async function getPlaybackSource(req: LicensedPlaybackRequest): Promise<LicensedPlaybackSource> {
  return callBackend<LicensedPlaybackSource>('/v1/playback', req);
}

/**
 * Resolve a downloadable source for the given title from the licensed
 * backend. Same contract/caveats as getPlaybackSource.
 */
export async function getDownloadSource(req: LicensedPlaybackRequest): Promise<LicensedDownloadSource> {
  return callBackend<LicensedDownloadSource>('/v1/download', req);
}

export default {
  isLicensedBackendConfigured,
  getPlaybackSource,
  getDownloadSource,
};
