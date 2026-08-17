// src/utils/streamExtractor.ts

import { getActiveStreamSources, getStreamingUrl as getApiStreamingUrl } from '../services/unified/providers/vidsrc/VidSrcProvider';
import { getStreamProcessor } from './streamProcessors';
import { buildStreamHeaders, buildFFmpegHeaders } from './streamHeaders';

// ─── NEW: Pure fetch + regex extractor (No WebView) ───
export interface ExtractedStream {
  url: string;
  type: 'hls' | 'mp4' | 'dash';
  quality?: string;
  headers?: Record<string, string>;
  referer?: string;
  sourceName?: string;
}

/**
 * Extract video URL using pure fetch + regex (No WebView)
 * Uses browser headers to avoid detection
 * Recursively follows iframes to find the video URL
 */
export async function extractWithFetchAndRegex(
  embedUrl: string,
  sourceName: string = 'unknown',
  referer?: string,
  timeoutMs: number = 15000,
  depth: number = 0
): Promise<ExtractedStream | null> {
  // Prevent infinite recursion
  if (depth > 10) {
    console.warn(`[StreamExtractor] ⛔ Max depth (10) reached for ${embedUrl}`);
    return null;
  }

  console.log(`[StreamExtractor] 🔍 Fetch+Regex (depth ${depth}): ${embedUrl}`);

  try {
    // ─── Step 1: Fetch with browser headers ───
    const headers = buildStreamHeaders(embedUrl, referer || embedUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(embedUrl, {
      headers,
      signal: controller.signal,
      credentials: 'include',
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(`[StreamExtractor] HTTP ${response.status}: ${embedUrl}`);
      return null;
    }

    const html = await response.text();
    console.log(`[StreamExtractor] ✅ Fetched ${html.length} characters`);

    // ─── Step 2: Try to extract video URL directly from HTML ───
    const extracted = extractVideoUrlFromHtml(html, embedUrl);
    if (extracted) {
      console.log(`[StreamExtractor] ✅ Extracted: ${extracted.url.substring(0, 60)}...`);
      return {
        ...extracted,
        headers: buildStreamHeaders(extracted.url, embedUrl),
        referer: embedUrl,
        sourceName,
      };
    }

    // ─── Step 3: Extract ALL iframes from the HTML ───
    const iframeUrls = extractAllIframeUrls(html, embedUrl);
    
    if (iframeUrls.length > 0) {
      console.log(`[StreamExtractor] 🔄 Found ${iframeUrls.length} iframe(s), following...`);
      
      // Follow each iframe recursively
      for (const iframeUrl of iframeUrls) {
        console.log(`[StreamExtractor]   ↳ Following: ${iframeUrl}`);
        const result = await extractWithFetchAndRegex(
          iframeUrl,
          sourceName,
          embedUrl,
          timeoutMs,
          depth + 1
        );
        if (result) {
          console.log(`[StreamExtractor] ✅ Found video in iframe: ${iframeUrl}`);
          return result;
        }
      }
    }

    // ─── Step 4: Try to find video URL in script tags (last resort) ───
    const scriptResult = extractFromScriptTags(html, embedUrl);
    if (scriptResult) {
      console.log(`[StreamExtractor] ✅ Extracted from script: ${scriptResult.url.substring(0, 60)}...`);
      return {
        ...scriptResult,
        headers: buildStreamHeaders(scriptResult.url, embedUrl),
        referer: embedUrl,
        sourceName,
      };
    }

    console.log('[StreamExtractor] ❌ No video URL found');
    return null;

  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.warn(`[StreamExtractor] ⏱️ Timeout after ${timeoutMs}ms: ${embedUrl}`);
    } else {
      console.error('[StreamExtractor] ❌ Extraction failed:', error.message);
    }
    return null;
  }
}

/**
 * Extract ALL iframe URLs from HTML (any domain, any source)
 */
function extractAllIframeUrls(html: string, baseUrl: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  // Pattern to match ANY iframe src
  const iframePatterns = [
    /<iframe[^>]+src=["']([^"']+)["']/gi,
    /<frame[^>]+src=["']([^"']+)["']/gi,
    /<embed[^>]+src=["']([^"']+)["']/gi,
    /<object[^>]+data=["']([^"']+)["']/gi,
  ];

  for (const pattern of iframePatterns) {
    const matches = html.matchAll(new RegExp(pattern, 'gi'));
    for (const match of matches) {
      if (match[1]) {
        let url = match[1].trim();
        
        // Skip empty or javascript: URLs
        if (!url || url.startsWith('javascript:') || url.startsWith('#')) {
          continue;
        }

        // Handle relative URLs
        if (url.startsWith('//')) {
          url = 'https:' + url;
        } else if (!url.startsWith('http')) {
          try {
            url = new URL(url, baseUrl).href;
          } catch {
            continue;
          }
        }

        // Validate and deduplicate
        try {
          const parsed = new URL(url);
          // Skip common non-video domains
          const skipDomains = ['google', 'facebook', 'twitter', 'youtube', 'vimeo', 'googletag', 'doubleclick'];
          if (skipDomains.some(d => parsed.hostname.includes(d))) {
            continue;
          }
          if (!seen.has(url)) {
            seen.add(url);
            urls.push(url);
          }
        } catch {
          continue;
        }
      }
    }
  }

  return urls;
}

/**
 * Extract video URL from script tags (JavaScript variables)
 */
function extractFromScriptTags(html: string, baseUrl: string): { url: string; type: 'hls' | 'mp4' | 'dash'; quality?: string } | null {
  // Extract all script contents
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  const scriptMatches = html.matchAll(scriptRegex);
  const scriptContents: string[] = [];
  for (const match of scriptMatches) {
    if (match[1]) scriptContents.push(match[1]);
  }

  // Patterns to find video URLs in JavaScript
  const patterns = [
    // Variable assignments
    /(?:var|let|const)\s+(?:url|source|src|file|playlist|stream|videoUrl|hlsUrl)\s*=\s*["']([^"']+\.(?:m3u8|mp4|m4v)[^"']*)["']/gi,
    /(?:var|let|const)\s+(?:url|source|src|file|playlist|stream|videoUrl|hlsUrl)\s*=\s*["']([^"']+\.space\/[^"']+\.(?:m3u8|mp4)[^"']*)["']/gi,
    
    // Object properties
    /["'](?:url|source|src|file|playlist|stream|videoUrl|hls)["']\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/gi,
    
    // Player initialization
    /player\.(?:load|setSource|play|setup)\s*\(\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/gi,
    /hls\.(?:loadSource|load)\s*\(\s*["']([^"']+\.m3u8[^"']*)["']/gi,
    /video\.src\s*=\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/gi,
    
    // fetch/XHR URLs
    /fetch\s*\(\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/gi,
    /\.get\s*\(\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/gi,
    
    // Base64 encoded
    /atob\s*\(\s*["']([A-Za-z0-9+/=]+)["']\s*\)/gi,
    /decodeURIComponent\s*\(\s*["']((?:%[0-9A-F]{2})+.*?)["']\s*\)/gi,
  ];

  for (const content of scriptContents) {
    for (const pattern of patterns) {
      const matches = content.matchAll(new RegExp(pattern, 'gi'));
      for (const match of matches) {
        let url = match[1]?.trim();
        if (!url) continue;

        // Handle base64
        if (pattern.source.includes('atob')) {
          try {
            url = atob(url.replace(/["']+/g, ''));
          } catch {
            continue;
          }
        }

        // Handle URI decoding
        if (pattern.source.includes('decodeURIComponent')) {
          try {
            url = decodeURIComponent(url.replace(/["']+/g, ''));
          } catch {
            continue;
          }
        }

        // Handle relative URLs
        if (url.startsWith('//')) {
          url = 'https:' + url;
        } else if (!url.startsWith('http')) {
          try {
            url = new URL(url, baseUrl).href;
          } catch {
            continue;
          }
        }

        // Validate
        try {
          new URL(url);
        } catch {
          continue;
        }

        if (isVideoUrl(url)) {
          const type = detectType(url);
          const quality = detectQuality(url);
          console.log(`[StreamExtractor] ✅ Extracted from script: ${url.substring(0, 60)}...`);
          return { url, type, quality };
        }
      }
    }
  }

  return null;
}

/**
 * Extract video URL from HTML using multiple regex patterns
 */
function extractVideoUrlFromHtml(html: string, baseUrl: string): { url: string; type: 'hls' | 'mp4' | 'dash'; quality?: string } | null {
  const patterns = [
    // Direct m3u8/mp4 URLs
    /(https?:\/\/[^\s"']+\.(?:m3u8|mp4|m4v|webm|ts)(?:[^\s"']*))/gi,
    
    // Cloudnestra/space domain patterns
    /["'](https?:\/\/[a-zA-Z0-9]+\.space\/pl\/[a-zA-Z0-9\/+]+\/[a-f0-9]+\/index\.m3u8\?token=[^"']*)["']/gi,
    /["'](https?:\/\/[a-zA-Z0-9]+\.space\/pl\/[a-zA-Z0-9\/+]+\/[a-f0-9]+\/page-\d+\.html\?token=[^"']*)["']/gi,
    /["'](https?:\/\/cloudnestra\.com\/rcp\/[a-zA-Z0-9]+)["']/gi,
    /["']\/\/cloudnestra\.com\/rcp\/([a-zA-Z0-9]+)["']/gi,
    /data-hash=["']([a-zA-Z0-9]+)["']/gi,
    
    // JavaScript variable assignments (inline)
    /(?:var|let|const)\s+(?:url|source|src|file|playlist|stream)\s*=\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/gi,
    
    // Player initialization
    /player\.(?:load|setSource|play)\s*\(\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/gi,
    /hls\.(?:loadSource|load)\s*\(\s*["']([^"']+\.m3u8[^"']*)["']/gi,
    /video\.src\s*=\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/gi,
    
    // HTML source tags
    /<source[^>]+src=["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/gi,
    /<video[^>]+src=["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/gi,
  ];

  for (const pattern of patterns) {
    const matches = html.matchAll(new RegExp(pattern, 'gi'));
    for (const match of matches) {
      let url = match[1]?.trim() || match[0]?.trim();
      if (!url) continue;

      // Handle relative URLs
      if (url.startsWith('//')) {
        url = 'https:' + url;
      } else if (!url.startsWith('http')) {
        try {
          url = new URL(url, baseUrl).href;
        } catch {
          continue;
        }
      }

      try {
        new URL(url);
      } catch {
        continue;
      }

      if (isVideoUrl(url)) {
        const type = detectType(url);
        const quality = detectQuality(url);
        console.log(`[StreamExtractor] ✅ Extracted: ${url.substring(0, 60)}...`);
        return { url, type, quality };
      }
    }
  }

  return null;
}

/**
 * Get all regex patterns for video URL extraction
 */
function getExtractionPatterns(): string[] {
  return [
    // Direct m3u8/mp4 URLs
    '(https?://[^\\s"\']+\\.(?:m3u8|mp4|m4v|webm|ts)(?:[^\\s"\']*))',

    // JavaScript variable assignments
    'var\\s+(?:source|src|url|stream|videoUrl|file|playlist)\\s*=\\s*["\']([^"\']+\\.(?:m3u8|mp4)[^"\']*)["\']',
    'let\\s+(?:source|src|url|stream|videoUrl|file|playlist)\\s*=\\s*["\']([^"\']+\\.(?:m3u8|mp4)[^"\']*)["\']',
    'const\\s+(?:source|src|url|stream|videoUrl|file|playlist)\\s*=\\s*["\']([^"\']+\\.(?:m3u8|mp4)[^"\']*)["\']',

    // JSON/object properties
    '["\']?source["\']?\\s*:\\s*["\']([^"\']+\\.(?:m3u8|mp4)[^"\']*)["\']',
    '["\']?file["\']?\\s*:\\s*["\']([^"\']+\\.(?:m3u8|mp4)[^"\']*)["\']',
    '["\']?url["\']?\\s*:\\s*["\']([^"\']+\\.(?:m3u8|mp4)[^"\']*)["\']',
    '["\']?playlist["\']?\\s*:\\s*["\']([^"\']+\\.m3u8[^"\']*)["\']',
    '["\']?hls["\']?\\s*:\\s*["\']([^"\']+\\.m3u8[^"\']*)["\']',

    // HTML source tags
    '<source[^>]+src=["\']([^"\']+\\.(?:m3u8|mp4)[^"\']*)["\']',
    '<video[^>]+src=["\']([^"\']+\\.(?:m3u8|mp4)[^"\']*)["\']',
    '<iframe[^>]+src=["\']([^"\']+\\.(?:m3u8|mp4)[^"\']*)["\']',

    // Base64 encoded
    'atob\\(["\']([A-Za-z0-9+/=]+)["\']\\)',

    // Function calls that return video URLs
    '["\']?video["\']?\\s*:\\s*["\']([^"\']+\\.(?:m3u8|mp4)[^"\']*)["\']',
    '["\']?src["\']?\\s*:\\s*["\']([^"\']+\\.(?:m3u8|mp4)[^"\']*)["\']',
    '["\']?file["\']?\\s*=\\s*["\']([^"\']+\\.(?:m3u8|mp4)[^"\']*)["\']',

    // Manifest files
    '(https?://[^\\s"\']+\\.m3u8(?![^\\s]*\\.m3u8))',
    '(https?://[^\\s"\']+\\.mpd[^\\s"\']*)',

    // Cloudnestra specific
    '(https?://cloudnestra\\.com/rcp/[a-zA-Z0-9]+)',
    'src:\\s*["\']//cloudnestra\\.com/rcp/([^"\']+)["\']',
    'data-hash=["\']([a-zA-Z0-9]+)["\']',
  ];
}

/**
 * Check if URL is a valid video URL
 */
function isVideoUrl(url: string): boolean {
  const videoExtensions = ['m3u8', 'mp4', 'm4v', 'webm', 'mpd', 'ts'];
  const urlLower = url.toLowerCase();
  return videoExtensions.some(ext => urlLower.includes(`.${ext}`)) ||
         urlLower.includes('/hls/') ||
         urlLower.includes('/video/') ||
         urlLower.includes('/stream/') ||
         urlLower.includes('manifest') ||
         urlLower.includes('cloudnestra') ||
         urlLower.includes('.space/pl/');
}

/**
 * Detect stream type from URL
 */
function detectType(url: string): 'hls' | 'mp4' | 'dash' {
  const urlLower = url.toLowerCase();
  if (urlLower.includes('.m3u8') || urlLower.includes('/hls/')) return 'hls';
  if (urlLower.includes('.mpd') || urlLower.includes('/dash/')) return 'dash';
  if (urlLower.includes('.mp4') || urlLower.includes('.m4v') || urlLower.includes('.webm')) return 'mp4';
  return 'hls'; // Default
}

/**
 * Detect quality from URL or return default
 */
function detectQuality(url: string): string {
  const urlLower = url.toLowerCase();
  if (urlLower.includes('2160') || urlLower.includes('4k')) return '2160p';
  if (urlLower.includes('1080') || urlLower.includes('1080p')) return '1080p';
  if (urlLower.includes('720') || urlLower.includes('720p')) return '720p';
  if (urlLower.includes('480') || urlLower.includes('480p')) return '480p';
  if (urlLower.includes('360') || urlLower.includes('360p')) return '360p';
  return '1080p'; // Default
}

// ─── EXISTING WebView-based extraction (kept as fallback) ───
// ... (rest of your existing code remains unchanged)

const _extractStream = (
  sources: any[],
  tmdbId: string | null,
  type: string | null,
  season: number | null,
  episode: number | null,
  onStreamFound: (url: string, referer: string | null, sourceName: string) => void,
  onSourceError: (error: Error, sourceName: string) => void,
  onAllSourcesFailed: (error: Error) => void,
  onManualInterventionRequired: (url: string, sourceName: string) => void,
  provideWebViewConfigForAttempt: (config: any, sourceName: string, key: string) => void,
  directUrl: string | null = null,
  mediaTitle: string | null = null
) => {
  let currentSourceIndex = 0;
  let attemptKey = 0;

  const tryNextSource = () => {
    if (currentSourceIndex >= sources.length) {
      if (onAllSourcesFailed) {
        onAllSourcesFailed(new Error('All stream sources have been attempted.'));
      }
      return;
    }

    const sourceInfo = sources[currentSourceIndex];
    attemptKey++;
    currentSourceIndex++;

    if (sourceInfo.name === "FluxSource") {
      provideWebViewConfigForAttempt(null, sourceInfo.name, `${sourceInfo.name}-${attemptKey}`);
      let fetchUrl: string;

      if (type === 'tv') {
        fetchUrl = sourceInfo.baseUrl + `?tmdbId=${tmdbId}&season=${season}&episode=${episode}`;
      } else {
        fetchUrl = sourceInfo.baseUrl + `?tmdbId=${tmdbId}`;
      }

      const headers = buildStreamHeaders(fetchUrl, sourceInfo.baseUrl);

      fetch(fetchUrl, { headers })
        .then(res => res.json())
        .then(res => {
          if (res.error || !res.url) {
            tryNextSource();
            return;
          }
          onStreamFound(res.url, res.referer || sourceInfo.baseUrl, sourceInfo.name);
        })
        .catch(() => tryNextSource());

      return;
    }

    let embedUrl: string | null;
    if (directUrl) {
      embedUrl = directUrl;
    } else {
      embedUrl = getApiStreamingUrl(sourceInfo.baseUrl, tmdbId, type, season, episode, mediaTitle);
    }

    if (!embedUrl) {
      console.error(`[StreamExtractor] Could not generate embed URL for source: ${sourceInfo.name}`);
      if (onSourceError) {
        onSourceError(new Error(`Failed to generate embed URL for ${sourceInfo.name}`), sourceInfo.name);
      }
      tryNextSource();
      return;
    }

    const sourceOrigin = new URL(embedUrl).origin;
    const timeoutInSeconds = sourceInfo.timeoutInSeconds || 10;

    const streamProcessor = getStreamProcessor(sourceInfo.name, timeoutInSeconds);
    streamProcessor.setContext({
      type,
      season,
      episode,
      mediaTitle,
      tmdbId
    });
    const injectedJavaScript = streamProcessor.getInjectedJavaScript();

    let attemptConcluded = false;

    const webViewHeaders = buildStreamHeaders(embedUrl, sourceOrigin);

    const webViewConfig = {
      source: {
        uri: embedUrl,
        headers: webViewHeaders,
      },
      injectedJavaScript,
      userAgent: webViewHeaders['User-Agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      onMessage: (event: any) => {
        if (attemptConcluded) return;
        try {
          const data = JSON.parse(event.nativeEvent.data);

          if (data.source !== sourceInfo.name && data.type !== 'debug') {
            return;
          }

          if (data.type === 'debug') {
            console.log(data.message);
          } else if (data.type === 'stream' && data.url) {
            attemptConcluded = true;
            const streamUrl = data.url;
            let streamReferer = data.referer !== undefined ? data.referer : null;
            if (streamReferer) {
              try {
                const url = new URL(streamReferer);
                streamReferer = `${url.protocol}//${url.hostname}/`;
              } catch {
                // Keep as-is
              }
            }

            const validationHeaders = buildStreamHeaders(streamUrl, streamReferer || sourceOrigin + '/');

            fetch(streamUrl, { method: 'GET', headers: validationHeaders })
              .then(response => {
                if (!response.ok) {
                  throw new Error(`Stream URL check failed with status: ${response.status}`);
                }
                if (onStreamFound) {
                  onStreamFound(streamUrl, streamReferer, sourceInfo.name);
                }
              })
              .catch(fetchError => {
                console.error(`[StreamExtractor] Stream URL check failed for ${sourceInfo.name}:`, fetchError.message);
                if (onSourceError) {
                  onSourceError(new Error(`Stream check failed: ${fetchError.message}`), sourceInfo.name);
                }
                tryNextSource();
              });
          } else if (data.type === 'stream_candidate') {
            // Can be used for debugging or advanced logic later
          } else if (data.type === 'error') {
            attemptConcluded = true;
            console.error(`[StreamExtractor] Error from WebView JS on ${sourceInfo.name}:`, data.message);
            if (onSourceError) {
              onSourceError(new Error(data.message), sourceInfo.name);
            }
            tryNextSource();
          } else if (data.type === 'skip') {
            attemptConcluded = true;
            tryNextSource();
          }
        } catch (e) {
          if (attemptConcluded) return;
          attemptConcluded = true;
          console.error(`[StreamExtractor] Error parsing WebView message from ${sourceInfo.name}:`, e);
          if (onSourceError) {
            onSourceError(e instanceof Error ? e : new Error(String(e)), sourceInfo.name);
          }
          tryNextSource();
        }
      },
      onError: (syntheticEvent: any) => {
        if (attemptConcluded) return;
        attemptConcluded = true;
        const { nativeEvent } = syntheticEvent;
        console.error(`[StreamExtractor] WebView onError for ${sourceInfo.name} - ${embedUrl}:`, nativeEvent.description);
        tryNextSource();
      },
      onHttpError: (syntheticEvent: any) => {
        if (attemptConcluded) return;
        attemptConcluded = true;
        const { nativeEvent } = syntheticEvent;
        console.error(`[StreamExtractor] WebView HTTP error for ${sourceInfo.name} - ${embedUrl}: ${nativeEvent.statusCode}`);
        if (nativeEvent.statusCode === 403 && onManualInterventionRequired) {
          onManualInterventionRequired(embedUrl, sourceInfo.name);
        }
        tryNextSource();
      }
    };

    if (provideWebViewConfigForAttempt) {
      provideWebViewConfigForAttempt(webViewConfig, sourceInfo.name, `${sourceInfo.name}-${attemptKey}`);
    }
  };

  tryNextSource();
};

/**
 * Extract m3u8 stream URL using WebView (fallback method)
 * Kept for compatibility with existing code
 */
export const extractM3U8Stream = (
  tmdbId: string,
  type: string,
  season: number | null,
  episode: number | null,
  onStreamFound: (url: string, referer: string | null, sourceName: string) => void,
  onSourceError: (error: Error, sourceName: string) => void,
  onAllSourcesFailed: (error: Error) => void,
  onManualInterventionRequired: (url: string, sourceName: string) => void,
  provideWebViewConfigForAttempt: (config: any, sourceName: string, key: string) => void,
  mediaTitle: string | null = null
) => {
  const activeSources = getActiveStreamSources();
  _extractStream(
    activeSources,
    tmdbId,
    type,
    season,
    episode,
    onStreamFound,
    onSourceError,
    onAllSourcesFailed,
    onManualInterventionRequired,
    provideWebViewConfigForAttempt,
    null,
    mediaTitle
  );
};

/**
 * Extract m3u8 stream URL from a specific source using WebView
 */
export const extractStreamFromSpecificSource = (
  sourceInfo: any,
  tmdbId: string,
  type: string,
  season: number | null,
  episode: number | null,
  onStreamFound: (url: string, referer: string | null, sourceName: string) => void,
  onSourceError: (error: Error, sourceName: string) => void,
  onManualInterventionRequired: (url: string, sourceName: string) => void,
  provideWebViewConfigForAttempt: (config: any, sourceName: string, key: string) => void,
  mediaTitle: string | null = null
) => {
  _extractStream(
    [sourceInfo],
    tmdbId,
    type,
    season,
    episode,
    onStreamFound,
    onSourceError,
    (error) => {
      if (onSourceError) {
        onSourceError(error, sourceInfo.name);
      }
    },
    onManualInterventionRequired,
    provideWebViewConfigForAttempt,
    null,
    mediaTitle
  );
};

/**
 * Extract live stream using WebView
 */
export const extractLiveStream = (
  directUrl: string,
  sourceName: string,
  timeoutInSeconds: number,
  onStreamFound: (url: string, referer: string | null, sourceName: string) => void,
  onSourceError: (error: Error, sourceName: string) => void,
  onManualInterventionRequired: (url: string, sourceName: string) => void,
  provideWebViewConfigForAttempt: (config: any, sourceName: string, key: string) => void
) => {
  const sourceInfo = {
    name: sourceName,
    baseUrl: null,
    timeoutInSeconds: timeoutInSeconds || 15
  };

  _extractStream(
    [sourceInfo],
    null,
    null,
    null,
    null,
    onStreamFound,
    onSourceError,
    (error) => {
      if (onSourceError) {
        onSourceError(error, sourceName);
      }
    },
    onManualInterventionRequired,
    provideWebViewConfigForAttempt,
    directUrl
  );
};

// ─── NEW: Batch extract multiple URLs with fetch+regex ───
export const batchExtractWithFetchAndRegex = async (
  urls: string[],
  sourceName: string = 'batch',
  timeoutMs: number = 15000
): Promise<ExtractedStream[]> => {
  const results: ExtractedStream[] = [];
  const promises = urls.map(async (url) => {
    const result = await extractWithFetchAndRegex(url, sourceName, undefined, timeoutMs);
    if (result) {
      results.push(result);
    }
  });
  await Promise.allSettled(promises);
  return results;
};

// ─── NEW: Try all sources with fetch+regex first, fallback to WebView ───
export const extractStreamHybrid = async (
  tmdbId: string,
  type: string,
  season: number | null,
  episode: number | null,
  onStreamFound: (url: string, referer: string | null, sourceName: string) => void,
  onSourceError: (error: Error, sourceName: string) => void,
  onAllSourcesFailed: (error: Error) => void,
  onManualInterventionRequired: (url: string, sourceName: string) => void,
  provideWebViewConfigForAttempt: (config: any, sourceName: string, key: string) => void,
  mediaTitle: string | null = null
) => {
  // Try fetch+regex first for all sources
  const sources = getActiveStreamSources();
  let found = false;

  for (const source of sources) {
    try {
      let embedUrl: string | null;
      if (source.name === "FluxSource") {
        embedUrl = source.baseUrl + (type === 'tv' 
          ? `?tmdbId=${tmdbId}&season=${season}&episode=${episode}`
          : `?tmdbId=${tmdbId}`);
      } else {
        embedUrl = getApiStreamingUrl(source.baseUrl, tmdbId, type, season, episode, mediaTitle);
      }

      if (embedUrl) {
        console.log(`[StreamExtractor] 🔍 Hybrid: Trying ${source.name} with fetch+regex`);
        const result = await extractWithFetchAndRegex(embedUrl, source.name, source.baseUrl);
        if (result) {
          console.log(`[StreamExtractor] ✅ Hybrid: ${source.name} succeeded with fetch+regex`);
          onStreamFound(result.url, result.referer || source.baseUrl, source.name);
          found = true;
          break;
        }
      }
    } catch (error) {
      console.warn(`[StreamExtractor] Hybrid: ${source.name} fetch+regex failed:`, error);
    }
  }

  // If fetch+regex fails, fallback to WebView
  if (!found) {
    console.log('[StreamExtractor] 🔄 Hybrid: Falling back to WebView method');
    extractM3U8Stream(
      tmdbId,
      type,
      season,
      episode,
      onStreamFound,
      onSourceError,
      onAllSourcesFailed,
      onManualInterventionRequired,
      provideWebViewConfigForAttempt,
      mediaTitle
    );
  }
};

// ─── Default export for backward compatibility ───
export default {
  extractM3U8Stream,
  extractStreamFromSpecificSource,
  extractLiveStream,
  extractWithFetchAndRegex,
  batchExtractWithFetchAndRegex,
  extractStreamHybrid,
};