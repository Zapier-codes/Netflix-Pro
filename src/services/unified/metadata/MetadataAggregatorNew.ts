// src/services/unified/metadata/MetadataAggregatorNew.ts

/**
 * MetadataAggregator - Coordinates metadata from multiple providers using adapters.
 * Uses the adapter pattern to unify different metadata sources.
 * 
 * v2.0 - Accepts full SearchRequest with all industry-standard filters.
 * Supports: language/country filtering, region-based content, discover mode.
 */

import { IMetadataResult, SearchRequest, DiscoverFilters } from '../../unified/types/MetadataTypes';
import { TMDBMetadataAdapter } from './adapters/TMDBMetadataAdapter';
import { KuryanaMetadataAdapter } from './adapters/KuryanaMetadataAdapter';
import { MovieBoxMetadataAdapter } from './adapters/MovieBoxMetadataAdapter';

interface MetadataProvider {
  name: string;
  id: string;
  search(query: string, options?: any): Promise<IMetadataResult[]>;
  getById(id: string, type: 'movie' | 'tv'): Promise<IMetadataResult | null>;
  getTrending?(limit: number): Promise<IMetadataResult[]>;
  getTrendingByCategory?(category: string, limit: number, region?: string): Promise<IMetadataResult[]>;
  discover?(filters: DiscoverFilters, limit: number): Promise<IMetadataResult[]>;
}

export class MetadataAggregatorNew {
  private providers: MetadataProvider[] = [];
  private initialized = false;

  constructor() {
    // Register ALL metadata providers
    this.providers = [
      new TMDBMetadataAdapter(),
      new KuryanaMetadataAdapter(),
      new MovieBoxMetadataAdapter(),
    ];
  }

  /**
   * Initialize the aggregator and all providers.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    // Initialize each provider that has an initialize method
    for (const provider of this.providers) {
      if (typeof (provider as any).ensureInitialized === 'function') {
        try {
          await (provider as any).ensureInitialized();
        } catch (error) {
          console.error('[MetadataAggregator] Provider init failed:', error);
        }
      }
    }
    
    this.initialized = true;
    console.log('[MetadataAggregator] Initialized with', this.providers.length, 'providers');
  }

  /**
   * Search for content across all metadata providers.
   * Accepts full SearchRequest with all industry-standard filters.
   * 
   * @param request - Full SearchRequest with filters
   * @returns Array of metadata results
   */
  async search(request: SearchRequest): Promise<IMetadataResult[]> {
    await this.initialize();

    const { query, type, limit = 20, ...filters } = request;

    const allResults: IMetadataResult[] = [];

    // If query is empty, use discover mode if available
    if (!query || query.trim() === '') {
      return this.discover(filters as DiscoverFilters, limit);
    }

    // For each provider, call search with the query and filters
    for (const provider of this.providers) {
      try {
        // Build search options for the provider
        const searchOptions = {
          query: query,
          type: type && type.length > 0 ? type[0] : undefined,
          limit: limit,
          // Forward all filters to providers that support them
          languages: filters.languages,
          countries: filters.countries,
          region: filters.region,
          genres: filters.genres,
          certifications: filters.certifications,
          minRating: filters.ratings ? parseFloat(filters.ratings.split(',')[0]) : undefined,
          maxRating: filters.ratings ? parseFloat(filters.ratings.split(',')[1]) : undefined,
          year: filters.years ? parseInt(filters.years) : undefined,
          startYear: filters.startDate ? new Date(filters.startDate).getFullYear() : undefined,
          endYear: filters.endDate ? new Date(filters.endDate).getFullYear() : undefined,
          keywords: filters.keywords,
          watchProviders: filters.watchProviders,
          withCast: filters.withCast,
          withCrew: filters.withCrew,
          withCompanies: filters.withCompanies,
          withoutGenres: filters.withoutGenres,
          includeAdult: filters.includeAdult,
          sortBy: filters.sortBy,
          language: filters.language,
          watchRegion: filters.watchRegion,
          extended: filters.extended,
        };

        // Call the provider's search method
        let results: IMetadataResult[] = [];
        if (typeof (provider as any).search === 'function') {
          results = await (provider as any).search(searchOptions);
        } else {
          // Fallback to simple search
          results = await provider.search(query, type ? type[0] : undefined, limit);
        }
        
        if (Array.isArray(results)) {
          allResults.push(...results);
        }
      } catch (error) {
        console.error('[MetadataAggregator] Provider', provider.constructor.name, 'search failed:', error);
      }
    }

    // Post-process results
    let processed = this.deduplicateResults(allResults);
    processed = this.applyFilters(processed, filters);
    processed = this.sortResults(processed, filters.sortBy || 'popularity.desc');

    // Filter by type if specified
    if (type && type.length > 0 && type[0] !== 'all') {
      processed = processed.filter(result => result.type === type[0]);
    }

    return processed.slice(0, limit);
  }

  /**
   * DISCOVER - Category browsing without a keyword.
   * This is how Netflix/MovieBox do category rows.
   * 
   * @param filters - DiscoverFilters with language, country, region, genres, etc.
   * @param limit - Maximum number of results
   * @returns Array of metadata results matching the filters
   */
  async discover(filters: DiscoverFilters, limit: number = 20): Promise<IMetadataResult[]> {
    await this.initialize();

    const allResults: IMetadataResult[] = [];

    // Try discover method on providers that support it
    for (const provider of this.providers) {
      try {
        let results: IMetadataResult[] = [];
        
        // Check if provider has a dedicated discover method
        if (typeof (provider as any).discover === 'function') {
          results = await (provider as any).discover(filters, limit);
        } 
        // Fallback: use search with empty query and filters
        else if (typeof (provider as any).search === 'function') {
          const searchOptions = {
            query: '', // Empty query = discover mode
            type: filters.type === 'all' ? undefined : filters.type,
            limit: limit,
            languages: filters.languages,
            countries: filters.countries,
            region: filters.region,
            genres: filters.genres,
            certifications: filters.certifications,
            minRating: filters.minRating,
            maxRating: filters.maxRating,
            year: filters.year,
            startYear: filters.startYear,
            endYear: filters.endYear,
            keywords: filters.keywords,
            watchProviders: filters.watchProviders,
            withCast: filters.withCast,
            withCrew: filters.withCrew,
            withCompanies: filters.withCompanies,
            withoutGenres: filters.withoutGenres,
            includeAdult: filters.includeAdult,
            sortBy: filters.sortBy,
            watchRegion: filters.region,
            extended: 'full,images',
          };
          results = await (provider as any).search(searchOptions);
        }
        
        if (Array.isArray(results)) {
          allResults.push(...results);
        }
      } catch (error) {
        console.error('[MetadataAggregator] Provider', provider.constructor.name, 'discover failed:', error);
      }
    }

    // Post-process results
    let processed = this.deduplicateResults(allResults);
    processed = this.applyDiscoverFilters(processed, filters);
    processed = this.sortResults(processed, filters.sortBy || 'popularity.desc');

    return processed.slice(0, limit);
  }

  /**
   * Get metadata by ID from any provider.
   */
  async getById(id: string, type: 'movie' | 'tv'): Promise<IMetadataResult | null> {
    await this.initialize();

    for (const provider of this.providers) {
      try {
        const result = await provider.getById(id, type);
        if (result) return result;
      } catch (error) {
        console.error('[MetadataAggregator] Provider', provider.constructor.name, 'getById failed:', error);
      }
    }

    return null;
  }

  /**
   * Get trending content across all providers that support it.
   */
  async getTrending(limit: number = 20): Promise<IMetadataResult[]> {
    await this.initialize();

    const allResults: IMetadataResult[] = [];

    for (const provider of this.providers) {
      if (typeof (provider as any).getTrending === 'function') {
        try {
          const results = await (provider as any).getTrending(limit);
          if (Array.isArray(results)) {
            allResults.push(...results);
          }
        } catch (error) {
          console.error('[MetadataAggregator] Provider', provider.constructor.name, 'getTrending failed:', error);
        }
      }
    }

    const deduplicated = this.deduplicateResults(allResults);
    return deduplicated.slice(0, limit);
  }

  /**
   * Get trending content by category.
   */
  async getTrendingByCategory(category: string, limit: number = 20, region?: string): Promise<IMetadataResult[]> {
    await this.initialize();

    const allResults: IMetadataResult[] = [];

    for (const provider of this.providers) {
      if (typeof (provider as any).getTrendingByCategory === 'function') {
        try {
          const results = await (provider as any).getTrendingByCategory(category, limit, region);
          if (Array.isArray(results)) {
            allResults.push(...results);
          }
        } catch (error) {
          console.error('[MetadataAggregator] Provider', provider.constructor.name, 'getTrendingByCategory failed:', error);
        }
      }
    }

    const deduplicated = this.deduplicateResults(allResults);
    return deduplicated.slice(0, limit);
  }

  /**
   * Get all registered providers.
   */
  getProviders(): MetadataProvider[] {
    return this.providers;
  }

  /**
   * Clear all resources.
   */
  destroy(): void {
    this.providers = [];
    this.initialized = false;
    console.log('[MetadataAggregator] Destroyed');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Deduplicate results by ID and source.
   */
  private deduplicateResults(results: IMetadataResult[]): IMetadataResult[] {
    const seen = new Set<string>();
    return results.filter(result => {
      const key = `${result.source || 'unknown'}-${result.type}-${result.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Apply filters to results (client-side fallback).
   */
  private applyFilters(results: IMetadataResult[], filters: any): IMetadataResult[] {
    let filtered = [...results];

    // Filter by language
    if (filters.languages && filters.languages.length > 0) {
      filtered = filtered.filter(item => 
        item.originalLanguage && filters.languages.includes(item.originalLanguage)
      );
    }

    // Filter by country
    if (filters.countries && filters.countries.length > 0) {
      filtered = filtered.filter(item => 
        item.originCountry && item.originCountry.some(c => filters.countries.includes(c))
      );
    }

    // Filter by certification
    if (filters.certifications && filters.certifications.length > 0) {
      filtered = filtered.filter(item => 
        item.certification && filters.certifications.includes(item.certification)
      );
    }

    // Filter by genre
    if (filters.genres && filters.genres.length > 0) {
      filtered = filtered.filter(item => 
        item.genres && item.genres.some(g => filters.genres.includes(g))
      );
    }

    // Filter by min rating
    if (filters.minRating !== undefined) {
      filtered = filtered.filter(item => (item.rating || 0) >= filters.minRating);
    }

    // Filter by max rating
    if (filters.maxRating !== undefined) {
      filtered = filtered.filter(item => (item.rating || 0) <= filters.maxRating);
    }

    // Filter by year range
    if (filters.startYear !== undefined) {
      filtered = filtered.filter(item => (item.year || 0) >= filters.startYear);
    }
    if (filters.endYear !== undefined) {
      filtered = filtered.filter(item => (item.year || 0) <= filters.endYear);
    }

    // Filter by keywords
    if (filters.keywords && filters.keywords.length > 0) {
      filtered = filtered.filter(item => 
        item.keywords && item.keywords.some(k => filters.keywords.includes(k))
      );
    }

    return filtered;
  }

  /**
   * Apply Discover filters.
   */
  private applyDiscoverFilters(results: IMetadataResult[], filters: DiscoverFilters): IMetadataResult[] {
    let filtered = [...results];

    // Filter by language
    if (filters.languages && filters.languages.length > 0) {
      filtered = filtered.filter(item => 
        item.originalLanguage && filters.languages.includes(item.originalLanguage)
      );
    }

    // Filter by country
    if (filters.countries && filters.countries.length > 0) {
      filtered = filtered.filter(item => 
        item.originCountry && item.originCountry.some(c => filters.countries.includes(c))
      );
    }

    // Filter by certification
    if (filters.certifications && filters.certifications.length > 0) {
      filtered = filtered.filter(item => 
        item.certification && filters.certifications.includes(item.certification)
      );
    }

    // Filter by genre
    if (filters.genres && filters.genres.length > 0) {
      filtered = filtered.filter(item => 
        item.genres && item.genres.some(g => filters.genres.includes(g))
      );
    }

    // Filter by rating range
    if (filters.minRating !== undefined) {
      filtered = filtered.filter(item => (item.rating || 0) >= filters.minRating);
    }
    if (filters.maxRating !== undefined) {
      filtered = filtered.filter(item => (item.rating || 0) <= filters.maxRating);
    }

    // Filter by year range
    if (filters.startYear !== undefined) {
      filtered = filtered.filter(item => (item.year || 0) >= filters.startYear);
    }
    if (filters.endYear !== undefined) {
      filtered = filtered.filter(item => (item.year || 0) <= filters.endYear);
    }

    // Filter by keywords
    if (filters.keywords && filters.keywords.length > 0) {
      filtered = filtered.filter(item => 
        item.keywords && item.keywords.some(k => filters.keywords.includes(k))
      );
    }

    // Filter by type
    if (filters.type && filters.type !== 'all') {
      filtered = filtered.filter(item => item.type === filters.type);
    }

    return filtered;
  }

  /**
   * Sort results by specified field.
   */
  private sortResults(results: IMetadataResult[], sortBy: string): IMetadataResult[] {
    const sorted = [...results];

    switch (sortBy) {
      case 'popularity.desc':
        return sorted.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
      case 'popularity.asc':
        return sorted.sort((a, b) => (a.popularity || 0) - (b.popularity || 0));
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
        return sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      case 'vote_average.asc':
        return sorted.sort((a, b) => (a.rating || 0) - (b.rating || 0));
      case 'vote_count.desc':
        return sorted.sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0));
      case 'vote_count.asc':
        return sorted.sort((a, b) => (a.voteCount || 0) - (b.voteCount || 0));
      default:
        // Default: popularity descending
        return sorted.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    }
  }
}

export default MetadataAggregatorNew;