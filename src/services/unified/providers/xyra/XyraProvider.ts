// src/api/xyra/xyraApi.ts
import axios from 'axios';

const XYRA_BASE_URL = 'https://api.xyra.stream/v1/moviesdrive';
const XYRA_API_KEY = 'key1';

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

export class XyraApiService {
  private apiKey: string;

  constructor(apiKey: string = XYRA_API_KEY) {
    this.apiKey = apiKey;
  }

  // ─── Home - Browse latest movies/series ───
  async getHome(page: number = 1): Promise<XyraMovie[]> {
    try {
      const response = await axios.get(`${XYRA_BASE_URL}/home`, {
        params: { 
          api_key: this.apiKey,
          page: page
        },
        timeout: 10000,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        }
      });
      
      if (response.data.success && response.data.data) {
        return response.data.data.posts || [];
      }
      return [];
    } catch (error) {
      console.log('[Xyra] Home not available:', error);
      return [];
    }
  }

  // ─── Search movies/series ───
  async searchDramas(query: string, page: number = 1): Promise<XyraMovie[]> {
    try {
      const response = await axios.get(`${XYRA_BASE_URL}/search`, {
        params: { 
          api_key: this.apiKey,
          query: query,
          page: page
        },
        timeout: 10000,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        }
      });
      
      if (response.data.success) {
        return response.data.data || [];
      }
      return [];
    } catch (error) {
      console.log('[Xyra] Search not available:', error);
      return [];
    }
  }

  // ─── Get movie/series info with download links ───
  async getMovieInfo(id: string): Promise<XyraMovieInfo | null> {
    try {
      const response = await axios.get(`${XYRA_BASE_URL}/info`, {
        params: { 
          api_key: this.apiKey,
          id: id
        },
        timeout: 10000,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        }
      });
      
      if (response.data.success) {
        return response.data.data;
      }
      return null;
    } catch (error) {
      console.log('[Xyra] Info not available:', error);
      return null;
    }
  }

  // ─── Get download qualities for a movie ───
  async getDownloadQualities(id: string): Promise<XyraDownload[]> {
    try {
      const info = await this.getMovieInfo(id);
      if (info && info.downloads) {
        return info.downloads;
      }
      return [];
    } catch (error) {
      console.log('[Xyra] Qualities not available:', error);
      return [];
    }
  }

  // ─── Get trending movies ───
  async getTrendingDramas(): Promise<XyraMovie[]> {
    try {
      const response = await axios.get(`${XYRA_BASE_URL}/home`, {
        params: { 
          api_key: this.apiKey,
          page: 1
        },
        timeout: 10000,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        }
      });
      
      if (response.data.success && response.data.data) {
        // Filter to get only trending/recent content
        return response.data.data.posts || [];
      }
      return [];
    } catch (error) {
      console.log('[Xyra] Trending not available:', error);
      return [];
    }
  }
}

export const xyraApiService = new XyraApiService();
export default xyraApiService;