// src/api/ApiService.ts

export class ApiService {
  private static instance: ApiService;
  public baseUrl: string;

  private constructor() {
    this.baseUrl = 'https://netflix-tf79.onrender.com';
  }

  public static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }

  async getStream(id: string, type: 'movie' | 'tv', season?: number, episode?: number, title?: string): Promise<any> {
    try {
      let url = `${this.baseUrl}/stream/${id}`;
      const params = new URLSearchParams();
      if (season !== undefined) params.append('s', String(season));
      if (episode !== undefined) params.append('e', String(episode));
      if (title) params.append('title', encodeURIComponent(title));
      if (params.toString()) url += `?${params.toString()}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('[ApiService] getStream error:', error);
      throw error;
    }
  }

  // ─── NEW: Convenience helper for episode-specific streams ───
  async getEpisodeStream(id: string, season: number, episode: number, title?: string): Promise<any> {
    return this.getStream(id, 'tv', season, episode, title);
  }

  async getProRCP(id: string, type: 'movie' | 'tv', season?: number, episode?: number, title?: string): Promise<any> {
    try {
      let url = `${this.baseUrl}/prorcp/${id}`;
      const params = new URLSearchParams();
      params.append('type', type);
      if (season !== undefined) params.append('s', String(season));
      if (episode !== undefined) params.append('e', String(episode));
      if (title) params.append('title', encodeURIComponent(title));
      url += `?${params.toString()}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('[ApiService] getProRCP error:', error);
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return response.ok;
    } catch (error) {
      console.error('[ApiService] healthCheck error:', error);
      return false;
    }
  }
}

export const apiService = ApiService.getInstance();