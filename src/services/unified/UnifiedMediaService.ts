/**
 * UnifiedMediaService - Main orchestrator for the unified media layer.
 * Coordinates metadata, streaming, subtitles, and social features.
 * 
 * v2.0 - Added discover() method for category browsing without keywords.
 * Supports: language/country filtering, region-based content, full search options.
 */

import { MetadataAggregatorNew } from './metadata/MetadataAggregatorNew';
import { ProviderRegistry } from './ProviderRegistry';
import { StreamNormalizer } from './StreamNormalizer';
import { UnifiedSubtitles } from './subtitles/UnifiedSubtitles';
import {
  UnifiedMediaResult,
  UnifiedSearchOptions,
  UnifiedStreamOptions,
  UnifiedSubtitleOptions,
} from './types/ProviderTypes';
import { NormalizedStream } from './types/StreamTypes';
import { IMetadataResult, DiscoverFilters, SearchRequest } from './types/MetadataTypes';

export class UnifiedMediaService {
  private metadataAggregator: MetadataAggregatorNew;
  private providerRegistry: ProviderRegistry;
  private subtitleService: UnifiedSubtitles;
  private initialized: boolean = false;

  constructor() {
    this.metadataAggregator = new MetadataAggregatorNew();
    this.providerRegistry = new ProviderRegistry();
    this.subtitleService = new UnifiedSubtitles();
  }

  /**
   * Initialize all subsystems.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Register default streaming providers
    this.providerRegistry.registerMultiple(['vidsrc', 'moviebox', 'xyra', 'consumet']);

    // Initialize metadata aggregator
    await this.metadataAggregator.initialize();

    this.initialized = true;
    console.log('[UnifiedMediaService] Initialized');
  }

  /**
   * Search for content across all sources.
   * Supports full filtering with language, country, region, genres, etc.
   */
  async search(options: UnifiedSearchOptions): Promise<UnifiedMediaResult[]> {
    this.ensureInitialized();

    const { query, type, year, limit = 20, ...filters } = options;

    // Build a proper SearchRequest with all filters
    const searchRequest: SearchRequest = {
      query: query || '',
      type: type ? [type] : ['movie', 'show'],
      limit: limit,
      page: filters.page || 1,
      
      // NEW: Forward all industry-standard filters
      languages: filters.language ? [filters.language] : undefined,
      countries: filters.country ? [filters.country] : undefined,
      region: filters.region,
      genres: filters.genres,
      certifications: filters.certification ? [filters.certification] : undefined,
      ratings: filters.minRating ? `${filters.minRating},${filters.maxRating || 10}` : undefined,
      years: filters.startYear || filters.endYear ? 
        `${filters.startYear || ''}-${filters.endYear || ''}` : 
        year ? `${year}` : undefined,
      keywords: filters.keywords,
      withCast: filters.withCast,
      withCrew: filters.withCrew,
      withCompanies: filters.withCompanies,
      withoutGenres: filters.withoutGenres,
      watchProviders: filters.watchProviders,
      includeAdult: filters.includeAdult,
      language: filters.languageCode,
      watchRegion: filters.watchRegion,
      sortBy: filters.sortBy || 'popularity.desc',
      
      // Extended metadata
      extended: 'full,images',
    };

    // Search metadata sources with full filters
    const metadataResults = await this.metadataAggregator.search(searchRequest);

    // Convert to unified results
    const results: UnifiedMediaResult[] = metadataResults.map(meta => ({
      id: meta.id,
      title: meta.title,
      type: meta.type,
      year: meta.year,
      releaseDate: meta.releaseDate,
      poster: meta.poster,
      backdrop: meta.backdrop,
      overview: meta.overview,
      rating: meta.rating,
      genres: meta.genres,
      runtime: meta.runtime,
      cast: meta.cast,
      source: meta.source,
      sources: [],
      metadata: meta,
      
      // NEW: Forward all enhanced fields
      originalLanguage: meta.originalLanguage,
      originCountry: meta.originCountry,
      originalTitle: meta.originalTitle,
      popularity: meta.popularity,
      voteCount: meta.voteCount,
      certification: meta.certification,
      tagline: meta.tagline,
      status: meta.status,
      belongsToCollection: meta.belongsToCollection,
      watchProviders: meta.watchProviders,
      keywords: meta.keywords,
      budget: meta.budget,
      revenue: meta.revenue,
      networks: meta.networks,
      spokenLanguages: meta.spokenLanguages,
      productionCompanies: meta.productionCompanies,
      productionCountries: meta.productionCountries,
      numberOfSeasons: meta.numberOfSeasons,
      numberOfEpisodes: meta.numberOfEpisodes,
      lastAirDate: meta.lastAirDate,
      inProduction: meta.inProduction,
    }));

    return results.slice(0, limit);
  }

  /**
   * DISCOVER - Category browsing without a keyword.
   * This is how Netflix/MovieBox do category rows.
   * 
   * @param filters - DiscoverFilters with language, country, region, genres, etc.
   * @param limit - Maximum number of results
   * @returns Array of media results matching the filters
   */
  async discover(filters: DiscoverFilters, limit: number = 20): Promise<UnifiedMediaResult[]> {
    this.ensureInitialized();

    // Build a SearchRequest from DiscoverFilters
    const searchRequest: SearchRequest = {
      query: '', // Empty query = discover mode
      type: filters.type === 'all' ? ['movie', 'show'] : filters.type === 'movie' ? ['movie'] : ['show'],
      limit: limit,
      page: filters.page || 1,
      
      // NEW: All discover filters
      languages: filters.languages,
      countries: filters.countries,
      region: filters.region,
      genres: filters.genres,
      certifications: filters.certifications,
      ratings: filters.minRating ? `${filters.minRating},${filters.maxRating || 10}` : undefined,
      years: filters.startYear || filters.endYear ? 
        `${filters.startYear || ''}-${filters.endYear || ''}` : 
        filters.year ? `${filters.year}` : undefined,
      keywords: filters.keywords,
      watchProviders: filters.watchProviders,
      withCast: filters.withCast,
      withCrew: filters.withCrew,
      withCompanies: filters.withCompanies,
      withoutGenres: filters.withoutGenres,
      includeAdult: filters.includeAdult,
      sortBy: filters.sortBy || 'popularity.desc',
      
      // Date filters
      startDate: filters.releaseDateGTE,
      endDate: filters.releaseDateLTE,
      
      // Extended metadata
      extended: 'full,images',
    };

    // Search with empty query (discover mode)
    const metadataResults = await this.metadataAggregator.search(searchRequest);

    // Convert to unified results
    const results: UnifiedMediaResult[] = metadataResults.map(meta => ({
      id: meta.id,
      title: meta.title,
      type: meta.type,
      year: meta.year,
      releaseDate: meta.releaseDate,
      poster: meta.poster,
      backdrop: meta.backdrop,
      overview: meta.overview,
      rating: meta.rating,
      genres: meta.genres,
      runtime: meta.runtime,
      cast: meta.cast,
      source: meta.source,
      sources: [],
      metadata: meta,
      
      // Forward all enhanced fields
      originalLanguage: meta.originalLanguage,
      originCountry: meta.originCountry,
      originalTitle: meta.originalTitle,
      popularity: meta.popularity,
      voteCount: meta.voteCount,
      certification: meta.certification,
      tagline: meta.tagline,
      status: meta.status,
      belongsToCollection: meta.belongsToCollection,
      watchProviders: meta.watchProviders,
      keywords: meta.keywords,
      budget: meta.budget,
      revenue: meta.revenue,
      networks: meta.networks,
      spokenLanguages: meta.spokenLanguages,
      productionCompanies: meta.productionCompanies,
      productionCountries: meta.productionCountries,
      numberOfSeasons: meta.numberOfSeasons,
      numberOfEpisodes: meta.numberOfEpisodes,
      lastAirDate: meta.lastAirDate,
      inProduction: meta.inProduction,
    }));

    return results.slice(0, limit);
  }

  /**
   * Get trending content across all metadata sources.
   */
  async getTrending(limit: number = 20): Promise<IMetadataResult[]> {
    this.ensureInitialized();
    return this.metadataAggregator.getTrending(limit);
  }

  /**
   * Get trending content with category filtering.
   * @param category - 'music' | 'gaming' | 'movies' | 'podcast' | 'videos'
   * @param limit - Maximum number of results
   * @param region - Region for regional trending
   */
  async getTrendingByCategory(category: string, limit: number = 20, region?: string): Promise<IMetadataResult[]> {
    this.ensureInitialized();
    return this.metadataAggregator.getTrendingByCategory(category, limit, region);
  }

  /**
   * Get streaming sources for a specific title.
   */
  async getStreams(options: UnifiedStreamOptions): Promise<NormalizedStream[]> {
    this.ensureInitialized();

    const { id, type, season, episode, preferredQuality = 'auto' } = options;

    const provider = this.providerRegistry.getBestProvider(type);
    if (!provider) {
      throw new Error('No healthy streaming provider available');
    }

    const sources = await provider.getStreams({
      id,
      type,
      season,
      episode,
    });

    return StreamNormalizer.normalizeAll(sources, provider.name, {
      preferredQuality,
    });
  }

  /**
   * Get subtitles for a specific title.
   */
  async getSubtitles(options: UnifiedSubtitleOptions): Promise<any[]> {
    this.ensureInitialized();

    return this.subtitleService.getSubtitles({
      imdbId: options.imdbId,
      tmdbId: options.tmdbId,
      season: options.season,
      episode: options.episode,
      language: options.language ?? 'en',
    });
  }

  /**
   * Get full media details with streams and subtitles.
   */
  async getFullMedia(
    id: string,
    type: 'movie' | 'tv',
    options: {
      season?: number;
      episode?: number;
      preferredQuality?: string;
      subtitleLanguage?: string;
    } = {}
  ): Promise<{
    metadata: IMetadataResult | null;
    streams: NormalizedStream[];
    subtitles: any[];
  }> {
    this.ensureInitialized();

    const [metadata, streams, subtitles] = await Promise.allSettled([
      this.metadataAggregator.getById(id, type),
      this.getStreams({
        id,
        type,
        season: options.season,
        episode: options.episode,
        preferredQuality: options.preferredQuality as any,
      }),
      this.getSubtitles({
        imdbId: id,
        season: options.season,
        episode: options.episode,
        language: options.subtitleLanguage,
      }),
    ]);

    return {
      metadata: metadata.status === 'fulfilled' ? metadata.value : null,
      streams: streams.status === 'fulfilled' ? streams.value : [],
      subtitles: subtitles.status === 'fulfilled' ? subtitles.value : [],
    };
  }

  /**
   * Health check all providers.
   */
  async healthCheck(): Promise<{ provider: string; isHealthy: boolean }[]> {
    if (!this.initialized) return [];
    return this.providerRegistry.healthCheck();
  }

  /**
   * Dispose of all resources.
   */
  destroy(): void {
    this.providerRegistry.clear();
    this.initialized = false;
    console.log('[UnifiedMediaService] Destroyed');
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('UnifiedMediaService not initialized. Call initialize() first.');
    }
  }
}

export const unifiedMediaService = new UnifiedMediaService();
export default UnifiedMediaService;