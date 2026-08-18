// src/services/unified/MetadataService.ts
//
// Replaces the old UnifiedMediaService, which mixed a legitimate metadata
// layer (TMDB/Kuryana/Trakt search, discover, trending, details) together
// with a piracy-scraping stream cascade (@movie-web/providers,
// tmdb-embed-providers, hardcoded vidsrc/2embed URLs, ProviderRegistry).
// That file was deleted in the Phase 1/2 cleanup — see handover.md.
//
// This class keeps only the metadata pass-through methods (unchanged
// behavior/mapping) that screens still legitimately depend on for search,
// discovery, and details. Playback now goes through
// src/services/licensedPlayback/LicensedPlaybackService.ts instead of
// anything in this file.

import { MetadataAggregatorNew } from './metadata/MetadataAggregatorNew';
import { UnifiedMediaResult, UnifiedSearchOptions } from './types/ProviderTypes';
import { IMetadataResult, DiscoverFilters, SearchRequest } from './types/MetadataTypes';

function toUnifiedMediaResult(meta: IMetadataResult): UnifiedMediaResult {
  return {
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
    seasons: meta.seasons,
    displaySeasons: meta.displaySeasons,
  } as UnifiedMediaResult;
}

export class MetadataService {
  private metadataAggregator: MetadataAggregatorNew;
  private initialized = false;

  constructor() {
    this.metadataAggregator = new MetadataAggregatorNew();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.metadataAggregator.initialize();
    this.initialized = true;
  }

  private ensureInitialized(): void {
    if (!this.initialized) throw new Error('MetadataService not initialized. Call initialize() first.');
  }

  async search(options: UnifiedSearchOptions): Promise<UnifiedMediaResult[]> {
    this.ensureInitialized();
    const { query, type, year, limit = 20, ...filters } = options;
    const searchRequest: SearchRequest = {
      query: query || '',
      type: type ? [type === 'tv' ? 'show' : 'movie'] : ['movie', 'show'],
      limit,
      page: filters.page || 1,
      languages: filters.language ? [filters.language] : undefined,
      countries: filters.country ? [filters.country] : undefined,
      region: filters.region,
      genres: filters.genres,
      certifications: filters.certification ? [filters.certification] : undefined,
      ratings: filters.minRating ? `${filters.minRating},${filters.maxRating || 10}` : undefined,
      years: filters.startYear || filters.endYear ? `${filters.startYear || ''}-${filters.endYear || ''}` : year ? `${year}` : undefined,
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
      extended: 'full,images',
    };
    const metadataResults = await this.metadataAggregator.search(searchRequest);
    return metadataResults.map(toUnifiedMediaResult).slice(0, limit);
  }

  async discover(filters: DiscoverFilters, limit: number = 20): Promise<UnifiedMediaResult[]> {
    this.ensureInitialized();
    const effectiveLimit = filters.limit ?? limit;
    const metadataResults = await this.metadataAggregator.discover(filters, effectiveLimit);
    return metadataResults.map(toUnifiedMediaResult).slice(0, effectiveLimit);
  }

  async getTrending(limit: number = 20): Promise<IMetadataResult[]> {
    this.ensureInitialized();
    return this.metadataAggregator.getTrending(limit);
  }

  async getTrendingByCategory(category: string, limit: number = 20, region?: string): Promise<IMetadataResult[]> {
    this.ensureInitialized();
    return this.metadataAggregator.getTrendingByCategory(category, limit, region);
  }

  async getById(id: string, type: 'movie' | 'tv'): Promise<IMetadataResult | null> {
    this.ensureInitialized();
    try {
      return await this.metadataAggregator.getById(id, type);
    } catch (error) {
      console.error('[MetadataService] ❌ getById failed:', error);
      return null;
    }
  }

  async getTVDetails(tvId: string): Promise<IMetadataResult | null> {
    this.ensureInitialized();
    return this.getById(tvId, 'tv');
  }

  // No-op kept for call-site compatibility — the old provider layer never
  // actually implemented this either (it was always an optional `?.()`
  // call in SearchScreen.tsx). A real implementation would need
  // MetadataAggregatorNew to expose season data, which it doesn't yet.
  async getSeasonDetails(_tvId: number, _seasonNumber: number): Promise<any | null> {
    return null;
  }

  async batchGetTVDetails(tvIds: string[]): Promise<IMetadataResult[]> {
    this.ensureInitialized();
    const results = await Promise.allSettled(tvIds.map(id => this.getById(id, 'tv')));
    const out: IMetadataResult[] = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled' && r.value) out.push(r.value);
      else console.warn(`[MetadataService] ⚠️ batch failed for ${tvIds[i]}`);
    });
    return out;
  }

  destroy(): void {
    this.initialized = false;
  }
}

export const metadataService = new MetadataService();
export default MetadataService;
