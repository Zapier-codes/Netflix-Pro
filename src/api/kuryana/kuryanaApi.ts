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
      const response = await axios.get(${KURYANA_BASE_URL}/api/search/q/);
      return response.data.results || [];
    } catch (error) {
      console.error('[Kuryana] Search error:', error);
      return [];
    }
  }

  async getDramaDetails(slug: string): Promise<KuryanaDrama | null> {
    try {
      const response = await axios.get(${KURYANA_BASE_URL}/api/id/);
      return response.data;
    } catch (error) {
      console.error('[Kuryana] Details error:', error);
      return null;
    }
  }

  async getDramaReviews(slug: string): Promise<KuryanaReview[]> {
    try {
      const response = await axios.get(${KURYANA_BASE_URL}/api/id//reviews);
      return response.data.reviews || [];
    } catch (error) {
      console.error('[Kuryana] Reviews error:', error);
      return [];
    }
  }

  async getDramaRecommendations(slug: string): Promise<KuryanaRecommendation[]> {
    try {
      const response = await axios.get(${KURYANA_BASE_URL}/api/id//recs);
      return response.data.recommendations || [];
    } catch (error) {
      console.error('[Kuryana] Recommendations error:', error);
      return [];
    }
  }

  async getSeasonalDramas(year: number, quarter: number): Promise<KuryanaDrama[]> {
    try {
      const response = await axios.get(${KURYANA_BASE_URL}/api/seasonal//);
      return response.data.results || [];
    } catch (error) {
      console.error('[Kuryana] Seasonal error:', error);
      return [];
    }
  }
}

export const kuryanaApiService = new KuryanaApiService();
