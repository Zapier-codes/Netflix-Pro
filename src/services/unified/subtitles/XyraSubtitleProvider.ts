/**
 * XyraSubtitleProvider.ts
 * Subtitle provider for Xyra subtitle service
 * Handles fetching, parsing, and formatting subtitle data from Xyra
 */

// ==================== TYPES ====================

export interface XyraSubtitleTrack {
  id: string;
  language: string;
  languageCode: string;
  label: string;
  url: string;
  format: 'srt' | 'vtt' | 'ass' | 'ssa';
  isDefault: boolean;
  isForced: boolean;
  isHearingImpaired: boolean;
  source: string;
  confidence: number; // 0-1 match confidence
}

export interface XyraSubtitleSearchParams {
  query?: string;
  imdbId?: string;
  tmdbId?: number;
  tvdbId?: number;
  season?: number;
  episode?: number;
  language?: string;
  year?: number;
  type: 'movie' | 'episode';
}

export interface XyraSubtitleDownloadResult {
  content: string;
  format: string;
  encoding: string;
  track: XyraSubtitleTrack;
}

// ==================== CONFIGURATION ====================

const XYRA_API_BASE = 'https://api.xyra.io/v1';
const XYRA_TIMEOUT_MS = 15000;

// ==================== ERROR HANDLING ====================

class XyraSubtitleError extends Error {
  constructor(message: string, public code: string, public statusCode?: number) {
    super(message);
    this.name = 'XyraSubtitleError';
  }
}

// ==================== PROVIDER CLASS ====================

export class XyraSubtitleProvider {
  private apiKey: string | null;
  private baseUrl: string;
  private timeout: number;

  constructor(apiKey?: string, baseUrl: string = XYRA_API_BASE, timeout: number = XYRA_TIMEOUT_MS) {
    this.apiKey = apiKey || null;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.timeout = timeout;
  }

  /**
   * Set or update the API key
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  /**
   * Get default headers for API requests
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'Flux-App/1.0.0',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    return headers;
  }

  /**
   * Generic fetch wrapper with timeout and error handling
   */
  private async fetchWithTimeout<T>(
    endpoint: string,
    options: RequestInit = {},
    params?: Record<string, string | number | boolean | undefined>
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${endpoint}`);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url.toString(), {
        ...options,
        headers: { ...this.getHeaders(), ...options.headers },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new XyraSubtitleError(
          `Xyra API error ${response.status}: ${errorText}`,
          'API_ERROR',
          response.status
        );
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        return response.json() as Promise<T>;
      }

      return response.text() as Promise<T>;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof XyraSubtitleError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new XyraSubtitleError('Request timeout', 'TIMEOUT');
        }
        throw new XyraSubtitleError(error.message, 'NETWORK_ERROR');
      }

      throw new XyraSubtitleError('Unknown error occurred', 'UNKNOWN');
    }
  }

  /**
   * Search for subtitles by various identifiers
   */
  async searchSubtitles(params: XyraSubtitleSearchParams): Promise<XyraSubtitleTrack[]> {
    const searchParams: Record<string, string | number> = {
      type: params.type,
    };

    if (params.query) searchParams.query = params.query;
    if (params.imdbId) searchParams.imdb_id = params.imdbId;
    if (params.tmdbId) searchParams.tmdb_id = params.tmdbId;
    if (params.tvdbId) searchParams.tvdb_id = params.tvdbId;
    if (params.season !== undefined) searchParams.season = params.season;
    if (params.episode !== undefined) searchParams.episode = params.episode;
    if (params.language) searchParams.language = params.language;
    if (params.year) searchParams.year = params.year;

    const response = await this.fetchWithTimeout<{ tracks: XyraSubtitleTrack[] }>(
      '/subtitles/search',
      { method: 'GET' },
      searchParams
    );

    return response.tracks || [];
  }

  /**
   * Search subtitles by IMDB ID
   */
  async searchByImdbId(
    imdbId: string,
    type: 'movie' | 'episode',
    season?: number,
    episode?: number,
    language?: string
  ): Promise<XyraSubtitleTrack[]> {
    return this.searchSubtitles({
      imdbId,
      type,
      season,
      episode,
      language,
    });
  }

  /**
   * Search subtitles by TMDB ID
   */
  async searchByTmdbId(
    tmdbId: number,
    type: 'movie' | 'episode',
    season?: number,
    episode?: number,
    language?: string
  ): Promise<XyraSubtitleTrack[]> {
    return this.searchSubtitles({
      tmdbId,
      type,
      season,
      episode,
      language,
    });
  }

  /**
   * Search subtitles by TVDB ID
   */
  async searchByTvdbId(
    tvdbId: number,
    type: 'movie' | 'episode',
    season?: number,
    episode?: number,
    language?: string
  ): Promise<XyraSubtitleTrack[]> {
    return this.searchSubtitles({
      tvdbId,
      type,
      season,
      episode,
      language,
    });
  }

  /**
   * Search subtitles by title query
   */
  async searchByQuery(
    query: string,
    type: 'movie' | 'episode',
    year?: number,
    season?: number,
    episode?: number,
    language?: string
  ): Promise<XyraSubtitleTrack[]> {
    return this.searchSubtitles({
      query,
      type,
      year,
      season,
      episode,
      language,
    });
  }

  /**
   * Get available languages for a specific media item
   */
  async getAvailableLanguages(
    imdbId?: string,
    tmdbId?: number,
    tvdbId?: number
  ): Promise<string[]> {
    const params: Record<string, string | number> = {};
    if (imdbId) params.imdb_id = imdbId;
    if (tmdbId) params.tmdb_id = tmdbId;
    if (tvdbId) params.tvdb_id = tvdbId;

    const response = await this.fetchWithTimeout<{ languages: string[] }>(
      '/subtitles/languages',
      { method: 'GET' },
      params
    );

    return response.languages || [];
  }

  /**
   * Download subtitle content by track ID
   */
  async downloadSubtitle(trackId: string): Promise<XyraSubtitleDownloadResult> {
    const response = await this.fetchWithTimeout<{
      content: string;
      format: string;
      encoding: string;
      track: XyraSubtitleTrack;
    }>('/subtitles/download', { method: 'POST' }, { track_id: trackId });

    return {
      content: response.content,
      format: response.format,
      encoding: response.encoding,
      track: response.track,
    };
  }

  /**
   * Download subtitle directly from URL
   */
  async downloadSubtitleFromUrl(url: string): Promise<XyraSubtitleDownloadResult> {
    const response = await this.fetchWithTimeout<{
      content: string;
      format: string;
      encoding: string;
      track: XyraSubtitleTrack;
    }>('/subtitles/download/url', { method: 'POST' }, { url });

    return {
      content: response.content,
      format: response.format,
      encoding: response.encoding,
      track: response.track,
    };
  }

  /**
   * Convert subtitle format
   */
  async convertSubtitle(
    trackId: string,
    targetFormat: 'srt' | 'vtt' | 'ass'
  ): Promise<XyraSubtitleDownloadResult> {
    const response = await this.fetchWithTimeout<{
      content: string;
      format: string;
      encoding: string;
      track: XyraSubtitleTrack;
    }>('/subtitles/convert', { method: 'POST' }, { track_id: trackId, format: targetFormat });

    return {
      content: response.content,
      format: response.format,
      encoding: response.encoding,
      track: response.track,
    };
  }

  /**
   * Parse subtitle content into cues/timed lines
   */
  parseSubtitleCues(content: string, format: string): Array<{
    index: number;
    startTime: number;
    endTime: number;
    text: string;
  }> {
    const cues: Array<{
      index: number;
      startTime: number;
      endTime: number;
      text: string;
    }> = [];

    if (format === 'vtt' || format === 'webvtt') {
      return this.parseVTT(content);
    } else if (format === 'srt') {
      return this.parseSRT(content);
    } else if (format === 'ass' || format === 'ssa') {
      return this.parseASS(content);
    }

    // Default to SRT parsing
    return this.parseSRT(content);
  }

  /**
   * Parse SRT format
   */
  private parseSRT(content: string): Array<{
    index: number;
    startTime: number;
    endTime: number;
    text: string;
  }> {
    const cues: Array<{
      index: number;
      startTime: number;
      endTime: number;
      text: string;
    }> = [];

    const blocks = content.trim().split(/\\n\\s*\\n/);
    let index = 0;

    for (const block of blocks) {
      const lines = block.trim().split('\\n');
      if (lines.length < 3) continue;

      const timeLine = lines.find(line => line.includes('-->'));
      if (!timeLine) continue;

      const [startStr, endStr] = timeLine.split('-->').map(s => s.trim());
      const startTime = this.timeToMs(startStr);
      const endTime = this.timeToMs(endStr);

      const textLines = lines.slice(lines.indexOf(timeLine) + 1);
      const text = textLines.join('\\n').trim();

      if (text) {
        cues.push({
          index: index++,
          startTime,
          endTime,
          text,
        });
      }
    }

    return cues;
  }

  /**
   * Parse WebVTT format
   */
  private parseVTT(content: string): Array<{
    index: number;
    startTime: number;
    endTime: number;
    text: string;
  }> {
    const cues: Array<{
      index: number;
      startTime: number;
      endTime: number;
      text: string;
    }> = [];

    const lines = content.split('\\n');
    let index = 0;
    let inCue = false;
    let currentCue: {
      index: number;
      startTime: number;
      endTime: number;
      text: string;
    } | null = null;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed === 'WEBVTT' || trimmed.startsWith('NOTE') || trimmed === '') {
        if (currentCue && currentCue.text) {
          cues.push(currentCue);
          currentCue = null;
        }
        continue;
      }

      if (trimmed.includes('-->')) {
        const [startStr, endStr] = trimmed.split('-->').map(s => s.trim().split(' ')[0]);
        currentCue = {
          index: index++,
          startTime: this.timeToMs(startStr),
          endTime: this.timeToMs(endStr),
          text: '',
        };
        inCue = true;
      } else if (inCue && currentCue) {
        currentCue.text += (currentCue.text ? '\\n' : '') + trimmed;
      }
    }

    if (currentCue && currentCue.text) {
      cues.push(currentCue);
    }

    return cues;
  }

  /**
   * Parse ASS/SSA format
   */
  private parseASS(content: string): Array<{
    index: number;
    startTime: number;
    endTime: number;
    text: string;
  }> {
    const cues: Array<{
      index: number;
      startTime: number;
      endTime: number;
      text: string;
    }> = [];

    const lines = content.split('\\n');
    let index = 0;

    for (const line of lines) {
      if (line.startsWith('Dialogue:')) {
        const parts = line.substring(9).split(',');
        if (parts.length >= 10) {
          const startTime = this.timeToMs(parts[1].trim());
          const endTime = this.timeToMs(parts[2].trim());
          const text = parts.slice(9).join(',').replace(/\\{[^}]*\\}/g, '').trim();

          if (text) {
            cues.push({
              index: index++,
              startTime,
              endTime,
              text: text.replace(/\\\\N/g, '\\n').replace(/\\\\n/g, '\\n'),
            });
          }
        }
      }
    }

    return cues;
  }

  /**
   * Convert time string to milliseconds
   */
  private timeToMs(timeStr: string): number {
    const clean = timeStr.replace('.', ',');
    const parts = clean.split(':');

    if (parts.length === 3) {
      const [hours, minutes, secondsMs] = parts;
      const [seconds, ms = '0'] = secondsMs.split(',');
      return (
        parseInt(hours) * 3600000 +
        parseInt(minutes) * 60000 +
        parseInt(seconds) * 1000 +
        parseInt(ms.padEnd(3, '0'))
      );
    }

    return 0;
  }

  /**
   * Convert milliseconds to SRT time format
   */
  msToSrtTime(ms: number): string {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const millis = Math.floor(ms % 1000);

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
  }

  /**
   * Convert milliseconds to VTT time format
   */
  msToVttTime(ms: number): string {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const millis = Math.floor(ms % 1000);

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
  }

  /**
   * Convert subtitle cues to SRT format string
   */
  cuesToSrt(cues: Array<{ index: number; startTime: number; endTime: number; text: string }>): string {
    return cues
      .map(
        cue =>
          `${cue.index + 1}\\n${this.msToSrtTime(cue.startTime)} --> ${this.msToSrtTime(cue.endTime)}\\n${cue.text}\\n`
      )
      .join('\\n');
  }

  /**
   * Convert subtitle cues to WebVTT format string
   */
  cuesToVtt(cues: Array<{ index: number; startTime: number; endTime: number; text: string }>): string {
    const header = 'WEBVTT\\n\\n';
    const body = cues
      .map(
        cue =>
          `${this.msToVttTime(cue.startTime)} --> ${this.msToVttTime(cue.endTime)}\\n${cue.text}\\n`
      )
      .join('\\n');
    return header + body;
  }

  /**
   * Get health status of the Xyra API
   */
  async getHealth(): Promise<{ status: string; version: string; timestamp: string }> {
    return this.fetchWithTimeout('/health', { method: 'GET' });
  }

  /**
   * Check if the provider is available/healthy
   */
  async isAvailable(): Promise<boolean> {
    try {
      const health = await this.getHealth();
      return health.status === 'ok' || health.status === 'healthy';
    } catch {
      return false;
    }
  }
}

// Singleton export
let _xyraProvider: XyraSubtitleProvider | null = null;

export function getXyraSubtitleProvider(apiKey?: string): XyraSubtitleProvider {
  if (!_xyraProvider) {
    _xyraProvider = new XyraSubtitleProvider(apiKey);
  }
  return _xyraProvider;
}

export function resetXyraSubtitleProvider(): void {
  _xyraProvider = null;
}

export default XyraSubtitleProvider;