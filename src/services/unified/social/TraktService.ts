/**
 * TraktService.ts
 * Unified social/activity layer for Trakt.tv public API (no auth required)
 * Integrates: trending, popular, played, watched, collected, anticipated,
 * box office, updates, calendars, certifications, genres, networks, countries,
 * languages, search, movie details, show details, season details, episode details,
 * people, comments, lists, and related endpoints.
 */

const TRAKT_API_BASE = 'https://api.trakt.tv';
const TRAKT_API_VERSION = '2';

// Default headers for every request
function getHeaders(clientId: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'trakt-api-version': TRAKT_API_VERSION,
    'trakt-api-key': clientId,
  };
}

// Generic fetch wrapper with error handling
async function traktFetch<T>(
  endpoint: string,
  clientId: string,
  params?: Record<string, string | number | boolean | undefined>
): Promise<T> {
  const url = new URL(`${TRAKT_API_BASE}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: getHeaders(clientId),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Trakt API error ${response.status}: ${errorText}`);
  }

  return response.json() as Promise<T>;
}

// ==================== TYPES ====================

export interface TraktIds {
  trakt?: number;
  slug?: string;
  imdb?: string;
  tmdb?: number;
  tvdb?: number;
  tvrage?: number;
}

export interface TraktMovie {
  title: string;
  year: number;
  ids: TraktIds;
}

export interface TraktShow {
  title: string;
  year: number;
  ids: TraktIds;
}

export interface TraktSeason {
  number: number;
  ids: TraktIds;
}

export interface TraktEpisode {
  season: number;
  number: number;
  title: string;
  ids: TraktIds;
}

export interface TraktPerson {
  name: string;
  ids: TraktIds;
}

export interface TraktUser {
  username: string;
  private: boolean;
  name: string;
  vip: boolean;
  vip_ep: boolean;
  ids: { slug: string };
}

export interface TraktComment {
  id: number;
  parent_id: number;
  created_at: string;
  updated_at: string;
  comment: string;
  spoiler: boolean;
  review: boolean;
  replies: number;
  likes: number;
  user_rating: number | null;
  user: TraktUser;
}

export interface TraktList {
  name: string;
  description: string;
  privacy: 'private' | 'public' | 'friends';
  type: 'personal' | 'official' | 'watchlists';
  display_numbers: boolean;
  allow_comments: boolean;
  sort_by: string;
  sort_how: string;
  created_at: string;
  updated_at: string;
  item_count: number;
  comment_count: number;
  likes: number;
  ids: TraktIds;
  user: TraktUser;
}

export interface TraktCertification {
  name: string;
  slug: string;
  description: string;
}

export interface TraktGenre {
  name: string;
  slug: string;
}

export interface TraktNetwork {
  name: string;
}

export interface TraktCountry {
  name: string;
  code: string;
}

export interface TraktLanguage {
  name: string;
  code: string;
}

export interface TraktImageSet {
  fanart?: string[];
  poster?: string[];
  logo?: string[];
  clearart?: string[];
  banner?: string[];
  thumb?: string[];
  screenshot?: string[];
  headshot?: string[];
}

export interface TraktMovieExtended extends TraktMovie {
  tagline?: string;
  overview?: string;
  released?: string;
  runtime?: number;
  country?: string;
  trailer?: string;
  homepage?: string;
  status?: string;
  rating?: number;
  votes?: number;
  comment_count?: number;
  language?: string;
  available_translations?: string[];
  genres?: string[];
  certification?: string;
  images?: TraktImageSet;
}

export interface TraktShowExtended extends TraktShow {
  overview?: string;
  first_aired?: string;
  airs?: { day: string; time: string; timezone: string };
  runtime?: number;
  certification?: string;
  network?: string;
  country?: string;
  trailer?: string;
  homepage?: string;
  status?: string;
  rating?: number;
  votes?: number;
  comment_count?: number;
  language?: string;
  available_translations?: string[];
  genres?: string[];
  aired_episodes?: number;
  images?: TraktImageSet;
}

export interface TraktSeasonExtended extends TraktSeason {
  rating?: number;
  votes?: number;
  episode_count?: number;
  aired_episodes?: number;
  title?: string;
  overview?: string;
  first_aired?: string;
  network?: string;
  images?: TraktImageSet;
}

export interface TraktEpisodeExtended extends TraktEpisode {
  overview?: string;
  rating?: number;
  votes?: number;
  first_aired?: string;
  comment_count?: number;
  available_translations?: string[];
  runtime?: number;
  images?: TraktImageSet;
}

export interface TraktPersonExtended extends TraktPerson {
  biography?: string;
  birthday?: string;
  death?: string | null;
  birthplace?: string;
  homepage?: string;
  gender?: string;
  known_for_department?: string;
  images?: TraktImageSet;
}

export interface TraktAlias {
  title: string;
  country: string;
}

export interface TraktRelease {
  country: string;
  certification?: string;
  release_date: string;
  note?: string;
  release_type?: string;
}

export interface TraktTranslation {
  title: string;
  overview: string;
  tagline?: string;
  language: string;
}

export interface TraktRating {
  rating: number;
  votes: number;
  distribution?: Record<string, number>;
}

export interface TraktStats {
  watchers: number;
  plays: number;
  collectors: number;
  comments: number;
  lists: number;
  votes: number;
}

export interface TraktCastMember {
  character?: string;
  characters?: string[];
  person: TraktPerson;
  episode_count?: number;
}

export interface TraktCrewMember {
  job?: string;
  jobs?: string[];
  person: TraktPerson;
  episode_count?: number;
}

export interface TraktPeople {
  cast?: TraktCastMember[];
  crew?: Record<string, TraktCrewMember[]>;
}

export interface TraktTrendingMovie {
  watchers: number;
  movie: TraktMovie;
}

export interface TraktTrendingShow {
  watchers: number;
  show: TraktShow;
}

export interface TraktPlayedItem {
  watcher_count: number;
  play_count: number;
  collected_count: number;
  collector_count: number;
  movie?: TraktMovie;
  show?: TraktShow;
}

export interface TraktAnticipatedItem {
  list_count: number;
  movie?: TraktMovie;
  show?: TraktShow;
}

export interface TraktBoxOfficeItem {
  revenue: number;
  movie: TraktMovie;
}

export interface TraktCalendarItem {
  first_aired?: string;
  episode?: TraktEpisode;
  show?: TraktShow;
  released?: string;
  movie?: TraktMovie;
}

export interface TraktSearchResult {
  type: 'movie' | 'show' | 'episode' | 'person' | 'list';
  score: number;
  movie?: TraktMovie;
  show?: TraktShow;
  episode?: TraktEpisode;
  person?: TraktPerson;
  list?: TraktList;
}

export interface TraktWatchNowItem {
  source: string;
  link: string;
  type: string;
  price?: number;
  currency?: string;
  quality?: string;
}

export type Period = 'weekly' | 'monthly' | 'yearly' | 'all';
export type SortType = 'newest' | 'oldest' | 'likes' | 'replies';
export type ListType = 'personal' | 'official' | 'watchlists';
export type ListSort = 'popular' | 'likes' | 'comments' | 'items' | 'added' | 'updated';
export type MediaType = 'movies' | 'shows' | 'seasons' | 'episodes' | 'persons' | 'lists';
export type SearchType = 'movie' | 'show' | 'episode' | 'person' | 'list';
export type IdType = 'trakt' | 'imdb' | 'tmdb' | 'tvdb' | 'tvrage';

// ==================== SERVICE CLASS ====================

export class TraktService {
  private clientId: string;

  constructor(clientId: string) {
    if (!clientId) {
      console.warn('[TraktService] ⚠️ No clientId provided. Trakt features will not work.');
    }
    this.clientId = clientId || '';
  }

  /**
   * Check if the service is properly configured
   */
  private isConfigured(): boolean {
    return !!this.clientId && this.clientId.length > 0;
  }

  /**
   * Ensure the service is configured before making requests
   */
  private ensureConfigured(): void {
    if (!this.isConfigured()) {
      throw new Error('[TraktService] ❌ Client ID not configured. Set EXPO_PUBLIC_TRAKT_CLIENT_ID in your .env file.');
    }
  }

  // ==================== MOVIES ====================

  /** Get trending movies (being watched right now) */
  async getTrendingMovies(params?: {
    page?: number;
    limit?: number;
    extended?: string;
    query?: string;
    years?: string;
    genres?: string;
    languages?: string;
    countries?: string;
    runtimes?: string;
    ratings?: string;
    votes?: string;
    certifications?: string;
  }): Promise<TraktTrendingMovie[]> {
    this.ensureConfigured();
    return traktFetch('/movies/trending', this.clientId, params);
  }

  /** Get most popular movies */
  async getPopularMovies(params?: {
    page?: number;
    limit?: number;
    extended?: string;
    query?: string;
    years?: string;
    genres?: string;
    languages?: string;
    countries?: string;
    runtimes?: string;
    ratings?: string;
    votes?: string;
    certifications?: string;
  }): Promise<TraktMovie[]> {
    this.ensureConfigured();
    return traktFetch('/movies/popular', this.clientId, params);
  }

  /** Get most played movies by period */
  async getPlayedMovies(
    period: Period = 'weekly',
    params?: {
      page?: number;
      limit?: number;
      extended?: string;
      query?: string;
      years?: string;
      genres?: string;
      languages?: string;
      countries?: string;
      runtimes?: string;
      ratings?: string;
      votes?: string;
      certifications?: string;
    }
  ): Promise<TraktPlayedItem[]> {
    this.ensureConfigured();
    return traktFetch(`/movies/played/${period}`, this.clientId, params);
  }

  /** Get most watched movies (unique users) by period */
  async getWatchedMovies(
    period: Period = 'weekly',
    params?: {
      page?: number;
      limit?: number;
      extended?: string;
      query?: string;
      years?: string;
      genres?: string;
      languages?: string;
      countries?: string;
      runtimes?: string;
      ratings?: string;
      votes?: string;
      certifications?: string;
    }
  ): Promise<TraktPlayedItem[]> {
    this.ensureConfigured();
    return traktFetch(`/movies/watched/${period}`, this.clientId, params);
  }

  /** Get most collected movies by period */
  async getCollectedMovies(
    period: Period = 'weekly',
    params?: {
      page?: number;
      limit?: number;
      extended?: string;
      query?: string;
      years?: string;
      genres?: string;
      languages?: string;
      countries?: string;
      runtimes?: string;
      ratings?: string;
      votes?: string;
      certifications?: string;
    }
  ): Promise<TraktPlayedItem[]> {
    this.ensureConfigured();
    return traktFetch(`/movies/collected/${period}`, this.clientId, params);
  }

  /** Get most anticipated movies */
  async getAnticipatedMovies(params?: {
    page?: number;
    limit?: number;
    extended?: string;
    query?: string;
    years?: string;
    genres?: string;
    languages?: string;
    countries?: string;
    runtimes?: string;
    ratings?: string;
    votes?: string;
    certifications?: string;
  }): Promise<TraktAnticipatedItem[]> {
    this.ensureConfigured();
    return traktFetch('/movies/anticipated', this.clientId, params);
  }

  /** Get top 10 US box office movies from last weekend */
  async getBoxOffice(params?: { extended?: string }): Promise<TraktBoxOfficeItem[]> {
    this.ensureConfigured();
    return traktFetch('/movies/boxoffice', this.clientId, params);
  }

  /** Get movies updated since a date (ISO 8601) */
  async getMovieUpdates(startDate: string, params?: { page?: number; limit?: number; extended?: string }): Promise<TraktMovie[]> {
    this.ensureConfigured();
    return traktFetch(`/movies/updates/${startDate}`, this.clientId, params);
  }

  /** Get single movie summary */
  async getMovie(id: string | number, params?: { extended?: string }): Promise<TraktMovieExtended> {
    this.ensureConfigured();
    return traktFetch(`/movies/${id}`, this.clientId, params);
  }

  /** Get movie aliases */
  async getMovieAliases(id: string | number): Promise<TraktAlias[]> {
    this.ensureConfigured();
    return traktFetch(`/movies/${id}/aliases`, this.clientId);
  }

  /** Get movie releases by country */
  async getMovieReleases(id: string | number, country?: string): Promise<TraktRelease[]> {
    this.ensureConfigured();
    const endpoint = country ? `/movies/${id}/releases/${country}` : `/movies/${id}/releases`;
    return traktFetch(endpoint, this.clientId);
  }

  /** Get movie translations */
  async getMovieTranslations(id: string | number, language?: string): Promise<TraktTranslation[]> {
    this.ensureConfigured();
    const endpoint = language ? `/movies/${id}/translations/${language}` : `/movies/${id}/translations`;
    return traktFetch(endpoint, this.clientId);
  }

  /** Get movie comments */
  async getMovieComments(
    id: string | number,
    sort: SortType = 'newest',
    params?: { page?: number; limit?: number }
  ): Promise<TraktComment[]> {
    this.ensureConfigured();
    return traktFetch(`/movies/${id}/comments/${sort}`, this.clientId, params);
  }

  /** Get lists containing this movie */
  async getMovieLists(
    id: string | number,
    type: ListType = 'personal',
    sort: ListSort = 'popular',
    params?: { page?: number; limit?: number }
  ): Promise<TraktList[]> {
    this.ensureConfigured();
    return traktFetch(`/movies/${id}/lists/${type}/${sort}`, this.clientId, params);
  }

  /** Get movie cast and crew */
  async getMoviePeople(id: string | number, params?: { extended?: string }): Promise<TraktPeople> {
    this.ensureConfigured();
    return traktFetch(`/movies/${id}/people`, this.clientId, params);
  }

  /** Get movie ratings */
  async getMovieRatings(id: string | number): Promise<TraktRating> {
    this.ensureConfigured();
    return traktFetch(`/movies/${id}/ratings`, this.clientId);
  }

  /** Get related movies */
  async getRelatedMovies(id: string | number, params?: { page?: number; limit?: number; extended?: string }): Promise<TraktMovie[]> {
    this.ensureConfigured();
    return traktFetch(`/movies/${id}/related`, this.clientId, params);
  }

  /** Get movie stats */
  async getMovieStats(id: string | number): Promise<TraktStats> {
    this.ensureConfigured();
    return traktFetch(`/movies/${id}/stats`, this.clientId);
  }

  /** Get users currently watching this movie */
  async getMovieWatching(id: string | number, params?: { extended?: string }): Promise<TraktUser[]> {
    this.ensureConfigured();
    return traktFetch(`/movies/${id}/watching`, this.clientId, params);
  }

  // ==================== SHOWS ====================

  /** Get trending shows */
  async getTrendingShows(params?: {
    page?: number;
    limit?: number;
    extended?: string;
    query?: string;
    years?: string;
    genres?: string;
    languages?: string;
    countries?: string;
    runtimes?: string;
    ratings?: string;
    votes?: string;
    certifications?: string;
    network_ids?: string;
    status?: string;
  }): Promise<TraktTrendingShow[]> {
    this.ensureConfigured();
    return traktFetch('/shows/trending', this.clientId, params);
  }

  /** Get popular shows */
  async getPopularShows(params?: {
    page?: number;
    limit?: number;
    extended?: string;
    query?: string;
    years?: string;
    genres?: string;
    languages?: string;
    countries?: string;
    runtimes?: string;
    ratings?: string;
    votes?: string;
    certifications?: string;
    network_ids?: string;
    status?: string;
  }): Promise<TraktShow[]> {
    this.ensureConfigured();
    return traktFetch('/shows/popular', this.clientId, params);
  }

  /** Get most played shows by period */
  async getPlayedShows(
    period: Period = 'weekly',
    params?: {
      page?: number;
      limit?: number;
      extended?: string;
      query?: string;
      years?: string;
      genres?: string;
      languages?: string;
      countries?: string;
      runtimes?: string;
      ratings?: string;
      votes?: string;
      certifications?: string;
      network_ids?: string;
      status?: string;
    }
  ): Promise<TraktPlayedItem[]> {
    this.ensureConfigured();
    return traktFetch(`/shows/played/${period}`, this.clientId, params);
  }

  /** Get most watched shows by period */
  async getWatchedShows(
    period: Period = 'weekly',
    params?: {
      page?: number;
      limit?: number;
      extended?: string;
      query?: string;
      years?: string;
      genres?: string;
      languages?: string;
      countries?: string;
      runtimes?: string;
      ratings?: string;
      votes?: string;
      certifications?: string;
      network_ids?: string;
      status?: string;
    }
  ): Promise<TraktPlayedItem[]> {
    this.ensureConfigured();
    return traktFetch(`/shows/watched/${period}`, this.clientId, params);
  }

  /** Get most collected shows by period */
  async getCollectedShows(
    period: Period = 'weekly',
    params?: {
      page?: number;
      limit?: number;
      extended?: string;
      query?: string;
      years?: string;
      genres?: string;
      languages?: string;
      countries?: string;
      runtimes?: string;
      ratings?: string;
      votes?: string;
      certifications?: string;
      network_ids?: string;
      status?: string;
    }
  ): Promise<TraktPlayedItem[]> {
    this.ensureConfigured();
    return traktFetch(`/shows/collected/${period}`, this.clientId, params);
  }

  /** Get most anticipated shows */
  async getAnticipatedShows(params?: {
    page?: number;
    limit?: number;
    extended?: string;
    query?: string;
    years?: string;
    genres?: string;
    languages?: string;
    countries?: string;
    runtimes?: string;
    ratings?: string;
    votes?: string;
    certifications?: string;
    network_ids?: string;
    status?: string;
  }): Promise<TraktAnticipatedItem[]> {
    this.ensureConfigured();
    return traktFetch('/shows/anticipated', this.clientId, params);
  }

  /** Get shows updated since a date */
  async getShowUpdates(startDate: string, params?: { page?: number; limit?: number; extended?: string }): Promise<TraktShow[]> {
    this.ensureConfigured();
    return traktFetch(`/shows/updates/${startDate}`, this.clientId, params);
  }

  /** Get single show summary */
  async getShow(id: string | number, params?: { extended?: string }): Promise<TraktShowExtended> {
    this.ensureConfigured();
    return traktFetch(`/shows/${id}`, this.clientId, params);
  }

  /** Get show aliases */
  async getShowAliases(id: string | number): Promise<TraktAlias[]> {
    this.ensureConfigured();
    return traktFetch(`/shows/${id}/aliases`, this.clientId);
  }

  /** Get show translations */
  async getShowTranslations(id: string | number, language?: string): Promise<TraktTranslation[]> {
    this.ensureConfigured();
    const endpoint = language ? `/shows/${id}/translations/${language}` : `/shows/${id}/translations`;
    return traktFetch(endpoint, this.clientId);
  }

  /** Get show comments */
  async getShowComments(
    id: string | number,
    sort: SortType = 'newest',
    params?: { page?: number; limit?: number }
  ): Promise<TraktComment[]> {
    this.ensureConfigured();
    return traktFetch(`/shows/${id}/comments/${sort}`, this.clientId, params);
  }

  /** Get lists containing this show */
  async getShowLists(
    id: string | number,
    type: ListType = 'personal',
    sort: ListSort = 'popular',
    params?: { page?: number; limit?: number }
  ): Promise<TraktList[]> {
    this.ensureConfigured();
    return traktFetch(`/shows/${id}/lists/${type}/${sort}`, this.clientId, params);
  }

  /** Get show cast and crew */
  async getShowPeople(id: string | number, params?: { extended?: string }): Promise<TraktPeople> {
    this.ensureConfigured();
    return traktFetch(`/shows/${id}/people`, this.clientId, params);
  }

  /** Get show ratings */
  async getShowRatings(id: string | number): Promise<TraktRating> {
    this.ensureConfigured();
    return traktFetch(`/shows/${id}/ratings`, this.clientId);
  }

  /** Get related shows */
  async getRelatedShows(id: string | number, params?: { page?: number; limit?: number; extended?: string }): Promise<TraktShow[]> {
    this.ensureConfigured();
    return traktFetch(`/shows/${id}/related`, this.clientId, params);
  }

  /** Get show stats */
  async getShowStats(id: string | number): Promise<TraktStats> {
    this.ensureConfigured();
    return traktFetch(`/shows/${id}/stats`, this.clientId);
  }

  /** Get users currently watching this show */
  async getShowWatching(id: string | number, params?: { extended?: string }): Promise<TraktUser[]> {
    this.ensureConfigured();
    return traktFetch(`/shows/${id}/watching`, this.clientId, params);
  }

  /** Get next scheduled episode */
  async getShowNextEpisode(id: string | number, params?: { extended?: string }): Promise<TraktEpisodeExtended | null> {
    this.ensureConfigured();
    return traktFetch(`/shows/${id}/next_episode`, this.clientId, params);
  }

  /** Get most recently aired episode */
  async getShowLastEpisode(id: string | number, params?: { extended?: string }): Promise<TraktEpisodeExtended | null> {
    this.ensureConfigured();
    return traktFetch(`/shows/${id}/last_episode`, this.clientId, params);
  }

  // ==================== SEASONS ====================

  /** Get all seasons for a show */
  async getSeasons(id: string | number, params?: { extended?: string }): Promise<TraktSeasonExtended[]> {
    this.ensureConfigured();
    return traktFetch(`/shows/${id}/seasons`, this.clientId, params);
  }

  /** Get all episodes for a season */
  async getSeasonEpisodes(
    id: string | number,
    season: number,
    params?: { extended?: string }
  ): Promise<TraktEpisodeExtended[]> {
    this.ensureConfigured();
    return traktFetch(`/shows/${id}/seasons/${season}`, this.clientId, params);
  }

  /** Get lists containing this season */
  async getSeasonLists(
    id: string | number,
    season: number,
    type: ListType = 'personal',
    sort: ListSort = 'popular',
    params?: { page?: number; limit?: number }
  ): Promise<TraktList[]> {
    this.ensureConfigured();
    return traktFetch(`/shows/${id}/seasons/${season}/lists/${type}/${sort}`, this.clientId, params);
  }

  /** Get season ratings */
  async getSeasonRatings(id: string | number, season: number): Promise<TraktRating> {
    this.ensureConfigured();
    return traktFetch(`/shows/${id}/seasons/${season}/ratings`, this.clientId);
  }

  /** Get season stats */
  async getSeasonStats(id: string | number, season: number): Promise<TraktStats> {
    this.ensureConfigured();
    return traktFetch(`/shows/${id}/seasons/${season}/stats`, this.clientId);
  }

  /** Get users currently watching this season */
  async getSeasonWatching(id: string | number, season: number, params?: { extended?: string }): Promise<TraktUser[]> {
    this.ensureConfigured();
    return traktFetch(`/shows/${id}/seasons/${season}/watching`, this.clientId, params);
  }

  // ==================== EPISODES ====================

  /** Get single episode */
  async getEpisode(
    id: string | number,
    season: number,
    episode: number,
    params?: { extended?: string }
  ): Promise<TraktEpisodeExtended> {
    this.ensureConfigured();
    return traktFetch(`/shows/${id}/seasons/${season}/episodes/${episode}`, this.clientId, params);
  }

  /** Get episode translations */
  async getEpisodeTranslations(
    id: string | number,
    season: number,
    episode: number,
    language?: string
  ): Promise<TraktTranslation[]> {
    this.ensureConfigured();
    const endpoint = language
      ? `/shows/${id}/seasons/${season}/episodes/${episode}/translations/${language}`
      : `/shows/${id}/seasons/${season}/episodes/${episode}/translations`;
    return traktFetch(endpoint, this.clientId);
  }

  /** Get episode comments */
  async getEpisodeComments(
    id: string | number,
    season: number,
    episode: number,
    sort: SortType = 'newest',
    params?: { page?: number; limit?: number }
  ): Promise<TraktComment[]> {
    this.ensureConfigured();
    return traktFetch(`/shows/${id}/seasons/${season}/episodes/${episode}/comments/${sort}`, this.clientId, params);
  }

  /** Get lists containing this episode */
  async getEpisodeLists(
    id: string | number,
    season: number,
    episode: number,
    type: ListType = 'personal',
    sort: ListSort = 'popular',
    params?: { page?: number; limit?: number }
  ): Promise<TraktList[]> {
    this.ensureConfigured();
    return traktFetch(
      `/shows/${id}/seasons/${season}/episodes/${episode}/lists/${type}/${sort}`,
      this.clientId,
      params
    );
  }

  /** Get episode ratings */
  async getEpisodeRatings(id: string | number, season: number, episode: number): Promise<TraktRating> {
    this.ensureConfigured();
    return traktFetch(`/shows/${id}/seasons/${season}/episodes/${episode}/ratings`, this.clientId);
  }

  /** Get episode stats */
  async getEpisodeStats(id: string | number, season: number, episode: number): Promise<TraktStats> {
    this.ensureConfigured();
    return traktFetch(`/shows/${id}/seasons/${season}/episodes/${episode}/stats`, this.clientId);
  }

  /** Get users currently watching this episode */
  async getEpisodeWatching(
    id: string | number,
    season: number,
    episode: number,
    params?: { extended?: string }
  ): Promise<TraktUser[]> {
    this.ensureConfigured();
    return traktFetch(`/shows/${id}/seasons/${season}/episodes/${episode}/watching`, this.clientId, params);
  }

  // ==================== PEOPLE ====================

  /** Get single person */
  async getPerson(id: string | number, params?: { extended?: string }): Promise<TraktPersonExtended> {
    this.ensureConfigured();
    return traktFetch(`/people/${id}`, this.clientId, params);
  }

  /** Get person's movie credits */
  async getPersonMovies(id: string | number, params?: { extended?: string }): Promise<TraktPeople> {
    this.ensureConfigured();
    return traktFetch(`/people/${id}/movies`, this.clientId, params);
  }

  /** Get person's show credits */
  async getPersonShows(id: string | number, params?: { extended?: string }): Promise<TraktPeople> {
    this.ensureConfigured();
    return traktFetch(`/people/${id}/shows`, this.clientId, params);
  }

  /** Get lists containing this person */
  async getPersonLists(
    id: string | number,
    type: ListType = 'personal',
    sort: ListSort = 'popular',
    params?: { page?: number; limit?: number }
  ): Promise<TraktList[]> {
    this.ensureConfigured();
    return traktFetch(`/people/${id}/lists/${type}/${sort}`, this.clientId, params);
  }

  // ==================== SEARCH ====================

  /** Text search across all types or specific type */
  async search(
    query: string,
    type?: SearchType,
    params?: {
      page?: number;
      limit?: number;
      extended?: string;
      fields?: string;
      years?: string;
      genres?: string;
      languages?: string;
      countries?: string;
      runtimes?: string;
      ratings?: string;
      votes?: string;
      certifications?: string;
    }
  ): Promise<TraktSearchResult[]> {
    this.ensureConfigured();
    const endpoint = type ? `/search/${type}` : '/search';
    return traktFetch(endpoint, this.clientId, { ...params, query });
  }

  /** Search by external ID */
  async searchById(
    idType: IdType,
    id: string | number,
    params?: {
      page?: number;
      limit?: number;
      extended?: string;
    }
  ): Promise<TraktSearchResult[]> {
    this.ensureConfigured();
    return traktFetch(`/search/id/${idType}/${id}`, this.clientId, params);
  }

  // ==================== CALENDARS (Public) ====================

  /** All shows airing during time period */
  async getCalendarAllShows(startDate: string, days: number, params?: { extended?: string }): Promise<TraktCalendarItem[]> {
    this.ensureConfigured();
    return traktFetch(`/calendars/all/shows/${startDate}/${days}`, this.clientId, params);
  }

  /** All new show premieres (S1E1) */
  async getCalendarAllNewShows(startDate: string, days: number, params?: { extended?: string }): Promise<TraktCalendarItem[]> {
    this.ensureConfigured();
    return traktFetch(`/calendars/all/shows/new/${startDate}/${days}`, this.clientId, params);
  }

  /** All season premieres */
  async getCalendarAllPremieres(startDate: string, days: number, params?: { extended?: string }): Promise<TraktCalendarItem[]> {
    this.ensureConfigured();
    return traktFetch(`/calendars/all/shows/premieres/${startDate}/${days}`, this.clientId, params);
  }

  /** All movies with theatrical release */
  async getCalendarAllMovies(startDate: string, days: number, params?: { extended?: string }): Promise<TraktCalendarItem[]> {
    this.ensureConfigured();
    return traktFetch(`/calendars/all/movies/${startDate}/${days}`, this.clientId, params);
  }

  /** All movies with DVD release */
  async getCalendarAllDvd(startDate: string, days: number, params?: { extended?: string }): Promise<TraktCalendarItem[]> {
    this.ensureConfigured();
    return traktFetch(`/calendars/all/dvd/${startDate}/${days}`, this.clientId, params);
  }

  // ==================== COMMENTS ====================

  /** Get single comment */
  async getComment(id: number): Promise<TraktComment> {
    this.ensureConfigured();
    return traktFetch(`/comments/${id}`, this.clientId);
  }

  /** Get comment replies */
  async getCommentReplies(id: number, params?: { page?: number; limit?: number }): Promise<TraktComment[]> {
    this.ensureConfigured();
    return traktFetch(`/comments/${id}/replies`, this.clientId, params);
  }

  /** Get item this comment is on */
  async getCommentItem(id: number): Promise<TraktSearchResult> {
    this.ensureConfigured();
    return traktFetch(`/comments/${id}/item`, this.clientId);
  }

  /** Get trending comments */
  async getTrendingComments(params?: { page?: number; limit?: number }): Promise<TraktComment[]> {
    this.ensureConfigured();
    return traktFetch('/comments/trending', this.clientId, params);
  }

  /** Get recent comments */
  async getRecentComments(params?: { page?: number; limit?: number }): Promise<TraktComment[]> {
    this.ensureConfigured();
    return traktFetch('/comments/recent', this.clientId, params);
  }

  /** Get recently updated comments */
  async getUpdatedComments(params?: { page?: number; limit?: number }): Promise<TraktComment[]> {
    this.ensureConfigured();
    return traktFetch('/comments/updates', this.clientId, params);
  }

  // ==================== LISTS (Official) ====================

  /** Get single official list */
  async getList(id: number): Promise<TraktList> {
    this.ensureConfigured();
    return traktFetch(`/lists/${id}`, this.clientId);
  }

  /** Get items in an official list */
  async getListItems(
    id: number,
    type?: MediaType,
    params?: { page?: number; limit?: number; extended?: string }
  ): Promise<TraktSearchResult[]> {
    this.ensureConfigured();
    const endpoint = type ? `/lists/${id}/items/${type}` : `/lists/${id}/items`;
    return traktFetch(endpoint, this.clientId, params);
  }

  // ==================== CERTIFICATIONS ====================

  /** Get all certifications (movies + shows) */
  async getCertifications(): Promise<{ us: TraktCertification[] }> {
    this.ensureConfigured();
    return traktFetch('/certifications', this.clientId);
  }

  /** Get movie certifications */
  async getMovieCertifications(): Promise<{ us: TraktCertification[] }> {
    this.ensureConfigured();
    return traktFetch('/certifications/movies', this.clientId);
  }

  /** Get show certifications */
  async getShowCertifications(): Promise<{ us: TraktCertification[] }> {
    this.ensureConfigured();
    return traktFetch('/certifications/shows', this.clientId);
  }

  // ==================== GENRES ====================

  /** Get all movie genres */
  async getMovieGenres(): Promise<TraktGenre[]> {
    this.ensureConfigured();
    return traktFetch('/genres/movies', this.clientId);
  }

  /** Get all show genres */
  async getShowGenres(): Promise<TraktGenre[]> {
    this.ensureConfigured();
    return traktFetch('/genres/shows', this.clientId);
  }

  // ==================== NETWORKS ====================

  /** Get all TV networks */
  async getNetworks(): Promise<TraktNetwork[]> {
    this.ensureConfigured();
    return traktFetch('/networks', this.clientId);
  }

  // ==================== COUNTRIES ====================

  /** Get all movie countries */
  async getMovieCountries(): Promise<TraktCountry[]> {
    this.ensureConfigured();
    return traktFetch('/countries/movies', this.clientId);
  }

  /** Get all show countries */
  async getShowCountries(): Promise<TraktCountry[]> {
    this.ensureConfigured();
    return traktFetch('/countries/shows', this.clientId);
  }

  // ==================== LANGUAGES ====================

  /** Get all movie languages */
  async getMovieLanguages(): Promise<TraktLanguage[]> {
    this.ensureConfigured();
    return traktFetch('/languages/movies', this.clientId);
  }

  /** Get all show languages */
  async getShowLanguages(): Promise<TraktLanguage[]> {
    this.ensureConfigured();
    return traktFetch('/languages/shows', this.clientId);
  }

  // ==================== WATCH NOW (VIP Only - included for completeness) ====================

  /** Get where to watch a movie */
  async getMovieWatchNow(id: string | number, country: string): Promise<TraktWatchNowItem[]> {
    this.ensureConfigured();
    return traktFetch(`/movies/${id}/watchnow/${country}`, this.clientId);
  }

  /** Get where to watch a show */
  async getShowWatchNow(id: string | number, country: string): Promise<TraktWatchNowItem[]> {
    this.ensureConfigured();
    return traktFetch(`/shows/${id}/watchnow/${country}`, this.clientId);
  }

  /** Get where to watch an episode */
  async getEpisodeWatchNow(
    id: string | number,
    season: number,
    episode: number,
    country: string
  ): Promise<TraktWatchNowItem[]> {
    this.ensureConfigured();
    return traktFetch(`/shows/${id}/seasons/${season}/episodes/${episode}/watchnow/${country}`, this.clientId);
  }
}

// ==================== SINGLETON EXPORT ====================

let _traktService: TraktService | null = null;

/**
 * Get or create a TraktService instance
 * Uses EXPO_PUBLIC_TRAKT_CLIENT_ID from environment if available
 */
export function getTraktService(clientId?: string): TraktService {
  // If a clientId is provided, use it
  if (clientId) {
    if (!_traktService || _traktService['clientId'] !== clientId) {
      _traktService = new TraktService(clientId);
    }
    return _traktService;
  }

  // Otherwise try to get from environment
  const envClientId = process.env.EXPO_PUBLIC_TRAKT_CLIENT_ID || process.env.TRAKT_CLIENT_ID || '';
  
  if (!_traktService) {
    if (envClientId) {
      console.log('[TraktService] ✅ Using client ID from environment');
      _traktService = new TraktService(envClientId);
    } else {
      console.warn('[TraktService] ⚠️ No client ID found. Trakt features will not work.');
      console.warn('[TraktService] 💡 Set EXPO_PUBLIC_TRAKT_CLIENT_ID in your .env file');
      _traktService = new TraktService('');
    }
  }
  
  return _traktService;
}

export function resetTraktService(): void {
  _traktService = null;
}

export default TraktService;