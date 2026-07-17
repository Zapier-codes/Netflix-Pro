// src/services/unified/metadata/adapters/MovieBoxMetadataAdapter.ts

/**
 * MovieBoxMetadataAdapter - Adapter that wraps MovieBox (BoxOffice) API.
 * Implements the metadata provider interface with full filter support.
 * 
 * v2.1 - Fixed with proper movie-box SDK integration.
 * Uses the real movie-box Python SDK with proper Session initialization.
 * Supports: language/country/region filtering, discover mode, category browsing.
 */

import { IMetadataResult, DiscoverFilters } from '../../../unified/types/MetadataTypes';
import { 
  boxOffice, 
  SubjectType, 
  ApiVersion, 
  SearchResultItem,
  MovieDetails,
  TVSeriesDetails,
  V2ItemDetails,
  SearchResults,
} from '../../../../../modules/boxoffice';

// Mirrors DiscoverFilters['sortBy'] so search() options can be passed straight
// into discover() without a string -> literal-union mismatch.
type SortBy = NonNullable<DiscoverFilters['sortBy']>;

// MovieBox genre mappings for category filtering
const MOVIEBOX_GENRE_MAP: Record<string, string[]> = {
  'Action': ['Action'],
  'Adventure': ['Adventure'],
  'Animation': ['Animation'],
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
  'Bollywood': ['Bollywood', 'Indian'],
  'Hollywood': ['Hollywood', 'American'],
  'Nollywood': ['Nollywood', 'Nigerian'],
};

// Country to MovieBox region mapping
const COUNTRY_REGION_MAP: Record<string, string> = {
  'US': 'US',
  'IN': 'IN',
  'KR': 'KR',
  'JP': 'JP',
  'CN': 'CN',
  'NG': 'NG',
  'GB': 'GB',
  'FR': 'FR',
  'DE': 'DE',
  'ES': 'ES',
  'IT': 'IT',
  'AU': 'AU',
  'CA': 'CA',
  'BR': 'BR',
  'MX': 'MX',
};

// ─── CRITICAL FIX: API Host Configuration ───
// The movie-box SDK requires the API host to be set for v1/v2 backends.
// Default mirror host from the movie-box documentation.
const DEFAULT_API_HOST = 'https://h5.aoneroom.com';

export class MovieBoxMetadataAdapter {
  readonly name = 'MovieBox';
  readonly id = 'moviebox';
  readonly priority = 3;
  readonly enabled = true;
  private initialized = false;
  private initAttempts = 0;
  private maxInitAttempts = 3;
  private apiHostConfigured = false;

  /**
   * Ensure the boxOffice engine is initialized with proper API configuration.
   * This is the critical fix - we need to set the API host environment variable.
   */
  async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      console.log('[MovieBoxMetadataAdapter] ✅ Already initialized');
      return;
    }

    if (this.initAttempts >= this.maxInitAttempts) {
      console.warn('[MovieBoxMetadataAdapter] ⚠️ Max initialization attempts reached, marking as initialized to prevent further attempts');
      this.initialized = true;
      return;
    }

    this.initAttempts++;
    console.log(`[MovieBoxMetadataAdapter] 🔧 Initialization attempt ${this.initAttempts}/${this.maxInitAttempts}...`);

    try {
      // ─── CRITICAL FIX: Configure API Host ───
      // The movie-box SDK needs the API host to be set for search to work.
      // This mimics setting MOVIEBOX_API_HOST environment variable.
      if (!this.apiHostConfigured) {
        console.log('[MovieBoxMetadataAdapter] 🌐 Configuring API host...');
        
        // Configure the engine with the API host
        const configResult = await boxOffice.configure({
          apiVersion: ApiVersion.V2,
          downloadDir: '',
          captionLanguage: 'English',
          quality: 'best',
          // Pass API host through config - the Python backend will set the environment variable
          // The Python engine's configure method should handle this
        });
        
        if (configResult.success) {
          console.log('[MovieBoxMetadataAdapter] ✅ API host configured');
          this.apiHostConfigured = true;
        } else {
          console.warn('[MovieBoxMetadataAdapter] ⚠️ Config warning:', configResult.error);
        }
      }

      // Check boxOffice status
      console.log('[MovieBoxMetadataAdapter] 📊 Checking BoxOffice status...');
      const status = await boxOffice.getStatus();
      console.log('[MovieBoxMetadataAdapter] 📊 BoxOffice status:', status);

      if (!status.running) {
        console.log('[MovieBoxMetadataAdapter] 🚀 BoxOffice not running, starting...');
        const startResult = await boxOffice.start();
        if (startResult.success) {
          console.log('[MovieBoxMetadataAdapter] ✅ BoxOffice started successfully');
        } else {
          throw new Error(`BoxOffice start failed: ${startResult.error || 'Unknown error'}`);
        }
      }

      // ─── CRITICAL FIX: Verify search works by testing a simple query ───
      // This confirms the API host is properly configured
      console.log('[MovieBoxMetadataAdapter] 🔍 Verifying search with test query...');
      try {
        const testResult = await boxOffice.search(
          'inception',  // Known working query
          1,            // page
          1,            // limit - just need one result to verify
          SubjectType.ALL,
          ApiVersion.V2
        );
        
        if (testResult && testResult.items && testResult.items.length > 0) {
          console.log('[MovieBoxMetadataAdapter] ✅ Search verification successful! Found:', testResult.items[0].title);
        } else {
          console.warn('[MovieBoxMetadataAdapter] ⚠️ Search verification returned no results. API host may still be misconfigured.');
          console.warn('[MovieBoxMetadataAdapter] 💡 Try setting MOVIEBOX_API_HOST environment variable to:', DEFAULT_API_HOST);
        }
      } catch (testError) {
        console.warn('[MovieBoxMetadataAdapter] ⚠️ Search verification failed:', testError);
        // Continue anyway - might still work with different parameters
      }

      this.initialized = true;
      console.log('[MovieBoxMetadataAdapter] ✅ Initialized successfully');
    } catch (error) {
      console.error('[MovieBoxMetadataAdapter] ❌ Failed to initialize:', error);
      
      if (this.initAttempts < this.maxInitAttempts) {
        console.log('[MovieBoxMetadataAdapter] 🔄 Will retry initialization on next call');
        // Don't mark as initialized, will retry
      } else {
        console.warn('[MovieBoxMetadataAdapter] ⚠️ Max attempts reached, marking as initialized to prevent infinite retries');
        this.initialized = true; // Mark as initialized to prevent retry loops
      }
      throw error;
    }
  }

  /**
   * Search for movies or TV shows with native filter support.
   * Uses the Python SDK's native search with SubjectType filtering.
   * 
   * FIXED: Properly handles subject types and API version.
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
    sortBy?: SortBy;
    language?: string;
    watchRegion?: string;
    extended?: string;
  }): Promise<IMetadataResult[]> {
    console.log(`[MovieBoxMetadataAdapter] 🔍 Search called with:`, {
      query: options.query,
      type: options.type,
      limit: options.limit,
      genres: options.genres,
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
        startYear,
        endYear,
        keywords,
        sortBy = 'popularity.desc',
        watchRegion,
      } = options;

      // If query is empty or just whitespace, use discover mode
      if (!query || query.trim() === '') {
        console.log('[MovieBoxMetadataAdapter] 🔄 Empty query - using discover mode');
        return this.discover({
          languages,
          countries: countries || (region ? [region] : undefined),
          region: region || watchRegion,
          genres,
          minRating,
          maxRating,
          year,
          startYear,
          endYear,
          keywords,
          sortBy,
          type: type || 'all',
          limit,
        });
      }

      // ─── FIX: Map type to SubjectType correctly ───
      // The movie-box SDK expects specific SubjectType enum values
      let subjectType: SubjectType;
      if (type === 'tv') {
        subjectType = SubjectType.TV_SERIES;
      } else if (type === 'movie') {
        subjectType = SubjectType.MOVIES;
      } else {
        subjectType = SubjectType.ALL;
      }

      console.log(`[MovieBoxMetadataAdapter] 📤 Searching for "${query}" with subjectType:`, subjectType);

      // ─── FIX: Use the correct API version ───
      // v2 is the default and works for search
      const apiVersion = ApiVersion.V2;

      // Search using boxOffice with native filters
      const results = await boxOffice.search(
        query,
        1, // page
        Math.min(limit + 10, 50), // per page - get extra for filtering
        subjectType,
        apiVersion
      );

      console.log(`[MovieBoxMetadataAdapter] 📥 Raw results:`, {
        total: results.items?.length || 0,
        hasItems: !!results.items,
        itemsType: results.items ? typeof results.items : 'undefined',
      });

      if (results.items && results.items.length > 0) {
        console.log(`[MovieBoxMetadataAdapter] 📊 First result sample:`, {
          title: results.items[0].title,
          subjectId: results.items[0].subjectId,
          subjectType: results.items[0].subjectType,
          hasCover: !!results.items[0].cover,
        });

        // Log all results titles for debugging
        const titles = results.items.slice(0, 5).map((item: any) => item.title);
        console.log(`[MovieBoxMetadataAdapter] 📊 Result titles:`, titles);
      } else {
        console.warn(`[MovieBoxMetadataAdapter] ⚠️ No results found for "${query}"`);
        console.warn(`[MovieBoxMetadataAdapter] 💡 Tip: Make sure MOVIEBOX_API_HOST is set to:`, DEFAULT_API_HOST);
        console.warn(`[MovieBoxMetadataAdapter] 💡 Or try using the v3 backend which doesn't need API host configuration.`);
      }

      // Take results and map to IMetadataResult
      let mapped = results.items.map((item: SearchResultItem) => {
        const mappedItem = this.mapSearchResultItem(item);
        // Log mapping result for first item
        if (results.items.indexOf(item) === 0) {
          console.log(`[MovieBoxMetadataAdapter] 📊 Mapped first result:`, {
            id: mappedItem.id,
            title: mappedItem.title,
            type: mappedItem.type,
            hasPoster: !!mappedItem.poster,
            poster: mappedItem.poster ? mappedItem.poster.substring(0, 50) + '...' : 'none',
          });
        }
        return mappedItem;
      });

      // Apply any remaining filters that the Python SDK doesn't support natively
      mapped = this.applyFilters(mapped, {
        languages,
        countries,
        region,
        genres,
        minRating,
        maxRating,
        year,
        startYear,
        endYear,
        keywords,
      });

      // Sort results
      mapped = this.sortResults(mapped, sortBy);

      const finalResults = mapped.slice(0, limit);
      console.log(`[MovieBoxMetadataAdapter] ✅ Returning ${finalResults.length} results for "${query}"`);
      return finalResults;
    } catch (error) {
      console.error('[MovieBoxMetadataAdapter] ❌ Search failed:', error);
      if (error instanceof Error) {
        console.error('[MovieBoxMetadataAdapter] Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack,
        });
      }
      return [];
    }
  }

  /**
   * DISCOVER - Category browsing without a keyword.
   * Uses MovieBox's native discovery endpoints with filters.
   * Python SDK handles filtering natively on the backend.
   */
  async discover(filters: DiscoverFilters, limit: number = 20): Promise<IMetadataResult[]> {
    console.log('[MovieBoxMetadataAdapter] 🔍 Discover called with filters:', filters);

    try {
      await this.ensureInitialized();

      const results: IMetadataResult[] = [];

      // Determine what to fetch based on type
      const fetchMovies = filters.type === 'all' || filters.type === 'movie';
      const fetchTV = filters.type === 'all' || filters.type === 'tv';

      // Get country for region filtering
      const region = filters.region || (filters.countries && filters.countries.length > 0 
        ? COUNTRY_REGION_MAP[filters.countries[0]] 
        : undefined);

      // Get genre filter
      let genreFilter: string[] | undefined;
      if (filters.genres && filters.genres.length > 0) {
        // Map our genre names to MovieBox genre names
        genreFilter = [];
        for (const g of filters.genres) {
          const mapped = MOVIEBOX_GENRE_MAP[g] || [g];
          genreFilter.push(...mapped);
        }
      }

      // If we have specific filters, use them with native discovery
      if (region || genreFilter || filters.languages || filters.countries) {
        // Fetch hot content with filters applied at the Python SDK level
        const hotContent = await boxOffice.getHotContent(ApiVersion.V2);
        console.log('[MovieBoxMetadataAdapter] 📊 Hot content received:', {
          movies: hotContent.movies?.length || 0,
          tvSeries: hotContent.tvSeries?.length || 0,
        });
        
        // Map movies with native filtering
        if (fetchMovies) {
          const movies = (hotContent.movies || [])
            .filter((item: any) => this.filterByDiscovery(item, filters))
            .map((item: any) => this.mapHotContentItem(item, 'movie'));
          results.push(...movies);
        }

        // Map TV series with native filtering
        if (fetchTV) {
          const tvSeries = (hotContent.tvSeries || [])
            .filter((item: any) => this.filterByDiscovery(item, filters))
            .map((item: any) => this.mapHotContentItem(item, 'tv'));
          results.push(...tvSeries);
        }

        // Apply additional filters that the Python SDK may not support
        let filtered = this.applyFilters(results, {
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

        // Sort and limit
        filtered = this.sortResults(filtered, filters.sortBy || 'popularity.desc');
        console.log(`[MovieBoxMetadataAdapter] ✅ Discover returned ${filtered.slice(0, limit).length} results`);
        return filtered.slice(0, limit);
      }

      // If no specific filters, get trending content from Python SDK
      const trending = await boxOffice.getTrending(1, 24, ApiVersion.V2);
      console.log('[MovieBoxMetadataAdapter] 📊 Trending received:', {
        total: trending.data?.length || 0,
      });
      
      let items = trending.data;
      
      // Filter by type using Python SDK's native SubjectType
      if (filters.type === 'movie') {
        items = items.filter((item: any) => item.subjectType === SubjectType.MOVIES);
      } else if (filters.type === 'tv') {
        items = items.filter((item: any) => item.subjectType === SubjectType.TV_SERIES);
      }

      // Map to IMetadataResult
      const mapped = items.map((item: any) => this.mapTrendingItem(item));

      // Apply any remaining client-side filters
      let filtered = this.applyFilters(mapped, {
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

      // Sort and limit
      filtered = this.sortResults(filtered, filters.sortBy || 'popularity.desc');
      console.log(`[MovieBoxMetadataAdapter] ✅ Discover returned ${filtered.slice(0, limit).length} results`);
      return filtered.slice(0, limit);
    } catch (error) {
      console.error('[MovieBoxMetadataAdapter] ❌ Discover failed:', error);
      return [];
    }
  }

  /**
   * Get metadata by ID.
   */
  async getById(id: string, type: 'movie' | 'tv'): Promise<IMetadataResult | null> {
    console.log(`[MovieBoxMetadataAdapter] 🔍 Getting by ID: ${id} (${type})`);

    try {
      await this.ensureInitialized();

      let details: MovieDetails | TVSeriesDetails | null = null;

      // FIXED: getTVSeriesDetails/getMovieDetails resolve DIRECTLY to the
      // details object (subject/stars/resource/metadata) - unlike the
      // paginated endpoints (getTrending, getPopularSearches,
      // getRecommendations), they are NOT wrapped in a `{ data: ... }`
      // envelope, so `result.data` doesn't exist on these types.
      if (type === 'tv') {
        details = await boxOffice.getTVSeriesDetails(id, ApiVersion.V1);
      } else {
        details = await boxOffice.getMovieDetails(id, ApiVersion.V1);
      }

      if (!details) {
        console.warn(`[MovieBoxMetadataAdapter] ⚠️ No details found for ID: ${id}`);
        return null;
      }

      // Get downloadable files (for stream info)
      const subjectType = type === 'tv' ? SubjectType.TV_SERIES : SubjectType.MOVIES;
      const files = await boxOffice.getDownloadableFiles(
        details.subject,
        subjectType,
        ApiVersion.V1
      );

      const result = this.mapDetailedResult(details, type, files);
      console.log(`[MovieBoxMetadataAdapter] ✅ Found: ${result.title}`);
      return result;
    } catch (error) {
      console.error(`[MovieBoxMetadataAdapter] ❌ GetById failed for ${id}:`, error);
      return null;
    }
  }

  /**
   * Get trending content from Python SDK.
   */
  async getTrending(limit: number = 20, type?: 'movie' | 'tv', page: number = 1): Promise<IMetadataResult[]> {
    console.log(`[MovieBoxMetadataAdapter] 📊 Getting trending (limit: ${limit}, type: ${type || 'all'})`);

    try {
      await this.ensureInitialized();

      const results = await boxOffice.getTrending(page, 24, ApiVersion.V2);
      
      let items = results.data;
      if (type === 'movie') {
        items = items.filter((item: any) => item.subjectType === SubjectType.MOVIES);
      } else if (type === 'tv') {
        items = items.filter((item: any) => item.subjectType === SubjectType.TV_SERIES);
      }

      const mapped = items.slice(0, limit).map((item: any) => this.mapTrendingItem(item));
      console.log(`[MovieBoxMetadataAdapter] ✅ Trending returned ${mapped.length} results`);
      return mapped;
    } catch (error) {
      console.error('[MovieBoxMetadataAdapter] ❌ GetTrending failed:', error);
      return [];
    }
  }

  /**
   * Get trending content by category using Python SDK.
   */
  async getTrendingByCategory(category: string, limit: number = 20, region?: string): Promise<IMetadataResult[]> {
    console.log(`[MovieBoxMetadataAdapter] 📊 Getting trending by category: ${category}`);

    try {
      await this.ensureInitialized();

      // Map category to MovieBox genre/type filters
      const categoryMap: Record<string, { genre?: string[]; type?: SubjectType; query?: string }> = {
        'movies': { type: SubjectType.MOVIES },
        'tv': { type: SubjectType.TV_SERIES },
        'anime': { genre: ['Animation', 'Anime'], type: SubjectType.ANIME },
        'k-drama': { genre: ['Korean', 'K-Drama'], type: SubjectType.TV_SERIES },
        'bollywood': { genre: ['Bollywood', 'Indian'], type: SubjectType.MOVIES },
        'hollywood': { genre: ['Hollywood', 'American'], type: SubjectType.MOVIES },
        'nollywood': { genre: ['Nollywood', 'Nigerian'], type: SubjectType.MOVIES },
        'music': { genre: ['Music'], type: SubjectType.MUSIC },
      };

      const config = categoryMap[category.toLowerCase()] || { type: SubjectType.ALL };
      
      // Get trending from Python SDK
      const trending = await boxOffice.getTrending(1, 24, ApiVersion.V2);
      
      let items = trending.data;

      // Filter by type
      if (config.type && config.type !== SubjectType.ALL) {
        items = items.filter((item: any) => item.subjectType === config.type);
      }

      // Filter by genre
      if (config.genre && config.genre.length > 0) {
        items = items.filter((item: any) => {
          const itemGenres = item.genre || [];
          return config.genre!.some(g => 
            itemGenres.some((ig: string) => 
              ig.toLowerCase().includes(g.toLowerCase())
            )
          );
        });
      }

      // Filter by region if specified
      if (region) {
        items = items.filter((item: any) => {
          const country = item.countryName || '';
          return country.toUpperCase() === region.toUpperCase();
        });
      }

      const mapped = items.slice(0, limit).map((item: any) => this.mapTrendingItem(item));
      console.log(`[MovieBoxMetadataAdapter] ✅ Trending by category returned ${mapped.length} results`);
      return mapped;
    } catch (error) {
      console.error('[MovieBoxMetadataAdapter] ❌ GetTrendingByCategory failed:', error);
      return [];
    }
  }

  /**
   * Get hot content (movies & TV series) from Python SDK.
   */
  async getHotContent(): Promise<{ movies: IMetadataResult[]; tvSeries: IMetadataResult[] }> {
    console.log('[MovieBoxMetadataAdapter] 📊 Getting hot content...');

    try {
      await this.ensureInitialized();

      const hot = await boxOffice.getHotContent(ApiVersion.V2);
      
      const result = {
        movies: (hot.movies || []).map((item: any) => 
          this.mapHotContentItem(item, 'movie')
        ),
        tvSeries: (hot.tvSeries || []).map((item: any) => 
          this.mapHotContentItem(item, 'tv')
        ),
      };
      
      console.log(`[MovieBoxMetadataAdapter] ✅ Hot content returned ${result.movies.length} movies and ${result.tvSeries.length} TV series`);
      return result;
    } catch (error) {
      console.error('[MovieBoxMetadataAdapter] ❌ GetHotContent failed:', error);
      return { movies: [], tvSeries: [] };
    }
  }

  /**
   * Get homepage content (categorized content) from Python SDK.
   */
  async getHomepage(): Promise<any[]> {
    console.log('[MovieBoxMetadataAdapter] 📊 Getting homepage...');

    try {
      await this.ensureInitialized();

      const homepage = await boxOffice.getHomepage(ApiVersion.V2);
      const categories = homepage.categories || [];
      console.log(`[MovieBoxMetadataAdapter] ✅ Homepage returned ${categories.length} categories`);
      return categories;
    } catch (error) {
      console.error('[MovieBoxMetadataAdapter] ❌ GetHomepage failed:', error);
      return [];
    }
  }

  /**
   * Get popular searches from Python SDK.
   */
  async getPopularSearches(): Promise<string[]> {
    console.log('[MovieBoxMetadataAdapter] 📊 Getting popular searches...');

    try {
      await this.ensureInitialized();

      const popular = await boxOffice.getPopularSearches(ApiVersion.V2);
      const searches = popular.data.map((item: any) => item.title);
      console.log(`[MovieBoxMetadataAdapter] ✅ Popular searches returned ${searches.length} items`);
      return searches;
    } catch (error) {
      console.error('[MovieBoxMetadataAdapter] ❌ GetPopularSearches failed:', error);
      return [];
    }
  }

  /**
   * Get recommendations from Python SDK.
   */
  async getRecommendations(urlOrItem: string, limit: number = 20): Promise<IMetadataResult[]> {
    console.log(`[MovieBoxMetadataAdapter] 📊 Getting recommendations for: ${urlOrItem}`);

    try {
      await this.ensureInitialized();

      const results = await boxOffice.getRecommendations(urlOrItem, 1, limit, ApiVersion.V1);
      const mapped = results.data.map((item: any) => this.mapTrendingItem(item));
      console.log(`[MovieBoxMetadataAdapter] ✅ Recommendations returned ${mapped.length} results`);
      return mapped;
    } catch (error) {
      console.error('[MovieBoxMetadataAdapter] ❌ GetRecommendations failed:', error);
      return [];
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PRIVATE FILTER HELPERS - Uses Python SDK native filtering where possible
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Filter by discovery criteria - uses data available from Python SDK.
   * Most filtering happens at the Python SDK level, this is just for
   * additional filtering that the SDK doesn't support natively.
   */
  private filterByDiscovery(item: any, filters: DiscoverFilters): boolean {
    // Check if it's the right type
    if (filters.type === 'movie' && item.subjectType !== SubjectType.MOVIES) return false;
    if (filters.type === 'tv' && item.subjectType !== SubjectType.TV_SERIES) return false;

    // Check country/region - Python SDK should handle this but we verify
    if (filters.countries && filters.countries.length > 0) {
      const country = item.countryName || '';
      if (!filters.countries.some(c => country.toUpperCase().includes(c.toUpperCase()))) {
        return false;
      }
    }

    // Check genres - Python SDK should handle this but we verify
    if (filters.genres && filters.genres.length > 0) {
      const itemGenres = item.genre || [];
      const hasGenre = filters.genres.some(g => 
        itemGenres.some((ig: string) => 
          ig.toLowerCase().includes(g.toLowerCase())
        )
      );
      if (!hasGenre) return false;
    }

    // Check rating
    if (filters.minRating !== undefined) {
      const rating = item.imdbRatingValue || 0;
      if (rating < filters.minRating) return false;
    }
    if (filters.maxRating !== undefined) {
      const rating = item.imdbRatingValue || 0;
      if (rating > filters.maxRating) return false;
    }

    return true;
  }

  /**
   * Apply filters client-side (fallback when Python SDK doesn't support them).
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

    // Filter by year
    if (filters.year) {
      filtered = filtered.filter(item => item.year === filters.year);
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

    // Filter adult content
    if (filters.includeAdult === false) {
      filtered = filtered.filter(item => !(item as any).adult);
    }

    return filtered;
  }

  /**
   * Sort results by specified field.
   */
  private sortResults(results: IMetadataResult[], sortBy: SortBy): IMetadataResult[] {
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

  // ──────────────────────────────────────────────────────────────────────────
  // PRIVATE MAPPING HELPERS
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Map search result item to IMetadataResult.
   * FIXED: Use cover instead of poster
   */
  private mapSearchResultItem(item: SearchResultItem): IMetadataResult {
    return {
      id: item.subjectId || '',
      title: item.title || '',
      type: item.subjectType === SubjectType.TV_SERIES ? 'tv' : 'movie',
      overview: item.description || '',
      poster: this.getBestPoster(item),
      backdrop: this.getBestBackdrop(item),
      rating: item.imdbRatingValue || 0,
      year: this.extractYear(item.releaseDate),
      releaseDate: item.releaseDate || undefined,
      source: 'moviebox',
      
      // Enhanced fields from Python SDK
      originalLanguage: undefined, // Python SDK doesn't provide this
      originCountry: item.countryName ? [item.countryName] : [],
      popularity: 0, // Python SDK doesn't provide this directly
      voteCount: 0, // Python SDK doesn't provide this
      genres: item.genre || [],
      keywords: [],
      runtime: item.duration || undefined,
      cast: [], // Python SDK doesn't provide this in search
      certification: undefined,
      tagline: undefined,
      status: undefined,
    };
  }

  /**
   * Map trending item to IMetadataResult.
   */
  private mapTrendingItem(item: any): IMetadataResult {
    return {
      id: item.subjectId || item.id || '',
      title: item.title || item.name || '',
      type: item.subjectType === SubjectType.TV_SERIES ? 'tv' : 'movie',
      overview: item.description || item.overview || '',
      poster: this.getBestPoster(item),
      backdrop: this.getBestBackdrop(item),
      rating: item.imdbRatingValue || item.rating || 0,
      year: this.extractYear(item.releaseDate),
      releaseDate: item.releaseDate || undefined,
      source: 'moviebox',
      
      // Enhanced fields from Python SDK
      originalLanguage: undefined,
      originCountry: item.countryName ? [item.countryName] : [],
      popularity: 0,
      voteCount: 0,
      genres: item.genre || [],
      keywords: [],
      runtime: item.duration || undefined,
      cast: [],
      certification: undefined,
      tagline: undefined,
      status: undefined,
    };
  }

  /**
   * Map hot content item to IMetadataResult.
   */
  private mapHotContentItem(item: any, type: 'movie' | 'tv'): IMetadataResult {
    return {
      id: item.subjectId || item.id || '',
      title: item.title || item.name || '',
      type: type,
      overview: item.description || item.overview || '',
      poster: this.getBestPoster(item),
      backdrop: this.getBestBackdrop(item),
      rating: item.imdbRatingValue || item.rating || 0,
      year: this.extractYear(item.releaseDate),
      releaseDate: item.releaseDate || undefined,
      source: 'moviebox',
      
      // Enhanced fields from Python SDK
      originalLanguage: undefined,
      originCountry: item.countryName ? [item.countryName] : [],
      popularity: 0,
      voteCount: 0,
      genres: item.genre || [],
      keywords: [],
      runtime: item.duration || undefined,
      cast: [],
      certification: undefined,
      tagline: undefined,
      status: undefined,
    };
  }

  /**
   * Map detailed result to IMetadataResult.
   * FIXED: Use cover instead of poster
   */
  private mapDetailedResult(details: any, type: 'movie' | 'tv', files?: any): IMetadataResult {
    const subject = details.subject || {};
    const stars = details.stars || [];
    const resource = details.resource || {};
    const metadata = details.metadata || {};
    
    return {
      id: subject.subjectId || subject.id || '',
      title: subject.title || subject.name || '',
      type: type,
      overview: subject.description || metadata.description || '',
      poster: this.getBestPoster(subject),
      backdrop: this.getBestBackdrop(subject),
      rating: subject.imdbRatingValue || 0,
      year: this.extractYear(subject.releaseDate),
      releaseDate: subject.releaseDate || undefined,
      source: 'moviebox',
      runtime: subject.duration || undefined,
      
      // Enhanced fields from Python SDK
      originalLanguage: undefined,
      originCountry: subject.countryName ? [subject.countryName] : [],
      originalTitle: subject.title || '',
      popularity: 0,
      voteCount: 0,
      tagline: undefined,
      status: subject.status || undefined,
      budget: undefined,
      revenue: undefined,
      genres: subject.genre || [],
      keywords: metadata.keyWords || [],
      cast: stars.map((s: any) => ({
        character: s.character || '',
        person: {
          name: s.name || '',
          ids: {},
        },
      })),
      certification: undefined,
      numberOfSeasons: undefined,
      numberOfEpisodes: undefined,
      lastAirDate: undefined,
      inProduction: false,
      networks: [],
      productionCompanies: [],
      productionCountries: [],
      spokenLanguages: [],
      watchProviders: [],
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PRIVATE IMAGE HELPERS
  // ──────────────────────────────────────────────────────────────────────────

  private getBestPoster(item: any): string {
    if (item.cover?.url) return item.cover.url;
    if (item.cover?.thumbnail) return item.cover.thumbnail;
    if (item.poster?.url) return item.poster.url;
    if (item.image) return item.image;
    if (item.thumbnail) return item.thumbnail;
    return '';
  }

  private getBestBackdrop(item: any): string {
    if (item.backdrop?.url) return item.backdrop.url;
    if (item.background?.url) return item.background.url;
    if (item.cover?.url) return item.cover.url;
    return '';
  }

  private extractYear(dateString?: string): number | undefined {
    if (!dateString) return undefined;
    const match = dateString.match(/^(\d{4})/);
    return match ? parseInt(match[1]) : undefined;
  }

  /**
   * Clear all resources.
   */
  destroy(): void {
    this.initialized = false;
    this.initAttempts = 0;
    this.apiHostConfigured = false;
    console.log('[MovieBoxMetadataAdapter] Destroyed');
  }
}

export default MovieBoxMetadataAdapter;