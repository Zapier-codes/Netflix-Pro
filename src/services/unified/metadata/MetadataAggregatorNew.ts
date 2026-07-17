// src/services/unified/metadata/MetadataAggregatorNew.ts

/**
 * MetadataAggregator - Coordinates metadata from multiple providers using adapters.
 * Uses the adapter pattern to unify different metadata sources.
 * 
 * v2.0 - Accepts full SearchRequest with all industry-standard filters.
 * Supports: language/country filtering, region-based content, discover mode.
 * FIXED: Now properly handles multiple media types (movie, tv, show)
 * UPDATED: Added Consumet and Trakt adapters for complete unified layer (5 providers total)
 * FIXED: MetadataProvider.search() now matches the real single-options-object
 * signature every adapter (TMDB/Kuryana/MovieBox/Consumet/Trakt) implements,
 * instead of a two-arg (query, options) signature none of them actually have.
 * FIXED (contravariance): ProviderSearchOptions.type was widened to
 * 'movie' | 'tv' | 'anime' | 'all' - a superset of what every adapter's own
 * search() accepts. Since `search(options: ProviderSearchOptions)` is the
 * signature every adapter must be assignable TO, the options type is
 * function-parameter position and is checked contravariantly: the interface
 * must promise no more than the narrowest adapter (KuryanaMetadataAdapter,
 * 'movie' | 'tv' only) can actually handle. The aggregator's own call sites
 * (search() and discover()) only ever construct `type: 'movie' | 'tv'` - the
 * mediaType mapping resolves 'show'/'anime'/'all' down to 'movie' or 'tv'
 * before building searchOptions - so narrowing costs nothing at the call
 * sites and satisfies every adapter's implementation.
 */

import { IMetadataResult, SearchRequest, DiscoverFilters } from '../../unified/types/MetadataTypes';
import { TMDBMetadataAdapter } from './adapters/TMDBMetadataAdapter';
import { KuryanaMetadataAdapter } from './adapters/KuryanaMetadataAdapter';
import { MovieBoxMetadataAdapter } from './adapters/MovieBoxMetadataAdapter';
import { ConsumetMetadataAdapter } from './adapters/ConsumetMetadataAdapter';
import { TraktMetadataAdapter } from './adapters/TraktMetadataAdapter';

// Sort option literal type
type SortOption =
  | 'popularity.desc'
  | 'popularity.asc'
  | 'release_date.desc'
  | 'release_date.asc'
  | 'vote_average.desc'
  | 'vote_average.asc'
  | 'vote_count.desc'
  | 'vote_count.asc';

/**
 * Options object shape every adapter's search() accepts. This mirrors what
 * ConsumetMetadataAdapter.search() / MovieBoxMetadataAdapter.search() /
 * TMDBMetadataAdapter.search() etc. actually declare - a single object, not
 * (query, options) as two separate params.
 *
 * FIXED: `type` narrowed from 'movie' | 'tv' | 'anime' | 'all' down to just
 * 'movie' | 'tv'. This field sits in a function-parameter position (it's the
 * argument type for every adapter's search()), so TS checks it
 * contravariantly against each concrete implementation - the interface must
 * be a SUBSET of what the narrowest real adapter accepts, not a superset of
 * every adapter's own vocabulary. KuryanaMetadataAdapter only ever accepts
 * 'movie' | 'tv', so that's the ceiling for the shared type here too. No call
 * site in this file ever needed 'anime' or 'all' on this object anyway - the
 * mediaType-to-searchOptions mapping already collapses everything to
 * 'movie' | 'tv' before search() is invoked.
 */
interface ProviderSearchOptions {
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
  watchProviders?: number[];
  withCast?: string[];
  withCrew?: string[];
  withCompanies?: string[];
  withoutGenres?: string[];
  includeAdult?: boolean;
  sortBy?: SortOption;
  language?: string;
  watchRegion?: string;
  extended?: string;
}

interface MetadataProvider {
  name: string;
  id: string;
  // FIXED: single options-object signature, matching every real adapter.
  search(options: ProviderSearchOptions): Promise<IMetadataResult[]>;
  getById(id: string, type: 'movie' | 'tv'): Promise<IMetadataResult | null>;
  getTrending?(limit: number): Promise<IMetadataResult[]>;
  getTrendingByCategory?(category: string, limit: number, region?: string): Promise<IMetadataResult[]>;
  discover?(filters: DiscoverFilters, limit: number): Promise<IMetadataResult[]>;
}

/**
 * Locally-typed shape of everything `search()` reads off `...filters` after
 * destructuring `query`/`type`/`limit` out of a SearchRequest.
 *
 * FIXED: Rest-destructuring `...filters` directly from
 * `request as SearchRequest & { startDate?; endDate? }` let TS's structural
 * narrowing collapse loosely-declared properties (ratings, years,
 * watchProviders, etc.) down to `never` wherever SearchRequest's own field
 * types didn't line up with how this method actually uses them - hence
 * `filters.ratings.split(...)` erroring with "Property 'split' does not
 * exist on type 'never'". Re-typing the rest object against this interface
 * sidesteps that inference entirely, without touching the shared
 * MetadataTypes.ts (per the existing project convention noted below).
 */
interface SearchFilters {
  languages?: string[];
  countries?: string[];
  region?: string;
  genres?: string[];
  certifications?: string[];
  ratings?: string;       // e.g. "6,10" -> min,max
  years?: string;         // e.g. "2020"
  startDate?: string;
  endDate?: string;
  keywords?: string[];
  watchProviders?: number[];
  withCast?: string[];
  withCrew?: string[];
  withCompanies?: string[];
  withoutGenres?: string[];
  includeAdult?: boolean;
  sortBy?: SortOption;
  language?: string;
  watchRegion?: string;
  extended?: string;
  // Fields also read via `filters as DiscoverFilters` in discover-mode calls
  minRating?: number;
  maxRating?: number;
  year?: number;
  startYear?: number;
  endYear?: number;
  type?: 'movie' | 'tv' | 'all';
}

export class MetadataAggregatorNew {
  private providers: MetadataProvider[] = [];
  private initialized = false;

  constructor() {
    // Register ALL metadata providers - COMPLETE LIST (5 providers)
    this.providers = [
      new TMDBMetadataAdapter(),      // Primary movie/TV metadata
      new KuryanaMetadataAdapter(),   // Asian dramas metadata
      new MovieBoxMetadataAdapter(),  // MovieBox with Consumet search fallback
      new ConsumetMetadataAdapter(),  // Anime and general content
      new TraktMetadataAdapter(),     // Social metadata, trending, recommendations
    ];
    console.log('[MetadataAggregator] Registered providers:', this.providers.map(p => p.name));
  }

  /**
   * Initialize the aggregator and all providers.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('[MetadataAggregator] Initializing all providers...');

    // Initialize each provider that has an initialize method
    for (const provider of this.providers) {
      if (typeof (provider as any).ensureInitialized === 'function') {
        try {
          console.log(`[MetadataAggregator] Initializing ${provider.name}...`);
          await (provider as any).ensureInitialized();
          console.log(`[MetadataAggregator] ✅ ${provider.name} initialized`);
        } catch (error) {
          console.error(`[MetadataAggregator] ❌ Provider ${provider.name} init failed:`, error);
        }
      }
    }

    this.initialized = true;
    console.log('[MetadataAggregator] Initialized with', this.providers.length, 'providers');
  }

  /**
   * Search for content across ALL metadata providers.
   * Aggregates results from TMDB, Kuryana, MovieBox, Consumet, AND Trakt.
   * 
   * @param request - Full SearchRequest with filters
   * @returns Array of metadata results from ALL providers
   */
  async search(request: SearchRequest): Promise<IMetadataResult[]> {
    await this.initialize();

    // NOTE: SearchRequest (from MetadataTypes) doesn't declare startDate/endDate,
    // and rest-destructuring `...filters` straight off SearchRequest let several
    // of its own field types collapse to `never` for how this method actually
    // uses them (see SearchFilters doc comment above). Widen/re-type locally
    // rather than editing the shared MetadataTypes.ts, to avoid affecting other
    // consumers of SearchRequest.
    const { query, type, limit = 20, ...rest } = request as SearchRequest & {
      startDate?: string;
      endDate?: string;
    };
    const filters = rest as SearchFilters;

    console.log(`[MetadataAggregator] 🔍 Search started: "${query}"`);
    console.log(`[MetadataAggregator] 📋 Type: ${type}, Limit: ${limit}`);
    console.log(`[MetadataAggregator] 📋 Filters:`, filters);

    // If query is empty, use discover mode
    if (!query || query.trim() === '') {
      console.log('[MetadataAggregator] 🔄 Empty query - using discover mode');
      return this.discover(filters as DiscoverFilters, limit);
    }

    const allResults: IMetadataResult[] = [];
    const providerResults: Record<string, number> = {};

    // Parse types - handle comma-separated string or array.
    // FIXED: SearchRequest['type'] is declared as
    // `('movie' | 'show' | 'episode' | 'person' | 'list')[] | undefined` -
    // it can never actually be a string per its own type, so
    // `typeof type === 'string'` narrowed `type` to `never` inside that
    // branch and `type.split(',')` failed with "Property 'split' does not
    // exist on type 'never'". Widening to `unknown` first lets us keep
    // defensive handling for a comma-separated string at runtime (in case
    // an untyped caller passes one) without TS collapsing the branch.
    let typeArray: string[] = [];
    const rawType: unknown = type;
    if (typeof rawType === 'string') {
      typeArray = rawType.split(',').map(t => t.trim());
    } else if (Array.isArray(rawType)) {
      typeArray = rawType as string[];
    }

    // If no specific type, search both
    if (typeArray.length === 0 || (typeArray.length === 1 && typeArray[0] === 'all')) {
      typeArray = ['movie', 'tv'];
    }

    console.log(`[MetadataAggregator] 📋 Searching for types:`, typeArray);

    // For EACH provider, call search with the query and filters
    for (const provider of this.providers) {
      try {
        console.log(`[MetadataAggregator] 🔎 Calling ${provider.name}...`);

        // For each type, search separately
        let providerTotalResults = 0;

        for (const mediaType of typeArray) {
          try {
            // Build search options for the provider.
            // NOTE: this mapping is exactly why ProviderSearchOptions.type can
            // safely be narrowed to 'movie' | 'tv' - every mediaType value
            // ('movie' | 'tv' | 'show' | 'anime' | 'all', whatever came in)
            // is resolved down to 'tv' or 'movie' right here before it's ever
            // assigned onto searchOptions.type.
            const searchOptions: ProviderSearchOptions = {
              query: query,
              type: mediaType === 'tv' ? 'tv' : (mediaType === 'show' ? 'tv' : 'movie'),
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
              sortBy: (filters.sortBy as SortOption) || 'popularity.desc',
              language: filters.language,
              watchRegion: filters.watchRegion,
              extended: filters.extended || 'full,images',
            };

            console.log(`[MetadataAggregator] 📤 ${provider.name} (${mediaType}) options:`, JSON.stringify(searchOptions, null, 2));

            // FIXED: every registered provider implements search(options) as a
            // single object per MetadataProvider - call it directly, no `as any`
            // cast and no two-arg fallback needed anymore.
            const results = await provider.search(searchOptions);

            if (Array.isArray(results) && results.length > 0) {
              // Add source if not already set
              results.forEach(r => {
                if (!r.source) r.source = provider.id || provider.name.toLowerCase();
              });
              console.log(`[MetadataAggregator] ✅ ${provider.name} (${mediaType}) returned ${results.length} results`);
              allResults.push(...results);
              providerTotalResults += results.length;
            } else if (Array.isArray(results)) {
              console.log(`[MetadataAggregator] ⚠️ ${provider.name} (${mediaType}) returned 0 results`);
            }
          } catch (error) {
            console.error(`[MetadataAggregator] ❌ Provider ${provider.name} (${mediaType}) search failed:`, error);
          }
        }

        providerResults[provider.name] = providerTotalResults;
      } catch (error) {
        console.error(`[MetadataAggregator] ❌ Provider ${provider.name} search failed:`, error);
        if (error instanceof Error) {
          console.error(`[MetadataAggregator] ${provider.name} error details:`, error.message);
        }
        providerResults[provider.name] = 0;
      }
    }

    console.log(`[MetadataAggregator] 📊 Search summary:`, providerResults);
    console.log(`[MetadataAggregator] 📊 Total raw results: ${allResults.length}`);

    // Post-process results
    let processed = this.deduplicateResults(allResults);
    console.log(`[MetadataAggregator] 📊 After deduplication: ${processed.length}`);

    processed = this.applyFilters(processed, filters);
    console.log(`[MetadataAggregator] 📊 After filtering: ${processed.length}`);

    processed = this.sortResults(processed, (filters.sortBy as SortOption) || 'popularity.desc');
    console.log(`[MetadataAggregator] 📊 After sorting: ${processed.length}`);

    const finalResults = processed.slice(0, limit);
    console.log(`[MetadataAggregator] 🏁 Final results: ${finalResults.length} (limited to ${limit})`);

    // Log sample results
    if (finalResults.length > 0) {
      console.log(`[MetadataAggregator] 📊 Sample results:`, finalResults.slice(0, 3).map(r => ({
        title: r.title,
        source: r.source,
        type: r.type,
        id: r.id
      })));
    } else {
      console.log(`[MetadataAggregator] ⚠️ NO RESULTS FOUND for "${query}"`);
    }

    return finalResults;
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

    console.log(`[MetadataAggregator] 🔍 Discover started with filters:`, filters);

    const allResults: IMetadataResult[] = [];
    const providerResults: Record<string, number> = {};

    // Determine media types to search
    const mediaTypes: Array<'movie' | 'tv'> =
      filters.type === 'all' ? ['movie', 'tv'] : [(filters.type as 'movie' | 'tv') || 'movie'];

    // Try discover method on ALL providers that support it
    for (const provider of this.providers) {
      for (const mediaType of mediaTypes) {
        try {
          console.log(`[MetadataAggregator] 🔎 Calling ${provider.name}.discover (${mediaType})...`);
          let results: IMetadataResult[] = [];

          // Create a copy of filters with the specific type
          const typeFilters: DiscoverFilters = { ...filters, type: mediaType };

          // Prefer a dedicated discover method when the provider supports one.
          // `discover` is optional on MetadataProvider, so this is already typed.
          if (typeof provider.discover === 'function') {
            results = await provider.discover(typeFilters, limit);
            console.log(`[MetadataAggregator] ✅ ${provider.name}.discover (${mediaType}) returned ${results.length} results`);
          }
          // Fallback: use search with empty query and filters. Every provider
          // implements search(options) per MetadataProvider, so this always
          // resolves - no `as any` cast needed anymore.
          else {
            console.log(`[MetadataAggregator] ⚠️ ${provider.name} has no discover, using search with empty query`);
            const searchOptions: ProviderSearchOptions = {
              query: '', // Empty query = discover mode
              type: mediaType,
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
              sortBy: (filters.sortBy as SortOption) || 'popularity.desc',
              watchRegion: filters.region,
              extended: 'full,images',
            };
            results = await provider.search(searchOptions);
            console.log(`[MetadataAggregator] ✅ ${provider.name} search (discover) (${mediaType}) returned ${results.length} results`);
          }

          if (Array.isArray(results)) {
            results.forEach(r => {
              if (!r.source) r.source = provider.id || provider.name.toLowerCase();
            });
            providerResults[`${provider.name}-${mediaType}`] = results.length;
            allResults.push(...results);
          }
        } catch (error) {
          console.error(`[MetadataAggregator] ❌ Provider ${provider.name} discover (${mediaType}) failed:`, error);
          providerResults[`${provider.name}-${mediaType}`] = 0;
        }
      }
    }

    console.log(`[MetadataAggregator] 📊 Discover summary:`, providerResults);
    console.log(`[MetadataAggregator] 📊 Total raw results: ${allResults.length}`);

    // Post-process results
    let processed = this.deduplicateResults(allResults);
    console.log(`[MetadataAggregator] 📊 After deduplication: ${processed.length}`);

    processed = this.applyDiscoverFilters(processed, filters);
    console.log(`[MetadataAggregator] 📊 After filtering: ${processed.length}`);

    processed = this.sortResults(processed, (filters.sortBy as SortOption) || 'popularity.desc');
    console.log(`[MetadataAggregator] 📊 After sorting: ${processed.length}`);

    const finalResults = processed.slice(0, limit);
    console.log(`[MetadataAggregator] 🏁 Final discover results: ${finalResults.length}`);
    return finalResults;
  }

  /**
   * Get metadata by ID from any provider.
   */
  async getById(id: string, type: 'movie' | 'tv'): Promise<IMetadataResult | null> {
    await this.initialize();

    console.log(`[MetadataAggregator] 🔍 Getting by ID: ${id} (${type})`);

    for (const provider of this.providers) {
      try {
        console.log(`[MetadataAggregator] 🔎 Trying ${provider.name}...`);
        const result = await provider.getById(id, type);
        if (result) {
          console.log(`[MetadataAggregator] ✅ Found in ${provider.name}`);
          return result;
        }
      } catch (error) {
        console.error(`[MetadataAggregator] ❌ Provider ${provider.name} getById failed:`, error);
      }
    }

    console.log(`[MetadataAggregator] ⚠️ Not found in any provider`);
    return null;
  }

  /**
   * Get trending content across all providers that support it.
   */
  async getTrending(limit: number = 20): Promise<IMetadataResult[]> {
    await this.initialize();

    console.log(`[MetadataAggregator] 🔍 Getting trending (limit: ${limit})`);

    const allResults: IMetadataResult[] = [];

    for (const provider of this.providers) {
      if (typeof provider.getTrending === 'function') {
        try {
          console.log(`[MetadataAggregator] 🔎 Calling ${provider.name}.getTrending...`);
          const results = await provider.getTrending(limit);
          if (Array.isArray(results)) {
            results.forEach(r => {
              if (!r.source) r.source = provider.id || provider.name.toLowerCase();
            });
            console.log(`[MetadataAggregator] ✅ ${provider.name} returned ${results.length} trending results`);
            allResults.push(...results);
          }
        } catch (error) {
          console.error(`[MetadataAggregator] ❌ Provider ${provider.name} getTrending failed:`, error);
        }
      }
    }

    const deduplicated = this.deduplicateResults(allResults);
    console.log(`[MetadataAggregator] 📊 Total trending results: ${deduplicated.length}`);
    return deduplicated.slice(0, limit);
  }

  /**
   * Get trending content by category.
   */
  async getTrendingByCategory(category: string, limit: number = 20, region?: string): Promise<IMetadataResult[]> {
    await this.initialize();

    console.log(`[MetadataAggregator] 🔍 Getting trending by category: ${category} (limit: ${limit})`);

    const allResults: IMetadataResult[] = [];

    for (const provider of this.providers) {
      if (typeof provider.getTrendingByCategory === 'function') {
        try {
          console.log(`[MetadataAggregator] 🔎 Calling ${provider.name}.getTrendingByCategory...`);
          const results = await provider.getTrendingByCategory(category, limit, region);
          if (Array.isArray(results)) {
            results.forEach(r => {
              if (!r.source) r.source = provider.id || provider.name.toLowerCase();
            });
            console.log(`[MetadataAggregator] ✅ ${provider.name} returned ${results.length} results`);
            allResults.push(...results);
          }
        } catch (error) {
          console.error(`[MetadataAggregator] ❌ Provider ${provider.name} getTrendingByCategory failed:`, error);
        }
      }
    }

    const deduplicated = this.deduplicateResults(allResults);
    console.log(`[MetadataAggregator] 📊 Total category results: ${deduplicated.length}`);
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
      const langs = filters.languages;
      filtered = filtered.filter(item => 
        item.originalLanguage !== undefined && langs.includes(item.originalLanguage)
      );
    }

    // Filter by country
    if (filters.countries && filters.countries.length > 0) {
      const ctrys = filters.countries;
      filtered = filtered.filter(item => 
        item.originCountry !== undefined && item.originCountry.some(c => ctrys.includes(c))
      );
    }

    // Filter by certification
    if (filters.certifications && filters.certifications.length > 0) {
      const certs = filters.certifications;
      filtered = filtered.filter(item => 
        item.certification !== undefined && certs.includes(item.certification)
      );
    }

    // Filter by genre
    if (filters.genres && filters.genres.length > 0) {
      const gens = filters.genres;
      filtered = filtered.filter(item => 
        item.genres !== undefined && item.genres.some(g => gens.includes(g))
      );
    }

    // Filter by min rating
    if (filters.minRating !== undefined) {
      const minR = filters.minRating;
      filtered = filtered.filter(item => (item.rating ?? 0) >= minR);
    }

    // Filter by max rating
    if (filters.maxRating !== undefined) {
      const maxR = filters.maxRating;
      filtered = filtered.filter(item => (item.rating ?? 0) <= maxR);
    }

    // Filter by year range
    if (filters.startYear !== undefined) {
      const sYear = filters.startYear;
      filtered = filtered.filter(item => (item.year ?? 0) >= sYear);
    }
    if (filters.endYear !== undefined) {
      const eYear = filters.endYear;
      filtered = filtered.filter(item => (item.year ?? 0) <= eYear);
    }

    // Filter by keywords
    if (filters.keywords && filters.keywords.length > 0) {
      const kw = filters.keywords;
      filtered = filtered.filter(item => 
        item.keywords !== undefined && item.keywords.some(k => kw.includes(k))
      );
    }

    // Filter adult content
    if (filters.includeAdult === false) {
      filtered = filtered.filter(item => !(item as any).adult);
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
      const langs = filters.languages;
      filtered = filtered.filter(item => 
        item.originalLanguage !== undefined && langs.includes(item.originalLanguage)
      );
    }

    // Filter by country
    if (filters.countries && filters.countries.length > 0) {
      const ctrys = filters.countries;
      filtered = filtered.filter(item => 
        item.originCountry !== undefined && item.originCountry.some(c => ctrys.includes(c))
      );
    }

    // Filter by certification
    if (filters.certifications && filters.certifications.length > 0) {
      const certs = filters.certifications;
      filtered = filtered.filter(item => 
        item.certification !== undefined && certs.includes(item.certification)
      );
    }

    // Filter by genre
    if (filters.genres && filters.genres.length > 0) {
      const gens = filters.genres;
      filtered = filtered.filter(item => 
        item.genres !== undefined && item.genres.some(g => gens.includes(g))
      );
    }

    // Filter by rating range
    if (filters.minRating !== undefined) {
      const minR = filters.minRating;
      filtered = filtered.filter(item => (item.rating ?? 0) >= minR);
    }
    if (filters.maxRating !== undefined) {
      const maxR = filters.maxRating;
      filtered = filtered.filter(item => (item.rating ?? 0) <= maxR);
    }

    // Filter by year range
    if (filters.startYear !== undefined) {
      const sYear = filters.startYear;
      filtered = filtered.filter(item => (item.year ?? 0) >= sYear);
    }
    if (filters.endYear !== undefined) {
      const eYear = filters.endYear;
      filtered = filtered.filter(item => (item.year ?? 0) <= eYear);
    }

    // Filter by keywords
    if (filters.keywords && filters.keywords.length > 0) {
      const kw = filters.keywords;
      filtered = filtered.filter(item => 
        item.keywords !== undefined && item.keywords.some(k => kw.includes(k))
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
        // Default: popularity descending
        return sorted.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
    }
  }
}

export default MetadataAggregatorNew;