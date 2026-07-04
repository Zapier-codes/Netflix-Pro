// src/api/kuryana/kuryanaApi.ts
import axios from 'axios';

const KURYANA_BASE_URL = 'https://kuryana.tbdh.app';

export interface KuryanaDrama {
  id: string;
  slug: string;
  title: string;
  synopsis: string;
  poster: string;
  backdrop: string;
  rating: number;
  genres: string[];
  country: string;
  year: number;
  totalEpisodes: number;
  duration: string;
  cast: KuryanaCast[];
}

export interface KuryanaCast {
  name: string;
  role: string;
  image: string;
}

export interface KuryanaReview {
  id: string;
  username: string;
  avatar: string;
  rating: number;
  review: string;
  helpfulCount: number;
  createdAt: string;
}

export interface KuryanaRecommendation {
  id: string;
  title: string;
  poster: string;
  rating: number;
}

export class KuryanaApiService {
  async searchDramas(query: string): Promise<KuryanaDrama[]> {
    try {
      // Fix: Use backticks and ${} for template literal
      const response = await axios.get(`${KURYANA_BASE_URL}/api/search?q=${encodeURIComponent(query)}`);
      return response.data.results || [];
    } catch (error) {
      console.error('[Kuryana] Search error:', error);
      return [];
    }
  }

  async getDramaDetails(slug: string): Promise<KuryanaDrama | null> {
    try {
      // Fix: Use backticks and ${} for template literal with slug parameter
      const response = await axios.get(`${KURYANA_BASE_URL}/api/drama/${slug}`);
      return response.data;
    } catch (error) {
      console.error('[Kuryana] Details error:', error);
      return null;
    }
  }

  async getDramaReviews(slug: string): Promise<KuryanaReview[]> {
    try {
      // Fix: Use backticks and ${} for template literal with slug parameter
      const response = await axios.get(`${KURYANA_BASE_URL}/api/drama/${slug}/reviews`);
      return response.data.reviews || [];
    } catch (error) {
      console.error('[Kuryana] Reviews error:', error);
      return [];
    }
  }

  async getDramaRecommendations(slug: string): Promise<KuryanaRecommendation[]> {
    try {
      // Fix: Use backticks and ${} for template literal with slug parameter
      const response = await axios.get(`${KURYANA_BASE_URL}/api/drama/${slug}/recommendations`);
      return response.data.recommendations || [];
    } catch (error) {
      console.error('[Kuryana] Recommendations error:', error);
      return [];
    }
  }

  async getSeasonalDramas(year: number, quarter: number): Promise<KuryanaDrama[]> {
    try {
      // Fix: Use backticks and ${} for template literal with parameters
      const response = await axios.get(`${KURYANA_BASE_URL}/api/seasonal/${year}/${quarter}`);
      return response.data.results || [];
    } catch (error) {
      console.error('[Kuryana] Seasonal error:', error);
      return [];
    }
  }

  async getTrendingDramas(): Promise<KuryanaDrama[]> {
    try {
      // New method for trending dramas
      const response = await axios.get(`${KURYANA_BASE_URL}/api/trending`);
      return response.data.results || [];
    } catch (error) {
      console.error('[Kuryana] Trending error:', error);
      return [];
    }
  }

  async getPopularDramas(): Promise<KuryanaDrama[]> {
    try {
      // New method for popular dramas
      const response = await axios.get(`${KURYANA_BASE_URL}/api/popular`);
      return response.data.results || [];
    } catch (error) {
      console.error('[Kuryana] Popular error:', error);
      return [];
    }
  }
}

export const kuryanaApiService = new KuryanaApiService();
export default kuryanaApiService;