// src/services/licensedPlayback/LicensedPlaybackService.ts
//
// Client for a licensed video backend that the app owner provides and
// operates themselves (a real licensing/streaming deal, not a scraped or
// bypassed source). This file intentionally contains no provider logic,
// no scraping, and no embedded API keys for any third-party site — it's
// a thin, generic HTTP client pointed at a URL/key.
//
// ── REPLACE THIS WITH YOUR REAL RENDER URL ──────────────────────────────
// DEFAULT_BASE_URL below is a PLACEHOLDER pointing at a Render app that
// does not exist yet. The moment you deploy your real backend to Render,
// either:
//   (a) edit DEFAULT_BASE_URL below to your real
//       `https://<your-service-name>.onrender.com`, or
//   (b) (preferred — no code edit, no rebuild) set
//       EXPO_PUBLIC_LICENSED_BACKEND_URL in a local .env file, which
//       always overrides the placeholder. See .env.example at the repo
//       root.
// Everything else in this file — request shape, response shape, retry/
// timeout handling — is already fully wired and doesn't need to change
// just because the URL changes.
//
// Configure via (e.g. in a local .env, gitignored, never committed):
//   EXPO_PUBLIC_LICENSED_BACKEND_URL=https://your-real-backend.onrender.com
//   EXPO_PUBLIC_LICENSED_BACKEND_API_KEY=your-key
//
// Expected backend contract (adjust to match your real API and update the
// request/response shapes below accordingly):
//   GET  {baseUrl}/v1/playback?tmdbId=...&mediaType=movie|tv&season=&episode=
//        -> { url: string, type: 'hls' | 'dash' | 'mp4', headers?: Record<string,string>, expiresAt?: string }
//   GET  {baseUrl}/v1/download?tmdbId=...&mediaType=movie|tv&season=&episode=
//        -> { url: string, headers?: Record<string,string> }
//
// ── RENDER FREE-TIER COLD STARTS ────────────────────────────────────────
// Render's free web-service tier spins the service down after ~15 minutes
// of inactivity. The next request after that has to wait for a full
// cold start — commonly 30-60+ seconds — before it gets a response at
// all. A naive short timeout would abort and fail every single "first
// request after idle," which for a video app is most requests. To handle
// this without forcing every request to always wait a full minute:
//   1. First attempt uses a short-ish timeout (FAST_TIMEOUT_MS).
//   2. If that attempt times out (not a 4xx/5xx — specifically a client-
//      side abort), retry once with a much longer timeout
//      (COLD_START_TIMEOUT_MS) to give a sleeping instance time to wake.
//   3. Any real HTTP error response (4xx/5xx) is NOT retried — that's a
//      real backend answer, not a cold start, and retrying would just
//      hide a genuine error.
// If you're on a paid Render tier (no spin-down) this retry essentially
// never triggers and costs nothing extra.

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

// PLACEHOLDER — see the header comment above for how to replace this.
const DEFAULT_BASE_URL = 'https://netflix-pro-backend.onrender.com';

const BASE_URL = process.env.EXPO_PUBLIC_LICENSED_BACKEND_URL || DEFAULT_BASE_URL;
const API_KEY = process.env.EXPO_PUBLIC_LICENSED_BACKEND_API_KEY ?? '';
const USING_PLACEHOLDER_URL = !process.env.EXPO_PUBLIC_LICENSED_BACKEND_URL;

const FAST_TIMEOUT_MS = 12000;
const COLD_START_TIMEOUT_MS = 65000;

/**
 * True as long as a base URL is set — including the placeholder. This
 * only tells callers "a request can be attempted," not "a real backend
 * is configured." Use isUsingPlaceholderBackend() to distinguish those.
 */
export function isLicensedBackendConfigured(): boolean {
  return BASE_URL.length > 0;
}

/** True until EXPO_PUBLIC_LICENSED_BACKEND_URL is set, i.e. still pointed at the placeholder Render URL. */
export function isUsingPlaceholderBackend(): boolean {
  return USING_PLACEHOLDER_URL;
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

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: API_KEY ? { Authorization: `Bearer ${API_KEY}` } : undefined,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

async function callBackend<T>(path: string, req: LicensedPlaybackRequest): Promise<T> {
  if (!isLicensedBackendConfigured()) {
    // Not actually reachable given DEFAULT_BASE_URL is always non-empty,
    // but kept as a guard in case BASE_URL is ever cleared entirely.
    throw new Error(
      'No licensed video backend configured. Set EXPO_PUBLIC_LICENSED_BACKEND_URL ' +
      '(and EXPO_PUBLIC_LICENSED_BACKEND_API_KEY if your backend requires it) to enable playback.'
    );
  }

  const url = `${BASE_URL.replace(/\/$/, '')}${path}?${buildQuery(req)}`;

  let response: Response;
  try {
    response = await fetchWithTimeout(url, FAST_TIMEOUT_MS);
  } catch (error) {
    if (!isAbortError(error)) throw error;
    // Likely a Render cold start — retry once with a much longer timeout.
    console.warn(`[LicensedPlayback] First attempt timed out after ${FAST_TIMEOUT_MS}ms — retrying with a longer timeout in case the backend is waking from a cold start...`);
    response = await fetchWithTimeout(url, COLD_START_TIMEOUT_MS);
  }

  if (!response.ok) {
    if (USING_PLACEHOLDER_URL) {
      throw new Error(
        `Licensed backend returned ${response.status} for ${path}. ` +
        `This app is still pointed at a placeholder backend URL (${DEFAULT_BASE_URL}) — ` +
        `set EXPO_PUBLIC_LICENSED_BACKEND_URL to your real Render URL to fix this.`
      );
    }
    throw new Error(`Licensed backend returned ${response.status} for ${path}`);
  }

  const data = await response.json();
  if (!data || !data.url) {
    throw new Error('Licensed backend response missing a playback url');
  }
  return data as T;
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
  isUsingPlaceholderBackend,
  getPlaybackSource,
  getDownloadSource,
};
