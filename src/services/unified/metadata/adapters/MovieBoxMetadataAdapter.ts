// src/services/unified/metadata/adapters/MovieBoxMetadataAdapter.ts

/**
 * MovieBoxMetadataAdapter - Adapter that wraps MovieBox (BoxOffice) API.
 * Implements the metadata provider interface with full filter support.
 * 
 * v2.2 - Fixed search result parsing. Properly handles both array and object responses.
 * Uses the real movie-box Python SDK with proper Session initialization.
 * Supports: language/country/region filtering, discover mode, category browsing.
 * FIXED: Genre filtering now uses flexible substring matching with genre map,
 * same pattern as Consumet and Kuryana adapters.
 * FIXED: discover() now uses proper search terms instead of relying solely on
 * hot content which often doesn't match filters.
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
  'Chinese': ['Chinese', 'C-Drama'],
  'C-Drama': ['Chinese', 'C-Drama'],
  'Japanese': ['Japanese', 'J-Drama'],
  'J-Drama': ['Japanese', 'J-Drama'],
  'Thai': ['Thai', 'Thai Drama'],
  'Taiwanese': ['Taiwanese', 'T-Drama'],
  'Turkish': ['Turkish', 'Turkish Drama'],
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

// ─── FIX: Genre name to search term mapping for discover mode ───
const GENRE_TO_SEARCH_TERM: Record<string, string> = {
  'Action': 'action movie',
  'Adventure': 'adventure film',
  'Animation': 'animated movie',
  'Comedy': 'comedy film',
  'Crime': 'crime movie',
  'Documentary': 'documentary',
  'Drama': 'drama film',
  'Family': 'family movie',
  'Fantasy': 'fantasy film',
  'Horror': 'horror movie',
  'Mystery': 'mystery film',
  'Romance': 'romantic movie',
  'Sci-Fi': 'sci-fi movie',
  'Thriller': 'thriller film',
  'War': 'war movie',
  'Western': 'western film',
  'Anime': 'anime',
  'Korean': 'korean drama',
  'K-Drama': 'korean drama',
  'Bollywood': 'bollywood',
  'Hollywood': 'hollywood',
  'Nollywood': 'nollywood',
  'Chinese': 'chinese drama',
  'C-Drama': 'chinese drama',
  'Japanese': 'japanese drama',
  'J-Drama': 'japanese drama',
  'Thai': 'thai drama',
  'Taiwanese': 'taiwanese drama',
  'Turkish': 'turkish drama',
};

// ─── API Host Configuration ───
const DEFAULT_API_HOST = 'h5.aoneroom.com';

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
   */
  async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      console.log('[MovieBoxMetadataAdapter] Already initialized');
      return;
    }

    if (this.initAttempts >= this.maxInitAttempts) {
      console.warn('[MovieBoxMetadataAdapter] Max initialization attempts reached, marking as initialized');
      this.initialized = true;
      return;
    }

    this.initAttempts++;
    console.log(`[MovieBoxMetadataAdapter] Initialization attempt ${this.initAttempts}/${this.maxInitAttempts}...`);

    try {
      // ─── CRITICAL FIX: Configure API Host ───
      if (!this.apiHostConfigured) {
        console.log('[MovieBoxMetadataAdapter] Configuring API host...');
        
        const configResult = await boxOffice.configure({
          apiVersion: ApiVersion.V2,
          apiHost: DEFAULT_API_HOST,
          downloadDir: '',
          captionLanguage: 'English',
          quality: 'best',
        });
        
        if (configResult.success) {
          console.log('[MovieBoxMetadataAdapter] API host configured:', DEFAULT_API_HOST);
          this.apiHostConfigured = true;
        } else {
          console.warn('[MovieBoxMetadataAdapter] Config warning:', configResult.error);
        }
      }

      // Check boxOffice status
      console.log('[MovieBoxMetadataAdapter] Checking BoxOffice status...');
      const status = await boxOffice.getStatus();
      console.log('[MovieBoxMetadataAdapter] BoxOffice status:', status);

      if (!status.running) {
        console.log('[MovieBoxMetadataAdapter] BoxOffice not running, starting...');
        const startResult = await boxOffice.start();
        if (startResult.success) {
          console.log('[MovieBoxMetadataAdapter] BoxOffice started successfully');
        } else {
          throw new Error(`BoxOffice start failed: ${startResult.error || 'Unknown error'}`);
        }
      }

      // ─── CRITICAL FIX: Verify search works by testing a simple query ───
      console.log('[MovieBoxMetadataAdapter] Verifying search with test query...');
      try {
        const testResult = await boxOffice.search(
          'inception',
          1,
          1,
          SubjectType.ALL,
          ApiVersion.V2
        );
        
        if (testResult && testResult.items && testResult.items.length > 0) {
          console.log('[MovieBoxMetadataAdapter] Search verification successful! Found:', testResult.items[0].title);
        } else {
          console.warn('[MovieBoxMetadataAdapter] Search verification returned no results even after configuring apiHost:', DEFAULT_API_HOST);
        }
      } catch (testError) {
        console.warn('[MovieBoxMetadataAdapter] Search verification failed:', testError);
      }

      this.initialized = true;
      console.log('[MovieBoxMetadataAdapter] Initialized successfully');
    } catch (error) {
      console.error('[MovieBoxMetadataAdapter] Failed to initialize:', error);
      
      if (this.initAttempts < this.maxInitAttempts) {
        console.log('[MovieBoxMetadataAdapter] Will retry initialization on next call');
      } else {
        console.warn('[MovieBoxMetadataAdapter] Max attempts reached, marking as initialized');
        this.initialized = true;
      }
      throw error;
    }
  }

  /**
   * Search for movies or TV shows with native filter support.
   * FIXED: Properly handles both array and object responses for items.
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
    console.log(`[MovieBoxMetadataAdapter] Search called with:`, {
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

      if (!query || query.trim() === '') {
        console.log('[MovieBoxMetadataAdapter] Empty query - using discover mode');
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

      let subjectType: SubjectType;
      if (type === 'tv') {
        subjectType = SubjectType.TV_SERIES;
      } else if (type === 'movie') {
        subjectType = SubjectType.MOVIES;
      } else {
        subjectType = SubjectType.ALL;
      }

      console.log(`[MovieBoxMetadataAdapter] Searching for "${query}" with subjectType:`, subjectType);

      const apiVersion = ApiVersion.V2;

      const results = await boxOffice.search(
        query,
        1,
        Math.min(limit + 10, 50),
        subjectType,
        apiVersion
      );

      // ─── FIX: Handle both array and object responses ───
      let itemsArray: SearchResultItem[] = [];
      
      if (results.items) {
        if (Array.isArray(results.items)) {
          itemsArray = results.items;
        } else if (typeof results.items === 'object') {
          // If items is an object, try to extract array from it
          const itemsObj = results.items as any;
          
          // Check for common patterns
          if (Array.isArray(itemsObj.data)) {
            itemsArray = itemsObj.data;
          } else if (Array.isArray(itemsObj.results)) {
            itemsArray = itemsObj.results;
          } else if (Array.isArray(itemsObj.items)) {
            itemsArray = itemsObj.items;
          } else if (Array.isArray(itemsObj.dramas)) {
            itemsArray = itemsObj.dramas;
          } else if (Array.isArray(itemsObj.posts)) {
            itemsArray = itemsObj.posts;
          } else {
            // Try to convert object values to array if they look like search results
            const possibleArray = Object.values(itemsObj).filter(v => 
              v && typeof v === 'object' && (v as any).subjectId
            );
            if (possibleArray.length > 0) {
              itemsArray = possibleArray as SearchResultItem[];
            } else {
              console.warn(`[MovieBoxMetadataAdapter] Items is an object with unknown structure:`, Object.keys(itemsObj));
              // Log a sample of the object for debugging
              const sample = JSON.stringify(itemsObj).substring(0, 500);
              console.warn(`[MovieBoxMetadataAdapter] Sample:`, sample);
            }
          }
        }
      }

      console.log(`[MovieBoxMetadataAdapter] Raw results:`, {
        total: itemsArray.length,
        hasItems: !!results.items,
        itemsType: results.items ? typeof results.items : 'undefined',
        isArray: Array.isArray(results.items),
      });

      if (itemsArray.length > 0) {
        console.log(`[MovieBoxMetadataAdapter] First result sample:`, {
          title: itemsArray[0].title,
          subjectId: itemsArray[0].subjectId,
          subjectType: itemsArray[0].subjectType,
          hasCover: !!itemsArray[0].cover,
        });

        const titles = itemsArray.slice(0, 5).map((item: any) => item.title);
        console.log(`[MovieBoxMetadataAdapter] Result titles:`, titles);
      } else {
        console.warn(`[MovieBoxMetadataAdapter] No results found for "${query}" (subjectType: ${subjectType})`);
      }

      let mapped = itemsArray.map((item: SearchResultItem) => {
        const mappedItem = this.mapSearchResultItem(item);
        if (itemsArray.indexOf(item) === 0) {
          console.log(`[MovieBoxMetadataAdapter] Mapped first result:`, {
            id: mappedItem.id,
            title: mappedItem.title,
            type: mappedItem.type,
            hasPoster: !!mappedItem.poster,
          });
        }
        return mappedItem;
      });

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

      mapped = this.sortResults(mapped, sortBy);

      const finalResults = mapped.slice(0, limit);
      console.log(`[MovieBoxMetadataAdapter] Returning ${finalResults.length} results for "${query}"`);
      return finalResults;
    } catch (error) {
      console.error('[MovieBoxMetadataAdapter] Search failed:', error);
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
   * FIXED: Uses search with genre-based terms instead of relying solely on
   * hot content which often doesn't match filters.
   */
  async discover(filters: DiscoverFilters, limit: number = 20): Promise<IMetadataResult[]> {
    console.log('[MovieBoxMetadataAdapter] Discover called with filters:', filters);

    try {
      await this.ensureInitialized();

      const results: IMetadataResult[] = [];

      const fetchMovies = filters.type === 'all' || filters.type === 'movie';
      const fetchTV = filters.type === 'all' || filters.type === 'tv';

      const region = filters.region || (filters.countries && filters.countries.length > 0 
        ? COUNTRY_REGION_MAP[filters.countries[0]] 
        : undefined);

      // ─── FIX: Build a search term from filters ───
      const searchTerm = this.buildDiscoverSearchTerm(filters);
      console.log(`[MovieBoxMetadataAdapter] Discover using search term: "${searchTerm}"`);

      // ─── PRIMARY: Use search with the built term ───
      // This is more reliable than hot content because it actually matches
      // the user's filters.
      let subjectType: SubjectType;
      if (filters.type === 'tv') {
        subjectType = SubjectType.TV_SERIES;
      } else if (filters.type === 'movie') {
        subjectType = SubjectType.MOVIES;
      } else {
        subjectType = SubjectType.ALL;
      }

      try {
        const searchResults = await boxOffice.search(
          searchTerm,
          1,
          Math.min(limit * 2, 50),
          subjectType,
          ApiVersion.V2
        );

        let itemsArray: SearchResultItem[] = [];
        if (searchResults.items) {
          if (Array.isArray(searchResults.items)) {
            itemsArray = searchResults.items;
          } else if (typeof searchResults.items === 'object') {
            const itemsObj = searchResults.items as any;
            if (Array.isArray(itemsObj.data)) itemsArray = itemsObj.data;
            else if (Array.isArray(itemsObj.results)) itemsArray = itemsObj.results;
            else if (Array.isArray(itemsObj.items)) itemsArray = itemsObj.items;
          }
        }

        if (itemsArray.length > 0) {
          console.log(`[MovieBoxMetadataAdapter] Search for "${searchTerm}" returned ${itemsArray.length} results`);
          const mapped = itemsArray.map((item: SearchResultItem) => this.mapSearchResultItem(item));
          results.push(...mapped);
        } else {
          console.log(`[MovieBoxMetadataAdapter] Search for "${searchTerm}" returned 0 results, trying fallback...`);
        }
      } catch (searchError) {
        console.log('[MovieBoxMetadataAdapter] Search failed, falling back to hot content:', searchError);
      }

      // ─── FALLBACK: If search returned nothing, try hot content ───
      if (results.length === 0) {
        console.log('[MovieBoxMetadataAdapter] Falling back to hot content...');
        
        if (fetchMovies || fetchTV) {
          const hotContent = await boxOffice.getHotContent(ApiVersion.V2);
          console.log('[MovieBoxMetadataAdapter] Hot content received:', {
            movies: hotContent.movies?.length || 0,
            tvSeries: hotContent.tvSeries?.length || 0,
          });
          
          if (fetchMovies) {
            const movies = (hotContent.movies || [])
              .filter((item: any) => this.filterByDiscovery(item, filters))
              .map((item: any) => this.mapHotContentItem(item, 'movie'));
            results.push(...movies);
          }

          if (fetchTV) {
            const tvSeries = (hotContent.tvSeries || [])
              .filter((item: any) => this.filterByDiscovery(item, filters))
              .map((item: any) => this.mapHotContentItem(item, 'tv'));
            results.push(...tvSeries);
          }
        }
      }

      // ─── TERTIARY FALLBACK: Trending ───
      if (results.length === 0) {
        console.log('[MovieBoxMetadataAdapter] Falling back to trending...');
        const trending = await boxOffice.getTrending(1, 24, ApiVersion.V2);
        console.log('[MovieBoxMetadataAdapter] Trending received:', {
          total: trending.data?.length || 0,
        });
        
        let items = trending.data || [];
        if (filters.type === 'movie') {
          items = items.filter((item: any) => item.subjectType === SubjectType.MOVIES);
        } else if (filters.type === 'tv') {
          items = items.filter((item: any) => item.subjectType === SubjectType.TV_SERIES);
        }

        const mapped = items.map((item: any) => this.mapTrendingItem(item));
        results.push(...mapped);
      }

      // ─── Apply filters ───
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

      // Deduplicate
      const seen = new Set<string>();
      filtered = filtered.filter(item => {
        const key = `${item.source || 'moviebox'}-${item.type}-${item.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      filtered = this.sortResults(filtered, filters.sortBy || 'popularity.desc');
      console.log(`[MovieBoxMetadataAdapter] Discover returned ${filtered.slice(0, limit).length} results`);
      return filtered.slice(0, limit);
    } catch (error) {
      console.error('[MovieBoxMetadataAdapter] Discover failed:', error);
      return [];
    }
  }

  /**
   * ─── FIX: Build a sensible search term from filters ───
   */
  private buildDiscoverSearchTerm(filters: DiscoverFilters): string {
    const terms: string[] = [];

    // Use genres if available
    if (filters.genres && filters.genres.length > 0) {
      const primaryGenre = filters.genres[0];
      const mapped = GENRE_TO_SEARCH_TERM[primaryGenre];
      if (mapped) {
        terms.push(mapped);
      } else {
        terms.push(primaryGenre.toLowerCase());
      }
    }

    // Use country/language to refine
    if (filters.countries && filters.countries.length > 0) {
      const countryNames: Record<string, string> = {
        'KR': 'korean',
        'JP': 'japanese',
        'CN': 'chinese',
        'TW': 'taiwanese',
        'HK': 'hong kong',
        'IN': 'indian',
        'NG': 'nigerian',
        'US': 'american',
        'GB': 'british',
        'FR': 'french',
        'DE': 'german',
        'ES': 'spanish',
        'IT': 'italian',
        'BR': 'brazilian',
        'MX': 'mexican',
      };
      const countryTerm = countryNames[filters.countries[0].toUpperCase()];
      if (countryTerm && !terms.some(t => t.includes(countryTerm))) {
        terms.push(countryTerm);
      }
    }

    // Use language
    if (filters.languages && filters.languages.length > 0) {
      const langNames: Record<string, string> = {
        'ko': 'korean',
        'ja': 'japanese',
        'zh': 'chinese',
        'hi': 'hindi',
        'en': 'english',
        'fr': 'french',
        'es': 'spanish',
        'de': 'german',
        'it': 'italian',
        'pt': 'portuguese',
        'ru': 'russian',
        'ar': 'arabic',
        'tr': 'turkish',
        'th': 'thai',
      };
      const langTerm = langNames[filters.languages[0]];
      if (langTerm && !terms.some(t => t.includes(langTerm))) {
        terms.push(langTerm);
      }
    }

    // Default terms based on media type
    if (terms.length === 0) {
      if (filters.type === 'movie') {
        terms.push('movie', 'film');
      } else if (filters.type === 'tv') {
        terms.push('tv series', 'show');
      } else {
        terms.push('movie', 'tv series');
      }
    }

    // Add year if specified
    if (filters.year) {
      terms.push(String(filters.year));
    } else if (filters.startYear && filters.endYear) {
      // Use the middle of the range
      const midYear = Math.floor((filters.startYear + filters.endYear) / 2);
      terms.push(String(midYear));
    }

    return terms.join(' ');
  }

  /**
   * Get metadata by ID.
   */
  async getById(id: string, type: 'movie' | 'tv'): Promise<IMetadataResult | null> {
    console.log(`[MovieBoxMetadataAdapter] Getting by ID: ${id} (${type})`);

    try {
      await this.ensureInitialized();

      let details: MovieDetails | TVSeriesDetails | null = null;

      if (type === 'tv') {
        details = await boxOffice.getTVSeriesDetails(id, ApiVersion.V1);
      } else {
        details = await boxOffice.getMovieDetails(id, ApiVersion.V1);
      }

      if (!details) {
        console.warn(`[MovieBoxMetadataAdapter] No details found for ID: ${id}`);
        return null;
      }

      const subjectType = type === 'tv' ? SubjectType.TV_SERIES : SubjectType.MOVIES;
      const files = await boxOffice.getDownloadableFiles(
        details.subject,
        subjectType,
        ApiVersion.V1
      );

      const result = this.mapDetailedResult(details, type, files);
      console.log(`[MovieBoxMetadataAdapter] Found: ${result.title}`);
      return result;
    } catch (error) {
      console.error(`[MovieBoxMetadataAdapter] GetById failed for ${id}:`, error);
      return null;
    }
  }

  /**
   * Get trending content from Python SDK.
   */
  async getTrending(limit: number = 20, type?: 'movie' | 'tv', page: number = 1): Promise<IMetadataResult[]> {
    console.log(`[MovieBoxMetadataAdapter] Getting trending (limit: ${limit}, type: ${type || 'all'})`);

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
      console.log(`[MovieBoxMetadataAdapter] Trending returned ${mapped.length} results`);
      return mapped;
    } catch (error) {
      console.error('[MovieBoxMetadataAdapter] GetTrending failed:', error);
      return [];
    }
  }

  /**
   * Get trending content by category using Python SDK.
   */
  async getTrendingByCategory(category: string, limit: number = 20, region?: string): Promise<IMetadataResult[]> {
    console.log(`[MovieBoxMetadataAdapter] Getting trending by category: ${category}`);

    try {
      await this.ensureInitialized();

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
      
      const trending = await boxOffice.getTrending(1, 24, ApiVersion.V2);
      
      let items = trending.data;

      if (config.type && config.type !== SubjectType.ALL) {
        items = items.filter((item: any) => item.subjectType === config.type);
      }

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

      if (region) {
        items = items.filter((item: any) => {
          const country = item.countryName || '';
          return country.toUpperCase() === region.toUpperCase();
        });
      }

      const mapped = items.slice(0, limit).map((item: any) => this.mapTrendingItem(item));
      console.log(`[MovieBoxMetadataAdapter] Trending by category returned ${mapped.length} results`);
      return mapped;
    } catch (error) {
      console.error('[MovieBoxMetadataAdapter] GetTrendingByCategory failed:', error);
      return [];
    }
  }

  /**
   * Get hot content (movies & TV series) from Python SDK.
   */
  async getHotContent(): Promise<{ movies: IMetadataResult[]; tvSeries: IMetadataResult[] }> {
    console.log('[MovieBoxMetadataAdapter] Getting hot content...');

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
      
      console.log(`[MovieBoxMetadataAdapter] Hot content returned ${result.movies.length} movies and ${result.tvSeries.length} TV series`);
      return result;
    } catch (error) {
      console.error('[MovieBoxMetadataAdapter] GetHotContent failed:', error);
      return { movies: [], tvSeries: [] };
    }
  }

  /**
   * Get homepage content (categorized content) from Python SDK.
   */
  async getHomepage(): Promise<any[]> {
    console.log('[MovieBoxMetadataAdapter] Getting homepage...');

    try {
      await this.ensureInitialized();

      const homepage = await boxOffice.getHomepage(ApiVersion.V2);
      const categories = homepage.categories || [];
      console.log(`[MovieBoxMetadataAdapter] Homepage returned ${categories.length} categories`);
      return categories;
    } catch (error) {
      console.error('[MovieBoxMetadataAdapter] GetHomepage failed:', error);
      return [];
    }
  }

  /**
   * Get popular searches from Python SDK.
   */
  async getPopularSearches(): Promise<string[]> {
    console.log('[MovieBoxMetadataAdapter] Getting popular searches...');

    try {
      await this.ensureInitialized();

      const popular = await boxOffice.getPopularSearches(ApiVersion.V2);
      const searches = popular.data.map((item: any) => item.title);
      console.log(`[MovieBoxMetadataAdapter] Popular searches returned ${searches.length} items`);
      return searches;
    } catch (error) {
      console.error('[MovieBoxMetadataAdapter] GetPopularSearches failed:', error);
      return [];
    }
  }

  /**
   * Get recommendations from Python SDK.
   */
  async getRecommendations(urlOrItem: string, limit: number = 20): Promise<IMetadataResult[]> {
    console.log(`[MovieBoxMetadataAdapter] Getting recommendations for: ${urlOrItem}`);

    try {
      await this.ensureInitialized();

      const results = await boxOffice.getRecommendations(urlOrItem, 1, limit, ApiVersion.V1);
      const mapped = results.data.map((item: any) => this.mapTrendingItem(item));
      console.log(`[MovieBoxMetadataAdapter] Recommendations returned ${mapped.length} results`);
      return mapped;
    } catch (error) {
      console.error('[MovieBoxMetadataAdapter] GetRecommendations failed:', error);
      return [];
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PRIVATE FILTER HELPERS
  // ──────────────────────────────────────────────────────────────────────────

  private filterByDiscovery(item: any, filters: DiscoverFilters): boolean {
    if (filters.type === 'movie' && item.subjectType !== SubjectType.MOVIES) return false;
    if (filters.type === 'tv' && item.subjectType !== SubjectType.TV_SERIES) return false;

    if (filters.countries && filters.countries.length > 0) {
      const country = item.countryName || '';
      if (!filters.countries.some(c => country.toUpperCase().includes(c.toUpperCase()))) {
        return false;
      }
    }

    if (filters.genres && filters.genres.length > 0) {
      const itemGenres = item.genre || [];
      const hasGenre = filters.genres.some(g => 
        itemGenres.some((ig: string) => 
          ig.toLowerCase().includes(g.toLowerCase())
        )
      );
      if (!hasGenre) return false;
    }

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

  private applyFilters(results: IMetadataResult[], filters: any): IMetadataResult[] {
    let filtered = [...results];

    if (filters.languages && filters.languages.length > 0) {
      filtered = filtered.filter(item => 
        item.originalLanguage && filters.languages.includes(item.originalLanguage)
      );
    }

    if (filters.countries && filters.countries.length > 0) {
      filtered = filtered.filter(item => 
        item.originCountry && item.originCountry.some(c => filters.countries.includes(c))
      );
    }

    if (filters.certifications && filters.certifications.length > 0) {
      filtered = filtered.filter(item => 
        item.certification && filters.certifications.includes(item.certification)
      );
    }

    // ─── FIX: Genre filtering with flexible substring matching ───
    if (filters.genres && filters.genres.length > 0) {
      const mappedGenres: string[] = [];
      for (const g of filters.genres) {
        mappedGenres.push(...(MOVIEBOX_GENRE_MAP[g] || [g]));
      }
      filtered = filtered.filter(item =>
        item.genres && item.genres.some((ig: string) =>
          mappedGenres.some((mg: string) => ig.toLowerCase().includes(mg.toLowerCase()))
        )
      );
    }

    if (filters.minRating !== undefined) {
      filtered = filtered.filter(item => (item.rating || 0) >= filters.minRating);
    }

    if (filters.maxRating !== undefined) {
      filtered = filtered.filter(item => (item.rating || 0) <= filters.maxRating);
    }

    if (filters.year) {
      filtered = filtered.filter(item => item.year === filters.year);
    }

    if (filters.startYear !== undefined) {
      filtered = filtered.filter(item => (item.year || 0) >= filters.startYear);
    }
    if (filters.endYear !== undefined) {
      filtered = filtered.filter(item => (item.year || 0) <= filters.endYear);
    }

    if (filters.keywords && filters.keywords.length > 0) {
      filtered = filtered.filter(item => 
        item.keywords && item.keywords.some(k => filters.keywords.includes(k))
      );
    }

    if (filters.includeAdult === false) {
      filtered = filtered.filter(item => !(item as any).adult);
    }

    return filtered;
  }

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

  destroy(): void {
    this.initialized = false;
    this.initAttempts = 0;
    this.apiHostConfigured = false;
    console.log('[MovieBoxMetadataAdapter] Destroyed');
  }
}

export default MovieBoxMetadataAdapter;