/**
 * TMDBMetadataAdapter - Adapter that wraps TMDB functions to implement the metadata provider interface.
 * Translates TMDB's standalone functions into the unified metadata provider shape.
 * 
 * v2.0 - Supports full industry-standard filters including language, country, region.
 * Uses TMDB's discover endpoints for category browsing without keywords.
 * FIXED: Uses /discover endpoint when country/language filters are present.
 * FIXED: Flexible language/country filtering with fallback strategies.
 * FIXED: Genre filtering now correctly resolves human labels to numeric IDs
 * before comparing against item.genres (which are numeric IDs from TMDB).
 * FIXED: Country filtering for movies - TMDB's /discover/movie doesn't return
 * origin_country, so we trust the server-side filter instead of rejecting.
 * 
 * v2.1 - ADDED: TV show season data support
 * - Added mapSeasonsData helper to convert TMDB seasons to ISeason format
 * - Added filterDisplaySeasons helper to filter seasons for UI display
 * - Enhanced mapDetailedResult to include seasons and displaySeasons for TV shows
 * - Added comprehensive season data logging
 */

import { IMetadataResult, DiscoverFilters, ISeason } from '../../types/MetadataTypes';
import tmdbApi from '../TMDBMetadata';

// TMDB API constants
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';
const TMDB_POSTER_SIZE = 'w500';
const TMDB_BACKDROP_SIZE = 'w1280';
const TMDB_PROFILE_SIZE = 'w185';

// Language mapping for fallback detection
const LANGUAGE_MAP: Record<string, string[]> = {
  'hi': ['hi', 'hin', 'hindi'],
  'bn': ['bn', 'ben', 'bengali'],
  'te': ['te', 'tel', 'telugu'],
  'ta': ['ta', 'tam', 'tamil'],
  'ml': ['ml', 'mal', 'malayalam'],
  'en': ['en', 'eng', 'english'],
  'ko': ['ko', 'kor', 'korean'],
  'ja': ['ja', 'jpn', 'japanese'],
  'zh': ['zh', 'zho', 'chinese', 'mandarin'],
  'fr': ['fr', 'fra', 'french'],
  'es': ['es', 'spa', 'spanish'],
  'de': ['de', 'deu', 'german'],
  'it': ['it', 'ita', 'italian'],
  'pt': ['pt', 'por', 'portuguese'],
  'ru': ['ru', 'rus', 'russian'],
  'ar': ['ar', 'ara', 'arabic'],
  'tr': ['tr', 'tur', 'turkish'],
  'th': ['th', 'tha', 'thai'],
  'vi': ['vi', 'vie', 'vietnamese'],
};

// ─── FIX: Genre name to TMDB ID mapping ───
const GENRE_NAME_TO_ID: Record<string, number> = {
  'Action': 28,
  'Adventure': 12,
  'Animation': 16,
  'Comedy': 35,
  'Crime': 80,
  'Documentary': 99,
  'Drama': 18,
  'Family': 10751,
  'Fantasy': 14,
  'Horror': 27,
  'Mystery': 9648,
  'Romance': 10749,
  'Sci-Fi': 878,
  'Thriller': 53,
  'War': 10752,
  'Western': 37,
  'Anime': 16,
  'Korean': 18,
  'K-Drama': 18,
  'Bollywood': 18,
  'Hollywood': 18,
  'Nollywood': 18,
  'Chinese': 18,
  'C-Drama': 18,
  'Japanese': 18,
  'J-Drama': 18,
  'Thai': 18,
  'Taiwanese': 18,
  'Turkish': 18,
  'Wuxia': 14,
  'Xianxia': 14,
  'Historical': 36,
  'Period': 36,
  'Martial Arts': 28,
  'Sageuk': 18,
  'Melodrama': 18,
  'Slice of Life': 18,
  'School': 18,
  'Youth': 18,
  'Coming of Age': 18,
  'Supernatural': 14,
  'Ghost': 27,
  'Psychological': 53,
  'Police': 80,
  'Detective': 80,
  'Medical': 18,
  'Legal': 18,
  'Political': 18,
  'Food': 18,
  'Music': 10402,
  'Sports': 18,
  'Revenge': 53,
  'Time Travel': 878,
  'Adaptation': 18,
  'Webtoon': 18,
  'Manhwa': 18,
  'Manga': 18,
  'Idol': 18,
  'BL': 18,
  'GL': 18,
  'LGBT': 18,
  'Erotica': 18,
  'Mature': 18,
};

// ─── FIX: TMDB genre ID to name mapping (reverse lookup) ───
const GENRE_ID_TO_NAME: Record<number, string> = Object.entries(GENRE_NAME_TO_ID).reduce(
  (acc, [name, id]) => ({ ...acc, [id]: name }),
  {}
);

export class TMDBMetadataAdapter {
  readonly name = 'TMDB';
  readonly id = 'tmdb';
  readonly priority = 1;
  readonly enabled = true;
  private initialized = false;

  /**
   * Ensure the adapter is initialized (no-op for TMDB, but keeps interface consistent).
   */
  async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    console.log('[TMDBMetadataAdapter] Initialized');
  }

  /**
   * Search for movies or TV shows with full filter support.
   * For discover mode (empty query), uses TMDB's discover endpoints.
   * When country/language filters are present, uses discover instead of search.
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
    watchProviders?: number[];
    withCast?: string[];
    withCrew?: string[];
    withCompanies?: string[];
    withoutGenres?: string[];
    includeAdult?: boolean;
    sortBy?: string;
    language?: string;
    watchRegion?: string;
    extended?: string;
  }): Promise<IMetadataResult[]> {
    await this.ensureInitialized();

    const {
      query,
      type,
      limit = 20,
      languages,
      countries,
      region,
      genres,
      certifications,
      minRating,
      maxRating,
      year,
      startYear,
      endYear,
      keywords,
      watchProviders,
      withCast,
      withCrew,
      withCompanies,
      withoutGenres,
      includeAdult = false,
      sortBy = 'popularity.desc',
      language,
      watchRegion,
    } = options;

    // If query is empty or just whitespace, use discover mode
    if (!query || query.trim() === '') {
      return this.discover({
        languages,
        countries,
        region: region || watchRegion,
        genres,
        certifications,
        minRating,
        maxRating,
        year,
        startYear,
        endYear,
        keywords,
        watchProviders,
        withCast,
        withCrew,
        withCompanies,
        withoutGenres,
        includeAdult,
        sortBy,
        type: type || 'all',
        limit,
      });
    }

    try {
      // ─── CRITICAL FIX: If we have country/language filters, use discover endpoint ───
      // The /search/multi endpoint doesn't support country/language filters
      const hasFilters = (countries && countries.length > 0) || 
                         (languages && languages.length > 0) || 
                         (genres && genres.length > 0) ||
                         (certifications && certifications.length > 0) ||
                         minRating !== undefined ||
                         maxRating !== undefined ||
                         year !== undefined ||
                         startYear !== undefined ||
                         endYear !== undefined;

      if (hasFilters) {
        console.log(`[TMDBMetadataAdapter] Using DISCOVER for "${query}" with filters:`, {
          countries,
          languages,
          genres,
        });

        // Build discover params with the query as a keyword
        const discoverFilters: DiscoverFilters = {
          languages,
          countries,
          region: region || watchRegion,
          genres,
          certifications,
          minRating,
          maxRating,
          year,
          startYear,
          endYear,
          keywords: [query, ...(keywords || [])], // Add query as keyword
          watchProviders,
          withCast,
          withCrew,
          withCompanies,
          withoutGenres,
          includeAdult,
          sortBy,
          type: type || 'all',
          limit: Math.min(limit * 2, 50),
        };

        // Use discover with the query as a keyword filter
        const discoverResults = await this.discover(discoverFilters, limit * 2);
        
        // If discover returns results, return them
        if (discoverResults.length > 0) {
          console.log(`[TMDBMetadataAdapter] Discover returned ${discoverResults.length} results for "${query}"`);
          return discoverResults.slice(0, limit);
        }
        
        // If discover returns nothing, fall back to regular search
        console.log(`[TMDBMetadataAdapter] Discover returned no results, falling back to regular search for "${query}"`);
      }

      // ─── Regular search with query (no filters) ───
      const results = await tmdbApi.searchMedia(query);

      // Filter by type if specified
      let filtered = results;
      if (type === 'movie') {
        filtered = results.filter((item: any) => item.media_type === 'movie' || item.title);
      } else if (type === 'tv') {
        filtered = results.filter((item: any) => item.media_type === 'tv' || item.name);
      }

      // Map results
      const mapped = this.mapSearchResults(filtered, 'tmdb');
      
      // Apply any remaining client-side filters with flexible matching
      let processed = this.applyFiltersFlexible(mapped, {
        languages,
        countries,
        region,
        genres,
        certifications,
        minRating,
        maxRating,
        year,
        startYear,
        endYear,
        keywords,
        includeAdult,
        sortBy,
      });

      // Sort results
      processed = this.sortResults(processed, sortBy);

      return processed.slice(0, limit);
    } catch (error) {
      console.error('[TMDBMetadataAdapter] Search failed:', error);
      return [];
    }
  }

  /**
   * DISCOVER - Category browsing without a keyword using TMDB's discover endpoints.
   * This is how Netflix/MovieBox do category rows.
   */
  async discover(filters: DiscoverFilters, limit: number = 20): Promise<IMetadataResult[]> {
    await this.ensureInitialized();

    console.log('[TMDBMetadataAdapter] Discover called with filters:', {
      languages: filters.languages,
      countries: filters.countries,
      type: filters.type,
      genres: filters.genres,
    });

    try {
      const results: IMetadataResult[] = [];
      
      // Determine what to fetch based on type
      const fetchMovies = filters.type === 'all' || filters.type === 'movie';
      const fetchShows = filters.type === 'all' || filters.type === 'tv';

      // Build discover params for TMDB
      const params = this.buildDiscoverParams(filters);

      // ─── FIX: Paginate until we have enough raw results ───
      // TMDB always caps a single discover response at 20 items per page,
      // regardless of the `limit` we pass in. Previously this only ever
      // fetched page 1, so a category like "Bollywood" (limit: 50) was
      // silently capped at whatever 20 items TMDB's popularity-sorted page 1
      // happened to contain — usually a cluster of newly-released titles
      // from the same year. That starved client-side filters (e.g. the year
      // toggle) of any other year to show. Fetch additional pages (capped at
      // MAX_DISCOVER_PAGES to stay reasonable) until we've gathered enough
      // raw results to satisfy the requested limit.
      const MAX_DISCOVER_PAGES = 5; // 5 pages * 20/page = up to 100 raw results
      const pagesNeeded = Math.min(MAX_DISCOVER_PAGES, Math.max(1, Math.ceil(limit / 20)));

      for (let page = 1; page <= pagesNeeded; page++) {
        const pageParams = { ...params, page };

        // Fetch movies if requested
        if (fetchMovies) {
          try {
            const movieResults = await this.fetchDiscoverMovies(pageParams);
            results.push(...movieResults);
          } catch (error) {
            console.error('[TMDBMetadataAdapter] Discover movies failed:', error);
          }
        }

        // Fetch TV shows if requested
        if (fetchShows) {
          try {
            const showResults = await this.fetchDiscoverShows(pageParams);
            results.push(...showResults);
          } catch (error) {
            console.error('[TMDBMetadataAdapter] Discover shows failed:', error);
          }
        }
      }

      // If no results and we have country/language filters, try a different approach
      if (results.length === 0 && (filters.countries || filters.languages)) {
        console.log('[TMDBMetadataAdapter] No discover results, trying fallback approach...');
        
        // Try with country as region
        if (filters.countries && filters.countries.length > 0) {
          const fallbackParams = this.buildDiscoverParams({
            ...filters,
            region: filters.countries[0],
            countries: [],
            languages: filters.languages || [],
          });
          
          if (fetchMovies) {
            try {
              const movieResults = await this.fetchDiscoverMovies(fallbackParams);
              results.push(...movieResults);
            } catch (error) {
              console.error('[TMDBMetadataAdapter] Fallback discover movies failed:', error);
            }
          }
          
          if (fetchShows) {
            try {
              const showResults = await this.fetchDiscoverShows(fallbackParams);
              results.push(...showResults);
            } catch (error) {
              console.error('[TMDBMetadataAdapter] Fallback discover shows failed:', error);
            }
          }
        }
      }

      // Apply flexible client-side filters
      let processed = this.applyFiltersFlexible(results, {
        languages: filters.languages,
        countries: filters.countries,
        region: filters.region,
        genres: filters.genres,
        minRating: filters.minRating,
        maxRating: filters.maxRating,
        year: filters.year,
        startYear: filters.startYear,
        endYear: filters.endYear,
        keywords: filters.keywords,
        includeAdult: filters.includeAdult,
      });

      // Deduplicate
      const seen = new Set<string>();
      processed = processed.filter(item => {
        const key = `${item.source || 'tmdb'}-${item.type}-${item.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // Sort results
      const sorted = this.sortResults(processed, filters.sortBy || 'popularity.desc');

      console.log(`[TMDBMetadataAdapter] Discover returning ${Math.min(sorted.length, limit)} results`);
      return sorted.slice(0, limit);
    } catch (error) {
      console.error('[TMDBMetadataAdapter] Discover failed:', error);
      return [];
    }
  }

  /**
   * Get metadata by ID.
   * For TV shows, this now includes full season data from the seasons array.
   */
  async getById(id: string, type: 'movie' | 'tv'): Promise<IMetadataResult | null> {
    await this.ensureInitialized();

    try {
      let item: any = null;

      if (type === 'movie') {
        item = await tmdbApi.fetchMovieDetails(parseInt(id));
      } else {
        // TV show - fetch with seasons data
        console.log(`[TMDBMetadataAdapter] 📡 Fetching TV details for ID: ${id}`);
        item = await tmdbApi.fetchTVShowDetails(parseInt(id));
        
        // Log season data for debugging
        if (item && item.seasons) {
          console.log(`[TMDBMetadataAdapter] ✅ Found ${item.seasons.length} seasons for "${item.name}"`);
        }
      }

      if (!item) return null;

      return this.mapDetailedResult(item, type);
    } catch (error) {
      console.error(`[TMDBMetadataAdapter] Get by ID ${id} failed:`, error);
      return null;
    }
  }

  /**
   * Get trending movies/TV shows.
   */
  async getTrending(limit: number = 20): Promise<IMetadataResult[]> {
    await this.ensureInitialized();

    try {
      const results = await tmdbApi.fetchTrending('day', 'all');
      const mapped = this.mapSearchResults(results, 'tmdb');
      return mapped.slice(0, limit);
    } catch (error) {
      console.error('[TMDBMetadataAdapter] GetTrending failed:', error);
      return [];
    }
  }

  /**
   * Get trending content by category.
   */
  async getTrendingByCategory(category: string, limit: number = 20, region?: string): Promise<IMetadataResult[]> {
    await this.ensureInitialized();

    try {
      // Map category to TMDB genre IDs or search terms
      const categoryMap: Record<string, { genreIds?: number[]; query?: string; type?: 'movie' | 'tv' }> = {
        'movies': { type: 'movie' },
        'tv': { type: 'tv' },
        'music': { query: 'music', type: 'movie' },
        'gaming': { query: 'gaming', type: 'movie' },
        'podcast': { query: 'podcast', type: 'tv' },
        'anime': { genreIds: [16], type: 'movie' }, // Animation genre
        'k-drama': { query: 'korean drama', type: 'tv' },
        'bollywood': { query: 'bollywood', type: 'movie' },
        'hollywood': { query: 'hollywood', type: 'movie' },
        'nollywood': { query: 'nollywood', type: 'movie' },
      };

      const categoryConfig = categoryMap[category.toLowerCase()] || { query: category, type: 'movie' };

      // Build discover params
      const params: any = {
        sort_by: 'popularity.desc',
        include_adult: false,
        region: region || 'US',
      };

      if (categoryConfig.genreIds) {
        params.with_genres = categoryConfig.genreIds.join(',');
      }

      if (categoryConfig.type === 'movie') {
        const results = await this.fetchDiscoverMovies(params);
        return results.slice(0, limit);
      } else if (categoryConfig.type === 'tv') {
        const results = await this.fetchDiscoverShows(params);
        return results.slice(0, limit);
      }

      // Fallback to search
      if (categoryConfig.query) {
        const results = await tmdbApi.searchMedia(categoryConfig.query);
        const mapped = this.mapSearchResults(results, 'tmdb');
        return mapped.slice(0, limit);
      }

      return [];
    } catch (error) {
      console.error('[TMDBMetadataAdapter] GetTrendingByCategory failed:', error);
      return [];
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PRIVATE DISCOVER METHODS
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Fetch discover movies from TMDB.
   */
  private async fetchDiscoverMovies(params: any): Promise<IMetadataResult[]> {
    try {
      // Use TMDB's discover/movie endpoint
      const url = `https://api.themoviedb.org/3/discover/movie`;
      const response = await this.fetchFromTMDB(url, params);
      return this.mapSearchResults(response.results || [], 'tmdb');
    } catch (error) {
      console.error('[TMDBMetadataAdapter] Fetch discover movies failed:', error);
      return [];
    }
  }

  /**
   * Fetch discover TV shows from TMDB.
   */
  private async fetchDiscoverShows(params: any): Promise<IMetadataResult[]> {
    try {
      // Use TMDB's discover/tv endpoint
      const url = `https://api.themoviedb.org/3/discover/tv`;
      const response = await this.fetchFromTMDB(url, params);
      return this.mapSearchResults(response.results || [], 'tmdb');
    } catch (error) {
      console.error('[TMDBMetadataAdapter] Fetch discover shows failed:', error);
      return [];
    }
  }

  /**
   * Build TMDB discover params from DiscoverFilters.
   */
  private buildDiscoverParams(filters: DiscoverFilters): any {
    // ─── FIX: Map our internal sortBy labels to TMDB's actual sort_by enum ───
    // TMDB's /discover/movie only recognizes 'primary_release_date.asc' /
    // 'primary_release_date.desc' (per its OpenAPI spec) — it does NOT
    // recognize 'release_date.asc' / 'release_date.desc', which is what our
    // own SortOption type uses as the app-facing label. Sending the raw
    // 'release_date.desc' straight through as sort_by was an invalid param
    // TMDB would reject or silently ignore. Map it here, at the API
    // boundary, so the rest of the app (UI labels, client-side sortResults)
    // can keep using 'release_date.*' without change.
    const TMDB_SORT_BY_MAP: Record<string, string> = {
      'release_date.asc': 'primary_release_date.asc',
      'release_date.desc': 'primary_release_date.desc',
    };
    const requestedSortBy = filters.sortBy || 'popularity.desc';
    const sortBy = TMDB_SORT_BY_MAP[requestedSortBy] || requestedSortBy;

    const params: any = {
      sort_by: sortBy,
      include_adult: filters.includeAdult || false,
    };

    // ─── FIX: Language filter with flexible mapping ───
    if (filters.languages && filters.languages.length > 0) {
      // Try to map to TMDB language codes
      const langCodes: string[] = [];
      for (const lang of filters.languages) {
        const lowerLang = lang.toLowerCase();
        // Find matching language code
        for (const [code, variants] of Object.entries(LANGUAGE_MAP)) {
          if (variants.some(v => lowerLang.includes(v) || v.includes(lowerLang))) {
            langCodes.push(code);
            break;
          }
        }
        // If no match found, use the original
        if (!langCodes.includes(lowerLang) && lowerLang.length <= 3) {
          langCodes.push(lowerLang);
        }
      }
      if (langCodes.length > 0) {
        params.with_original_language = langCodes.join('|');
      }
    }

    // ─── FIX: Country filter with flexible mapping ───
    if (filters.countries && filters.countries.length > 0) {
      // TMDB supports with_origin_country for TV
      const countryCodes = filters.countries.map(c => c.toUpperCase());
      params.with_origin_country = countryCodes.join('|');
      // Also set region for movies
      params.region = countryCodes[0];
    }

    // Region filter
    if (filters.region) {
      params.region = filters.region.toUpperCase();
    }

    // ─── FIX: Genre filter - resolve human labels to numeric IDs ───
    if (filters.genres && filters.genres.length > 0) {
      // Convert genre names to IDs
      const genreIds = this.resolveGenreNames(filters.genres);
      if (genreIds.length > 0) {
        params.with_genres = genreIds.join('|');
      }
    }

    // Certification filter
    if (filters.certifications && filters.certifications.length > 0) {
      params.certification_country = filters.region || 'US';
      params.certification = filters.certifications.join('|');
    }

    // Rating filters
    if (filters.minRating !== undefined) {
      params['vote_average.gte'] = filters.minRating;
    }
    if (filters.maxRating !== undefined) {
      params['vote_average.lte'] = filters.maxRating;
    }

    // Year filters
    if (filters.year) {
      // For movies: primary_release_year
      // For TV: first_air_date_year
      params.primary_release_year = filters.year;
      params.first_air_date_year = filters.year;
    } else {
      if (filters.startYear !== undefined) {
        params['primary_release_date.gte'] = `${filters.startYear}-01-01`;
        params['first_air_date.gte'] = `${filters.startYear}-01-01`;
      }
      if (filters.endYear !== undefined) {
        params['primary_release_date.lte'] = `${filters.endYear}-12-31`;
        params['first_air_date.lte'] = `${filters.endYear}-12-31`;
      }
    }

    // Watch providers
    if (filters.watchProviders && filters.watchProviders.length > 0) {
      params.with_watch_providers = filters.watchProviders.join('|');
      params.watch_region = filters.region || 'US';
    }

    // Keywords
    if (filters.keywords && filters.keywords.length > 0) {
      // TMDB uses keyword IDs, but we can search by name
      // For simplicity, we'll use a search query instead
      // A full implementation would resolve keyword IDs
    }

    // Cast and crew filtering (TMDB supports with_people)
    if (filters.withCast && filters.withCast.length > 0) {
      // This would require resolving person IDs
      // For now, we'll pass as-is if they're IDs
    }

    // Exclude genres
    if (filters.withoutGenres && filters.withoutGenres.length > 0) {
      params.without_genres = filters.withoutGenres.join('|');
    }

    // Pagination
    if (filters.page) {
      params.page = filters.page;
    }

    return params;
  }

  /**
   * Resolve genre names to TMDB genre IDs.
   */
  private resolveGenreNames(genreNames: string[]): number[] {
    try {
      return genreNames.map(name => GENRE_NAME_TO_ID[name] || 0).filter(id => id > 0);
    } catch (error) {
      console.warn('[TMDBMetadataAdapter] Failed to resolve genre names:', error);
      return [];
    }
  }

  /**
   * Fetch from TMDB API with rate limiting.
   */
  private async fetchFromTMDB(url: string, params: any): Promise<any> {
    const TMDB_API_KEY = 'fa953c513c37da857fb3155738358ff0';
    
    const fullUrl = new URL(url);
    fullUrl.searchParams.append('api_key', TMDB_API_KEY);
    
    // Add all params
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        fullUrl.searchParams.append(key, String(value));
      }
    }

    const response = await fetch(fullUrl.toString());
    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`);
    }

    return response.json();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Map TMDB search results to IMetadataResult.
   */
  private mapSearchResults(items: any[], source: string): IMetadataResult[] {
    return items.map((item: any) => ({
      id: item.id?.toString() || '',
      title: item.title || item.name || '',
      type: item.media_type === 'tv' || item.name ? 'tv' : 'movie',
      year: item.release_date ? parseInt(item.release_date.split('-')[0]) :
            item.first_air_date ? parseInt(item.first_air_date.split('-')[0]) :
            undefined,
      releaseDate: item.release_date || item.first_air_date || undefined,
      poster: item.poster_path ? `${TMDB_IMAGE_BASE}/${TMDB_POSTER_SIZE}${item.poster_path}` : undefined,
      backdrop: item.backdrop_path ? `${TMDB_IMAGE_BASE}/${TMDB_BACKDROP_SIZE}${item.backdrop_path}` : undefined,
      overview: item.overview || '',
      rating: item.vote_average || 0,
      popularity: item.popularity || 0,
      voteCount: item.vote_count || 0,
      genres: item.genre_ids?.map((id: number) => id.toString()) || [],
      keywords: [],
      source: source,
      originalLanguage: item.original_language || undefined,
      originalTitle: item.original_title || item.original_name || item.title || item.name || '',
      originCountry: item.origin_country || 
                    (item.production_countries?.map((c: any) => c.iso_3166_1)) || 
                    [],
      certification: undefined,
      tagline: undefined,
      status: item.status,
      belongsToCollection: undefined,
      watchProviders: undefined,
      budget: undefined,
      revenue: undefined,
      networks: undefined,
      spokenLanguages: undefined,
      productionCompanies: undefined,
      productionCountries: item.production_countries?.map((c: any) => ({
        iso3166_1: c.iso_3166_1,
        name: c.name,
      })) || [],
      numberOfSeasons: item.number_of_seasons || undefined,
      numberOfEpisodes: item.number_of_episodes || undefined,
      lastAirDate: item.last_air_date || undefined,
      inProduction: item.in_production || false,
      runtime: item.runtime || item.episode_run_time?.[0] || undefined,
      cast: [],
      // NEW: Season data for TV shows in search results
      // Note: Search results don't include seasons, so these are empty
      seasons: [],
      displaySeasons: [],
    }));
  }

  /**
   * Map detailed TMDB result to IMetadataResult.
   * ENHANCED: Now includes seasons and displaySeasons for TV shows.
   */
  private mapDetailedResult(item: any, type: 'movie' | 'tv'): IMetadataResult {
    const isMovie = type === 'movie';
    
    // ─── NEW: Map seasons for TV shows ───
    let seasons: ISeason[] = [];
    let displaySeasons: number[] = [];
    
    if (!isMovie && item.seasons) {
      // Map TMDB seasons to ISeason format
      seasons = this.mapSeasonsData(item.seasons);
      
      // Filter seasons for display (exclude season 0, specials, no air date)
      displaySeasons = this.filterDisplaySeasons(item.seasons);
      
      console.log(`[TMDBMetadataAdapter] 📊 Mapped ${seasons.length} seasons for "${item.name}"`);
      console.log(`[TMDBMetadataAdapter] 📊 Display seasons: [${displaySeasons.join(', ')}]`);
    }

    const result: IMetadataResult = {
      id: item.id?.toString() || '',
      title: item.title || item.name || '',
      type: isMovie ? 'movie' : 'tv',
      year: item.release_date ? parseInt(item.release_date.split('-')[0]) :
            item.first_air_date ? parseInt(item.first_air_date.split('-')[0]) :
            undefined,
      releaseDate: item.release_date || item.first_air_date || undefined,
      poster: item.poster_path ? `${TMDB_IMAGE_BASE}/${TMDB_POSTER_SIZE}${item.poster_path}` : undefined,
      backdrop: item.backdrop_path ? `${TMDB_IMAGE_BASE}/${TMDB_BACKDROP_SIZE}${item.backdrop_path}` : undefined,
      overview: item.overview || '',
      tagline: item.tagline || undefined,
      rating: item.vote_average || 0,
      popularity: item.popularity || 0,
      voteCount: item.vote_count || 0,
      runtime: item.runtime || item.episode_run_time?.[0] || undefined,
      genres: item.genres?.map((g: any) => g.name) || [],
      keywords: [],
      cast: item.credits?.cast?.slice(0, 10).map((c: any) => ({
        character: c.character,
        person: {
          name: c.name,
          ids: {},
        },
      })) || [],
      source: 'tmdb',
      
      // Enhanced fields
      originalLanguage: item.original_language || undefined,
      originalTitle: item.original_title || item.original_name || item.title || item.name || '',
      originCountry: item.origin_country || 
                    item.production_countries?.map((c: any) => c.iso_3166_1) || 
                    [],
      certification: item.releases?.results?.[0]?.certification || 
                     item.content_ratings?.results?.[0]?.rating || 
                     item.certification || undefined,
      status: item.status,
      belongsToCollection: item.belongs_to_collection ? {
        id: item.belongs_to_collection.id,
        name: item.belongs_to_collection.name,
        posterPath: item.belongs_to_collection.poster_path,
        backdropPath: item.belongs_to_collection.backdrop_path,
      } : undefined,
      budget: isMovie ? item.budget : undefined,
      revenue: isMovie ? item.revenue : undefined,
      networks: item.networks?.map((n: any) => ({
        id: n.id,
        name: n.name,
        logoPath: n.logo_path,
        originCountry: n.origin_country,
      })) || [],
      spokenLanguages: item.spoken_languages?.map((l: any) => ({
        englishName: l.english_name,
        iso639_1: l.iso_639_1,
        name: l.name,
      })) || [],
      productionCompanies: item.production_companies?.map((c: any) => ({
        id: c.id,
        name: c.name,
        logoPath: c.logo_path,
        originCountry: c.origin_country,
      })) || [],
      productionCountries: item.production_countries?.map((c: any) => ({
        iso3166_1: c.iso_3166_1,
        name: c.name,
      })) || [],
      numberOfSeasons: item.number_of_seasons || undefined,
      numberOfEpisodes: item.number_of_episodes || undefined,
      lastAirDate: item.last_air_date || undefined,
      inProduction: item.in_production || false,
      
      // ─── NEW: Season data for TV shows ───
      seasons: seasons,
      displaySeasons: displaySeasons,
    };

    return result;
  }

  /**
   * NEW: Map TMDB seasons to ISeason format
   */
  private mapSeasonsData(seasons: any[]): ISeason[] {
    if (!seasons || !Array.isArray(seasons)) return [];
    
    return seasons
      .filter((season: any) => season.season_number !== undefined)
      .map((season: any) => ({
        seasonNumber: season.season_number,
        episodeCount: season.episode_count || 0,
        airDate: season.air_date || undefined,
        name: season.name || `Season ${season.season_number}`,
        overview: season.overview || undefined,
        posterPath: season.poster_path ? `${TMDB_IMAGE_BASE}/${TMDB_POSTER_SIZE}${season.poster_path}` : undefined,
        id: season.id || undefined,
      }));
  }

  /**
   * NEW: Filter seasons for display (exclude season 0, specials, no air date)
   */
  private filterDisplaySeasons(seasons: any[]): number[] {
    if (!seasons || !Array.isArray(seasons)) return [];
    
    return seasons
      .filter((season: any) => {
        // EXCLUDE season 0 (specials)
        if (season.season_number === 0) return false;
        
        // EXCLUDE seasons with no air date (often placeholder)
        if (!season.air_date) return false;
        
        // EXCLUDE seasons marked as type 'special'
        if (season.type && season.type === 'special') return false;
        
        // INCLUDE all other seasons
        return true;
      })
      .map((season: any) => season.season_number)
      .sort((a: number, b: number) => a - b);
  }

  /**
   * Apply filters client-side with flexible matching (FIXED).
   */
  private applyFiltersFlexible(results: IMetadataResult[], filters: any): IMetadataResult[] {
    let filtered = [...results];

    // ─── FIX: Flexible language filtering ───
    if (filters.languages && filters.languages.length > 0) {
      const langs = filters.languages.map((l: string) => l.toLowerCase());
      filtered = filtered.filter(item => {
        if (!item.originalLanguage) return false;
        const itemLang = item.originalLanguage.toLowerCase();
        // Check if the item's language matches ANY of the filtered languages
        return langs.some((l: string) => 
          itemLang.includes(l) || l.includes(itemLang)
        );
      });
    }

    // ─── FIX: Flexible country filtering ───
    // NOTE: TMDB's /discover/movie and /search/movie responses never include
    // origin_country (that field only exists on TV objects — for movies it's
    // only present via production_countries on the full details endpoint,
    // which discover doesn't call). So for movies, originCountry is always [].
    // Rejecting on empty originCountry would wipe out every movie result even
    // though the API request already scoped results server-side via
    // with_origin_country. Only reject on missing country data for TV, where
    // origin_country is actually populated.
    if (filters.countries && filters.countries.length > 0) {
      const ctrys = filters.countries.map((c: string) => c.toUpperCase());
      filtered = filtered.filter(item => {
        if (!item.originCountry || item.originCountry.length === 0) {
          // No country data available (expected for movies) — trust the
          // server-side with_origin_country filter instead of rejecting.
          return item.type === 'movie';
        }
        // Check if any of the item's countries matches ANY of the filtered countries
        return item.originCountry.some((c: string) => {
          const countryCode = c.toUpperCase();
          return ctrys.some((filterCountry: string) => 
            countryCode.includes(filterCountry) || filterCountry.includes(countryCode)
          );
        });
      });
    }

    // ─── FIX: Region filtering using flexible matching ───
    if (filters.region) {
      const regionUpper = filters.region.toUpperCase();
      filtered = filtered.filter(item => {
        if (!item.originCountry || item.originCountry.length === 0) return false;
        return item.originCountry.some((c: string) => {
          const countryCode = c.toUpperCase();
          return countryCode.includes(regionUpper) || regionUpper.includes(countryCode);
        });
      });
    }

    // Certification filtering
    if (filters.certifications && filters.certifications.length > 0) {
      const certs = filters.certifications.map((c: string) => c.toUpperCase());
      filtered = filtered.filter(item =>
        item.certification && certs.some((c: string) => 
          item.certification?.toUpperCase().includes(c) || c.includes(item.certification?.toUpperCase() || '')
        )
      );
    }

    // ─── FIX: Genre filtering - resolve human labels to numeric IDs ───
    if (filters.genres && filters.genres.length > 0) {
      // Resolve genre names to TMDB IDs
      const filterGenreIds = new Set(
        this.resolveGenreNames(filters.genres).map(id => String(id))
      );
      // Some incoming values might already be raw numeric IDs rather than
      // labels - keep those too instead of dropping them.
      filters.genres.forEach((g: string) => {
        if (/^\d+$/.test(g)) filterGenreIds.add(g);
      });

      if (filterGenreIds.size > 0) {
        filtered = filtered.filter(item => {
          // item.genres are numeric IDs as strings (e.g. "28") from TMDB
          return item.genres && item.genres.some((g: string) => filterGenreIds.has(g));
        });
      }
      // If we couldn't resolve any of the requested genres to IDs, don't
      // filter at all rather than wiping out every result on a bad label.
    }

    // Rating filters
    if (filters.minRating !== undefined) {
      filtered = filtered.filter(item => (item.rating || 0) >= filters.minRating);
    }
    if (filters.maxRating !== undefined) {
      filtered = filtered.filter(item => (item.rating || 0) <= filters.maxRating);
    }

    // Year filters
    if (filters.year) {
      filtered = filtered.filter(item => item.year === filters.year);
    }
    if (filters.startYear !== undefined) {
      filtered = filtered.filter(item => (item.year || 0) >= filters.startYear);
    }
    if (filters.endYear !== undefined) {
      filtered = filtered.filter(item => (item.year || 0) <= filters.endYear);
    }

    // Keyword filtering
    if (filters.keywords && filters.keywords.length > 0) {
      const keywords = filters.keywords.map((k: string) => k.toLowerCase());
      filtered = filtered.filter(item => {
        const title = item.title?.toLowerCase() || '';
        const overview = item.overview?.toLowerCase() || '';
        return keywords.some((k: string) => 
          title.includes(k) || overview.includes(k)
        );
      });
    }

    // Adult content filter
    if (filters.includeAdult === false) {
      filtered = filtered.filter(item => !(item as any).adult);
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
        return sorted.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    }
  }
}

export default TMDBMetadataAdapter;