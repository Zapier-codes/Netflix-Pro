// src/services/vidsrc-extractor/vidsrc.ts

/*
written by @cool-dev-guy
github: https://github.com/cool-dev-guy
Modified for React Native with browser headers, timeout support, and error handling
*/

import * as cheerio from "cheerio";
import { decrypt } from "./helpers/decoder";
import { buildStreamHeaders } from "../../utils/streamHeaders";

// ─── Constants ───
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_BASE_DOM = "https://whisperingauroras.com";
const FALLBACK_DOMAINS = [
  "https://whisperingauroras.com",
  "https://vidsrc.net",
  "https://vidsrc.to",
];

// ─── Interfaces ───
interface Servers {
  name: string | null;
  dataHash: string | null;
}

interface APIResponse {
  name: string | null;
  image: string | null;
  mediaId: string | null;
  stream: string | null;
  referer: string;
}

interface RCPResponse {
  metadata: {
    image: string;
  };
  data: string;
}

// ─── State ───
let BASEDOM = DEFAULT_BASE_DOM;
let currentDomainIndex = 0;

// ─── Helper: Fetch with timeout and headers ───
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  // ─── FIX: Validate URL before fetching ───
  if (!url || typeof url !== 'string') {
    throw new Error(`Invalid URL: ${url}`);
  }

  try {
    new URL(url);
  } catch (error) {
    throw new Error(`Invalid URL: ${url} - ${error}`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Build browser headers
    const headers = buildStreamHeaders(url);
    
    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

// ─── Helper: Safe text extraction with error handling ───
async function safeFetchText(url: string, timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<string> {
  // ─── FIX: Validate URL before fetching ───
  if (!url || typeof url !== 'string') {
    throw new Error(`Invalid URL in safeFetchText: ${url}`);
  }

  try {
    const response = await fetchWithTimeout(url, {}, timeoutMs);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.text();
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error(`Timeout after ${timeoutMs}ms: ${url}`);
    }
    throw error;
  }
}

// ─── Helper: Validate and clean URL ───
function validateAndCleanUrl(baseUrl: string, path: string): string | null {
  if (!baseUrl || !path) {
    console.warn('[vidsrc] validateAndCleanUrl: missing baseUrl or path');
    return null;
  }

  try {
    // Remove trailing slash from base if present
    const cleanBase = baseUrl.replace(/\/+$/, '');
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const fullUrl = `${cleanBase}${cleanPath}`;
    
    // Validate the URL
    new URL(fullUrl);
    return fullUrl;
  } catch (error) {
    console.warn('[vidsrc] validateAndCleanUrl failed:', error);
    return null;
  }
}

// ─── serversLoad: Parse server list from HTML ───
async function serversLoad(html: string): Promise<{ servers: Servers[]; title: string }> {
  try {
    const $ = cheerio.load(html);
    const servers: Servers[] = [];
    const title = $("title").text() ?? "";
    
    // Extract base domain from iframe
    const base = $("iframe").attr("src") ?? "";
    if (base) {
      try {
        const baseUrl = base.startsWith("//") ? "https:" + base : base;
        const parsed = new URL(baseUrl);
        BASEDOM = parsed.origin;
        console.log(`[vidsrc] ✅ BASEDOM set to: ${BASEDOM}`);
      } catch (error) {
        console.warn('[vidsrc] Failed to parse base domain, using default:', error);
      }
    }
    
    // Parse server list
    $(".serversList .server").each((index, element) => {
      const server = $(element);
      const name = server.text().trim();
      const dataHash = server.attr("data-hash") ?? null;
      
      if (name && dataHash) {
        servers.push({ name, dataHash });
      }
    });
    
    if (servers.length === 0) {
      console.warn('[vidsrc] No servers found in HTML');
    } else {
      console.log(`[vidsrc] Found ${servers.length} servers`);
    }
    
    return { servers, title };
  } catch (error) {
    console.warn('[vidsrc] serversLoad failed:', error);
    return { servers: [], title: '' };
  }
}

// ─── PRORCPhandler: Handle prorcp decryption ───
async function PRORCPhandler(prorcp: string): Promise<string | null> {
  // ─── FIX: Validate prorcp parameter ───
  if (!prorcp || typeof prorcp !== 'string') {
    console.warn('[vidsrc] PRORCPhandler: invalid prorcp parameter');
    return null;
  }

  try {
    // ─── FIX: Validate and build URL ───
    const prorcpUrl = validateAndCleanUrl(BASEDOM, `/prorcp/${prorcp}`);
    if (!prorcpUrl) {
      console.warn('[vidsrc] PRORCPhandler: failed to build URL');
      return null;
    }

    console.log(`[vidsrc] PRORCPhandler: fetching ${prorcpUrl}`);
    const prorcpResponse = await safeFetchText(prorcpUrl);
    
    // Extract script URL
    const scripts = prorcpResponse.match(/<script\s+src="\/([^"]*\.js)\?\_=([^"]*)"><\/script>/gm);
    if (!scripts || scripts.length === 0) {
      console.warn('[vidsrc] No scripts found in prorcp response');
      return null;
    }
    
    // Find the correct script (skip cpt.js if present)
    let scriptMatch: string | undefined;
    if (scripts.some(s => s.includes("cpt.js"))) {
      scriptMatch = scripts[scripts.length - 2];
    } else {
      scriptMatch = scripts[scripts.length - 1];
    }
    
    if (!scriptMatch) {
      console.warn('[vidsrc] No valid script found');
      return null;
    }
    
    // Extract script path
    const scriptPath = scriptMatch.replace(/.*src="\/([^"]*\.js)\?\_=([^"]*)".*/, "$1?_=$2");
    
    // ─── FIX: Validate and build script URL ───
    const scriptUrl = validateAndCleanUrl(BASEDOM, scriptPath);
    if (!scriptUrl) {
      console.warn('[vidsrc] PRORCPhandler: failed to build script URL');
      return null;
    }
    
    // Fetch and decrypt JavaScript
    const jsCode = await safeFetchText(scriptUrl);
    
    // Find decryption function
    const decryptRegex = /{}\}window\[([^"]+)\("([^"]+)"\)/;
    const decryptMatches = jsCode.match(decryptRegex);
    
    if (!decryptMatches || decryptMatches.length < 3) {
      console.warn('[vidsrc] No decryption function found');
      return null;
    }
    
    // Decrypt the data
    const $ = cheerio.load(prorcpResponse);
    const decryptedId = decrypt(decryptMatches[2].toString().trim(), decryptMatches[1].toString().trim());
    
    if (!decryptedId) {
      console.warn('[vidsrc] Decryption returned null');
      return null;
    }
    
    const dataElement = $("#" + decryptedId);
    
    if (!dataElement || dataElement.length === 0) {
      console.warn('[vidsrc] Decrypted element not found');
      return null;
    }
    
    const result = await decrypt(await dataElement.text(), decryptMatches[2].toString().trim());
    return result;
    
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.warn('[vidsrc] PRORCPhandler timeout');
    } else {
      console.warn('[vidsrc] PRORCPhandler error:', error?.message || error);
    }
    return null;
  }
}

// ─── rcpGrabber: Extract RCP data from HTML ───
async function rcpGrabber(html: string): Promise<RCPResponse | null> {
  try {
    const regex = /src:\s*'([^']*)'/;
    const match = html.match(regex);
    if (!match || !match[1]) {
      return null;
    }
    
    return {
      metadata: { image: "" },
      data: match[1],
    };
  } catch (error) {
    console.warn('[vidsrc] rcpGrabber error:', error);
    return null;
  }
}

// ─── tmdbScrape: Main extraction function ───
async function tmdbScrape(
  tmdbId: string,
  type: "movie" | "tv",
  season?: number,
  episode?: number
): Promise<APIResponse[]> {
  // ─── FIX: Validate input parameters ───
  if (!tmdbId || typeof tmdbId !== 'string') {
    console.error('[vidsrc] Invalid tmdbId:', tmdbId);
    return [];
  }

  if (type !== 'movie' && type !== 'tv') {
    console.error('[vidsrc] Invalid type:', type);
    return [];
  }

  console.log(`[vidsrc] Starting scrape: ${type} ${tmdbId} ${season ? `S${season}` : ''} ${episode ? `E${episode}` : ''}`);

  // Validate season/episode for TV shows
  if (type === 'tv') {
    if (season === undefined || season === null || season < 1) {
      console.warn('[vidsrc] Invalid season for TV show, defaulting to 1');
      season = 1;
    }
    if (episode === undefined || episode === null || episode < 1) {
      console.warn('[vidsrc] Invalid episode for TV show, defaulting to 1');
      episode = 1;
    }
  }

  // Validate movie request
  if (type === 'movie' && (season !== undefined || episode !== undefined)) {
    console.warn('[vidsrc] Season/episode provided for movie, ignoring');
    season = undefined;
    episode = undefined;
  }

  try {
    // ─── Step 1: Fetch embed page ───
    let url: string;
    if (type === 'movie') {
      url = `https://vidsrc.net/embed/movie?tmdb=${tmdbId}`;
    } else {
      url = `https://vidsrc.net/embed/tv?tmdb=${tmdbId}&season=${season}&episode=${episode}`;
    }
    
    console.log(`[vidsrc] Fetching embed: ${url}`);
    
    let embedResp: string;
    try {
      embedResp = await safeFetchText(url);
    } catch (error) {
      console.warn('[vidsrc] Failed to fetch from vidsrc.net, trying fallback...');
      // Try fallback URL
      const fallbackUrl = `https://vidsrc.to/embed/${type}/${tmdbId}${type === 'tv' ? `/${season}/${episode}` : ''}`;
      try {
        embedResp = await safeFetchText(fallbackUrl);
      } catch (fallbackError) {
        console.error('[vidsrc] All fetch attempts failed');
        return [];
      }
    }
    
    // ─── Step 2: Parse servers ───
    const { servers, title } = await serversLoad(embedResp);
    
    if (!servers || servers.length === 0) {
      console.warn('[vidsrc] No servers found');
      return [];
    }
    
    console.log(`[vidsrc] Found ${servers.length} servers`);
    
    // ─── Step 3: Fetch all RCP data ───
    const rcpFetchPromises = servers
      .filter(server => server.dataHash)
      .map(server => {
        // ─── FIX: Validate and build RCP URL ───
        const rcpUrl = validateAndCleanUrl(BASEDOM, `/rcp/${server.dataHash}`);
        if (!rcpUrl) {
          console.warn(`[vidsrc] Failed to build RCP URL for ${server.name}`);
          return Promise.resolve(null);
        }
        return safeFetchText(rcpUrl).catch(err => {
          console.warn(`[vidsrc] Failed to fetch RCP for ${server.name}:`, err);
          return null;
        });
      });
    
    const rcpResponses = await Promise.all(rcpFetchPromises);
    
    // ─── Step 4: Parse RCP responses ───
    const rcpResults = await Promise.all(
      rcpResponses
        .filter((response): response is string => response !== null)
        .map(async (text) => rcpGrabber(text))
    );
    
    // ─── Step 5: Process RCP results ───
    const apiResponse: APIResponse[] = [];
    
    for (const item of rcpResults) {
      if (!item || !item.data) continue;
      
      // Check if it's a prorcp path
      if (item.data.startsWith("/prorcp/")) {
        const prorcpPath = item.data.replace("/prorcp/", "");
        const stream = await PRORCPhandler(prorcpPath);
        
        if (stream) {
          apiResponse.push({
            name: title || 'vidsrc',
            image: item.metadata.image || null,
            mediaId: tmdbId,
            stream: stream,
            referer: BASEDOM,
          });
        }
      }
    }
    
    console.log(`[vidsrc] Found ${apiResponse.length} streams`);
    return apiResponse;
    
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error('[vidsrc] Scrape timeout');
    } else {
      console.error('[vidsrc] Scrape error:', error?.message || error);
    }
    return [];
  }
}

export default tmdbScrape;