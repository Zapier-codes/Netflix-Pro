/**
 * ConsumetMetadataAdapter - Uses ONLY the local ConsumetMetadata service
 * wrapper (never reaches into src/api/* directly), matching the exact
 * routing pattern used by KuryanaMetadataAdapter:
 *
 *   adapter -> local metadata wrapper (../ConsumetMetadata) -> raw provider
 *
 * Covers: movie, tv, and anime search/discover via Consumet providers.
 */

import { IMetadataResult, DiscoverFilters } from '../../types/MetadataTypes';
import { consumetMetadataService, ConsumetContent } from '../ConsumetMetadata';

const CONSUMET_GENRE_MAP: Record<string, string[]> = {
  'Action': ['Action'],
  'Adventure': ['Adventure'],
  'Animation': ['Animation', 'Anime'],
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
};

// Literal union pulled straight from IMetadataResult['status'] so this file
// stays a single source of truth for "what counts as a valid status".
type MetadataStatus = NonNullable<IMetadataResult['status']>;

// Maps arbitrary/free-text status strings coming out of Consumet scraping
// providers (movie sites, anime sites, etc.) onto the strict literal union
// IMetadataResult expects. Keys are lowercase, trimmed, punctuation-normalized.
const STATUS_MAP: Record<string, MetadataStatus> = {
  // Released / finished
  'released': 'Released',
  'complete': 'Released',
  'completed': 'Released',
  'finished': 'Released',
  'finished airing': 'Released',
  'movie': 'Released',
  'done': 'Released',

  // Production pipeline
  'post production': 'Post Production',
  'post-production': 'Post Production',
  'in production': 'In Production',
  'production': 'In Production',

  // Ongoing / airing
  'ongoing': 'Returning Series',
  'airing': 'Returning Series',
  'currently airing': 'Returning Series',
  'releasing': 'Returning Series',
  'returning series': 'Returning Series',

  // Upcoming
  'planned': 'Planned',
  'not yet aired': 'Planned',
  'upcoming': 'Planned',
  'tba': 'Planned',
  'to be announced': 'Planned',

  // Cancelled / halted
  'canceled': 'Canceled',
  'cancelled': 'Canceled',
  'hiatus': 'Canceled',
  'discontinued': 'Canceled',

  // Ended
  'ended': 'Ended',

  // Pilot
  'pilot': 'Pilot',
};

export class ConsumetMetadataAdapter {
  readonly name = 'Consumet';
  readonly id = 'consumet';
  readonly priority = 5;
  readonly enabled = true;

  async search(options: {
    query?: string;
    type?: 'movie' | 'tv' | 'anime';
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
        type: (type as DiscoverFilters['type']) || 'all',
        limit,
      });
    }

    try {
      const results = await consumetMetadataService.searchContent(
        query,
        type || 'all',
        Math.min(limit + 20, 50)
      );
      let mapped = results.map((item: ConsumetContent) => this.mapConsumetContent(item));
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
      console.error('[ConsumetMetadataAdapter] Search failed:', error);
      return [];
    }
  }

  async discover(filters: DiscoverFilters, limit: number = 20): Promise<IMetadataResult[]> {
    // FIXED: Use literal type instead of string default
    const sortBy = filters.sortBy || 'popularity.desc';

    try {
      const type: 'movie' | 'tv' | 'anime' | 'all' =
        filters.type === 'movie' || filters.type === 'tv' || (filters.type as any) === 'anime'
          ? (filters.type as 'movie' | 'tv' | 'anime')
          : 'all';

      const results = await consumetMetadataService.getRecent(type, Math.min(limit * 3, 60));
      let mapped = results.map((item: ConsumetContent) => this.mapConsumetContent(item));

      mapped = this.applyFilters(mapped, {
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
      mapped = mapped.filter((item: IMetadataResult) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });

      mapped = this.sortResults(mapped, sortBy);
      return mapped.slice(0, limit);
    } catch (error) {
      console.error('[ConsumetMetadataAdapter] Discover failed:', error);
      return [];
    }
  }

  async getById(id: string, type: 'movie' | 'tv'): Promise<IMetadataResult | null> {
    try {
      const item = await consumetMetadataService.getDetails(id, type);
      if (!item) return null;
      return this.mapConsumetContent(item);
    } catch (error) {
      console.error(`[ConsumetMetadataAdapter] Get by ID ${id} failed:`, error);
      return null;
    }
  }

  /**
   * Get anime metadata by ID (Consumet-specific, since IMetadataResult's
   * getById only distinguishes movie/tv).
   */
  async getAnimeById(id: string): Promise<IMetadataResult | null> {
    try {
      const item = await consumetMetadataService.getDetails(id, 'anime');
      if (!item) return null;
      return this.mapConsumetContent(item);
    } catch (error) {
      console.error(`[ConsumetMetadataAdapter] GetAnimeById failed for ${id}:`, error);
      return null;
    }
  }

  private applyFilters(results: IMetadataResult[], filters: any): IMetadataResult[] {
    let filtered: IMetadataResult[] = [...results];

    if (filters.languages && filters.languages.length > 0) {
      filtered = filtered.filter(
        (item: IMetadataResult) =>
          item.originalLanguage && filters.languages.includes(item.originalLanguage)
      );
    }

    if (filters.countries && filters.countries.length > 0) {
      filtered = filtered.filter(
        (item: IMetadataResult) =>
          item.originCountry && item.originCountry.some((c: string) => filters.countries.includes(c))
      );
    }

    if (filters.certifications && filters.certifications.length > 0) {
      filtered = filtered.filter(
        (item: IMetadataResult) =>
          item.certification && filters.certifications.includes(item.certification)
      );
    }

    if (filters.genres && filters.genres.length > 0) {
      filtered = filtered.filter((item: IMetadataResult) => {
        const genres = item.genres || [];
        const mappedGenres: string[] = [];
        for (const g of filters.genres) {
          const mapped = CONSUMET_GENRE_MAP[g] || [g];
          mappedGenres.push(...mapped);
        }
        return genres.some((g: string) =>
          mappedGenres.some((mg: string) => g.toLowerCase().includes(mg.toLowerCase()))
        );
      });
    }

    if (filters.minRating !== undefined) {
      filtered = filtered.filter((item: IMetadataResult) => (item.rating || 0) >= filters.minRating);
    }

    if (filters.maxRating !== undefined) {
      filtered = filtered.filter((item: IMetadataResult) => (item.rating || 0) <= filters.maxRating);
    }

    if (filters.year) {
      filtered = filtered.filter((item: IMetadataResult) => item.year === filters.year);
    }

    if (filters.startYear !== undefined) {
      filtered = filtered.filter((item: IMetadataResult) => (item.year || 0) >= filters.startYear);
    }

    if (filters.endYear !== undefined) {
      filtered = filtered.filter((item: IMetadataResult) => (item.year || 0) <= filters.endYear);
    }

    if (filters.keywords && filters.keywords.length > 0) {
      filtered = filtered.filter((item: IMetadataResult) => {
        const title = item.title || '';
        const overview = item.overview || '';
        const keywords = (item as any).keywords || [];
        const searchText = `${title} ${overview} ${keywords.join(' ')}`.toLowerCase();
        return filters.keywords.some((k: string) => searchText.includes(k.toLowerCase()));
      });
    }

    if (filters.includeAdult === false) {
      filtered = filtered.filter((item: IMetadataResult) => !(item as any).adult);
    }

    return filtered;
  }

  private sortResults(results: IMetadataResult[], sortBy: string): IMetadataResult[] {
    const sorted: IMetadataResult[] = [...results];

    switch (sortBy) {
      case 'popularity.desc':
        return sorted.sort((a: IMetadataResult, b: IMetadataResult) => (b.popularity || 0) - (a.popularity || 0));
      case 'popularity.asc':
        return sorted.sort((a: IMetadataResult, b: IMetadataResult) => (a.popularity || 0) - (b.popularity || 0));
      case 'release_date.desc':
        return sorted.sort((a: IMetadataResult, b: IMetadataResult) => {
          const dateA = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
          const dateB = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
          return dateB - dateA;
        });
      case 'release_date.asc':
        return sorted.sort((a: IMetadataResult, b: IMetadataResult) => {
          const dateA = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
          const dateB = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
          return dateA - dateB;
        });
      case 'vote_average.desc':
        return sorted.sort((a: IMetadataResult, b: IMetadataResult) => (b.rating || 0) - (a.rating || 0));
      case 'vote_average.asc':
        return sorted.sort((a: IMetadataResult, b: IMetadataResult) => (a.rating || 0) - (b.rating || 0));
      case 'vote_count.desc':
        return sorted.sort((a: IMetadataResult, b: IMetadataResult) => (b.voteCount || 0) - (a.voteCount || 0));
      case 'vote_count.asc':
        return sorted.sort((a: IMetadataResult, b: IMetadataResult) => (a.voteCount || 0) - (b.voteCount || 0));
      default:
        return sorted.sort((a: IMetadataResult, b: IMetadataResult) => (b.popularity || 0) - (a.popularity || 0));
    }
  }

  private mapConsumetContent(item: ConsumetContent): IMetadataResult {
    return {
      id: item.id || '',
      title: item.title || '',
      type: item.type === 'anime' ? 'tv' : item.type,
      year: this.extractYear(item.releaseDate),
      poster: item.poster || undefined,
      backdrop: item.backdrop || undefined,
      overview: item.overview || '',
      rating: item.rating || 0,
      genres: item.genres || [],
      runtime: item.runtime ? parseInt(item.runtime.toString()) : undefined,
      source: 'consumet',
      originalLanguage: undefined,
      originCountry: [],
      originalTitle: item.title || '',
      popularity: 0,
      voteCount: 0,
      cast: (item.cast || []).map((c) => ({
        character: c.role || '',
        person: {
          name: c.name,
          ids: {},
        },
      })),
      certification: undefined,
      tagline: undefined,
      status: this.normalizeStatus(item.status),
      keywords: [],
      belongsToCollection: undefined,
      watchProviders: undefined,
      budget: undefined,
      revenue: undefined,
      networks: undefined,
      spokenLanguages: undefined,
      productionCompanies: undefined,
      productionCountries: [],
      numberOfSeasons: item.seasons || undefined,
      numberOfEpisodes: item.episodes || undefined,
      lastAirDate: undefined,
      inProduction: false,
      providerData: {
        contentType: item.type,
      },
    };
  }

  /**
   * Normalizes the free-text status string returned by Consumet scraping
   * providers (e.g. "Ongoing", "Completed", "Currently Airing", "TBA") into
   * the strict literal union IMetadataResult['status'] requires. Falls back
   * to undefined for anything unrecognized rather than widening the type.
   */
  private normalizeStatus(status?: string): MetadataStatus | undefined {
    if (!status) return undefined;

    const normalized = status
      .trim()
      .toLowerCase()
      .replace(/[_]+/g, ' ')
      .replace(/\s+/g, ' ');

    return STATUS_MAP[normalized];
  }

  private extractYear(dateString?: string): number | undefined {
    if (!dateString) return undefined;
    const match = dateString.match(/^(\d{4})/);
    return match ? parseInt(match[1]) : undefined;
  }

  destroy(): void {
    console.log('[ConsumetMetadataAdapter] Destroyed');
  }
}

export default ConsumetMetadataAdapter;