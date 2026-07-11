/**
 * KuryanaMetadataAdapter - Adapter that wraps KuryanaApiService to implement the metadata provider interface.
 * Translates Kuryana's API into the unified metadata provider shape.
 * 
 * v2.0 - Maps industry-standard filters to Kuryana's native parameters.
 * Supports: language/country/region filtering, genre mapping, year filtering.
 * Kuryana primarily handles Asian dramas/TV series content with genres like:
 * Wuxia, Xianxia, Historical, Period, Martial Arts, and more.
 */

import { IMetadataResult, DiscoverFilters } from '../../types/MetadataTypes';
import { kuryanaApiService, KuryanaDrama } from '../KuryanaMetadata';

// Complete Kuryana genre mapping for Asian dramas
const KURYANA_GENRE_MAP: Record<string, string[]> = {
  // Standard Western genres
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
  
  // Asian Drama specific genres
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
  
  // Korean Drama specific
  'K-Drama': ['K-Drama', 'Korean', 'Korea', 'Sageuk', 'Korean Drama'],
  'Korean': ['Korean', 'K-Drama', 'Korean Drama'],
  'Rom-Com': ['Romantic Comedy', 'Rom-Com', 'Romance', 'Comedy'],
  'Melodrama': ['Melodrama', 'Drama', 'Romantic Drama', 'Emotional'],
  
  // Japanese Drama specific
  'J-Drama': ['J-Drama', 'Japanese', 'Japanese Drama', 'Dorama'],
  'Japanese': ['Japanese', 'J-Drama', 'Japanese Drama', 'Dorama'],
  
  // Chinese Drama specific
  'C-Drama': ['C-Drama', 'Chinese', 'Chinese Drama', 'Cdrama'],
  'Chinese': ['Chinese', 'C-Drama', 'Chinese Drama', 'Cdrama'],
  
  // Taiwanese Drama specific
  'T-Drama': ['T-Drama', 'Taiwanese', 'Taiwanese Drama'],
  'Taiwanese': ['Taiwanese', 'T-Drama', 'Taiwanese Drama'],
  
  // Thai Drama specific
  'Thai': ['Thai', 'Thai Drama', 'Thai Lakorn'],
  'Thai Drama': ['Thai Drama', 'Thai', 'Thai Lakorn', 'Lakorn'],
  'Lakorn': ['Lakorn', 'Thai Drama', 'Thai', 'Soap Opera'],
  
  // Philippine Drama specific
  'Filipino': ['Filipino', 'Philippine', 'Philippine Drama', 'Teleserye'],
  'Teleserye': ['Teleserye', 'Philippine Drama', 'Filipino Drama'],
  
  // Indonesian Drama specific
  'Indonesian': ['Indonesian', 'Indonesian Drama', 'Sinetron'],
  'Sinetron': ['Sinetron', 'Indonesian Drama', 'Indonesian'],
  
  // Vietnamese Drama specific
  'Vietnamese': ['Vietnamese', 'Vietnamese Drama', 'V-Drama'],
  
  // Other specific genres
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

// Country/Region to Kuryana region mapping (expanded)
const COUNTRY_REGION_MAP: Record<string, string> = {
  // East Asia
  'KR': 'Korea',
  'JP': 'Japan',
  'CN': 'China',
  'TW': 'Taiwan',
  'HK': 'Hong Kong',
  'MO': 'Macau',
  
  // Southeast Asia
  'TH': 'Thailand',
  'ID': 'Indonesia',
  'PH': 'Philippines',
  'MY': 'Malaysia',
  'SG': 'Singapore',
  'VN': 'Vietnam',
  'MM': 'Myanmar',
  'KH': 'Cambodia',
  'LA': 'Laos',
  'BN': 'Brunei',
  'TL': 'Timor-Leste',
  
  // South Asia
  'IN': 'India',
  'PK': 'Pakistan',
  'BD': 'Bangladesh',
  'LK': 'Sri Lanka',
  'NP': 'Nepal',
  'BT': 'Bhutan',
  'MV': 'Maldives',
  
  // Western
  'US': 'United States',
  'GB': 'United Kingdom',
  'CA': 'Canada',
  'AU': 'Australia',
  'NZ': 'New Zealand',
  'NG': 'Nigeria',
  'ZA': 'South Africa',
  
  // Europe
  'FR': 'France',
  'DE': 'Germany',
  'IT': 'Italy',
  'ES': 'Spain',
  'PT': 'Portugal',
  'NL': 'Netherlands',
  'BE': 'Belgium',
  'CH': 'Switzerland',
  'AT': 'Austria',
  'SE': 'Sweden',
  'NO': 'Norway',
  'DK': 'Denmark',
  'FI': 'Finland',
  'RU': 'Russia',
  
  // Latin America
  'BR': 'Brazil',
  'MX': 'Mexico',
  'AR': 'Argentina',
  'CL': 'Chile',
  'CO': 'Colombia',
  'PE': 'Peru',
};

export class KuryanaMetadataAdapter {
  readonly name = 'Kuryana';
  readonly id = 'kuryana';
  readonly priority = 2;
  readonly enabled = true;

  /**
   * Search for movies or TV shows with filter support.
   * Kuryana primarily handles Asian dramas/TV series content.
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
    includeAdult?: boolean;
    sortBy?: string;
    language?: string;
    watchRegion?: string;
    extended?: string;
  }): Promise<IMetadataResult[]> {
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

    try {
      // Kuryana only supports text search
      const results = await kuryanaApiService.searchDramas(query);

      // Map to IMetadataResult
      let mapped = results.slice(0, Math.min(limit + 20, 50)).map((item: KuryanaDrama) =>
        this.mapKuryanaDrama(item)
      );

      // Apply filters client-side since Kuryana doesn't support them natively
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

      // Sort results
      mapped = this.sortResults(mapped, sortBy);

      return mapped.slice(0, limit);
    } catch (error) {
      console.error('[KuryanaMetadataAdapter] Search failed:', error);
      return [];
    }
  }

  /**
   * DISCOVER - Category browsing without a keyword.
   * Kuryana doesn't have a native discover endpoint, so we use
   * trending and seasonal endpoints as alternatives.
   */
  async discover(filters: DiscoverFilters, limit: number = 20): Promise<IMetadataResult[]> {
    try {
      const results: IMetadataResult[] = [];

      // Try to get trending dramas
      try {
        const trending = await kuryanaApiService.getTrendingDramas();
        const mapped = trending.slice(0, 30).map((item: KuryanaDrama) =>
          this.mapKuryanaDrama(item)
        );
        results.push(...mapped);
      } catch (error) {
        console.error('[KuryanaMetadataAdapter] Trending failed:', error);
      }

      // Try to get popular dramas
      try {
        const popular = await kuryanaApiService.getPopularDramas();
        const mapped = popular.slice(0, 30).map((item: KuryanaDrama) =>
          this.mapKuryanaDrama(item)
        );
        results.push(...mapped);
      } catch (error) {
        console.error('[KuryanaMetadataAdapter] Popular failed:', error);
      }

      // Try seasonal dramas if year is specified
      if (filters.year || filters.startYear) {
        const year = filters.year || filters.startYear || new Date().getFullYear();
        for (const quarter of [1, 2, 3, 4]) {
          try {
            const seasonal = await kuryanaApiService.getSeasonalDramas(year, quarter);
            const mapped = seasonal.slice(0, 15).map((item: KuryanaDrama) =>
              this.mapKuryanaDrama(item)
            );
            results.push(...mapped);
          } catch (error) {
            // Silently continue
          }
        }
      }

      // Apply filters
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

      // Deduplicate by ID
      const seen = new Set<string>();
      filtered = filtered.filter(item => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });

      // Sort and limit
      filtered = this.sortResults(filtered, filters.sortBy || 'popularity.desc');
      return filtered.slice(0, limit);
    } catch (error) {
      console.error('[KuryanaMetadataAdapter] Discover failed:', error);
      return [];
    }
  }

  /**
   * Get metadata by ID (slug).
   */
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

  /**
   * Get trending content.
   * Kuryana only has trending dramas.
   */
  async getTrending(limit: number = 20): Promise<IMetadataResult[]> {
    try {
      const results = await kuryanaApiService.getTrendingDramas();
      return results.slice(0, limit).map((item: KuryanaDrama) =>
        this.mapKuryanaDrama(item)
      );
    } catch (error) {
      console.error('[KuryanaMetadataAdapter] GetTrending failed:', error);
      return [];
    }
  }

  /**
   * Get trending content by category.
   * Maps categories to Kuryana's genre/country filtering.
   */
  async getTrendingByCategory(category: string, limit: number = 20, region?: string): Promise<IMetadataResult[]> {
    try {
      // Map category to Kuryana filters
      const categoryMap: Record<string, { genres?: string[]; countries?: string[]; query?: string }> = {
        // Standard categories
        'movies': { query: 'movie' },
        'tv': { query: 'drama' },
        
        // Asian drama specific categories
        'wuxia': { genres: ['Wuxia', 'Martial Arts', 'Swordplay'] },
        'xianxia': { genres: ['Xianxia', 'Cultivation', 'Celestial'] },
        'xuanhuan': { genres: ['Xuanhuan', 'Mythological', 'Eastern Fantasy'] },
        'historical': { genres: ['Historical', 'Period', 'Costume', 'Sageuk'] },
        'period': { genres: ['Period', 'Historical', 'Costume', 'Sageuk'] },
        'costume': { genres: ['Costume', 'Historical', 'Period', 'Sageuk'] },
        'martial arts': { genres: ['Martial Arts', 'Wuxia', 'Kung Fu'] },
        'sageuk': { genres: ['Sageuk', 'Historical', 'Period', 'Korean Historical'] },
        'joseon': { genres: ['Joseon', 'Sageuk', 'Historical', 'Korean Period'] },
        'goryeo': { genres: ['Goryeo', 'Sageuk', 'Historical', 'Korean Period'] },
        
        // Anime related
        'anime': { genres: ['Animation', 'Anime'] },
        
        // Country/Region specific
        'k-drama': { countries: ['Korea'], genres: ['K-Drama', 'Korean Drama'] },
        'j-drama': { countries: ['Japan'], genres: ['J-Drama', 'Japanese Drama'] },
        'c-drama': { countries: ['China'], genres: ['C-Drama', 'Chinese Drama'] },
        't-drama': { countries: ['Taiwan'], genres: ['T-Drama', 'Taiwanese Drama'] },
        'thai': { countries: ['Thailand'], genres: ['Thai Drama', 'Lakorn'] },
        'indonesian': { countries: ['Indonesia'], genres: ['Indonesian Drama', 'Sinetron'] },
        'filipino': { countries: ['Philippines'], genres: ['Philippine Drama', 'Teleserye'] },
        'vietnamese': { countries: ['Vietnam'], genres: ['Vietnamese Drama'] },
        
        // Bollywood related
        'bollywood': { countries: ['India'], genres: ['Bollywood', 'Indian'] },
        'hollywood': { countries: ['United States'], genres: ['Drama'] },
        'nollywood': { countries: ['Nigeria'], genres: ['Drama'] },
        
        // Genre specific
        'rom-com': { genres: ['Romantic Comedy', 'Rom-Com'] },
        'romance': { genres: ['Romance', 'Romantic Drama'] },
        'melodrama': { genres: ['Melodrama', 'Drama'] },
        'thriller': { genres: ['Thriller', 'Suspense'] },
        'action': { genres: ['Action', 'Martial Arts'] },
        'fantasy': { genres: ['Fantasy', 'Xianxia', 'Wuxia'] },
        'supernatural': { genres: ['Supernatural', 'Ghost', 'Paranormal'] },
        'mystery': { genres: ['Mystery', 'Suspense'] },
        'crime': { genres: ['Crime', 'Detective', 'Police'] },
        'medical': { genres: ['Medical', 'Hospital', 'Doctor'] },
        'legal': { genres: ['Legal', 'Law', 'Court'] },
        'political': { genres: ['Political', 'Political Drama'] },
        'slice of life': { genres: ['Slice of Life', 'Life', 'Everyday'] },
        'school': { genres: ['School', 'High School', 'Youth'] },
        'youth': { genres: ['Youth', 'Coming of Age', 'School'] },
        'coming of age': { genres: ['Coming of Age', 'Youth', 'Teen'] },
        'food': { genres: ['Food', 'Culinary', 'Cooking'] },
        'music': { genres: ['Music', 'Musical', 'K-Pop'] },
        'sports': { genres: ['Sports', 'Athletic'] },
        'revenge': { genres: ['Revenge', 'Vengeance'] },
        'time travel': { genres: ['Time Travel', 'Time Slip'] },
        'adaptation': { genres: ['Adaptation', 'Webtoon', 'Manhwa', 'Manga'] },
        'webtoon': { genres: ['Webtoon', 'Webcomic', 'Adaptation'] },
        'manhwa': { genres: ['Manhwa', 'Webtoon', 'Adaptation'] },
        'manga': { genres: ['Manga', 'Adaptation', 'Anime'] },
        'idol': { genres: ['Idol', 'K-Pop', 'Music'] },
        'bl': { genres: ['BL', 'Boys Love', 'LGBT'] },
        'gl': { genres: ['GL', 'Girls Love', 'LGBT'] },
        'lgbt': { genres: ['LGBT', 'BL', 'GL', 'Queer'] },
        
        // Combined categories
        'korean': { countries: ['Korea'], genres: ['K-Drama', 'Korean Drama'] },
        'japanese': { countries: ['Japan'], genres: ['J-Drama', 'Japanese Drama'] },
        'chinese': { countries: ['China'], genres: ['C-Drama', 'Chinese Drama'] },
        'taiwanese': { countries: ['Taiwan'], genres: ['T-Drama', 'Taiwanese Drama'] },
      };

      const config = categoryMap[category.toLowerCase()] || { query: category };

      // Get trending as base
      const trending = await kuryanaApiService.getTrendingDramas();
      
      // Filter by category
      let filtered = trending;

      // Filter by country if specified
      if (config.countries && config.countries.length > 0) {
        filtered = filtered.filter((item: KuryanaDrama) => {
          const country = item.country || '';
          return config.countries!.some(c => 
            country.toLowerCase().includes(c.toLowerCase())
          );
        });
      }

      // Filter by genre if specified
      if (config.genres && config.genres.length > 0) {
        filtered = filtered.filter((item: KuryanaDrama) => {
          const genres = item.genres || [];
          return config.genres!.some(g => 
            genres.some((ig: string) => 
              ig.toLowerCase().includes(g.toLowerCase())
            )
          );
        });
      }

      // Filter by region if specified
      if (region) {
        const regionName = COUNTRY_REGION_MAP[region.toUpperCase()] || region;
        filtered = filtered.filter((item: KuryanaDrama) => {
          const country = item.country || '';
          return country.toLowerCase().includes(regionName.toLowerCase());
        });
      }

      // Map to IMetadataResult
      return filtered.slice(0, limit).map((item: KuryanaDrama) =>
        this.mapKuryanaDrama(item)
      );
    } catch (error) {
      console.error('[KuryanaMetadataAdapter] GetTrendingByCategory failed:', error);
      return [];
    }
  }

  /**
   * Get popular dramas.
   */
  async getPopular(limit: number = 20): Promise<IMetadataResult[]> {
    try {
      const results = await kuryanaApiService.getPopularDramas();
      return results.slice(0, limit).map((item: KuryanaDrama) =>
        this.mapKuryanaDrama(item)
      );
    } catch (error) {
      console.error('[KuryanaMetadataAdapter] GetPopular failed:', error);
      return [];
    }
  }

  /**
   * Get seasonal dramas by year and quarter.
   */
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
   * Get drama reviews.
   */
  async getReviews(slug: string, limit: number = 20): Promise<any[]> {
    try {
      const results = await kuryanaApiService.getDramaReviews(slug);
      return results.slice(0, limit);
    } catch (error) {
      console.error('[KuryanaMetadataAdapter] GetReviews failed:', error);
      return [];
    }
  }

  /**
   * Get drama recommendations.
   */
  async getRecommendations(slug: string, limit: number = 20): Promise<IMetadataResult[]> {
    try {
      const results = await kuryanaApiService.getDramaRecommendations(slug);
      return results.slice(0, limit).map((item: any) => ({
        id: item.id?.toString() || '',
        title: item.title || '',
        type: 'tv' as const,
        poster: item.poster || undefined,
        rating: item.rating || 0,
        year: undefined,
        source: 'kuryana',
      }));
    } catch (error) {
      console.error('[KuryanaMetadataAdapter] GetRecommendations failed:', error);
      return [];
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PRIVATE FILTER HELPERS
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Apply filters client-side since Kuryana doesn't support them natively.
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

    // Filter by country using name matching (Kuryana uses country names)
    if (filters.region) {
      const regionName = COUNTRY_REGION_MAP[filters.region.toUpperCase()] || filters.region;
      filtered = filtered.filter(item => {
        const country = (item as any).countryName || '';
        return country.toLowerCase().includes(regionName.toLowerCase());
      });
    }

    // Filter by certification
    if (filters.certifications && filters.certifications.length > 0) {
      filtered = filtered.filter(item => 
        item.certification && filters.certifications.includes(item.certification)
      );
    }

    // Filter by genre - uses the complete genre mapping
    if (filters.genres && filters.genres.length > 0) {
      filtered = filtered.filter(item => {
        const genres = item.genres || [];
        // Map our genre to Kuryana genre equivalents
        const mappedGenres: string[] = [];
        for (const g of filters.genres) {
          const mapped = KURYANA_GENRE_MAP[g] || [g];
          mappedGenres.push(...mapped);
        }
        return genres.some(g => 
          mappedGenres.some(mg => g.toLowerCase().includes(mg.toLowerCase()))
        );
      });
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
      filtered = filtered.filter(item => {
        const title = item.title || '';
        const overview = item.overview || '';
        const keywords = (item as any).keywords || [];
        const searchText = `${title} ${overview} ${keywords.join(' ')}`.toLowerCase();
        return filters.keywords.some((k: string) => searchText.includes(k.toLowerCase()));
      });
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

  // ──────────────────────────────────────────────────────────────────────────
  // PRIVATE MAPPING HELPERS
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Map Kuryana drama to IMetadataResult.
   */
  private mapKuryanaDrama(item: KuryanaDrama): IMetadataResult {
    return {
      id: item.id?.toString() || item.slug || '',
      title: item.title || '',
      type: 'tv', // Kuryana only has dramas/TV series
      year: item.year || undefined,
      poster: item.poster || undefined,
      backdrop: item.backdrop || undefined,
      overview: item.synopsis || '',
      rating: item.rating || 0,
      genres: item.genres || [],
      runtime: item.duration ? parseInt(item.duration) : undefined,
      source: 'kuryana',
      
      // Enhanced fields - Kuryana provides limited metadata
      originalLanguage: undefined, // Kuryana doesn't provide this
      originCountry: item.country ? [item.country] : [],
      originalTitle: item.title || '',
      popularity: 0, // Kuryana doesn't provide this
      voteCount: 0, // Kuryana doesn't provide this
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
      spokenLanguages: undefined,
      productionCompanies: undefined,
      productionCountries: item.country ? [{ iso3166_1: item.country, name: item.country }] : [],
      numberOfSeasons: undefined,
      numberOfEpisodes: item.totalEpisodes || undefined,
      lastAirDate: undefined,
      inProduction: false,
      // Store extra data for debugging
      providerData: {
        slug: item.slug,
        totalEpisodes: item.totalEpisodes,
        cast: item.cast,
      },
    };
  }

  /**
   * Clear all resources.
   */
  destroy(): void {
    console.log('[KuryanaMetadataAdapter] Destroyed');
  }
}

export default KuryanaMetadataAdapter;