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
 * FIXED: Kuryana results no longer get language/country filtered at the
 * aggregator level since its database endpoint is already Asian-only.
 * 
 * v2.1 - ADDED: TV show season data support
 * - getById now returns seasons and displaySeasons from adapters
 * - search and discover pass seasons data through to results
 * - Added logging for season data in getById
 */

import { IMetadataResult, SearchRequest, DiscoverFilters, ISeason } from '../../unified/types/MetadataTypes';
import { TMDBMetadataAdapter } from './adapters/TMDBMetadataAdapter';
import { KuryanaMetadataAdapter } from './adapters/KuryanaMetadataAdapter';
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
  // NEW: server-side exclusion filter. Lets a category (e.g. "Cartoons")
  // request the same genre as another category (e.g. "Anime" - both are
  // "Animation") while excluding the language that makes it anime, instead
  // of every consumer having to duplicate that distinction client-side.
  // This is the single source of truth for "cartoons are not anime".
  excludeLanguages?: string[];
}

/**
 * TMDB genre IDs -> human-readable names.
 *
 * FIXED: TMDBMetadataAdapter's list/discover results only ever populate
 * `item.genres` with stringified numeric genre IDs (e.g. "28"), because
 * TMDB's /discover and /search endpoints only return `genre_ids`, never
 * genre-name objects (only the single-item /details endpoint does). Every
 * other provider (Consumet, Kuryana, MovieBox) puts real names like
 * "Action" in `item.genres`. The aggregator's own genre filter compares
 * `item.genres` against filter values that are always human names (e.g.
 * "Action" from a UI genre chip) - so for TMDB-sourced items the comparison
 * was silently "28" !== "Action" for every single item, wiping out 100
 * good, server-side-filtered results down to 0. Normalizing any purely
 * numeric genre entries through this map before comparing fixes that for
 * every call site without needing to touch each provider adapter.
 */
const TMDB_GENRE_ID_TO_NAME: Record<string, string> = {
  '28': 'Action', '12': 'Adventure', '16': 'Animation', '35': 'Comedy',
  '80': 'Crime', '99': 'Documentary', '18': 'Drama', '10751': 'Family',
  '14': 'Fantasy', '36': 'History', '27': 'Horror', '10402': 'Music',
  '9648': 'Mystery', '10749': 'Romance', '878': 'Sci-Fi', '10770': 'TV Movie',
  '53': 'Thriller', '10752': 'War', '37': 'Western',
  // TV-specific IDs
  '10759': 'Action & Adventure', '10762': 'Kids', '10763': 'News',
  '10764': 'Reality', '10765': 'Sci-Fi & Fantasy', '10766': 'Soap',
  '10767': 'Talk', '10768': 'War & Politics',
};

function normalizeGenres(genres?: string[]): string[] {
  if (!genres || genres.length === 0) return [];
  return genres.map(g => (/^\d+$/.test(g) ? (TMDB_GENRE_ID_TO_NAME[g] || g) : g));
}

/**
 * Converts the string-shaped `years` filter (e.g. "2025" or "2020-2024",
 * as produced by UnifiedMediaService.search()/discover() when it builds a
 * SearchRequest) into the numeric year/startYear/endYear fields that
 * DiscoverFilters and every provider's discover()/search() actually read.
 *
 * FIXED: `filters as DiscoverFilters` at the empty-query redirect in
 * search() was a pure type-level cast with no runtime conversion, so
 * `years: "2025"` never became `year: 2025` and every discover() call
 * silently ignored whatever year the user picked. `parseInt(filters.years)`
 * in the non-empty-query path had the same problem for range strings like
 * "2020-2024" - it truncated to 2020 and dropped endYear entirely.
 */
function parseYearsFilter(years?: string): Pick<DiscoverFilters, 'year' | 'startYear' | 'endYear'> {
  if (!years) return {};

  const range = years.match(/^(\d{4})-(\d{4})$/);
  if (range) {
    return { startYear: parseInt(range[1], 10), endYear: parseInt(range[2], 10) };
  }

  // Handle the open-ended range shapes UnifiedMediaService can produce,
  // e.g. "2020-" (startYear only) or "-2024" (endYear only).
  const openStart = years.match(/^(\d{4})-$/);
  if (openStart) return { startYear: parseInt(openStart[1], 10) };

  const openEnd = years.match(/^-(\d{4})$/);
  if (openEnd) return { endYear: parseInt(openEnd[1], 10) };

  const single = parseInt(years, 10);
  return isNaN(single) ? {} : { year: single };
}

export class MetadataAggregatorNew {
  private providers: MetadataProvider[] = [];
  private initialized = false;

  constructor() {
    // Register ALL metadata providers - COMPLETE LIST (5 providers)
    this.providers = [
      new TMDBMetadataAdapter(),      // Primary movie/TV metadata
      new KuryanaMetadataAdapter(),   // Asian dramas metadata
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
   * v2.1 - Now passes seasons and displaySeasons through from providers.
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

      // FIXED: `type` was destructured out of `request` above and never
      // merged back into `filters`/`discoverFilters`, so every empty-query
      // discover() call silently lost whatever media type the caller asked
      // for (e.g. Anime's "all" or Asian's "tv") and fell back to the
      // 'movie'-only default inside discover(). Normalize whatever shape
      // `type` came in as (string, array, 'show' alias) into the
      // 'movie' | 'tv' | 'all' that DiscoverFilters actually expects, and
      // pass it through explicitly.
      const rawType: unknown = type;
      let resolvedType: DiscoverFilters['type'] | undefined;
      const firstType = Array.isArray(rawType) ? rawType[0] : rawType;
      // FIXED: this used to check firstType === 'movie' before checking
      // whether rawType was actually a multi-element array - so a caller
      // asking for "every type" via `type: ['movie', 'show']` (e.g.
      // UnifiedMediaService.search()'s own default, and its old discover()
      // before it was fixed to call the aggregator's discover() directly)
      // matched the 'movie' branch on the first element and silently lost
      // 'show'/'tv' entirely. Checking "is this actually a list of more
      // than one type" first means a real multi-type request always
      // resolves to 'all', and the single-value checks only run once we
      // know there's exactly one type to resolve.
      if (Array.isArray(rawType) && rawType.length > 1) {
        resolvedType = 'all';
      } else if (firstType === 'tv' || firstType === 'show') {
        resolvedType = 'tv';
      } else if (firstType === 'movie') {
        resolvedType = 'movie';
      } else if (firstType === 'all') {
        resolvedType = 'all';
      }

      const discoverFilters: DiscoverFilters = {
        ...(filters as DiscoverFilters),
        ...(resolvedType ? { type: resolvedType } : {}),
        ...parseYearsFilter(filters.years),
      };
      console.log('[MetadataAggregator] 📅 Resolved year filter:', {
        years: filters.years,
        year: discoverFilters.year,
        startYear: discoverFilters.startYear,
        endYear: discoverFilters.endYear,
      });
      return this.discover(discoverFilters, limit);
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

        // Resolve the years filter once per provider (not per mediaType) -
        // explicit startDate/endDate win when present, otherwise fall back
        // to whatever `years` (e.g. "2025" or "2020-2024") resolves to.
        const yearsFromFilter = parseYearsFilter(filters.years);
        const resolvedYear = yearsFromFilter.year;
        const resolvedStartYear = filters.startDate
          ? new Date(filters.startDate).getFullYear()
          : yearsFromFilter.startYear;
        const resolvedEndYear = filters.endDate
          ? new Date(filters.endDate).getFullYear()
          : yearsFromFilter.endYear;

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
              year: resolvedYear,
              startYear: resolvedStartYear,
              endYear: resolvedEndYear,
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
        id: r.id,
        // NEW: Log season data for TV shows
        seasons: r.seasons?.length || 0,
        displaySeasons: r.displaySeasons?.join(', ') || 'none'
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
   * v2.1 - Now passes seasons and displaySeasons through from providers.
   * 
   * @param filters - DiscoverFilters with language, country, region, genres, etc.
   * @param limit - Maximum number of results
   * @returns Array of metadata results matching the filters
   */
  async discover(filters: DiscoverFilters, limit: number = 20): Promise<IMetadataResult[]> {
    await this.initialize();

    console.log(`[MetadataAggregator] 🔍 Discover started with filters:`, filters);

    // FIXED: previously every provider's results were pushed into one flat
    // `allResults` array, then the WHOLE combined pool was capped to a
    // single `limit` after one global popularity sort. MovieBox/Consumet/
    // Kuryana items generally carry popularity: 0 (they have no TMDB-style
    // popularity score), so they always sorted to the bottom - meaning the
    // instant TMDB alone returned >= limit results, every other source got
    // sliced off entirely even though it had returned real data. A
    // multi-source category (Anime: tmdb+consumet, Asian: kuryana+consumet)
    // would silently degrade to single-source output. Bucketing per
    // provider (in discoverProviders' priority order) lets each source keep
    // its own budget of up to `limit` results, independent of how the other
    // sources score.
    const providerResults: Record<string, number> = {};

    // Determine media types to search
    const mediaTypes: Array<'movie' | 'tv'> =
      filters.type === 'all' ? ['movie', 'tv'] : [(filters.type as 'movie' | 'tv') || 'movie'];

    // FIXED: Kuryana, MovieBox, Consumet, and Trakt were being called on
    // every single discover() request and never contributing a single
    // result for category browsing (e.g. "Bollywood"): Kuryana's seasonal
    // endpoint 500s every time and its country-search fallback returns
    // dramas that don't match the language/country filters; MovieBox's
    // discover only has access to unfiltered "hot" lists that filter down
    // to 0; Consumet's scraping mirrors are down (403/520/network errors);
    // and TraktMetadataAdapter.discover() is a literal unimplemented stub
    // that always returns an empty array without even making a request.
    // That's 4 wasted round-trips (plus a wall of error logs) per category
    // press for zero results. Only TMDB actually returns anything right
    // now, so skip the rest here by default. Revisit/remove entries from
    // this set once a given provider's discover() is actually wired up.
    //
    // OVERRIDE: a caller can pass `sources: string[]` on the filters object
    // (e.g. SearchScreen's CATEGORY_CARDS[i].sources) to explicitly opt a
    // category into a specific provider mix instead of the default
    // TMDB-only set - e.g. Anime combining TMDB + Consumet, or the merged
    // "Asian" category combining Kuryana + Consumet. This is an explicit
    // request, so it bypasses DISCOVER_DISABLED_PROVIDER_IDS - but note the
    // underlying reasons those providers were disabled (above) still apply
    // until KuryanaMetadataAdapter/ConsumetMetadataAdapter's discover()
    // implementations are actually fixed; opting them back in here won't by
    // itself make their broken endpoints start returning results.
    const DISCOVER_DISABLED_PROVIDER_IDS = new Set(['kuryana', 'trakt']);
    const requestedSources = (filters as DiscoverFilters & { sources?: string[] }).sources;
    const discoverProviders = requestedSources && requestedSources.length > 0
      ? this.providers.filter(p => requestedSources.includes(p.id))
      : this.providers.filter(p => !DISCOVER_DISABLED_PROVIDER_IDS.has(p.id));

    if (requestedSources && requestedSources.length > 0) {
      console.log(`[MetadataAggregator] 🔧 Using explicit source override:`, requestedSources);
    }

    // One bucket per provider (same order as discoverProviders, i.e.
    // registration/priority order, or the caller's explicit `sources`
    // order) - this is what makes per-source capping and round-robin
    // interleaving possible below.
    const buckets: IMetadataResult[][] = discoverProviders.map(() => []);

    // Try discover method on ALL (enabled) providers that support it
    for (let providerIdx = 0; providerIdx < discoverProviders.length; providerIdx++) {
      const provider = discoverProviders[providerIdx];
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
            buckets[providerIdx].push(...results);
          }
        } catch (error) {
          console.error(`[MetadataAggregator] ❌ Provider ${provider.name} discover (${mediaType}) failed:`, error);
          providerResults[`${provider.name}-${mediaType}`] = 0;
        }
      }
    }

    console.log(`[MetadataAggregator] 📊 Discover summary:`, providerResults);
    console.log(`[MetadataAggregator] 📊 Total raw results: ${buckets.reduce((n, b) => n + b.length, 0)}`);

    // FIXED: each source's bucket is now filtered, cross-source-deduped, and
    // sorted/capped to `limit` INDEPENDENTLY - so e.g. TMDB and Consumet
    // each get up to `limit` results of their own, instead of one shared
    // pool where the highest-popularity source ate the entire budget and
    // the rest got sliced off.
    //
    // FIXED: Kuryana's database endpoint is already Asian-only. Applying
    // language/country filters at the aggregator level would incorrectly
    // reject valid Kuryana results (e.g. searching for "Korea" returns dramas
    // with inferred country=KR, but the filter expects originCountry to
    // include 'KR' which may not be populated on search results). Use a
    // Kuryana-safe filter that skips language/country filtering.
    const sortBy = (filters.sortBy as SortOption) || 'popularity.desc';
    const seenGlobally = new Set<string>(); // cross-source de-dupe, priority order wins ties
    const processedBuckets = buckets.map((bucket, i) => {
      const provider = discoverProviders[i];
      const providerId = provider?.id?.toLowerCase() || '';

      // ─── FIX: Kuryana's database is already Asian-only ───
      // Skip language/country filters for Kuryana since its endpoint is
      // already scoped. Only apply genre, rating, year, keyword, type filters.
      const isKuryana = providerId === 'kuryana';

      let b: IMetadataResult[];
      if (isKuryana) {
        b = this.applyKuryanaSafeFilters(bucket, filters);
      } else {
        b = this.applyDiscoverFilters(bucket, filters);
      }

      b = b.filter(item => {
        const key = `${item.type}-${item.id}`;
        if (seenGlobally.has(key)) return false;
        seenGlobally.add(key);
        return true;
      });
      b = this.sortResults(b, sortBy);
      const capped = b.slice(0, limit);
      console.log(`[MetadataAggregator] 📊 ${provider?.name || 'unknown'} bucket: ${bucket.length} raw -> ${capped.length} after filter/dedupe/cap (limit ${limit})`);
      return capped;
    });

    // Round-robin interleave: 1st result from source A, 1st from source B,
    // ..., 2nd from source A, 2nd from source B, ... - so every requested
    // source is actually visible near the top of the list, in the same
    // relative order the caller/registration gave the sources, instead of
    // being crowded out entirely by whichever source sorts highest once
    // everything is merged into one pool.
    const finalResults: IMetadataResult[] = [];
    const maxBucketLen = processedBuckets.reduce((max, b) => Math.max(max, b.length), 0);
    for (let i = 0; i < maxBucketLen; i++) {
      for (const bucket of processedBuckets) {
        if (bucket[i]) finalResults.push(bucket[i]);
      }
    }

    console.log(`[MetadataAggregator] 🏁 Final discover results: ${finalResults.length} (interleaved across ${discoverProviders.length} source(s), up to ${limit} each)`);
    return finalResults;
  }

  /**
   * Get metadata by ID from any provider.
   * 
   * v2.1 - ENHANCED: Now returns seasons and displaySeasons from the provider.
   * For TV shows, this includes the full seasons array and filtered display seasons.
   * 
   * @param id - The media ID (TMDB ID or other provider ID)
   * @param type - The media type ('movie' or 'tv')
   * @returns Complete metadata including seasons for TV shows
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
          
          // Log season data if TV show
          if (type === 'tv' && result.seasons) {
            console.log(`[MetadataAggregator] 📊 Seasons: ${result.seasons.length}`);
            console.log(`[MetadataAggregator] 📊 Display seasons: ${result.displaySeasons?.join(', ') || 'none'}`);
            console.log(`[MetadataAggregator] 📊 Total seasons: ${result.numberOfSeasons || 0}`);
            console.log(`[MetadataAggregator] 📊 Total episodes: ${result.numberOfEpisodes || 0}`);
          }
          
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
   * 
   * v2.1 - Preserves seasons and displaySeasons through filtering.
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

    // Filter OUT specific languages (e.g. "Cartoons" = Animation genre minus
    // Japanese, so it never overlaps with "Anime"). Single server-side rule
    // instead of every screen re-deriving "not anime" on its own.
    if (filters.excludeLanguages && filters.excludeLanguages.length > 0) {
      const excluded = filters.excludeLanguages;
      filtered = filtered.filter(item =>
        !item.originalLanguage || !excluded.includes(item.originalLanguage)
      );
    }

    // Filter by country
    // NOTE: Movie objects from TMDB (and most scraping-based movie providers)
    // never populate originCountry — that data only exists reliably on TV
    // objects. Rejecting movies for missing originCountry would wipe out
    // every movie result even though providers already scoped the request
    // server-side (e.g. TMDB's with_origin_country). Only enforce this
    // filter when we actually have country data to check against.
    if (filters.countries && filters.countries.length > 0) {
      const ctrys = filters.countries;
      filtered = filtered.filter(item => 
        !item.originCountry || item.originCountry.length === 0
          ? item.type === 'movie'
          : item.originCountry.some(c => ctrys.includes(c))
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
    // FIXED: normalize both sides (TMDB numeric genre IDs -> names) before
    // comparing - see normalizeGenres() doc comment above.
    if (filters.genres && filters.genres.length > 0) {
      const gens = filters.genres.map((g: string) => g.toLowerCase());
      filtered = filtered.filter(item => {
        const itemGenres = normalizeGenres(item.genres).map(g => g.toLowerCase());
        return itemGenres.length > 0 && itemGenres.some(g => gens.includes(g));
      });
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
   * 
   * v2.1 - Preserves seasons and displaySeasons through filtering.
   */
  private applyDiscoverFilters(
    results: IMetadataResult[],
    filtersIn: DiscoverFilters
  ): IMetadataResult[] {
    // NOTE: `excludeLanguages` is a local-only extension (see SearchFilters
    // doc comment above) - it isn't declared on the shared DiscoverFilters
    // type, so it's read through this widened alias rather than editing
    // MetadataTypes.ts.
    const filters = filtersIn as DiscoverFilters & { excludeLanguages?: string[] };
    let filtered = [...results];

    // Filter by language
    if (filters.languages && filters.languages.length > 0) {
      const langs = filters.languages;
      filtered = filtered.filter(item => 
        item.originalLanguage !== undefined && langs.includes(item.originalLanguage)
      );
    }

    // Filter OUT specific languages. Used by the "Cartoons" category so it
    // can share the "Animation" genre with "Anime" while still excluding
    // Japanese-language titles - the server is the single place that decides
    // what counts as "not anime", so every screen gets the same answer.
    if (filters.excludeLanguages && filters.excludeLanguages.length > 0) {
      const excluded = filters.excludeLanguages;
      filtered = filtered.filter(item =>
        !item.originalLanguage || !excluded.includes(item.originalLanguage)
      );
    }

    // Filter by country
    // NOTE: Movie objects from TMDB (and most scraping-based movie providers)
    // never populate originCountry — that data only exists reliably on TV
    // objects. Rejecting movies for missing originCountry would wipe out
    // every movie result even though providers already scoped the request
    // server-side (e.g. TMDB's with_origin_country). Only enforce this
    // filter when we actually have country data to check against.
    if (filters.countries && filters.countries.length > 0) {
      const ctrys = filters.countries;
      filtered = filtered.filter(item => 
        !item.originCountry || item.originCountry.length === 0
          ? item.type === 'movie'
          : item.originCountry.some(c => ctrys.includes(c))
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
    // FIXED: this is the block responsible for "After filtering: 0" in the
    // logs whenever a genre chip was active. TMDB discover/list results
    // carry item.genres as numeric ID strings (e.g. "28"), not names, so
    // comparing directly against filters.genres (human names like "Action")
    // always failed even though TMDB itself had already correctly scoped
    // results server-side via with_genres. normalizeGenres() resolves both
    // sides to names before comparing.
    if (filters.genres && filters.genres.length > 0) {
      const gens = filters.genres.map((g: string) => g.toLowerCase());
      filtered = filtered.filter(item => {
        const itemGenres = normalizeGenres(item.genres).map(g => g.toLowerCase());
        return itemGenres.length > 0 && itemGenres.some(g => gens.includes(g));
      });
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
   * Apply discover filters EXCEPT language/country — used for Kuryana
   * since its database endpoint is already Asian-only. Prevents valid
   * Kuryana results from being incorrectly rejected by aggregator-level
   * language/country filtering.
   * 
   * v2.1 - Preserves seasons and displaySeasons through filtering.
   */
  private applyKuryanaSafeFilters(
    results: IMetadataResult[],
    filtersIn: DiscoverFilters
  ): IMetadataResult[] {
    const filters = filtersIn as DiscoverFilters & { excludeLanguages?: string[] };
    let filtered = [...results];

    // ─── SKIP: languages, countries, region, excludeLanguages ───
    // Kuryana's database is already Asian-only. Filtering by these would
    // incorrectly reject valid results since Kuryana search results may
    // not populate originalLanguage/originCountry consistently.

    // Genre filtering
    if (filters.genres && filters.genres.length > 0) {
      const gens = filters.genres.map((g: string) => g.toLowerCase());
      filtered = filtered.filter(item => {
        const itemGenres = normalizeGenres(item.genres).map(g => g.toLowerCase());
        return itemGenres.length > 0 && itemGenres.some(g => gens.includes(g));
      });
    }

    // Rating range
    if (filters.minRating !== undefined) {
      filtered = filtered.filter(item => (item.rating ?? 0) >= filters.minRating!);
    }
    if (filters.maxRating !== undefined) {
      filtered = filtered.filter(item => (item.rating ?? 0) <= filters.maxRating!);
    }

    // Year range
    if (filters.startYear !== undefined) {
      filtered = filtered.filter(item => (item.year ?? 0) >= filters.startYear!);
    }
    if (filters.endYear !== undefined) {
      filtered = filtered.filter(item => (item.year ?? 0) <= filters.endYear!);
    }

    // Keywords
    if (filters.keywords && filters.keywords.length > 0) {
      const kw = filters.keywords;
      filtered = filtered.filter(item => 
        item.keywords !== undefined && item.keywords.some(k => kw.includes(k))
      );
    }

    // Type filter
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