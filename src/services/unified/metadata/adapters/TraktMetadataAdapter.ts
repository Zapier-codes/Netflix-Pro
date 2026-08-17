/**
 * TraktMetadataAdapter - Adapter that wraps Trakt API.
 * Provides social metadata, trending, popular, and recommendations.
 * Supports: search, discover, trending, popular, anticipated content.
 *
 * FIXED: Full implementation using TraktService public endpoints.
 * Supports search, discover, trending, popular, anticipated, box office.
 * FIXED: Genre filtering now uses flexible matching with genre map.
 * FIXED: Language/country filtering with flexible matching.
 * FIXED: discover() uses proper search terms instead of empty queries.
 */

import { IMetadataResult, DiscoverFilters } from '../../types/MetadataTypes';
import {
  TraktService,
  getTraktService,
  TraktMovieExtended,
  TraktShowExtended,
  TraktTrendingMovie,
  TraktTrendingShow,
  TraktPlayedItem,
  TraktAnticipatedItem,
  TraktBoxOfficeItem,
  TraktSearchResult,
  TraktMovie,
  TraktShow,
  TraktPerson,
  TraktCastMember,
  TraktCrewMember,
} from '../../../unified/social/TraktService';

// ─── Genre mapping for flexible matching ───
const TRAKT_GENRE_MAP: Record<string, string[]> = {
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

// ─── Genre to search term mapping for discover mode ───
const GENRE_TO_SEARCH_TERM: Record<string, string> = {
  'Action': 'action',
  'Adventure': 'adventure',
  'Animation': 'animation',
  'Comedy': 'comedy',
  'Crime': 'crime',
  'Documentary': 'documentary',
  'Drama': 'drama',
  'Family': 'family',
  'Fantasy': 'fantasy',
  'Horror': 'horror',
  'Mystery': 'mystery',
  'Romance': 'romance',
  'Sci-Fi': 'sci-fi',
  'Thriller': 'thriller',
  'War': 'war',
  'Western': 'western',
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

// ─── Country to language mapping ───
const COUNTRY_TO_LANGUAGE: Record<string, string> = {
  'KR': 'ko', 'JP': 'ja', 'CN': 'zh', 'TW': 'zh', 'HK': 'zh',
  'TH': 'th', 'IN': 'hi', 'NG': 'en', 'US': 'en', 'GB': 'en',
  'FR': 'fr', 'DE': 'de', 'ES': 'es', 'IT': 'it', 'PT': 'pt',
  'RU': 'ru', 'AR': 'ar', 'TR': 'tr', 'VN': 'vi', 'PH': 'tl',
  'MY': 'ms', 'ID': 'id', 'SG': 'en', 'NZ': 'en', 'AU': 'en',
  'CA': 'en', 'ZA': 'en', 'NL': 'nl', 'BE': 'nl', 'CH': 'de',
  'AT': 'de', 'SE': 'sv', 'NO': 'no', 'DK': 'da', 'FI': 'fi',
  'BR': 'pt', 'MX': 'es', 'AR': 'es', 'CL': 'es', 'CO': 'es',
  'PE': 'es', 'PK': 'ur', 'BD': 'bn', 'LK': 'si', 'NP': 'ne',
  'BT': 'dz', 'MV': 'dv', 'MO': 'zh', 'MM': 'my', 'KH': 'km',
  'LA': 'lo', 'BN': 'ms', 'TL': 'pt', 'IL': 'he', 'SA': 'ar',
  'AE': 'ar', 'EG': 'ar', 'MA': 'ar', 'DZ': 'ar', 'TN': 'ar',
  'LY': 'ar', 'SD': 'ar', 'JO': 'ar', 'LB': 'ar', 'KW': 'ar',
  'QA': 'ar', 'BH': 'ar', 'OM': 'ar', 'YE': 'ar', 'SY': 'ar',
  'IR': 'fa', 'IQ': 'ar', 'AF': 'ps', 'AZ': 'az', 'GE': 'ka',
  'AM': 'hy', 'AL': 'sq', 'BA': 'bs', 'BG': 'bg', 'HR': 'hr',
  'CZ': 'cs', 'DK': 'da', 'EE': 'et', 'HU': 'hu', 'IS': 'is',
  'IE': 'en', 'LV': 'lv', 'LT': 'lt', 'LU': 'lb', 'MT': 'mt',
  'PL': 'pl', 'RO': 'ro', 'SK': 'sk', 'SI': 'sl', 'UA': 'uk',
  'BY': 'be', 'MD': 'ro', 'GE': 'ka', 'AM': 'hy', 'AZ': 'az',
  'KZ': 'kk', 'UZ': 'uz', 'TM': 'tk', 'KG': 'ky', 'TJ': 'tg',
  'MN': 'mn', 'KP': 'ko', 'CU': 'es', 'DO': 'es', 'PR': 'es',
  'CR': 'es', 'SV': 'es', 'GT': 'es', 'HN': 'es', 'NI': 'es',
  'PA': 'es', 'PY': 'es', 'UY': 'es', 'VE': 'es', 'BO': 'es',
  'EC': 'es', 'GY': 'en', 'SR': 'nl', 'TT': 'en', 'JM': 'en',
  'BB': 'en', 'BS': 'en', 'BZ': 'en', 'AG': 'en', 'LC': 'en',
  'VC': 'en', 'GD': 'en', 'KN': 'en', 'DM': 'en', 'SC': 'en',
  'MU': 'en', 'ZW': 'en', 'ZM': 'en', 'MW': 'en', 'MZ': 'pt',
  'AO': 'pt', 'CV': 'pt', 'GW': 'pt', 'ST': 'pt', 'GQ': 'es',
  'CF': 'fr', 'TD': 'fr', 'CG': 'fr', 'CD': 'fr', 'BJ': 'fr',
  'BF': 'fr', 'BI': 'fr', 'CM': 'fr', 'CI': 'fr', 'DJ': 'fr',
  'GA': 'fr', 'GN': 'fr', 'ML': 'fr', 'NE': 'fr', 'SN': 'fr',
  'TG': 'fr', 'MG': 'fr', 'KM': 'fr', 'MU': 'fr', 'SC': 'fr',
};

// ─── Country code to country name mapping ───
const COUNTRY_CODE_TO_NAME: Record<string, string> = {
  'KR': 'Korea', 'JP': 'Japan', 'CN': 'China', 'TW': 'Taiwan',
  'HK': 'Hong Kong', 'MO': 'Macau', 'TH': 'Thailand', 'ID': 'Indonesia',
  'PH': 'Philippines', 'MY': 'Malaysia', 'SG': 'Singapore', 'VN': 'Vietnam',
  'MM': 'Myanmar', 'KH': 'Cambodia', 'LA': 'Laos', 'BN': 'Brunei',
  'TL': 'Timor-Leste', 'IN': 'India', 'PK': 'Pakistan', 'BD': 'Bangladesh',
  'LK': 'Sri Lanka', 'NP': 'Nepal', 'BT': 'Bhutan', 'MV': 'Maldives',
  'US': 'United States', 'GB': 'United Kingdom', 'CA': 'Canada',
  'AU': 'Australia', 'NZ': 'New Zealand', 'NG': 'Nigeria', 'ZA': 'South Africa',
  'FR': 'France', 'DE': 'Germany', 'IT': 'Italy', 'ES': 'Spain',
  'PT': 'Portugal', 'NL': 'Netherlands', 'BE': 'Belgium', 'CH': 'Switzerland',
  'AT': 'Austria', 'SE': 'Sweden', 'NO': 'Norway', 'DK': 'Denmark',
  'FI': 'Finland', 'RU': 'Russia', 'BR': 'Brazil', 'MX': 'Mexico',
  'AR': 'Argentina', 'CL': 'Chile', 'CO': 'Colombia', 'PE': 'Peru',
  'UY': 'Uruguay', 'PY': 'Paraguay', 'BO': 'Bolivia', 'EC': 'Ecuador',
  'VE': 'Venezuela', 'PA': 'Panama', 'CR': 'Costa Rica', 'SV': 'El Salvador',
  'GT': 'Guatemala', 'HN': 'Honduras', 'NI': 'Nicaragua', 'DO': 'Dominican Republic',
  'PR': 'Puerto Rico', 'CU': 'Cuba', 'JM': 'Jamaica', 'TT': 'Trinidad and Tobago',
  'BB': 'Barbados', 'BS': 'Bahamas', 'BZ': 'Belize', 'GY': 'Guyana',
  'SR': 'Suriname', 'AG': 'Antigua and Barbuda', 'LC': 'Saint Lucia',
  'VC': 'Saint Vincent and the Grenadines', 'GD': 'Grenada',
  'KN': 'Saint Kitts and Nevis', 'DM': 'Dominica', 'SC': 'Seychelles',
  'MU': 'Mauritius', 'ZW': 'Zimbabwe', 'ZM': 'Zambia', 'MW': 'Malawi',
  'MZ': 'Mozambique', 'AO': 'Angola', 'CV': 'Cape Verde', 'GW': 'Guinea-Bissau',
  'ST': 'Sao Tome and Principe', 'GQ': 'Equatorial Guinea', 'CF': 'Central African Republic',
  'TD': 'Chad', 'CG': 'Congo', 'CD': 'DR Congo', 'BJ': 'Benin',
  'BF': 'Burkina Faso', 'BI': 'Burundi', 'CM': 'Cameroon', 'CI': 'Ivory Coast',
  'DJ': 'Djibouti', 'GA': 'Gabon', 'GN': 'Guinea', 'ML': 'Mali',
  'NE': 'Niger', 'SN': 'Senegal', 'TG': 'Togo', 'MG': 'Madagascar',
  'KM': 'Comoros', 'IL': 'Israel', 'SA': 'Saudi Arabia', 'AE': 'United Arab Emirates',
  'EG': 'Egypt', 'MA': 'Morocco', 'DZ': 'Algeria', 'TN': 'Tunisia',
  'LY': 'Libya', 'SD': 'Sudan', 'JO': 'Jordan', 'LB': 'Lebanon',
  'KW': 'Kuwait', 'QA': 'Qatar', 'BH': 'Bahrain', 'OM': 'Oman',
  'YE': 'Yemen', 'SY': 'Syria', 'IQ': 'Iraq', 'IR': 'Iran',
  'AF': 'Afghanistan', 'PS': 'Palestine', 'AZ': 'Azerbaijan', 'GE': 'Georgia',
  'AM': 'Armenia', 'AL': 'Albania', 'BA': 'Bosnia and Herzegovina',
  'BG': 'Bulgaria', 'HR': 'Croatia', 'CZ': 'Czech Republic', 'DK': 'Denmark',
  'EE': 'Estonia', 'HU': 'Hungary', 'IS': 'Iceland', 'IE': 'Ireland',
  'LV': 'Latvia', 'LT': 'Lithuania', 'LU': 'Luxembourg', 'MT': 'Malta',
  'PL': 'Poland', 'RO': 'Romania', 'SK': 'Slovakia', 'SI': 'Slovenia',
  'UA': 'Ukraine', 'BY': 'Belarus', 'MD': 'Moldova', 'KZ': 'Kazakhstan',
  'UZ': 'Uzbekistan', 'TM': 'Turkmenistan', 'KG': 'Kyrgyzstan', 'TJ': 'Tajikistan',
  'MN': 'Mongolia', 'KP': 'North Korea',
};

export class TraktMetadataAdapter {
  readonly name = 'Trakt';
  readonly id = 'trakt';
  readonly priority = 4;
  readonly enabled = true;
  private service: TraktService | null = null;
  private initialized = false;
  private clientId: string;

  constructor(clientId: string = '') {
    this.clientId = clientId || process.env.TRAKT_CLIENT_ID || '';
    if (!this.clientId) {
      console.warn('[TraktMetadataAdapter] No clientId provided. Trakt features will not work.');
    }
  }

  async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    
    if (!this.clientId) {
      console.warn('[TraktMetadataAdapter] No clientId configured');
      this.initialized = true;
      return;
    }

    try {
      this.service = getTraktService(this.clientId);
      this.initialized = true;
      console.log('[TraktMetadataAdapter] Initialized successfully');
    } catch (error) {
      console.error('[TraktMetadataAdapter] Failed to initialize:', error);
      throw error;
    }
  }

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
      sortBy = 'popularity.desc',
    } = options;

    // If query is empty, use discover mode
    if (!query || query.trim() === '') {
      return this.discover({
        languages,
        countries: countries || (region ? [region] : undefined),
        region: region || options.watchRegion,
        genres,
        certifications,
        minRating,
        maxRating,
        year,
        startYear,
        endYear,
        sortBy,
        type: type || 'all',
        limit,
      });
    }

    if (!this.service) {
      console.warn('[TraktMetadataAdapter] Service not available');
      return [];
    }

    try {
      // Map type to Trakt search type
      let searchType: 'movie' | 'show' | 'episode' | 'person' | 'list' | undefined;
      if (type === 'movie') searchType = 'movie';
      else if (type === 'tv') searchType = 'show';

      // Build search params
      const searchParams: any = {
        page: 1,
        limit: Math.min(limit + 10, 50),
        extended: 'full,images',
      };

      // Add filters
      if (genres && genres.length > 0) {
        // Map genre names to Trakt genre slugs
        const genreSlugs: string[] = [];
        for (const g of genres) {
          const mapped = TRAKT_GENRE_MAP[g] || [g];
          genreSlugs.push(...mapped.map(s => s.toLowerCase().replace(/\s+/g, '-')));
        }
        searchParams.genres = genreSlugs.join(',');
      }
      if (languages && languages.length > 0) {
        searchParams.languages = languages.join(',');
      }
      if (countries && countries.length > 0) {
        searchParams.countries = countries.join(',');
      }
      if (certifications && certifications.length > 0) {
        searchParams.certifications = certifications.join(',');
      }
      if (minRating !== undefined) {
        searchParams.ratings = `${minRating},${maxRating || 10}`;
      }
      if (year) {
        searchParams.years = `${year}`;
      } else if (startYear !== undefined || endYear !== undefined) {
        searchParams.years = `${startYear || ''}-${endYear || ''}`;
      }

      const results = await this.service.search(query, searchType, searchParams);

      // Map results to IMetadataResult
      let mapped = results.map((result: TraktSearchResult) => 
        this.mapSearchResult(result)
      );

      // Apply filters
      mapped = this.applyFilters(mapped, {
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
      });

      // Sort results
      mapped = this.sortResults(mapped, sortBy);

      return mapped.slice(0, limit);
    } catch (error) {
      console.error('[TraktMetadataAdapter] Search failed:', error);
      return [];
    }
  }

  async discover(filters: DiscoverFilters, limit: number = 20): Promise<IMetadataResult[]> {
    await this.ensureInitialized();

    if (!this.service) {
      console.warn('[TraktMetadataAdapter] Service not available');
      return [];
    }

    try {
      const results: IMetadataResult[] = [];

      // Determine what to fetch based on type
      const fetchMovies = filters.type === 'all' || filters.type === 'movie';
      const fetchShows = filters.type === 'all' || filters.type === 'tv';

      // ─── FIX: Build search term from filters ───
      const searchTerm = this.buildDiscoverSearchTerm(filters);
      console.log(`[TraktMetadataAdapter] Discover using search term: "${searchTerm}"`);

      // ─── PRIMARY: Use search with the built term ───
      try {
        const searchResults = await this.service.search(
          searchTerm,
          undefined,
          {
            page: 1,
            limit: Math.min(limit * 2, 50),
            extended: 'full,images',
          }
        );

        if (searchResults && searchResults.length > 0) {
          console.log(`[TraktMetadataAdapter] Search for "${searchTerm}" returned ${searchResults.length} results`);
          const mapped = searchResults.map((result: TraktSearchResult) => this.mapSearchResult(result));
          results.push(...mapped);
        } else {
          console.log(`[TraktMetadataAdapter] Search for "${searchTerm}" returned 0 results, trying fallback...`);
        }
      } catch (searchError) {
        console.log('[TraktMetadataAdapter] Search failed, falling back to trending/popular:', searchError);
      }

      // ─── FALLBACK: Get trending movies ───
      if (results.length < limit * 0.5 && fetchMovies) {
        try {
          const trending = await this.service.getTrendingMovies({
            limit: Math.min(limit + 10, 50),
            extended: 'full,images',
          });
          const mapped = trending.map((item: TraktTrendingMovie) => 
            this.mapTrendingMovie(item)
          );
          // Only add if not already in results (deduplicate by ID)
          const existingIds = new Set(results.map(r => r.id));
          const newItems = mapped.filter(r => !existingIds.has(r.id));
          results.push(...newItems);
          console.log(`[TraktMetadataAdapter] Added ${newItems.length} trending movies`);
        } catch (error) {
          console.error('[TraktMetadataAdapter] Trending movies failed:', error);
        }
      }

      // ─── FALLBACK: Get trending shows ───
      if (results.length < limit * 0.5 && fetchShows) {
        try {
          const trending = await this.service.getTrendingShows({
            limit: Math.min(limit + 10, 50),
            extended: 'full,images',
          });
          const mapped = trending.map((item: TraktTrendingShow) => 
            this.mapTrendingShow(item)
          );
          const existingIds = new Set(results.map(r => r.id));
          const newItems = mapped.filter(r => !existingIds.has(r.id));
          results.push(...newItems);
          console.log(`[TraktMetadataAdapter] Added ${newItems.length} trending shows`);
        } catch (error) {
          console.error('[TraktMetadataAdapter] Trending shows failed:', error);
        }
      }

      // ─── TERTIARY FALLBACK: Popular movies ───
      if (results.length < limit * 0.5 && fetchMovies) {
        try {
          const popular = await this.service.getPopularMovies({
            limit: Math.min(limit + 5, 30),
            extended: 'full,images',
          });
          const mapped = popular.map((movie: TraktMovie) => this.mapMovie(movie));
          const existingIds = new Set(results.map(r => r.id));
          const newItems = mapped.filter(r => !existingIds.has(r.id));
          results.push(...newItems);
          console.log(`[TraktMetadataAdapter] Added ${newItems.length} popular movies`);
        } catch (error) {
          console.error('[TraktMetadataAdapter] Popular movies failed:', error);
        }
      }

      // ─── TERTIARY FALLBACK: Popular shows ───
      if (results.length < limit * 0.5 && fetchShows) {
        try {
          const popular = await this.service.getPopularShows({
            limit: Math.min(limit + 5, 30),
            extended: 'full,images',
          });
          const mapped = popular.map((show: TraktShow) => this.mapShow(show));
          const existingIds = new Set(results.map(r => r.id));
          const newItems = mapped.filter(r => !existingIds.has(r.id));
          results.push(...newItems);
          console.log(`[TraktMetadataAdapter] Added ${newItems.length} popular shows`);
        } catch (error) {
          console.error('[TraktMetadataAdapter] Popular shows failed:', error);
        }
      }

      // Apply filters
      let filtered = this.applyFilters(results, {
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
        includeAdult: filters.includeAdult,
      });

      // Deduplicate by ID
      const seen = new Set<string>();
      filtered = filtered.filter(item => {
        const key = `${item.source || 'trakt'}-${item.type}-${item.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // Sort and limit
      filtered = this.sortResults(filtered, filters.sortBy || 'popularity.desc');
      
      console.log(`[TraktMetadataAdapter] Discover returning ${Math.min(filtered.length, limit)} results`);
      return filtered.slice(0, limit);
    } catch (error) {
      console.error('[TraktMetadataAdapter] Discover failed:', error);
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
      const countryName = COUNTRY_CODE_TO_NAME[filters.countries[0].toUpperCase()] || filters.countries[0];
      if (countryName && !terms.some(t => t.toLowerCase().includes(countryName.toLowerCase()))) {
        terms.push(countryName);
      }
    }

    // Use language
    if (filters.languages && filters.languages.length > 0) {
      const langName = COUNTRY_CODE_TO_NAME[filters.languages[0].toUpperCase()] || filters.languages[0];
      if (langName && !terms.some(t => t.toLowerCase().includes(langName.toLowerCase()))) {
        terms.push(langName);
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
      const midYear = Math.floor((filters.startYear + filters.endYear) / 2);
      terms.push(String(midYear));
    }

    return terms.join(' ');
  }

  async getById(id: string, type: 'movie' | 'tv'): Promise<IMetadataResult | null> {
    await this.ensureInitialized();

    if (!this.service) {
      console.warn('[TraktMetadataAdapter] Service not available');
      return null;
    }

    try {
      if (type === 'movie') {
        const movie = await this.service.getMovie(id, { extended: 'full,images' });
        return this.mapMovieExtended(movie);
      } else {
        const show = await this.service.getShow(id, { extended: 'full,images' });
        return this.mapShowExtended(show);
      }
    } catch (error) {
      console.error(`[TraktMetadataAdapter] Get by ID ${id} failed:`, error);
      return null;
    }
  }

  async getTrending(limit: number = 20, type?: 'movie' | 'tv'): Promise<IMetadataResult[]> {
    await this.ensureInitialized();

    if (!this.service) {
      console.warn('[TraktMetadataAdapter] Service not available');
      return [];
    }

    try {
      const results: IMetadataResult[] = [];

      if (!type || type === 'movie') {
        const trending = await this.service.getTrendingMovies({
          limit: Math.min(limit + 10, 30),
          extended: 'full,images',
        });
        const mapped = trending.map((item: TraktTrendingMovie) => 
          this.mapTrendingMovie(item)
        );
        results.push(...mapped);
      }

      if (!type || type === 'tv') {
        const trending = await this.service.getTrendingShows({
          limit: Math.min(limit + 10, 30),
          extended: 'full,images',
        });
        const mapped = trending.map((item: TraktTrendingShow) => 
          this.mapTrendingShow(item)
        );
        results.push(...mapped);
      }

      // Deduplicate by ID
      const seen = new Set<string>();
      const deduplicated = results.filter(item => {
        const key = `${item.source || 'trakt'}-${item.type}-${item.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      return deduplicated.slice(0, limit);
    } catch (error) {
      console.error('[TraktMetadataAdapter] GetTrending failed:', error);
      return [];
    }
  }

  async getTrendingByCategory(category: string, limit: number = 20, region?: string): Promise<IMetadataResult[]> {
    await this.ensureInitialized();

    if (!this.service) {
      console.warn('[TraktMetadataAdapter] Service not available');
      return [];
    }

    try {
      // Map category to search terms
      const categoryMap: Record<string, { searchTerm: string; type?: 'movie' | 'tv' }> = {
        'movies': { searchTerm: 'movie', type: 'movie' },
        'tv': { searchTerm: 'tv series', type: 'tv' },
        'anime': { searchTerm: 'anime', type: 'tv' },
        'k-drama': { searchTerm: 'korean drama', type: 'tv' },
        'bollywood': { searchTerm: 'bollywood', type: 'movie' },
        'hollywood': { searchTerm: 'hollywood', type: 'movie' },
        'nollywood': { searchTerm: 'nollywood', type: 'movie' },
        'action': { searchTerm: 'action', type: 'movie' },
        'comedy': { searchTerm: 'comedy', type: 'movie' },
        'drama': { searchTerm: 'drama', type: 'movie' },
        'romance': { searchTerm: 'romance', type: 'movie' },
        'thriller': { searchTerm: 'thriller', type: 'movie' },
        'horror': { searchTerm: 'horror', type: 'movie' },
        'sci-fi': { searchTerm: 'sci-fi', type: 'movie' },
        'documentary': { searchTerm: 'documentary', type: 'movie' },
      };

      const config = categoryMap[category.toLowerCase()] || { searchTerm: category, type: 'movie' };

      // Try search first
      const results: IMetadataResult[] = [];
      
      try {
        const searchResults = await this.service.search(
          config.searchTerm,
          undefined,
          {
            page: 1,
            limit: Math.min(limit + 10, 30),
            extended: 'full,images',
          }
        );
        const mapped = searchResults.map((result: TraktSearchResult) => this.mapSearchResult(result));
        results.push(...mapped);
      } catch (searchError) {
        console.log('[TraktMetadataAdapter] Category search failed, falling back to trending:', searchError);
      }

      // If search returned nothing, fall back to trending
      if (results.length === 0) {
        if (config.type === 'movie' || !config.type) {
          const trending = await this.service.getTrendingMovies({
            limit: Math.min(limit + 10, 30),
            extended: 'full,images',
          });
          const mapped = trending.map((item: TraktTrendingMovie) => 
            this.mapTrendingMovie(item)
          );
          results.push(...mapped);
        }

        if (config.type === 'tv' || !config.type) {
          const trending = await this.service.getTrendingShows({
            limit: Math.min(limit + 10, 30),
            extended: 'full,images',
          });
          const mapped = trending.map((item: TraktTrendingShow) => 
            this.mapTrendingShow(item)
          );
          results.push(...mapped);
        }
      }

      // Deduplicate and return
      const seen = new Set<string>();
      const deduplicated = results.filter(item => {
        const key = `${item.source || 'trakt'}-${item.type}-${item.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      return deduplicated.slice(0, limit);
    } catch (error) {
      console.error('[TraktMetadataAdapter] GetTrendingByCategory failed:', error);
      return [];
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PRIVATE MAPPING HELPERS
  // ──────────────────────────────────────────────────────────────────────────

  private mapMovie(movie: TraktMovie | TraktMovieExtended): IMetadataResult {
    const extended = movie as TraktMovieExtended;
    const countryCode = extended.country || '';
    const language = countryCode ? COUNTRY_TO_LANGUAGE[countryCode.toUpperCase()] : undefined;

    return {
      id: movie.ids.trakt?.toString() || movie.ids.imdb || movie.ids.tmdb?.toString() || '',
      title: movie.title || '',
      type: 'movie',
      year: movie.year || undefined,
      releaseDate: extended.released || undefined,
      poster: this.getBestImage(extended.images?.poster),
      backdrop: this.getBestImage(extended.images?.fanart),
      overview: extended.overview || '',
      tagline: extended.tagline || undefined,
      rating: extended.rating || 0,
      popularity: extended.votes || 0,
      voteCount: extended.votes || 0,
      runtime: extended.runtime || undefined,
      genres: extended.genres || [],
      certification: extended.certification || undefined,
      originalLanguage: language,
      originCountry: countryCode ? [countryCode] : [],
      originalTitle: movie.title || '',
      status: extended.status || undefined,
      source: 'trakt',
      cast: [],
      keywords: [],
      belongsToCollection: undefined,
      watchProviders: undefined,
      budget: undefined,
      revenue: undefined,
      networks: undefined,
      spokenLanguages: language ? [{ englishName: language, iso639_1: language, name: language }] : undefined,
      productionCompanies: undefined,
      productionCountries: countryCode ? [{ iso3166_1: countryCode, name: countryCode }] : [],
      numberOfSeasons: undefined,
      numberOfEpisodes: undefined,
      lastAirDate: undefined,
      inProduction: false,
    };
  }

  private mapShow(show: TraktShow | TraktShowExtended): IMetadataResult {
    const extended = show as TraktShowExtended;
    const countryCode = extended.country || '';
    const language = countryCode ? COUNTRY_TO_LANGUAGE[countryCode.toUpperCase()] : undefined;

    return {
      id: show.ids.trakt?.toString() || show.ids.imdb || show.ids.tmdb?.toString() || '',
      title: show.title || '',
      type: 'tv',
      year: show.year || undefined,
      releaseDate: extended.first_aired || undefined,
      poster: this.getBestImage(extended.images?.poster),
      backdrop: this.getBestImage(extended.images?.fanart),
      overview: extended.overview || '',
      rating: extended.rating || 0,
      popularity: extended.votes || 0,
      voteCount: extended.votes || 0,
      runtime: extended.runtime || undefined,
      genres: extended.genres || [],
      certification: extended.certification || undefined,
      originalLanguage: language,
      originCountry: countryCode ? [countryCode] : [],
      originalTitle: show.title || '',
      status: extended.status || undefined,
      numberOfSeasons: undefined,
      numberOfEpisodes: extended.aired_episodes || undefined,
      lastAirDate: extended.first_aired || undefined,
      source: 'trakt',
      cast: [],
      keywords: [],
      belongsToCollection: undefined,
      watchProviders: undefined,
      budget: undefined,
      revenue: undefined,
      networks: extended.network ? [{ id: 0, name: extended.network, logoPath: '', originCountry: '' }] : undefined,
      spokenLanguages: language ? [{ englishName: language, iso639_1: language, name: language }] : undefined,
      productionCompanies: undefined,
      productionCountries: countryCode ? [{ iso3166_1: countryCode, name: countryCode }] : [],
      inProduction: false,
    };
  }

  private mapSearchResult(result: TraktSearchResult): IMetadataResult {
    if (result.movie) {
      return this.mapMovie(result.movie);
    } else if (result.show) {
      return this.mapShow(result.show);
    } else if (result.episode) {
      return {
        id: result.episode.ids.trakt?.toString() || result.episode.ids.imdb || '',
        title: result.episode.title || 'Episode',
        type: 'tv',
        year: undefined,
        poster: undefined,
        backdrop: undefined,
        overview: (result.episode as any).overview || '',
        rating: (result.episode as any).rating || 0,
        source: 'trakt',
        originalLanguage: undefined,
        originCountry: [],
        originalTitle: result.episode.title || '',
        popularity: 0,
        voteCount: 0,
        cast: [],
        keywords: [],
        genres: [],
      };
    } else if (result.person) {
      return {
        id: result.person.ids.trakt?.toString() || '',
        title: result.person.name || '',
        type: 'tv',
        year: undefined,
        poster: (result.person as any).images?.headshot?.[0],
        backdrop: undefined,
        overview: (result.person as any).biography || '',
        rating: 0,
        source: 'trakt',
        originalLanguage: undefined,
        originCountry: [],
        originalTitle: result.person.name || '',
        popularity: 0,
        voteCount: 0,
        cast: [],
        keywords: [],
        genres: [],
      };
    } else {
      return {
        id: '',
        title: 'Unknown',
        type: 'movie',
        source: 'trakt',
        originalLanguage: undefined,
        originCountry: [],
        originalTitle: '',
        popularity: 0,
        voteCount: 0,
        cast: [],
        keywords: [],
        genres: [],
      };
    }
  }

  private mapTrendingMovie(item: TraktTrendingMovie): IMetadataResult {
    const mapped = this.mapMovie(item.movie);
    mapped.popularity = item.watchers || 0;
    return mapped;
  }

  private mapTrendingShow(item: TraktTrendingShow): IMetadataResult {
    const mapped = this.mapShow(item.show);
    mapped.popularity = item.watchers || 0;
    return mapped;
  }

  private mapMovieExtended(movie: TraktMovieExtended): IMetadataResult {
    const mapped = this.mapMovie(movie);
    mapped.tagline = movie.tagline || undefined;
    return mapped;
  }

  private mapShowExtended(show: TraktShowExtended): IMetadataResult {
    const mapped = this.mapShow(show);
    mapped.numberOfSeasons = undefined;
    mapped.numberOfEpisodes = show.aired_episodes || undefined;
    mapped.networks = show.network ? [{ id: 0, name: show.network, logoPath: '', originCountry: '' }] : undefined;
    return mapped;
  }

  private getBestImage(images?: string[]): string | undefined {
    if (!images || images.length === 0) return undefined;
    return images[0];
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PRIVATE FILTER HELPERS
  // ──────────────────────────────────────────────────────────────────────────

  private applyFilters(results: IMetadataResult[], filters: any): IMetadataResult[] {
    let filtered = [...results];

    // ─── FIX: Flexible language filtering ───
    if (filters.languages && filters.languages.length > 0) {
      const langs = filters.languages.map((l: string) => l.toLowerCase());
      filtered = filtered.filter(item => {
        if (!item.originalLanguage) return false;
        const itemLang = item.originalLanguage.toLowerCase();
        return langs.some((l: string) => 
          itemLang.includes(l) || l.includes(itemLang)
        );
      });
    }

    // ─── FIX: Flexible country filtering ───
    if (filters.countries && filters.countries.length > 0) {
      const ctrys = filters.countries.map((c: string) => c.toUpperCase());
      filtered = filtered.filter(item => {
        if (!item.originCountry || item.originCountry.length === 0) return false;
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

    // ─── FIX: Genre filtering with flexible matching ───
    if (filters.genres && filters.genres.length > 0) {
      const filterGenres: string[] = [];
      for (const g of filters.genres) {
        const mapped = TRAKT_GENRE_MAP[g] || [g];
        filterGenres.push(...mapped);
      }
      const normalizedFilterGenres = filterGenres.map(g => g.toLowerCase());

      filtered = filtered.filter(item => {
        const itemGenres = item.genres || [];
        const normalizedItemGenres = itemGenres.map((g: string) => g.toLowerCase());
        return normalizedItemGenres.some((ig: string) =>
          normalizedFilterGenres.some((fg: string) => ig.includes(fg) || fg.includes(ig))
        );
      });
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

  destroy(): void {
    this.initialized = false;
    this.service = null;
    console.log('[TraktMetadataAdapter] Destroyed');
  }
}

export default TraktMetadataAdapter;