// src/services/unified/metadata/adapters/XyraMetadataAdapter.ts

/**
 * XyraMetadataAdapter - Adapter that wraps Xyra provider for metadata.
 * Uses the Xyra API for search, discover, and trending.
 * Xyra is better for Korean, Asian, and international content.
 */

import { IMetadataResult, DiscoverFilters } from '../../../unified/types/MetadataTypes';
import { XyraProvider } from '../../providers/xyra/XyraProvider';

// Sort option literal type matching DiscoverFilters.sortBy
type SortOption =
  | 'popularity.desc'
  | 'popularity.asc'
  | 'release_date.desc'
  | 'release_date.asc'
  | 'vote_average.desc'
  | 'vote_average.asc'
  | 'vote_count.desc'
  | 'vote_count.asc';

// Xyra genre mappings
const XYRA_GENRE_MAP: Record<string, string[]> = {
  'Action': ['Action'],
  'Adventure': ['Adventure'],
  'Animation': ['Animation', 'Anime'],
  'Comedy': ['Comedy'],
  'Crime': ['Crime'],
  'Documentary': ['Documentary'],
  'Drama': ['Drama'],
  'Family': ['Family'],
  'Fantasy': ['Fantasy'],
  'Horror': ['Horror'],
  'Mystery': ['Mystery'],
  'Romance': ['Romance'],
  'Sci-Fi': ['Sci-Fi', 'Science Fiction'],
  'Thriller': ['Thriller'],
  'War': ['War'],
  'Western': ['Western'],
  'Anime': ['Animation', 'Anime'],
  'Korean': ['Korean', 'K-Drama'],
  'K-Drama': ['Korean', 'K-Drama'],
  'Bollywood': ['Bollywood', 'Indian'],
  'Hollywood': ['Hollywood', 'American'],
  'Nollywood': ['Nollywood', 'Nigerian'],
  'Chinese': ['Chinese', 'C-Drama'],
  'C-Drama': ['Chinese', 'C-Drama'],
  'Japanese': ['Japanese', 'J-Drama'],
  'J-Drama': ['Japanese', 'J-Drama'],
  'Thai': ['Thai', 'Thai Drama'],
  'Taiwanese': ['Taiwanese', 'T-Drama'],
  'Turkish': ['Turkish', 'Turkish Drama'],
};

export class XyraMetadataAdapter {
  readonly name = 'Xyra';
  readonly id = 'xyra';
  readonly priority = 3;
  readonly enabled = true;
  private provider: XyraProvider;
  private initialized = false;

  constructor() {
    this.provider = new XyraProvider();
  }

  /**
   * Ensure the Xyra provider is initialized.
   */
  async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    try {
      console.log('[XyraMetadataAdapter] Initializing...');
      await this.provider.initialize();
      this.initialized = true;
      console.log('[XyraMetadataAdapter] ✅ Initialized');
    } catch (error) {
      console.error('[XyraMetadataAdapter] ❌ Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Search for movies or TV shows using Xyra API.
   */
  async search(options: {
    query?: string;
    type?: 'movie' | 'tv';
    limit?: number;
    languages?: string[];
    countries?: string[];
    region?: string;
    genres?: string[];
    certifications?: string[];
    minRating?: number;
    maxRating?: number;
    year?: number;
    startYear?: number;
    endYear?: number;
    keywords?: string[];
    includeAdult?: boolean;
    sortBy?: SortOption;
    language?: string;
    watchRegion?: string;
    extended?: string;
  }): Promise<IMetadataResult[]> {
    console.log(`[XyraMetadataAdapter] 🔍 Search called with:`, {
      query: options.query,
      type: options.type,
      limit: options.limit,
    });

    try {
      await this.ensureInitialized();

      const {
        query,
        type,
        limit = 20,
        languages,
        countries,
        region,
        genres,
        minRating,
        maxRating,
        year,
        sortBy = 'popularity.desc',
      } = options;

      if (!query || query.trim() === '') {
        console.log('[XyraMetadataAdapter] 🔄 Empty query - using discover mode');
        return this.discover({
          languages,
          countries: countries || (region ? [region] : undefined),
          region,
          genres,
          minRating,
          maxRating,
          year,
          type: type || 'all',
          limit,
          sortBy,
        }, limit);
      }

      // Search using Xyra provider
      const results = await this.provider.search({
        query: query,
        type: type,
        limit: limit,
      });

      console.log(`[XyraMetadataAdapter] 📥 Raw results: ${results?.length || 0}`);

      if (!results || results.length === 0) {
        console.warn(`[XyraMetadataAdapter] ⚠️ No results found for "${query}"`);
        return [];
      }

      // Log sample results
      const sample = results.slice(0, 3);
      sample.forEach((item: any, index: number) => {
        console.log(`[XyraMetadataAdapter] 📊 Sample ${index + 1}:`, {
          title: item.title,
          type: item.type,
          source: item.source,
          id: item.id,
        });
      });

      // Map to IMetadataResult
      let mapped = results.map((item: any) => this.mapToMetadataResult(item));

      // Apply additional filters
      mapped = this.applyFilters(mapped, {
        languages,
        countries,
        region,
        genres,
        minRating,
        maxRating,
        year,
      });

      // Sort results
      mapped = this.sortResults(mapped, sortBy);

      const finalResults = mapped.slice(0, limit);
      console.log(`[XyraMetadataAdapter] ✅ Returning ${finalResults.length} results for "${query}"`);
      return finalResults;
    } catch (error) {
      console.error('[XyraMetadataAdapter] ❌ Search failed:', error);
      if (error instanceof Error) {
        console.error('[XyraMetadataAdapter] Error details:', error.message);
      }
      return [];
    }
  }

  /**
   * Discover - category browsing without a keyword.
   */
  async discover(filters: DiscoverFilters, limit: number = 20): Promise<IMetadataResult[]> {
    console.log('[XyraMetadataAdapter] 🔍 Discover called with filters:', filters);

    try {
      await this.ensureInitialized();

      const results: IMetadataResult[] = [];

      // Try to get trending content from Xyra
      try {
        const trendingResults = await this.provider.getTrending(limit);
        if (trendingResults && trendingResults.length > 0) {
          console.log(`[XyraMetadataAdapter] 📊 Trending results: ${trendingResults.length}`);

          // Filter by type if specified
          let filtered = trendingResults;
          if (filters.type === 'movie') {
            filtered = filtered.filter((item: any) => item.type === 'movie');
          } else if (filters.type === 'tv') {
            filtered = filtered.filter((item: any) => item.type === 'tv');
          }

          // Map and filter
          let mapped = filtered.map((item: any) => this.mapToMetadataResult(item));
          mapped = this.applyFilters(mapped, {
            languages: filters.languages,
            countries: filters.countries,
            region: filters.region,
            genres: filters.genres,
            minRating: filters.minRating,
            maxRating: filters.maxRating,
            year: filters.year,
          });
          results.push(...mapped);
        }
      } catch (err) {
        console.warn('[XyraMetadataAdapter] ⚠️ Failed to get trending:', err);
      }

      // Sort and limit
      const sorted = this.sortResults(results, filters.sortBy || 'popularity.desc');
      const finalResults = sorted.slice(0, limit);
      console.log(`[XyraMetadataAdapter] ✅ Discover returned ${finalResults.length} results`);
      return finalResults;
    } catch (error) {
      console.error('[XyraMetadataAdapter] ❌ Discover failed:', error);
      return [];
    }
  }

  /**
   * Get metadata by ID.
   */
  async getById(id: string, type: 'movie' | 'tv'): Promise<IMetadataResult | null> {
    console.log(`[XyraMetadataAdapter] 🔍 Getting by ID: ${id} (${type})`);

    try {
      await this.ensureInitialized();

      const result = await this.provider.getDetails(id, type);
      if (!result) {
        console.warn(`[XyraMetadataAdapter] ⚠️ No details found for ID: ${id}`);
        return null;
      }

      const mapped = this.mapToMetadataResult(result);
      console.log(`[XyraMetadataAdapter] ✅ Found: ${mapped.title}`);
      return mapped;
    } catch (error) {
      console.error(`[XyraMetadataAdapter] ❌ GetById failed for ${id}:`, error);
      return null;
    }
  }

  /**
   * Get trending content from Xyra.
   */
  async getTrending(limit: number = 20, type?: 'movie' | 'tv'): Promise<IMetadataResult[]> {
    console.log(`[XyraMetadataAdapter] 📊 Getting trending (limit: ${limit}, type: ${type || 'all'})`);

    try {
      await this.ensureInitialized();

      const results = await this.provider.getTrending(limit);

      let items = results;
      if (type === 'movie') {
        items = items.filter((item: any) => item.type === 'movie');
      } else if (type === 'tv') {
        items = items.filter((item: any) => item.type === 'tv');
      }

      const mapped = items.slice(0, limit).map((item: any) => this.mapToMetadataResult(item));
      console.log(`[XyraMetadataAdapter] ✅ Trending returned ${mapped.length} results`);
      return mapped;
    } catch (error) {
      console.error('[XyraMetadataAdapter] ❌ GetTrending failed:', error);
      return [];
    }
  }

  /**
   * Get trending by category.
   */
  async getTrendingByCategory(category: string, limit: number = 20, region?: string): Promise<IMetadataResult[]> {
    console.log(`[XyraMetadataAdapter] 📊 Getting trending by category: ${category}`);

    try {
      await this.ensureInitialized();

      const results = await this.provider.getTrendingByCategory(category, limit, region);
      const mapped = results.map((item: any) => this.mapToMetadataResult(item));
      console.log(`[XyraMetadataAdapter] ✅ Category returned ${mapped.length} results`);
      return mapped;
    } catch (error) {
      console.error('[XyraMetadataAdapter] ❌ GetTrendingByCategory failed:', error);
      return [];
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Map Xyra result to IMetadataResult.
   */
  private mapToMetadataResult(item: any): IMetadataResult {
    return {
      id: item.id ?? '',
      title: item.title ?? '',
      type: item.type ?? 'movie',
      year: item.year ?? undefined,
      releaseDate: item.releaseDate ?? undefined,
      poster: item.poster ?? item.image ?? item.cover ?? '',
      backdrop: item.backdrop ?? item.background ?? '',
      overview: item.overview ?? item.description ?? '',
      rating: item.rating ?? 0,
      genres: item.genres ?? [],
      runtime: item.runtime ?? item.duration ?? undefined,
      cast: item.cast ?? [],
      source: 'xyra',
      originalLanguage: item.originalLanguage ?? undefined,
      originCountry: item.originCountry ?? [],
      originalTitle: item.originalTitle ?? item.title ?? '',
      popularity: item.popularity ?? 0,
      voteCount: item.voteCount ?? 0,
      certification: item.certification ?? undefined,
      tagline: item.tagline ?? undefined,
      status: item.status ?? undefined,
      keywords: item.keywords ?? [],
      belongsToCollection: item.belongsToCollection ?? undefined,
      watchProviders: item.watchProviders ?? undefined,
      budget: item.budget ?? undefined,
      revenue: item.revenue ?? undefined,
      networks: item.networks ?? undefined,
      spokenLanguages: item.spokenLanguages ?? undefined,
      productionCompanies: item.productionCompanies ?? undefined,
      productionCountries: item.productionCountries ?? undefined,
      numberOfSeasons: item.numberOfSeasons ?? undefined,
      numberOfEpisodes: item.numberOfEpisodes ?? undefined,
      lastAirDate: item.lastAirDate ?? undefined,
      inProduction: item.inProduction ?? false,
      providerData: item.providerData ?? undefined,
    };
  }

  /**
   * Apply filters client-side.
   */
  private applyFilters(results: IMetadataResult[], filters: {
    languages?: string[];
    countries?: string[];
    region?: string;
    genres?: string[];
    minRating?: number;
    maxRating?: number;
    year?: number;
    startYear?: number;
    endYear?: number;
    keywords?: string[];
    includeAdult?: boolean;
  }): IMetadataResult[] {
    let filtered = [...results];

    if (filters.languages && filters.languages.length > 0) {
      filtered = filtered.filter(item => 
        item.originalLanguage !== undefined && filters.languages!.includes(item.originalLanguage)
      );
    }

    if (filters.countries && filters.countries.length > 0) {
      filtered = filtered.filter(item => 
        item.originCountry !== undefined && item.originCountry.some(c => filters.countries!.includes(c))
      );
    }

    if (filters.genres && filters.genres.length > 0) {
      filtered = filtered.filter(item => 
        item.genres !== undefined && item.genres.some(g => filters.genres!.includes(g))
      );
    }

    if (filters.minRating !== undefined) {
      filtered = filtered.filter(item => (item.rating ?? 0) >= filters.minRating!);
    }

    if (filters.maxRating !== undefined) {
      filtered = filtered.filter(item => (item.rating ?? 0) <= filters.maxRating!);
    }

    if (filters.year !== undefined) {
      filtered = filtered.filter(item => item.year === filters.year);
    }

    if (filters.startYear !== undefined) {
      filtered = filtered.filter(item => (item.year ?? 0) >= filters.startYear!);
    }

    if (filters.endYear !== undefined) {
      filtered = filtered.filter(item => (item.year ?? 0) <= filters.endYear!);
    }

    if (filters.keywords && filters.keywords.length > 0) {
      filtered = filtered.filter(item => 
        item.keywords !== undefined && item.keywords.some(k => filters.keywords!.includes(k))
      );
    }

    if (filters.includeAdult === false) {
      filtered = filtered.filter(item => !(item as any).adult);
    }

    return filtered;
  }

  /**
   * Sort results by specified field.
   */
  private sortResults(results: IMetadataResult[], sortBy: SortOption): IMetadataResult[] {
    const sorted = [...results];

    switch (sortBy) {
      case 'popularity.desc':
        return sorted.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
      case 'popularity.asc':
        return sorted.sort((a, b) => (a.popularity ?? 0) - (b.popularity ?? 0));
      case 'release_date.desc':
        return sorted.sort((a, b) => {
          const dateA = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
          const dateB = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
          return dateB - dateA;
        });
      case 'release_date.asc':
        return sorted.sort((a, b) => {
          const dateA = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
          const dateB = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
          return dateA - dateB;
        });
      case 'vote_average.desc':
        return sorted.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
      case 'vote_average.asc':
        return sorted.sort((a, b) => (a.rating ?? 0) - (b.rating ?? 0));
      case 'vote_count.desc':
        return sorted.sort((a, b) => (b.voteCount ?? 0) - (a.voteCount ?? 0));
      case 'vote_count.asc':
        return sorted.sort((a, b) => (a.voteCount ?? 0) - (b.voteCount ?? 0));
      default:
        return sorted.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
    }
  }

  /**
   * Clear all resources.
   */
  destroy(): void {
    this.initialized = false;
    this.provider.destroy();
    console.log('[XyraMetadataAdapter] Destroyed');
  }
}

export default XyraMetadataAdapter;
