// src/api/subtitles/subdlApi.ts
import axios from 'axios';

const SUBDL_BASE_URL = 'https://subdl.com/api/v1';

export interface SubdlSubtitle {
  id: string;
  name: string;
  language: string;
  languageCode: string;
  url: string;
  downloads: number;
  rating: number;
  uploadDate: string;
}

export class SubdlApiService {
  private apiKey: string;

  constructor(apiKey: string = '') {
    this.apiKey = apiKey;
  }

  async searchSubtitles(title: string, language?: string): Promise<SubdlSubtitle[]> {
    try {
      const params: any = { title, apikey: this.apiKey };
      if (language) params.language = language;
      
      const response = await axios.get(${SUBDL_BASE_URL}/subtitles, { params });
      return response.data.subtitles || [];
    } catch (error) {
      console.error('[SubDL] Search error:', error);
      return [];
    }
  }

  async getSubtitleFile(id: string): Promise<string | null> {
    try {
      const response = await axios.get(${SUBDL_BASE_URL}/subtitle/, {
        params: { apikey: this.apiKey }
      });
      return response.data.url || null;
    } catch (error) {
      console.error('[SubDL] File error:', error);
      return null;
    }
  }

  async getLanguages(): Promise<{ code: string; name: string }[]> {
    try {
      const response = await axios.get(${SUBDL_BASE_URL}/languages, {
        params: { apikey: this.apiKey }
      });
      return response.data.languages || [];
    } catch (error) {
      console.error('[SubDL] Languages error:', error);
      return [];
    }
  }
}

export const subdlApiService = new SubdlApiService(process.env.SUBDL_API_KEY || '');
