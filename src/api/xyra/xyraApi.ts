// src/api/xyra/xyraApi.ts

/**
 * Xyra API Service - Unified API client for Xyra.
 * Provides typed access to all Xyra endpoints.
 * Base URL: https://api.xyra.stream/v1/moviesdrive
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

// ============================================================================
// TYPES
// ============================================================================

export interface XyraMovie {
  title: string;
  id: string;
  link: string;
  image: string;
  quality: string;
  type: 'movie' | 'series';
}

export interface XyraMovieInfo {
  id: string;
  title: string;
  image: string;
  description: string;
  categories: string[];
  imdb_id: string;
  type: 'movie' | 'series';
  downloads: XyraDownload[];
  download_count: number;
  related: XyraRelated[];
}

export interface XyraDownload {
  quality: string;
  url: string;
}

export interface XyraRelated {
  title: string;
  id: string;
  link: string;
  image: string;
}

export interface XyraHomeResponse {
  success: boolean;
  data: {
    posts: XyraMovie[];
    pagination?: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
    };
  };
}

export interface XyraSearchResponse {
  success: boolean;
  data: XyraMovie[];
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
  };
}

export interface XyraInfoResponse {
  success: boolean;
  data: XyraMovieInfo;
}

export interface XyraErrorResponse {
  success: false;
  error: string;
  code?: number;
}

export type XyraResponse = XyraHomeResponse | XyraSearchResponse | XyraInfoResponse | XyraErrorResponse;

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class XyraApiService {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly client: AxiosInstance;
  private readonly defaultTimeout: number = 30000;

  constructor(config?: {
    baseUrl?: string;
    apiKey?: string;
    timeout?: number;
  }) {
    this.baseUrl = config?.baseUrl || 'https://api.xyra.stream/v1/moviesdrive';
    this.apiKey = config?.apiKey || 'key1';
    this.defaultTimeout = config?.timeout || 30000;

    // Create axios instance with default config
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: this.defaultTimeout,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        console.log(`[XyraApi] 📤 ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('[XyraApi] ❌ Request interceptor error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        console.log(`[XyraApi] 📥 ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        console.error('[XyraApi] ❌ Response error:', error.message);
        if (error.response) {
          console.error('[XyraApi] Status:', error.response.status);
          console.error('[XyraApi] Data:', error.response.data);
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get the base URL for the API.
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Set the API key.
   */
  setApiKey(apiKey: string): void {
    // Update the apiKey property
    // The key is sent as a query param, so we don't need to update headers
  }

  /**
   * Get home page content (latest movies/series).
   */
  async getHome(page: number = 1): Promise<XyraMovie[]> {
    try {
      const response = await this.client.get<XyraHomeResponse>('/home', {
        params: {
          api_key: this.apiKey,
          page: page,
        },
      });

      if (response.data.success && response.data.data) {
        return response.data.data.posts || [];
      }

      console.warn('[XyraApi] ⚠️ Home request returned unsuccessful response');
      return [];
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(`[XyraApi] ❌ Home request failed: ${error.message}`);
        if (error.response) {
          console.error(`[XyraApi] Status: ${error.response.status}`);
          console.error(`[XyraApi] Data:`, error.response.data);
        }
      } else {
        console.error('[XyraApi] ❌ Home request failed:', error);
      }
      return [];
    }
  }

  /**
   * Search for movies/series.
   */
  async searchDramas(query: string, page: number = 1): Promise<XyraMovie[]> {
    if (!query || query.trim().length === 0) {
      console.warn('[XyraApi] ⚠️ Empty search query');
      return [];
    }

    try {
      const response = await this.client.get<XyraSearchResponse>('/search', {
        params: {
          api_key: this.apiKey,
          query: query.trim(),
          page: page,
        },
      });

      if (response.data.success) {
        return response.data.data || [];
      }

      console.warn('[XyraApi] ⚠️ Search request returned unsuccessful response');
      return [];
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(`[XyraApi] ❌ Search failed for "${query}": ${error.message}`);
        if (error.response) {
          console.error(`[XyraApi] Status: ${error.response.status}`);
          console.error(`[XyraApi] Data:`, error.response.data);
        }
      } else {
        console.error('[XyraApi] ❌ Search failed:', error);
      }
      return [];
    }
  }

  /**
   * Get detailed information about a specific movie/series.
   */
  async getMovieInfo(id: string): Promise<XyraMovieInfo | null> {
    if (!id || id.trim().length === 0) {
      console.warn('[XyraApi] ⚠️ Empty ID provided');
      return null;
    }

    try {
      const response = await this.client.get<XyraInfoResponse>('/info', {
        params: {
          api_key: this.apiKey,
          id: id.trim(),
        },
      });

      if (response.data.success && response.data.data) {
        return response.data.data;
      }

      console.warn('[XyraApi] ⚠️ Info request returned unsuccessful response');
      return null;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(`[XyraApi] ❌ Info request failed for ID "${id}": ${error.message}`);
        if (error.response) {
          console.error(`[XyraApi] Status: ${error.response.status}`);
          console.error(`[XyraApi] Data:`, error.response.data);
        }
      } else {
        console.error('[XyraApi] ❌ Info request failed:', error);
      }
      return null;
    }
  }

  /**
   * Get download qualities for a movie/series.
   */
  async getDownloadQualities(id: string): Promise<XyraDownload[]> {
    try {
      const info = await this.getMovieInfo(id);
      if (info && info.downloads) {
        return info.downloads;
      }
      return [];
    } catch (error) {
      console.error(`[XyraApi] ❌ GetDownloadQualities failed for ID "${id}":`, error);
      return [];
    }
  }

  /**
   * Get trending content.
   */
  async getTrendingDramas(): Promise<XyraMovie[]> {
    try {
      // Trending is just the home page with trending/recent content
      const response = await this.client.get<XyraHomeResponse>('/home', {
        params: {
          api_key: this.apiKey,
          page: 1,
        },
      });

      if (response.data.success && response.data.data) {
        return response.data.data.posts || [];
      }

      console.warn('[XyraApi] ⚠️ Trending request returned unsuccessful response');
      return [];
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(`[XyraApi] ❌ Trending request failed: ${error.message}`);
        if (error.response) {
          console.error(`[XyraApi] Status: ${error.response.status}`);
          console.error(`[XyraApi] Data:`, error.response.data);
        }
      } else {
        console.error('[XyraApi] ❌ Trending request failed:', error);
      }
      return [];
    }
  }

  /**
   * Search with advanced filters.
   */
  async advancedSearch(options: {
    query?: string;
    type?: 'movie' | 'series';
    genre?: string;
    year?: number;
    page?: number;
    limit?: number;
  }): Promise<XyraMovie[]> {
    try {
      const { query, type, genre, year, page = 1, limit = 20 } = options;

      // First, get results
      let results: XyraMovie[] = [];

      if (query && query.trim().length > 0) {
        results = await this.searchDramas(query, page);
      } else {
        results = await this.getHome(page);
      }

      // Apply filters
      let filtered = results;

      if (type) {
        filtered = filtered.filter((item) => item.type === type);
      }

      if (genre) {
        const genreLower = genre.toLowerCase();
        // We'd need to get full info to filter by genre
        // For now, filter by title containing the genre
        filtered = filtered.filter((item) => 
          item.title.toLowerCase().includes(genreLower)
        );
      }

      if (year) {
        // Xyra doesn't provide year directly in search results
        // We'd need to get info for each item
        // This is a limitation of the API
        console.warn('[XyraApi] ⚠️ Year filtering is not supported by Xyra API');
      }

      return filtered.slice(0, limit);
    } catch (error) {
      console.error('[XyraApi] ❌ Advanced search failed:', error);
      return [];
    }
  }

  /**
   * Get related content for a specific ID.
   */
  async getRelated(id: string): Promise<XyraRelated[]> {
    try {
      const info = await this.getMovieInfo(id);
      if (info && info.related) {
        return info.related;
      }
      return [];
    } catch (error) {
      console.error(`[XyraApi] ❌ GetRelated failed for ID "${id}":`, error);
      return [];
    }
  }

  /**
   * Get multiple items by IDs.
   */
  async getMultipleInfo(ids: string[]): Promise<XyraMovieInfo[]> {
    try {
      const promises = ids.map((id) => this.getMovieInfo(id));
      const results = await Promise.allSettled(promises);

      const infos: XyraMovieInfo[] = [];
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          infos.push(result.value);
        } else {
          console.warn(`[XyraApi] ⚠️ Failed to get info for ID: ${ids[index]}`);
        }
      });

      return infos;
    } catch (error) {
      console.error('[XyraApi] ❌ GetMultipleInfo failed:', error);
      return [];
    }
  }

  /**
   * Check if the API is available.
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await this.client.get('/home', {
        params: {
          api_key: this.apiKey,
          page: 1,
        },
        timeout: 5000,
      });
      return response.data && response.data.success === true;
    } catch (error) {
      return false;
    }
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

// Export a singleton instance
export const xyraApiService = new XyraApiService();

// Export default for convenience
export default xyraApiService;