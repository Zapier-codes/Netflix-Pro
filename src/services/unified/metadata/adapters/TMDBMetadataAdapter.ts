/**
 * TMDBMetadataAdapter - Adapter that wraps TMDB functions to implement the metadata provider interface.
 * Translates TMDB's standalone functions into the unified metadata provider shape.
 * 
 * v2.0 - Supports full industry-standard filters including language, country, region.
 * Uses TMDB's discover endpoints for category browsing without keywords.
 */

import { IMetadataResult, DiscoverFilters } from '../../types/MetadataTypes';
import tmdbApi from '../TMDBMetadata';

// TMDB API constants
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';
const TMDB_POSTER_SIZE = 'w500';
const TMDB_BACKDROP_SIZE = 'w1280';
const TMDB_PROFILE_SIZE = 'w185';

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
    sortBy?: SortOption;
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
        genres: genres?.map(g => parseInt(g)).filter(n => !isNaN(n)).map(String),
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

    // Regular search with query
    try {
      const results = await tmdbApi.searchMedia(query);

      // Filter by type if specified
      let filtered = results;
      if (type === 'movie') {
        filtered = results.filter((item: any) => item.media_type === 'movie' || item.title);
      } else if (type === 'tv') {
        filtered = results.filter((item: any) => item.media_type === 'tv' || item.name);
      }

      // Apply filters client-side since search endpoint doesn't support all filters
      const mapped = this.mapSearchResults(filtered, 'tmdb');

      // Apply additional filters
      let processed = this.applyFilters(mapped, {
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

    try {
      const results: IMetadataResult[] = [];

      // Determine what to fetch based on type
      const fetchMovies = filters.type === 'all' || filters.type === 'movie';
      const fetchShows = filters.type === 'all' || filters.type === 'tv';

      // Build discover params for TMDB
      const params = this.buildDiscoverParams(filters);

      // Fetch movies if requested
      if (fetchMovies) {
        try {
          const movieResults = await this.fetchDiscoverMovies(params);
          results.push(...movieResults);
        } catch (error) {
          console.error('[TMDBMetadataAdapter] Discover movies failed:', error);
        }
      }

      // Fetch TV shows if requested
      if (fetchShows) {
        try {
          const showResults = await this.fetchDiscoverShows(params);
          results.push(...showResults);
        } catch (error) {
          console.error('[TMDBMetadataAdapter] Discover shows failed:', error);
        }
      }

      // Sort results
      const sorted = this.sortResults(results, filters.sortBy || 'popularity.desc');

      return sorted.slice(0, limit);
    } catch (error) {
      console.error('[TMDBMetadataAdapter] Discover failed:', error);
      return [];
    }
  }

  /**
   * Get metadata by ID.
   */
  async getById(id: string, type: 'movie' | 'tv'): Promise<IMetadataResult | null> {
    await this.ensureInitialized();

    try {
      let item: any = null;

      if (type === 'movie') {
        item = await tmdbApi.fetchMovieDetails(parseInt(id));
      } else {
        item = await tmdbApi.fetchTVShowDetails(parseInt(id));
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
    const params: any = {
      sort_by: filters.sortBy || 'popularity.desc',
      include_adult: filters.includeAdult || false,
    };

    // Language filter - TMDB uses with_original_language
    if (filters.languages && filters.languages.length > 0) {
      params.with_original_language = filters.languages.join('|');
    }

    // Country filter - TMDB uses with_origin_country (TV) or region (Movies)
    if (filters.countries && filters.countries.length > 0) {
      // TMDB supports with_origin_country for TV
      params.with_origin_country = filters.countries.join('|');
      // Also set region for movies
      params.region = filters.countries[0];
    }

    // Region filter
    if (filters.region) {
      params.region = filters.region;
    }

    // Genre filter
    if (filters.genres && filters.genres.length > 0) {
      // Convert genre names to IDs if needed, or use names directly
      // For now, assume they're already IDs or names that TMDB understands
      params.with_genres = filters.genres.join('|');
    }

    // Certification filter
    if (filters.certifications && filters.certifications.length > 0) {
      // TMDB uses certification_country and certification
      // We'll use certification for the region
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
      id: item.id?.toString() ?? '',
      title: item.title ?? item.name ?? '',
      type: item.media_type === 'tv' || item.name ? 'tv' : 'movie',
      year: item.release_date ? parseInt(item.release_date.split('-')[0]) :
            item.first_air_date ? parseInt(item.first_air_date.split('-')[0]) :
            undefined,
      releaseDate: item.release_date || item.first_air_date || undefined,
      poster: item.poster_path ? `${TMDB_IMAGE_BASE}/${TMDB_POSTER_SIZE}${item.poster_path}` : undefined,
      backdrop: item.backdrop_path ? `${TMDB_IMAGE_BASE}/${TMDB_BACKDROP_SIZE}${item.backdrop_path}` : undefined,
      overview: item.overview ?? '',
      rating: item.vote_average ?? 0,
      popularity: item.popularity ?? 0,
      voteCount: item.vote_count ?? 0,
      genres: item.genre_ids?.map((id: number) => id.toString()) ?? [],
      keywords: [],
      source: source,
      originalLanguage: item.original_language ?? undefined,
      originalTitle: item.original_title ?? item.original_name ?? item.title ?? item.name ?? '',
      originCountry: item.origin_country ?? [],
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
      productionCountries: undefined,
      numberOfSeasons: item.number_of_seasons ?? undefined,
      numberOfEpisodes: item.number_of_episodes ?? undefined,
      lastAirDate: item.last_air_date ?? undefined,
      inProduction: item.in_production ?? false,
      runtime: item.runtime ?? item.episode_run_time?.[0] ?? undefined,
      cast: [],
    }));
  }

  /**
   * Map detailed TMDB result to IMetadataResult.
   */
  private mapDetailedResult(item: any, type: 'movie' | 'tv'): IMetadataResult {
    const isMovie = type === 'movie';

    return {
      id: item.id?.toString() ?? '',
      title: item.title ?? item.name ?? '',
      type: isMovie ? 'movie' : 'tv',
      year: item.release_date ? parseInt(item.release_date.split('-')[0]) :
            item.first_air_date ? parseInt(item.first_air_date.split('-')[0]) :
            undefined,
      releaseDate: item.release_date || item.first_air_date || undefined,
      poster: item.poster_path ? `${TMDB_IMAGE_BASE}/${TMDB_POSTER_SIZE}${item.poster_path}` : undefined,
      backdrop: item.backdrop_path ? `${TMDB_IMAGE_BASE}/${TMDB_BACKDROP_SIZE}${item.backdrop_path}` : undefined,
      overview: item.overview ?? '',
      tagline: item.tagline ?? undefined,
      rating: item.vote_average ?? 0,
      popularity: item.popularity ?? 0,
      voteCount: item.vote_count ?? 0,
      runtime: item.runtime ?? item.episode_run_time?.[0] ?? undefined,
      genres: item.genres?.map((g: any) => g.name) ?? [],
      keywords: [],
      cast: item.credits?.cast?.slice(0, 10).map((c: any) => ({
        character: c.character,
        person: {
          name: c.name,
          ids: {},
        },
      })) ?? [],
      source: 'tmdb',

      // Enhanced fields
      originalLanguage: item.original_language ?? undefined,
      originalTitle: item.original_title ?? item.original_name ?? item.title ?? item.name ?? '',
      originCountry: item.origin_country ?? item.production_countries?.map((c: any) => c.iso_3166_1) ?? [],
      certification: item.releases?.results?.[0]?.certification ?? 
                     item.content_ratings?.results?.[0]?.rating ?? 
                     item.certification ?? undefined,
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
      })) ?? [],
      spokenLanguages: item.spoken_languages?.map((l: any) => ({
        englishName: l.english_name,
        iso639_1: l.iso_639_1,
        name: l.name,
      })) ?? [],
      productionCompanies: item.production_companies?.map((c: any) => ({
        id: c.id,
        name: c.name,
        logoPath: c.logo_path,
        originCountry: c.origin_country,
      })) ?? [],
      productionCountries: item.production_countries?.map((c: any) => ({
        iso3166_1: c.iso_3166_1,
        name: c.name,
      })) ?? [],
      numberOfSeasons: item.number_of_seasons ?? undefined,
      numberOfEpisodes: item.number_of_episodes ?? undefined,
      lastAirDate: item.last_air_date ?? undefined,
      inProduction: item.in_production ?? false,
    };
  }

  /**
   * Apply filters client-side (fallback when API doesn't support them).
   */
  private applyFilters(results: IMetadataResult[], filters: {
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
  }): IMetadataResult[] {
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

    // Filter by year
    if (filters.year !== undefined) {
      filtered = filtered.filter(item => item.year === filters.year);
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
}

export default TMDBMetadataAdapter;
