/**
 * KuryanaMetadataAdapter - Uses ONLY real Kuryana endpoints:
 *   /search/q/{query}
 *   /id/{slug}
 *   /id/{slug}/reviews
 *   /id/{slug}/cast
 *   /id/{slug}/episodes
 *   /seasonal/{year}/{quarter}
 *
 * FIXED: Seasonal endpoint returns 500 errors consistently. Instead of
 * making 8 sequential failed requests, discover() now uses search by
 * country/language directly as the primary strategy.
 * FIXED: Kuryana is exclusively Asian content - SKIP language/country
 * filtering entirely since all results are already Asian dramas.
 * FIXED: mapKuryanaDrama() now properly populates originalLanguage and
 * originCountry for ALL results so they pass the aggregator's filters.
 * FIXED: applyFiltersForKuryana() now skips strict genre filtering too.
 * FIXED: discover() now searches ALL provided countries, not just the first
 * one. When "Asian" category sends ['KR','CN','TW','HK'], Kuryana searches
 * each country and merges results so the user gets Korean, Chinese,
 * Taiwanese, and Hong Kong dramas all together.
 */

import { IMetadataResult, DiscoverFilters } from '../../types/MetadataTypes';
import { kuryanaApiService, KuryanaDrama } from '../KuryanaMetadata';

const KURYANA_GENRE_MAP: Record<string, string[]> = {
  'Action': ['Action', 'Action Drama', 'Martial Arts', 'Wuxia'],
  'Adventure': ['Adventure', 'Fantasy', 'Xianxia'],
  'Animation': ['Animation', 'Anime'],
  'Comedy': ['Comedy', 'Romantic Comedy', 'Sitcom', 'Slice of Life'],
  'Crime': ['Crime', 'Mystery', 'Suspense', 'Noir'],
  'Documentary': ['Documentary'],
  'Drama': ['Drama', 'Romantic Drama', 'Historical Drama', 'Political Drama', 'Slice of Life'],
  'Family': ['Family', 'Melodrama'],
  'Fantasy': ['Fantasy', 'Xianxia', 'Wuxia', 'Magical'],
  'Horror': ['Horror', 'Supernatural', 'Ghost'],
  'Mystery': ['Mystery', 'Suspense', 'Thriller'],
  'Romance': ['Romance', 'Romantic Comedy', 'Romantic Drama', 'Melodrama'],
  'Sci-Fi': ['Sci-Fi', 'Science Fiction', 'Futuristic'],
  'Thriller': ['Thriller', 'Suspense', 'Psychological'],
  'War': ['War', 'Military'],
  'Western': ['Western'],
  'Wuxia': ['Wuxia', 'Martial Arts', 'Swordplay', 'Jianghu'],
  'Xianxia': ['Xianxia', 'Cultivation', 'Celestial', 'Immortal'],
  'Xuanhuan': ['Xuanhuan', 'Mythological', 'Eastern Fantasy'],
  'Historical': ['Historical', 'Period', 'Costume', 'Historical Drama', 'Sageuk'],
  'Period': ['Period', 'Historical', 'Costume', 'Sageuk'],
  'Costume': ['Costume', 'Historical', 'Period', 'Sageuk'],
  'Martial Arts': ['Martial Arts', 'Wuxia', 'Swordplay', 'Kung Fu'],
  'Sageuk': ['Sageuk', 'Historical', 'Period', 'Korean Historical'],
  'Joseon': ['Joseon', 'Sageuk', 'Historical', 'Korean Period'],
  'Goryeo': ['Goryeo', 'Sageuk', 'Historical', 'Korean Period'],
  'K-Drama': ['K-Drama', 'Korean', 'Korea', 'Sageuk', 'Korean Drama'],
  'Korean': ['Korean', 'K-Drama', 'Korean Drama'],
  'Rom-Com': ['Romantic Comedy', 'Rom-Com', 'Romance', 'Comedy'],
  'Melodrama': ['Melodrama', 'Drama', 'Romantic Drama', 'Emotional'],
  'J-Drama': ['J-Drama', 'Japanese', 'Japanese Drama', 'Dorama'],
  'Japanese': ['Japanese', 'J-Drama', 'Japanese Drama', 'Dorama'],
  'C-Drama': ['C-Drama', 'Chinese', 'Chinese Drama', 'Cdrama'],
  'Chinese': ['Chinese', 'C-Drama', 'Chinese Drama', 'Cdrama'],
  'T-Drama': ['T-Drama', 'Taiwanese', 'Taiwanese Drama'],
  'Taiwanese': ['Taiwanese', 'T-Drama', 'Taiwanese Drama'],
  'Thai': ['Thai', 'Thai Drama', 'Thai Lakorn'],
  'Thai Drama': ['Thai Drama', 'Thai', 'Thai Lakorn', 'Lakorn'],
  'Lakorn': ['Lakorn', 'Thai Drama', 'Thai', 'Soap Opera'],
  'Filipino': ['Filipino', 'Philippine', 'Philippine Drama', 'Teleserye'],
  'Teleserye': ['Teleserye', 'Philippine Drama', 'Filipino Drama'],
  'Indonesian': ['Indonesian', 'Indonesian Drama', 'Sinetron'],
  'Sinetron': ['Sinetron', 'Indonesian Drama', 'Indonesian'],
  'Vietnamese': ['Vietnamese', 'Vietnamese Drama', 'V-Drama'],
  'Slice of Life': ['Slice of Life', 'Life', 'Everyday', 'Realistic'],
  'School': ['School', 'High School', 'Youth', 'College'],
  'Youth': ['Youth', 'Coming of Age', 'School', 'Teen'],
  'Coming of Age': ['Coming of Age', 'Youth', 'School', 'Teen'],
  'Supernatural': ['Supernatural', 'Ghost', 'Paranormal', 'Fantasy'],
  'Ghost': ['Ghost', 'Supernatural', 'Paranormal', 'Horror'],
  'Psychological': ['Psychological', 'Thriller', 'Suspense', 'Mind'],
  'Police': ['Police', 'Crime', 'Detective', 'Investigation'],
  'Detective': ['Detective', 'Police', 'Crime', 'Investigation'],
  'Medical': ['Medical', 'Hospital', 'Doctor', 'Healthcare'],
  'Legal': ['Legal', 'Law', 'Court', 'Lawyer', 'Prosecutor'],
  'Political': ['Political', 'Political Drama', 'Government', 'Power'],
  'Food': ['Food', 'Culinary', 'Cooking', 'Restaurant'],
  'Music': ['Music', 'Musical', 'K-Pop', 'Idol', 'Band'],
  'Sports': ['Sports', 'Athletic', 'Sports Drama', 'Competition'],
  'Revenge': ['Revenge', 'Vengeance', 'Retribution'],
  'Time Travel': ['Time Travel', 'Time Slip', 'Sci-Fi', 'Fantasy'],
  'Adaptation': ['Adaptation', 'Webtoon', 'Manhwa', 'Manga', 'Novel'],
  'Webtoon': ['Webtoon', 'Webcomic', 'Adaptation', 'Manhwa'],
  'Manhwa': ['Manhwa', 'Webtoon', 'Adaptation', 'Webcomic'],
  'Manga': ['Manga', 'Adaptation', 'Japanese', 'Anime'],
  'Idol': ['Idol', 'K-Pop', 'Music', 'Boy Band', 'Girl Group'],
  'BL': ['BL', 'Boys Love', 'Yaoi', 'LGBT'],
  'GL': ['GL', 'Girls Love', 'Yuri', 'LGBT'],
  'LGBT': ['LGBT', 'BL', 'GL', 'Queer', 'Gay', 'Lesbian'],
  'Erotica': ['Erotica', 'Romance', 'Adult', 'Sensual'],
  'Mature': ['Mature', 'Adult', 'Dark', 'Psychological'],
};

const COUNTRY_REGION_MAP: Record<string, string> = {
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
};

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
  'MN': 'mn', 'KP': 'ko',
};

export class KuryanaMetadataAdapter {
  readonly name = 'Kuryana';
  readonly id = 'kuryana';
  readonly priority = 2;
  readonly enabled = true;

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
    const {
      query,
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
      sortBy,
    } = options;

    const effectiveSortBy = sortBy || 'popularity.desc';

    if (!query || query.trim() === '') {
      return this.discover({
        languages,
        countries: countries || (region ? [region] : undefined),
        region: region || options.watchRegion,
        genres,
        minRating,
        maxRating,
        year,
        startYear,
        endYear,
        keywords,
        sortBy: effectiveSortBy as DiscoverFilters['sortBy'],
        type: options.type || 'all',
        limit,
      });
    }

    try {
      const results = await kuryanaApiService.searchDramas(query);
      let mapped = results.slice(0, Math.min(limit + 20, 50)).map((item: KuryanaDrama) =>
        this.mapKuryanaDrama(item)
      );
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
        includeAdult: options.includeAdult,
      });
      mapped = this.sortResults(mapped, effectiveSortBy);
      return mapped.slice(0, limit);
    } catch (error) {
      console.error('[KuryanaMetadataAdapter] Search failed:', error);
      return [];
    }
  }

  async discover(filters: DiscoverFilters, limit: number = 20): Promise<IMetadataResult[]> {
    const sortBy = filters.sortBy || 'popularity.desc';

    try {
      const allResults: IMetadataResult[] = [];

      // ─── FIX: Skip seasonal entirely - it consistently returns 500 ───
      console.log('[KuryanaMetadataAdapter] Discover: skipping seasonal (known 500), using search by country/language');

      // ─── PRIMARY: Search by ALL provided countries (not just the first) ───
      // When "Asian" category sends ['KR','CN','TW','HK'], we search each
      // country and merge so user gets Korean, Chinese, Taiwanese, and
      // Hong Kong dramas all together.
      if (filters.countries && filters.countries.length > 0) {
        console.log(`[KuryanaMetadataAdapter] Searching by countries: ${JSON.stringify(filters.countries)}`);
        
        for (const countryCode of filters.countries) {
          const countryName = COUNTRY_REGION_MAP[countryCode.toUpperCase()] || countryCode;
          console.log(`[KuryanaMetadataAdapter] Searching by country: "${countryName}"`);
          
          try {
            const searchResults = await kuryanaApiService.searchDramas(countryName);
            if (searchResults && searchResults.length > 0) {
              const mapped = searchResults.map((item: KuryanaDrama) =>
                this.mapKuryanaDrama(item)
              );
              allResults.push(...mapped);
              console.log(`[KuryanaMetadataAdapter] Found ${mapped.length} results for "${countryName}"`);
            }
          } catch (error) {
            console.log(`[KuryanaMetadataAdapter] Search by country "${countryName}" failed:`, error);
          }
        }
      }

      // ─── SECONDARY: Search by ALL provided languages ───
      if (allResults.length === 0 && filters.languages && filters.languages.length > 0) {
        console.log(`[KuryanaMetadataAdapter] Searching by languages: ${JSON.stringify(filters.languages)}`);
        
        for (const lang of filters.languages) {
          const langNames: Record<string, string> = {
            'hi': 'Hindi', 'bn': 'Bengali', 'te': 'Telugu', 'ta': 'Tamil',
            'ml': 'Malayalam', 'ko': 'Korean', 'ja': 'Japanese', 'zh': 'Chinese',
            'en': 'English', 'fr': 'French', 'es': 'Spanish', 'de': 'German',
            'it': 'Italian', 'pt': 'Portuguese', 'ru': 'Russian', 'ar': 'Arabic',
            'tr': 'Turkish', 'th': 'Thai', 'vi': 'Vietnamese', 'tl': 'Filipino',
            'ms': 'Malay', 'id': 'Indonesian', 'ur': 'Urdu', 'fa': 'Persian',
            'he': 'Hebrew', 'nl': 'Dutch', 'sv': 'Swedish', 'no': 'Norwegian',
            'da': 'Danish', 'fi': 'Finnish', 'pl': 'Polish', 'uk': 'Ukrainian',
            'ro': 'Romanian', 'bg': 'Bulgarian', 'cs': 'Czech', 'el': 'Greek',
            'hu': 'Hungarian', 'sk': 'Slovak', 'sl': 'Slovenian', 'et': 'Estonian',
            'lv': 'Latvian', 'lt': 'Lithuanian', 'is': 'Icelandic', 'mt': 'Maltese',
            'sq': 'Albanian', 'bs': 'Bosnian', 'hr': 'Croatian', 'sr': 'Serbian',
            'mk': 'Macedonian', 'ka': 'Georgian', 'hy': 'Armenian', 'az': 'Azerbaijani',
            'kk': 'Kazakh', 'uz': 'Uzbek', 'tg': 'Tajik', 'ky': 'Kyrgyz',
            'mn': 'Mongolian', 'km': 'Khmer', 'lo': 'Lao', 'my': 'Burmese',
            'ne': 'Nepali', 'si': 'Sinhala', 'dv': 'Dhivehi', 'dz': 'Dzongkha',
            'ps': 'Pashto', 'sd': 'Sindhi', 'pa': 'Punjabi', 'gu': 'Gujarati',
            'kn': 'Kannada', 'or': 'Odia', 'as': 'Assamese', 'mai': 'Maithili',
            'sat': 'Santali', 'ks': 'Kashmiri', 'doi': 'Dogri', 'mni': 'Manipuri',
            'bodo': 'Bodo', 'kok': 'Konkani',
          };
          
          const langName = langNames[lang] || lang;
          console.log(`[KuryanaMetadataAdapter] Searching by language: "${langName}"`);
          
          try {
            const searchResults = await kuryanaApiService.searchDramas(langName);
            if (searchResults && searchResults.length > 0) {
              const mapped = searchResults.map((item: KuryanaDrama) =>
                this.mapKuryanaDrama(item)
              );
              allResults.push(...mapped);
              console.log(`[KuryanaMetadataAdapter] Found ${mapped.length} results for "${langName}"`);
            }
          } catch (error) {
            console.log(`[KuryanaMetadataAdapter] Search by language "${langName}" failed:`, error);
          }
        }
      }

      // ─── TERTIARY: Search by genre ───
      if (allResults.length === 0 && filters.genres && filters.genres.length > 0) {
        for (const genre of filters.genres) {
          console.log(`[KuryanaMetadataAdapter] Searching by genre: "${genre}"`);
          
          try {
            const searchResults = await kuryanaApiService.searchDramas(genre);
            if (searchResults && searchResults.length > 0) {
              const mapped = searchResults.map((item: KuryanaDrama) =>
                this.mapKuryanaDrama(item)
              );
              allResults.push(...mapped);
              console.log(`[KuryanaMetadataAdapter] Found ${mapped.length} results for "${genre}"`);
            }
          } catch (error) {
            console.log(`[KuryanaMetadataAdapter] Search by genre "${genre}" failed:`, error);
          }
        }
      }

      // ─── FALLBACK: General search for popular content ───
      if (allResults.length === 0) {
        const fallbackTerms = ['popular', 'trending', 'new', 'best'];
        for (const term of fallbackTerms) {
          try {
            console.log(`[KuryanaMetadataAdapter] Fallback search: "${term}"`);
            const searchResults = await kuryanaApiService.searchDramas(term);
            if (searchResults && searchResults.length > 0) {
              const mapped = searchResults.map((item: KuryanaDrama) =>
                this.mapKuryanaDrama(item)
              );
              allResults.push(...mapped);
              console.log(`[KuryanaMetadataAdapter] Found ${mapped.length} results for "${term}"`);
              break;
            }
          } catch (error) {
            console.log(`[KuryanaMetadataAdapter] Fallback search "${term}" failed:`, error);
          }
        }
      }

      // ─── FIX: Kuryana is exclusively Asian content - SKIP ALL strict filtering ───
      // The search endpoint is already scoped by country/language/genre query.
      // Only deduplicate, sort, and cap.
      const seen = new Set<string>();
      const deduped = allResults.filter(item => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });

      const sorted = this.sortResults(deduped, sortBy);
      const finalResults = sorted.slice(0, limit);
      
      console.log(`[KuryanaMetadataAdapter] Discover returning ${finalResults.length} results (from ${allResults.length} raw)`);
      return finalResults;
    } catch (error) {
      console.error('[KuryanaMetadataAdapter] Discover failed:', error);
      return [];
    }
  }

  async getById(id: string, type: 'movie' | 'tv'): Promise<IMetadataResult | null> {
    try {
      const item = await kuryanaApiService.getDramaDetails(id);
      if (!item) return null;
      return this.mapKuryanaDrama(item);
    } catch (error) {
      console.error(`[KuryanaMetadataAdapter] Get by ID ${id} failed:`, error);
      return null;
    }
  }

  async getReviews(slug: string, limit: number = 20): Promise<any[]> {
    try {
      const results = await kuryanaApiService.getDramaReviews(slug);
      return results.slice(0, limit);
    } catch (error) {
      console.error('[KuryanaMetadataAdapter] GetReviews failed:', error);
      return [];
    }
  }

  async getCast(slug: string, limit: number = 20): Promise<any[]> {
    try {
      const results = await kuryanaApiService.getDramaCast(slug);
      return results.slice(0, limit);
    } catch (error) {
      console.error('[KuryanaMetadataAdapter] GetCast failed:', error);
      return [];
    }
  }

  async getEpisodes(slug: string, limit: number = 20): Promise<any[]> {
    try {
      const results = await kuryanaApiService.getDramaEpisodes(slug);
      return results.slice(0, limit);
    } catch (error) {
      console.error('[KuryanaMetadataAdapter] GetEpisodes failed:', error);
      return [];
    }
  }

  async getSeasonal(year: number, quarter: number, limit: number = 20): Promise<IMetadataResult[]> {
    try {
      const results = await kuryanaApiService.getSeasonalDramas(year, quarter);
      return results.slice(0, limit).map((item: KuryanaDrama) =>
        this.mapKuryanaDrama(item)
      );
    } catch (error) {
      console.error('[KuryanaMetadataAdapter] GetSeasonal failed:', error);
      return [];
    }
  }

  /**
   * ─── DEPRECATED: Replaced by direct dedupe/sort/cap in discover() ───
   * Keeping for backward compatibility with search() path only.
   */
  private applyFiltersForKuryana(results: IMetadataResult[], filters: any): IMetadataResult[] {
    let filtered = [...results];

    // ─── SKIP language, country, AND genre filters for Kuryana ───
    // All Kuryana content is already Asian dramas. Genre filtering is too
    // brittle because Kuryana uses free-text genre labels ("Korean Drama",
    // "Romance") not canonical names. The search query itself already scopes
    // results appropriately.

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
      filtered = filtered.filter(item => {
        const title = item.title || '';
        const overview = item.overview || '';
        const keywords = (item as any).keywords || [];
        const searchText = `${title} ${overview} ${keywords.join(' ')}`.toLowerCase();
        return filters.keywords.some((k: string) => searchText.includes(k.toLowerCase()));
      });
    }

    // Adult content filter
    if (filters.includeAdult === false) {
      filtered = filtered.filter(item => !(item as any).adult);
    }

    return filtered;
  }

  private applyFilters(results: IMetadataResult[], filters: any): IMetadataResult[] {
    let filtered = [...results];

    // ─── FIX: Kuryana is exclusively Asian content - skip language/country filters ───
    // Check if results are from Kuryana
    const isKuryanaSource = results.length > 0 && results[0].source === 'kuryana';
    
    if (isKuryanaSource) {
      // Use the Kuryana-specific filter that skips language/country/genre
      return this.applyFiltersForKuryana(results, filters);
    }

    // ─── For non-Kuryana sources, apply all filters ───
    // Flexible language filtering
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

    // Flexible country filtering
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

    // Region filtering
    if (filters.region) {
      const regionName = COUNTRY_REGION_MAP[filters.region.toUpperCase()] || filters.region;
      filtered = filtered.filter(item => {
        const country = (item as any).countryName || '';
        const originCountry = item.originCountry?.join(', ') || '';
        const searchText = `${country} ${originCountry}`.toLowerCase();
        return searchText.includes(regionName.toLowerCase());
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

    // Genre filtering
    if (filters.genres && filters.genres.length > 0) {
      filtered = filtered.filter(item => {
        const genres = item.genres || [];
        const mappedGenres: string[] = [];
        for (const g of filters.genres) {
          const mapped = KURYANA_GENRE_MAP[g] || [g];
          mappedGenres.push(...mapped);
        }
        return genres.some((g: string) =>
          mappedGenres.some((mg: string) => g.toLowerCase().includes(mg.toLowerCase()))
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
      filtered = filtered.filter(item => {
        const title = item.title || '';
        const overview = item.overview || '';
        const keywords = (item as any).keywords || [];
        const searchText = `${title} ${overview} ${keywords.join(' ')}`.toLowerCase();
        return filters.keywords.some((k: string) => searchText.includes(k.toLowerCase()));
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

  /**
   * Map Kuryana drama to IMetadataResult with proper poster handling
   *
   * GET /search/q/{query} returns the poster as `thumb` — a full, ready-to-use
   * MyDramaList CDN URL. There is NO `/images/{slug}.jpg` endpoint on
   * kuryana.tbdh.app (confirmed 404) — never construct a poster URL from slug.
   * GET /id/{slug} (detail endpoint) may use a different field name, so a few
   * plausible fallbacks are kept for that path, but none of them fabricate a URL.
   *
   * ─── FIX: Populate originalLanguage and originCountry for ALL results ───
   * Previously these were only set when the drama had a `country` field.
   * Now we extract country and language from the `type` field as well,
   * so fallback search results (which may not have country populated) still
   * pass the aggregator's language/country filters.
   */
  private mapKuryanaDrama(item: KuryanaDrama): IMetadataResult {
    const posterUrl =
      item.thumb ||
      item.poster ||
      (item as any).cover ||
      (item as any).image ||
      (item as any).poster_url ||
      undefined;

    // `series` distinguishes movie vs show on /search results:
    // a string like "20 episodes" means it's a show; `false` means a movie.
    const isMovie = item.series === false;

    // ─── FIX: Extract country from multiple sources ───
    let country = item.country || '';
    
    // If country is empty, try to extract from type
    if (!country && item.type) {
      const typeLower = item.type.toLowerCase();
      if (typeLower.includes('korean')) country = 'KR';
      else if (typeLower.includes('japanese')) country = 'JP';
      else if (typeLower.includes('chinese')) country = 'CN';
      else if (typeLower.includes('taiwanese')) country = 'TW';
      else if (typeLower.includes('thai')) country = 'TH';
      else if (typeLower.includes('indian') || typeLower.includes('bollywood')) country = 'IN';
      else if (typeLower.includes('nigeria') || typeLower.includes('nollywood')) country = 'NG';
      else if (typeLower.includes('filipino') || typeLower.includes('pinoy')) country = 'PH';
      else if (typeLower.includes('malaysian') || typeLower.includes('melayu')) country = 'MY';
      else if (typeLower.includes('indonesian')) country = 'ID';
      else if (typeLower.includes('vietnamese')) country = 'VN';
      else if (typeLower.includes('turkish')) country = 'TR';
      else if (typeLower.includes('spanish')) country = 'ES';
      else if (typeLower.includes('french')) country = 'FR';
      else if (typeLower.includes('german')) country = 'DE';
      else if (typeLower.includes('italian')) country = 'IT';
      else if (typeLower.includes('portuguese')) country = 'PT';
      else if (typeLower.includes('russian')) country = 'RU';
      else if (typeLower.includes('arabic') || typeLower.includes('egyptian')) country = 'EG';
      else if (typeLower.includes('persian') || typeLower.includes('iranian')) country = 'IR';
      else if (typeLower.includes('hebrew') || typeLower.includes('israeli')) country = 'IL';
      else if (typeLower.includes('greek')) country = 'GR';
      else if (typeLower.includes('polish')) country = 'PL';
      else if (typeLower.includes('czech')) country = 'CZ';
      else if (typeLower.includes('hungarian')) country = 'HU';
      else if (typeLower.includes('swedish')) country = 'SE';
      else if (typeLower.includes('norwegian')) country = 'NO';
      else if (typeLower.includes('danish')) country = 'DK';
      else if (typeLower.includes('finnish')) country = 'FI';
    }

    // ─── FIX: Determine language from country ───
    let language = undefined;
    if (country) {
      language = COUNTRY_TO_LANGUAGE[country.toUpperCase()] || undefined;
    }
    
    // If still no language, try to infer from type
    if (!language && item.type) {
      const typeLower = item.type.toLowerCase();
      if (typeLower.includes('korean')) language = 'ko';
      else if (typeLower.includes('japanese')) language = 'ja';
      else if (typeLower.includes('chinese') || typeLower.includes('mandarin')) language = 'zh';
      else if (typeLower.includes('taiwanese')) language = 'zh';
      else if (typeLower.includes('thai')) language = 'th';
      else if (typeLower.includes('indian') || typeLower.includes('bollywood')) language = 'hi';
      else if (typeLower.includes('nigerian') || typeLower.includes('nollywood')) language = 'en';
      else if (typeLower.includes('filipino') || typeLower.includes('pinoy')) language = 'tl';
      else if (typeLower.includes('malaysian')) language = 'ms';
      else if (typeLower.includes('indonesian')) language = 'id';
      else if (typeLower.includes('vietnamese')) language = 'vi';
      else if (typeLower.includes('turkish')) language = 'tr';
      else if (typeLower.includes('spanish')) language = 'es';
      else if (typeLower.includes('french')) language = 'fr';
      else if (typeLower.includes('german')) language = 'de';
      else if (typeLower.includes('italian')) language = 'it';
      else if (typeLower.includes('portuguese')) language = 'pt';
      else if (typeLower.includes('russian')) language = 'ru';
      else if (typeLower.includes('arabic')) language = 'ar';
      else if (typeLower.includes('persian')) language = 'fa';
      else if (typeLower.includes('hebrew')) language = 'he';
      else if (typeLower.includes('greek')) language = 'el';
      else if (typeLower.includes('polish')) language = 'pl';
      else if (typeLower.includes('czech')) language = 'cs';
      else if (typeLower.includes('hungarian')) language = 'hu';
      else if (typeLower.includes('swedish')) language = 'sv';
      else if (typeLower.includes('norwegian')) language = 'no';
      else if (typeLower.includes('danish')) language = 'da';
      else if (typeLower.includes('finnish')) language = 'fi';
    }

    return {
      id: item.slug || item.id || item.mdl_id || '',
      title: item.title || '',
      type: isMovie ? 'movie' : 'tv',
      year: item.year || undefined,
      poster: posterUrl,
      backdrop: item.backdrop || undefined,
      overview: item.synopsis || '',
      rating: item.rating || 0,
      genres: item.genres || [],
      runtime: item.duration ? parseInt(item.duration) : undefined,
      source: 'kuryana',
      originalLanguage: language,
      originCountry: country ? [country] : [],
      originalTitle: item.title || '',
      popularity: 0,
      voteCount: 0,
      cast: item.cast?.map((c) => ({
        character: c.role,
        person: {
          name: c.name,
          ids: {},
        },
      })) || [],
      certification: undefined,
      tagline: undefined,
      status: undefined,
      keywords: [],
      belongsToCollection: undefined,
      watchProviders: undefined,
      budget: undefined,
      revenue: undefined,
      networks: undefined,
      spokenLanguages: language ? [{ englishName: language, iso639_1: language, name: language }] : undefined,
      productionCompanies: undefined,
      productionCountries: country ? [{ iso3166_1: country, name: country }] : [],
      numberOfSeasons: undefined,
      numberOfEpisodes: item.totalEpisodes || undefined,
      lastAirDate: undefined,
      inProduction: false,
      providerData: {
        slug: item.slug,
        mdlId: item.mdl_id,
        ranking: item.ranking,
        totalEpisodes: item.totalEpisodes,
        cast: item.cast,
      },
    };
  }

  destroy(): void {
    console.log('[KuryanaMetadataAdapter] Destroyed');
  }
}

export default KuryanaMetadataAdapter;