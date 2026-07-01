// src/api/consumet/consumetApi.ts
import axios from 'axios';

const CONSUMET_BASE_URL = 'https://api.consumet.org';

export interface ConsumetMovie {
  id: string;
  title: string;
  overview: string;
  poster: string;
  backdrop: string;
  rating: number;
  genres: string[];
  releaseDate: string;
  runtime: number;
  status: string;
}

export interface ConsumetTVShow {
  id: string;
  title: string;
  overview: string;
  poster: string;
  backdrop: string;
  rating: number;
  genres: string[];
  releaseDate: string;
  seasons: number;
  episodes: number;
  status: string;
}

export interface ConsumetAnime {
  id: string;
  title: string;
  synopsis: string;
  image: string;
  cover: string;
  rating: number;
  genres: string[];
  totalEpisodes: number;
  status: string;
}

export interface ConsumetStream {
  url: string;
  quality: string;
  format: string;
  headers?: Record<string, string>;
}

export class ConsumetApiService {
  private static instance: ConsumetApiService;

  static getInstance(): ConsumetApiService {
    if (!ConsumetApiService.instance) {
      ConsumetApiService.instance = new ConsumetApiService();
    }
    return ConsumetApiService.instance;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MOVIES
  // ─────────────────────────────────────────────────────────────────────────

  async searchMovies(query: string, page: number = 1): Promise<ConsumetMovie[]> {
    try {
      const response = await axios.get(`${CONSUMET_BASE_URL}/movies/${query}`, {
        params: { page }
      });
      return response.data.results || [];
    } catch (error) {
      console.error('[Consumet] Search movies error:', error);
      return [];
    }
  }

  async getMovieInfo(id: string): Promise<ConsumetMovie | null> {
    try {
      const response = await axios.get(`${CONSUMET_BASE_URL}/movies/info?id=${id}`);
      return response.data;
    } catch (error) {
      console.error('[Consumet] Movie info error:', error);
      return null;
    }
  }

  async getMovieSources(id: string): Promise<ConsumetStream[]> {
    try {
      const response = await axios.get(`${CONSUMET_BASE_URL}/movies/watch/${id}`);
      return response.data.sources || [];
    } catch (error) {
      console.error('[Consumet] Movie sources error:', error);
      return [];
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TV SHOWS
  // ─────────────────────────────────────────────────────────────────────────

  async searchTVShows(query: string, page: number = 1): Promise<ConsumetTVShow[]> {
    try {
      const response = await axios.get(`${CONSUMET_BASE_URL}/tv/${query}`, {
        params: { page }
      });
      return response.data.results || [];
    } catch (error) {
      console.error('[Consumet] Search TV error:', error);
      return [];
    }
  }

  async getTVInfo(id: string): Promise<ConsumetTVShow | null> {
    try {
      const response = await axios.get(`${CONSUMET_BASE_URL}/tv/info?id=${id}`);
      return response.data;
    } catch (error) {
      console.error('[Consumet] TV info error:', error);
      return null;
    }
  }

  async getTVSources(id: string, season: number, episode: number): Promise<ConsumetStream[]> {
    try {
      const response = await axios.get(`${CONSUMET_BASE_URL}/tv/watch/${id}`, {
        params: { season, episode }
      });
      return response.data.sources || [];
    } catch (error) {
      console.error('[Consumet] TV sources error:', error);
      return [];
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ANIME
  // ─────────────────────────────────────────────────────────────────────────

  async searchAnime(query: string, page: number = 1): Promise<ConsumetAnime[]> {
    try {
      const response = await axios.get(`${CONSUMET_BASE_URL}/anime/${query}`, {
        params: { page }
      });
      return response.data.results || [];
    } catch (error) {
      console.error('[Consumet] Search anime error:', error);
      return [];
    }
  }

  async getAnimeInfo(id: string): Promise<ConsumetAnime | null> {
    try {
      const response = await axios.get(`${CONSUMET_BASE_URL}/anime/info?id=${id}`);
      return response.data;
    } catch (error) {
      console.error('[Consumet] Anime info error:', error);
      return null;
    }
  }

  async getAnimeSources(id: string): Promise<ConsumetStream[]> {
    try {
      const response = await axios.get(`${CONSUMET_BASE_URL}/anime/watch/${id}`);
      return response.data.sources || [];
    } catch (error) {
      console.error('[Consumet] Anime sources error:', error);
      return [];
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RECENTLY ADDED / POPULAR
  // ─────────────────────────────────────────────────────────────────────────

  async getRecentMovies(): Promise<ConsumetMovie[]> {
    try {
      const response = await axios.get(`${CONSUMET_BASE_URL}/movies/recent`);
      return response.data.results || [];
    } catch (error) {
      console.error('[Consumet] Recent movies error:', error);
      return [];
    }
  }

  async getRecentTVShows(): Promise<ConsumetTVShow[]> {
    try {
      const response = await axios.get(`${CONSUMET_BASE_URL}/tv/recent`);
      return response.data.results || [];
    } catch (error) {
      console.error('[Consumet] Recent TV error:', error);
      return [];
    }
  }

  async getPopularAnime(): Promise<ConsumetAnime[]> {
    try {
      const response = await axios.get(`${CONSUMET_BASE_URL}/anime/popular`);
      return response.data.results || [];
    } catch (error) {
      console.error('[Consumet] Popular anime error:', error);
      return [];
    }
  }
}

export const consumetApiService = ConsumetApiService.getInstance();