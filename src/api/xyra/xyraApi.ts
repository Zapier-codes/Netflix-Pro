// src/api/xyra/xyraApi.ts
import axios from 'axios';

const XYRA_BASE_URL = 'https://api.xyra.stream/v1/dramacool';

export interface XyraDrama {
  id: string;
  title: string;
  alternativeTitles: string[];
  synopsis: string;
  poster: string;
  backdrop: string;
  rating: number;
  genres: string[];
  country: string;
  year: number;
  status: 'Ongoing' | 'Completed';
  episodes: XyraEpisode[];
  cast: XyraCast[];
}

export interface XyraEpisode {
  id: string;
  number: number;
  title: string;
  airDate: string;
  streamUrl: string;
  subtitles: XyraSubtitle[];
}

export interface XyraSubtitle {
  language: string;
  url: string;
}

export interface XyraCast {
  name: string;
  role: string;
  image: string;
}

export class XyraApiService {
  private apiKey: string;

  constructor(apiKey: string = '') {
    this.apiKey = apiKey;
  }

  async searchDramas(query: string): Promise<XyraDrama[]> {
    try {
      const response = await axios.get(${XYRA_BASE_URL}/search, {
        params: { q: query, apikey: this.apiKey }
      });
      return response.data.results || [];
    } catch (error) {
      console.error('[Xyra] Search error:', error);
      return [];
    }
  }

  async getDramaDetails(id: string): Promise<XyraDrama | null> {
    try {
      const response = await axios.get(${XYRA_BASE_URL}/drama/, {
        params: { apikey: this.apiKey }
      });
      return response.data;
    } catch (error) {
      console.error('[Xyra] Details error:', error);
      return null;
    }
  }

  async getEpisodeStream(id: string): Promise<{ url: string; subtitles: XyraSubtitle[] } | null> {
    try {
      const response = await axios.get(${XYRA_BASE_URL}/episode/, {
        params: { apikey: this.apiKey }
      });
      return {
        url: response.data.streamUrl,
        subtitles: response.data.subtitles || []
      };
    } catch (error) {
      console.error('[Xyra] Stream error:', error);
      return null;
    }
  }

  async getTrendingDramas(): Promise<XyraDrama[]> {
    try {
      const response = await axios.get(${XYRA_BASE_URL}/trending, {
        params: { apikey: this.apiKey }
      });
      return response.data.results || [];
    } catch (error) {
      console.error('[Xyra] Trending error:', error);
      return [];
    }
  }
}

export const xyraApiService = new XyraApiService();
