/**
 * KuryanaMetadataAdapter - Uses ONLY real Kuryana endpoints:
 *   /search/q/{query}
 *   /id/{slug}
 *   /id/{slug}/reviews
 *   /id/{slug}/cast
 *   /id/{slug}/episodes
 *   /seasonal/{year}/{quarter}
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

    // FIXED: Use literal type instead of string default
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
    // FIXED: Use literal type instead of string default
    const sortBy = filters.sortBy || 'popularity.desc';

    try {
      const results: IMetadataResult[] = [];
      const currentYear = new Date().getFullYear();

      for (const year of [currentYear, currentYear - 1]) {
        for (const quarter of [1, 2, 3, 4]) {
          try {
            const seasonal = await kuryanaApiService.getSeasonalDramas(year, quarter);
            const mapped = seasonal.slice(0, 10).map((item: KuryanaDrama) =>
              this.mapKuryanaDrama(item)
            );
            results.push(...mapped);
          } catch {
            // Silently continue
          }
        }
      }

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

      const seen = new Set<string>();
      filtered = filtered.filter(item => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });

      filtered = this.sortResults(filtered, sortBy);
      return filtered.slice(0, limit);
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

  private applyFilters(results: IMetadataResult[], filters: any): IMetadataResult[] {
    let filtered = [...results];

    if (filters.languages && filters.languages.length > 0) {
      filtered = filtered.filter(item =>
        item.originalLanguage && filters.languages.includes(item.originalLanguage)
      );
    }

    if (filters.countries && filters.countries.length > 0) {
      filtered = filtered.filter(item =>
        item.originCountry && item.originCountry.some((c: string) => filters.countries.includes(c))
      );
    }

    if (filters.region) {
      const regionName = COUNTRY_REGION_MAP[filters.region.toUpperCase()] || filters.region;
      filtered = filtered.filter(item => {
        const country = (item as any).countryName || '';
        return country.toLowerCase().includes(regionName.toLowerCase());
      });
    }

    if (filters.certifications && filters.certifications.length > 0) {
      filtered = filtered.filter(item =>
        item.certification && filters.certifications.includes(item.certification)
      );
    }

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
      filtered = filtered.filter(item => {
        const title = item.title || '';
        const overview = item.overview || '';
        const keywords = (item as any).keywords || [];
        const searchText = `${title} ${overview} ${keywords.join(' ')}`.toLowerCase();
        return filters.keywords.some((k: string) => searchText.includes(k.toLowerCase()));
      });
    }

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

  private mapKuryanaDrama(item: KuryanaDrama): IMetadataResult {
    return {
      id: item.id?.toString() || item.slug || '',
      title: item.title || '',
      type: 'tv',
      year: item.year || undefined,
      poster: item.poster || undefined,
      backdrop: item.backdrop || undefined,
      overview: item.synopsis || '',
      rating: item.rating || 0,
      genres: item.genres || [],
      runtime: item.duration ? parseInt(item.duration) : undefined,
      source: 'kuryana',
      originalLanguage: undefined,
      originCountry: item.country ? [item.country] : [],
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
      spokenLanguages: undefined,
      productionCompanies: undefined,
      productionCountries: item.country ? [{ iso3166_1: item.country, name: item.country }] : [],
      numberOfSeasons: undefined,
      numberOfEpisodes: item.totalEpisodes || undefined,
      lastAirDate: undefined,
      inProduction: false,
      providerData: {
        slug: item.slug,
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