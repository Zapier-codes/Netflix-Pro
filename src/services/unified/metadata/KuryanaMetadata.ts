// src/services/unified/metadata/KuryanaMetadata.ts
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
      // FIXED: /search/q/{query} (NOT /api/search?q=)
      const response = await axios.get(`${KURYANA_BASE_URL}/search/q/${encodeURIComponent(query)}`);
      return response.data.results?.dramas || [];
    } catch (error: any) {
      console.error('[Kuryana] Search error:', error.message);
      return [];
    }
  }

  async getDramaDetails(slug: string): Promise<KuryanaDrama | null> {
    try {
      // FIXED: /id/{slug} (NOT /api/drama/{slug})
      const response = await axios.get(`${KURYANA_BASE_URL}/id/${slug}`);
      return response.data;
    } catch (error: any) {
      console.error('[Kuryana] Details error:', error.message);
      return null;
    }
  }

  async getDramaReviews(slug: string): Promise<KuryanaReview[]> {
    try {
      // FIXED: /id/{slug}/reviews (NOT /api/drama/{slug}/reviews)
      const response = await axios.get(`${KURYANA_BASE_URL}/id/${slug}/reviews`);
      return response.data.reviews || [];
    } catch (error: any) {
      console.error('[Kuryana] Reviews error:', error.message);
      return [];
    }
  }

  async getDramaCast(slug: string): Promise<KuryanaCast[]> {
    try {
      // NEW: /id/{slug}/cast
      const response = await axios.get(`${KURYANA_BASE_URL}/id/${slug}/cast`);
      return response.data.cast || [];
    } catch (error: any) {
      console.error('[Kuryana] Cast error:', error.message);
      return [];
    }
  }

  async getDramaEpisodes(slug: string): Promise<any[]> {
    try {
      // NEW: /id/{slug}/episodes
      const response = await axios.get(`${KURYANA_BASE_URL}/id/${slug}/episodes`);
      return response.data.episodes || [];
    } catch (error: any) {
      console.error('[Kuryana] Episodes error:', error.message);
      return [];
    }
  }

  async getSeasonalDramas(year: number, quarter: number): Promise<KuryanaDrama[]> {
    try {
      // FIXED: /seasonal/{year}/{quarter} (NOT /api/seasonal/{year}/{quarter})
      const response = await axios.get(`${KURYANA_BASE_URL}/seasonal/${year}/${quarter}`);
      return response.data.results || [];
    } catch (error: any) {
      console.error('[Kuryana] Seasonal error:', error.message);
      return [];
    }
  }

  // REMOVED: getTrendingDramas() — endpoint doesn't exist
  // REMOVED: getPopularDramas() — endpoint doesn't exist
  // REMOVED: getDramaRecommendations() — endpoint doesn't exist
}

export const kuryanaApiService = new KuryanaApiService();
export default kuryanaApiService;