// src/services/unified/metadata/adapters/MovieBoxMetadataAdapter.ts

import { IMetadataResult } from '../../../unified/types/MetadataTypes';
import { 
  boxOffice, 
  SubjectType, 
  ApiVersion, 
  SearchResultItem,
  MovieDetails,
  TVSeriesDetails,
  V2ItemDetails,
} from '../../../../../modules/boxoffice';

export class MovieBoxMetadataAdapter {
  private initialized = false;

  constructor() {}

  /**
   * Ensure the boxOffice engine is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    
    try {
      await boxOffice.initialize();
      this.initialized = true;
      console.log('[MovieBoxMetadataAdapter] Initialized');
    } catch (error) {
      console.error('[MovieBoxMetadataAdapter] Failed to initialize:', error);
      throw error;
    }
  }

  async search(query: string, type?: 'movie' | 'tv', limit: number = 20): Promise<IMetadataResult[]> {
    try {
      await this.ensureInitialized();

      // Map the type to SubjectType
      let subjectType: SubjectType;
      if (type === 'tv') {
        subjectType = SubjectType.TV_SERIES;
      } else if (type === 'movie') {
        subjectType = SubjectType.MOVIES;
      } else {
        subjectType = SubjectType.ALL;
      }

      // Search using boxOffice
      const results = await boxOffice.search(
        query,
        1, // page
        24, // per page
        subjectType,
        ApiVersion.V2
      );

      // Take only the first 'limit' results
      const limitedResults = results.items.slice(0, limit);

      // Map to IMetadataResult format
      return limitedResults.map((item: SearchResultItem) => ({
        id: item.subjectId || '',
        title: item.title || '',
        type: item.subjectType === SubjectType.TV_SERIES ? 'tv' : 'movie',
        overview: item.description || '',
        poster: this.getBestPoster(item),
        backdrop: this.getBestBackdrop(item),
        rating: item.rating || 0,
        year: this.extractYear(item.releaseDate),
        source: 'moviebox',
        originalData: item,
      }));
    } catch (error) {
      console.error('[MovieBoxMetadataAdapter] Search failed:', error);
      return [];
    }
  }

  async getById(id: string, type: 'movie' | 'tv'): Promise<IMetadataResult | null> {
    try {
      await this.ensureInitialized();

      let details: MovieDetails | TVSeriesDetails | null = null;

      if (type === 'tv') {
        const result = await boxOffice.getTVSeriesDetails(id, ApiVersion.V1);
        details = result.data;
      } else {
        const result = await boxOffice.getMovieDetails(id, ApiVersion.V1);
        details = result.data;
      }

      if (!details) return null;

      // Get downloadable files (for stream info)
      const subjectType = type === 'tv' ? SubjectType.TV_SERIES : SubjectType.MOVIES;
      const files = await boxOffice.getDownloadableFiles(
        id,
        subjectType,
        ApiVersion.V1
      );

      return {
        id: details.subjectId || id,
        title: details.title || '',
        type: type,
        overview: details.description || details.overview || '',
        poster: this.getBestPoster(details),
        backdrop: this.getBestBackdrop(details),
        rating: details.rating || details.voteAverage || 0,
        year: this.extractYear(details.releaseDate || details.firstAirDate),
        source: 'moviebox',
        originalData: {
          details,
          files: files.hasResource ? files : null,
        },
      };
    } catch (error) {
      console.error('[MovieBoxMetadataAdapter] GetById failed:', error);
      return null;
    }
  }

  /**
   * Get trending content from MovieBox
   */
  async getTrending(type?: 'movie' | 'tv', page: number = 1): Promise<IMetadataResult[]> {
    try {
      await this.ensureInitialized();

      const results = await boxOffice.getTrending(page, 24, ApiVersion.V2);
      
      return results.data.map((item: any) => ({
        id: item.subjectId || '',
        title: item.title || '',
        type: item.subjectType === SubjectType.TV_SERIES ? 'tv' : 'movie',
        overview: item.description || '',
        poster: this.getBestPoster(item),
        backdrop: this.getBestBackdrop(item),
        rating: item.rating || 0,
        year: this.extractYear(item.releaseDate),
        source: 'moviebox',
      }));
    } catch (error) {
      console.error('[MovieBoxMetadataAdapter] GetTrending failed:', error);
      return [];
    }
  }

  /**
   * Get hot content (movies & TV series)
   */
  async getHotContent(): Promise<{ movies: IMetadataResult[]; tvSeries: IMetadataResult[] }> {
    try {
      await this.ensureInitialized();

      const hot = await boxOffice.getHotContent(ApiVersion.V2);
      
      const mapItem = (item: any): IMetadataResult => ({
        id: item.subjectId || '',
        title: item.title || '',
        type: item.subjectType === SubjectType.TV_SERIES ? 'tv' : 'movie',
        overview: item.description || '',
        poster: this.getBestPoster(item),
        backdrop: this.getBestBackdrop(item),
        rating: item.rating || 0,
        year: this.extractYear(item.releaseDate),
        source: 'moviebox',
      });

      return {
        movies: (hot.movies || []).map(mapItem),
        tvSeries: (hot.tvSeries || []).map(mapItem),
      };
    } catch (error) {
      console.error('[MovieBoxMetadataAdapter] GetHotContent failed:', error);
      return { movies: [], tvSeries: [] };
    }
  }

  /**
   * Get homepage content (categorized content)
   */
  async getHomepage(): Promise<any[]> {
    try {
      await this.ensureInitialized();
      const homepage = await boxOffice.getHomepage(ApiVersion.V2);
      return homepage.categories || [];
    } catch (error) {
      console.error('[MovieBoxMetadataAdapter] GetHomepage failed:', error);
      return [];
    }
  }

  /**
   * Get popular searches
   */
  async getPopularSearches(): Promise<string[]> {
    try {
      await this.ensureInitialized();
      const popular = await boxOffice.getPopularSearches(ApiVersion.V2);
      return popular.map((item: any) => item.query);
    } catch (error) {
      console.error('[MovieBoxMetadataAdapter] GetPopularSearches failed:', error);
      return [];
    }
  }

  // ==================== HELPERS ====================

  private getBestPoster(item: any): string {
    if (item.cover?.url) return item.cover.url;
    if (item.poster?.url) return item.poster.url;
    if (item.poster_path) return `https://image.tmdb.org/t/p/w500${item.poster_path}`;
    if (item.image?.url) return item.image.url;
    return '';
  }

  private getBestBackdrop(item: any): string {
    if (item.background?.url) return item.background.url;
    if (item.backdrop?.url) return item.backdrop.url;
    if (item.backdrop_path) return `https://image.tmdb.org/t/p/w780${item.backdrop_path}`;
    return '';
  }

  private extractYear(dateString?: string): string {
    if (!dateString) return '';
    const match = dateString.match(/^(\d{4})/);
    return match ? match[1] : '';
  }

  /**
   * Clear all resources
   */
  destroy(): void {
    this.initialized = false;
    console.log('[MovieBoxMetadataAdapter] Destroyed');
  }
}

export default MovieBoxMetadataAdapter;