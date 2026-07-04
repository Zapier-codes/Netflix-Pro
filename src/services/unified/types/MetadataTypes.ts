/**
 * Unified Metadata Types
 * Defines all type interfaces for metadata aggregation across providers
 */

// ============================================================================
// BASE MEDIA TYPES
// ============================================================================

export interface MediaIds {
  trakt?: number;
  slug?: string;
  imdb?: string;
  tmdb?: number;
  tvdb?: number;
  tvrage?: number;
}

export interface MediaImageSet {
  poster?: string[];
  fanart?: string[];
  banner?: string[];
  logo?: string[];
  clearart?: string[];
  thumb?: string[];
  screenshot?: string[];
  headshot?: string[];
}

export interface MediaRating {
  rating: number;
  votes: number;
  distribution?: Record<string, number>;
}

// ============================================================================
// MOVIE TYPES
// ============================================================================

export interface UnifiedMovie {
  title: string;
  year: number;
  ids: MediaIds;
  tagline?: string;
  overview?: string;
  released?: string;
  runtime?: number;
  country?: string;
  trailer?: string;
  homepage?: string;
  status?: string;
  rating?: MediaRating;
  votes?: number;
  commentCount?: number;
  updatedAt?: string;
  language?: string;
  availableTranslations?: string[];
  genres?: string[];
  certification?: string;
  images?: MediaImageSet;
  
  // Extended
  budget?: number;
  revenue?: number;
  tagline?: string;
  director?: string;
  writer?: string;
  cast?: CastMember[];
  crew?: CrewMember[];
  studios?: string[];
  keywords?: string[];
  collections?: string[];
  
  // Provider-specific
  provider?: string;
  providerData?: Record<string, unknown>;
}

export interface MovieRelease {
  country: string;
  certification?: string;
  releaseDate?: string;
  note?: string;
}

// ============================================================================
// SHOW TYPES
// ============================================================================

export interface UnifiedShow {
  title: string;
  year: number;
  ids: MediaIds;
  overview?: string;
  firstAired?: string;
  airs?: {
    day?: string;
    time?: string;
    timezone?: string;
  };
  runtime?: number;
  certification?: string;
  network?: string;
  networkIds?: number[];
  country?: string;
  trailer?: string;
  homepage?: string;
  status?: 'returning series' | 'continuing' | 'in production' | 'planned' | 'upcoming' | 'pilot' | 'canceled' | 'ended';
  rating?: MediaRating;
  votes?: number;
  commentCount?: number;
  updatedAt?: string;
  language?: string;
  availableTranslations?: string[];
  genres?: string[];
  airedEpisodes?: number;
  images?: MediaImageSet;
  
  // Extended
  seasons?: UnifiedSeason[];
  cast?: CastMember[];
  crew?: CrewMember[];
  studios?: string[];
  keywords?: string[];
  
  // Provider-specific
  provider?: string;
  providerData?: Record<string, unknown>;
}

// ============================================================================
// SEASON TYPES
// ============================================================================

export interface UnifiedSeason {
  number: number;
  ids: MediaIds;
  title?: string;
  overview?: string;
  rating?: MediaRating;
  votes?: number;
  episodeCount?: number;
  airedEpisodes?: number;
  firstAired?: string;
  updatedAt?: string;
  network?: string;
  images?: MediaImageSet;
  episodes?: UnifiedEpisode[];
}

// ============================================================================
// EPISODE TYPES
// ============================================================================

export interface UnifiedEpisode {
  season: number;
  number: number;
  title: string;
  ids: MediaIds;
  overview?: string;
  rating?: MediaRating;
  votes?: number;
  commentCount?: number;
  firstAired?: string;
  updatedAt?: string;
  availableTranslations?: string[];
  runtime?: number;
  images?: MediaImageSet;
  
  // Extended
  cast?: CastMember[];
  crew?: CrewMember[];
  guestStars?: CastMember[];
  
  // Provider-specific
  provider?: string;
  providerData?: Record<string, unknown>;
}

// ============================================================================
// PERSON TYPES
// ============================================================================

export interface CastMember {
  character?: string;
  characters?: string[];
  person: UnifiedPerson;
  episodeCount?: number;
  self?: boolean;
  voice?: boolean;
}

export interface CrewMember {
  job?: string;
  jobs?: string[];
  person: UnifiedPerson;
  department?: string;
}

export interface UnifiedPerson {
  name: string;
  ids: MediaIds;
  biography?: string;
  birthday?: string;
  death?: string;
  birthplace?: string;
  homepage?: string;
  gender?: 'male' | 'female' | 'non-binary' | 'unknown';
  knownForDepartment?: string;
  images?: MediaImageSet;
  
  // Extended
  movieCredits?: PersonCredits<UnifiedMovie>;
  showCredits?: PersonCredits<UnifiedShow>;
}

export interface PersonCredits<T> {
  cast?: { character?: string; media: T }[];
  crew?: { job?: string; department?: string; media: T }[];
}

// ============================================================================
// SEARCH TYPES
// ============================================================================

export interface SearchResult {
  type: 'movie' | 'show' | 'episode' | 'person' | 'list';
  score?: number;
  movie?: UnifiedMovie;
  show?: UnifiedShow;
  episode?: UnifiedEpisode;
  person?: UnifiedPerson;
  list?: UnifiedList;
}

export interface SearchRequest {
  query: string;
  type?: ('movie' | 'show' | 'episode' | 'person' | 'list')[];
  fields?: string[];
  years?: string;
  genres?: string[];
  languages?: string[];
  countries?: string[];
  runtimes?: string;
  ratings?: string;
  votes?: string;
  certifications?: string[];
  networks?: string[];
  status?: string[];
  page?: number;
  limit?: number;
  extended?: 'images' | 'full' | 'full,images' | 'metadata';
}

// ============================================================================
// LIST TYPES
// ============================================================================

export interface UnifiedList {
  name: string;
  description?: string;
  privacy?: 'private' | 'friends' | 'public';
  displayNumbers?: boolean;
  allowComments?: boolean;
  sortBy?: string;
  sortHow?: string;
  createdAt?: string;
  updatedAt?: string;
  itemCount?: number;
  commentCount?: number;
  likes?: number;
  ids?: {
    trakt?: number;
    slug?: string;
  };
  user?: UnifiedUser;
  items?: ListItem[];
}

export interface ListItem {
  rank?: number;
  listedAt?: string;
  type: 'movie' | 'show' | 'season' | 'episode' | 'person';
  movie?: UnifiedMovie;
  show?: UnifiedShow;
  season?: UnifiedSeason;
  episode?: UnifiedEpisode;
  person?: UnifiedPerson;
}

// ============================================================================
// USER TYPES
// ============================================================================

export interface UnifiedUser {
  username: string;
  private: boolean;
  name?: string;
  vip?: boolean;
  vipEp?: boolean;
  ids: {
    slug: string;
  };
  images?: MediaImageSet;
}

// ============================================================================
// TRENDING / POPULAR TYPES
// ============================================================================

export interface TrendingItem<T> {
  watchers: number;
  media: T;
}

export interface AnticipatedItem<T> {
  listCount: number;
  media: T;
}

export interface BoxOfficeItem {
  revenue: number;
  movie: UnifiedMovie;
}

export interface UpdatedItem<T> {
  updatedAt: string;
  media: T;
}

// ============================================================================
// CALENDAR TYPES
// ============================================================================

export interface CalendarEntry {
  released: string;
  episode?: UnifiedEpisode;
  show?: UnifiedShow;
  movie?: UnifiedMovie;
}

// ============================================================================
// COMMENT TYPES
// ============================================================================

export interface UnifiedComment {
  id: number;
  parentId?: number;
  createdAt: string;
  updatedAt: string;
  comment: string;
  spoiler: boolean;
  review: boolean;
  replies?: number;
  likes?: number;
  userRating?: number;
  user?: UnifiedUser;
  mediaType?: 'movie' | 'show' | 'season' | 'episode' | 'list';
  movie?: UnifiedMovie;
  show?: UnifiedShow;
  season?: UnifiedSeason;
  episode?: UnifiedEpisode;
  list?: UnifiedList;
}

// ============================================================================
// PROVIDER INTERFACE
// ============================================================================

export interface MetadataProvider {
  name: string;
  id: string;
  priority: number;
  enabled: boolean;
  
  // Search
  search?(query: SearchRequest): Promise<SearchResult[]>;
  searchById?(idType: string, id: string): Promise<SearchResult[]>;
  
  // Movies
  getTrendingMovies?(): Promise<TrendingItem<UnifiedMovie>[]>;
  getPopularMovies?(): Promise<UnifiedMovie[]>;
  getMostPlayedMovies?(period?: string): Promise<UnifiedMovie[]>;
  getMostWatchedMovies?(period?: string): Promise<UnifiedMovie[]>;
  getMostCollectedMovies?(period?: string): Promise<UnifiedMovie[]>;
  getAnticipatedMovies?(): Promise<AnticipatedItem<UnifiedMovie>[]>;
  getBoxOffice?(): Promise<BoxOfficeItem[]>;
  getUpdatedMovies?(startDate: string): Promise<UpdatedItem<UnifiedMovie>[]>;
  getMovie?(id: string | number): Promise<UnifiedMovie>;
  getMovieAliases?(id: string | number): Promise<{ title: string; country?: string }[]>;
  getMovieReleases?(id: string | number, country?: string): Promise<MovieRelease[]>;
  getMovieTranslations?(id: string | number, language?: string): Promise<{ title: string; overview?: string; tagline?: string; language: string }[]>;
  getMovieComments?(id: string | number, sort?: string): Promise<UnifiedComment[]>;
  getMovieLists?(id: string | number, type?: string, sort?: string): Promise<UnifiedList[]>;
  getMoviePeople?(id: string | number): Promise<{ cast?: CastMember[]; crew?: CrewMember[] }>;
  getMovieRatings?(id: string | number): Promise<MediaRating>;
  getMovieRelated?(id: string | number): Promise<UnifiedMovie[]>;
  getMovieStats?(id: string | number): Promise<MovieStats>;
  getMovieWatching?(id: string | number): Promise<UnifiedUser[]>;
  
  // Shows
  getTrendingShows?(): Promise<TrendingItem<UnifiedShow>[]>;
  getPopularShows?(): Promise<UnifiedShow[]>;
  getMostPlayedShows?(period?: string): Promise<UnifiedShow[]>;
  getMostWatchedShows?(period?: string): Promise<UnifiedShow[]>;
  getMostCollectedShows?(period?: string): Promise<UnifiedShow[]>;
  getAnticipatedShows?(): Promise<AnticipatedItem<UnifiedShow>[]>;
  getUpdatedShows?(startDate: string): Promise<UpdatedItem<UnifiedShow>[]>;
  getShow?(id: string | number): Promise<UnifiedShow>;
  getShowAliases?(id: string | number): Promise<{ title: string; country?: string }[]>;
  getShowTranslations?(id: string | number, language?: string): Promise<{ title: string; overview?: string; language: string }[]>;
  getShowComments?(id: string | number, sort?: string): Promise<UnifiedComment[]>;
  getShowLists?(id: string | number, type?: string, sort?: string): Promise<UnifiedList[]>;
  getShowPeople?(id: string | number): Promise<{ cast?: CastMember[]; crew?: CrewMember[] }>;
  getShowRatings?(id: string | number): Promise<MediaRating>;
  getShowRelated?(id: string | number): Promise<UnifiedShow[]>;
  getShowStats?(id: string | number): Promise<ShowStats>;
  getShowWatching?(id: string | number): Promise<UnifiedUser[]>;
  getShowNextEpisode?(id: string | number): Promise<UnifiedEpisode>;
  getShowLastEpisode?(id: string | number): Promise<UnifiedEpisode>;
  
  // Seasons
  getShowSeasons?(id: string | number): Promise<UnifiedSeason[]>;
  getSeason?(showId: string | number, seasonNumber: number): Promise<UnifiedSeason>;
  getSeasonLists?(showId: string | number, seasonNumber: number, type?: string, sort?: string): Promise<UnifiedList[]>;
  getSeasonRatings?(showId: string | number, seasonNumber: number): Promise<MediaRating>;
  getSeasonStats?(showId: string | number, seasonNumber: number): Promise<SeasonStats>;
  getSeasonWatching?(showId: string | number, seasonNumber: number): Promise<UnifiedUser[]>;
  
  // Episodes
  getEpisode?(showId: string | number, seasonNumber: number, episodeNumber: number): Promise<UnifiedEpisode>;
  getEpisodeTranslations?(showId: string | number, seasonNumber: number, episodeNumber: number, language?: string): Promise<{ title: string; overview?: string; language: string }[]>;
  getEpisodeComments?(showId: string | number, seasonNumber: number, episodeNumber: number, sort?: string): Promise<UnifiedComment[]>;
  getEpisodeLists?(showId: string | number, seasonNumber: number, episodeNumber: number, type?: string, sort?: string): Promise<UnifiedList[]>;
  getEpisodeRatings?(showId: string | number, seasonNumber: number, episodeNumber: number): Promise<MediaRating>;
  getEpisodeStats?(showId: string | number, seasonNumber: number, episodeNumber: number): Promise<EpisodeStats>;
  getEpisodeWatching?(showId: string | number, seasonNumber: number, episodeNumber: number): Promise<UnifiedUser[]>;
  
  // People
  getPerson?(id: string | number): Promise<UnifiedPerson>;
  getPersonMovies?(id: string | number): Promise<PersonCredits<UnifiedMovie>>;
  getPersonShows?(id: string | number): Promise<PersonCredits<UnifiedShow>>;
  getPersonLists?(id: string | number, type?: string, sort?: string): Promise<UnifiedList[]>;
  
  // Calendars
  getAllShowsCalendar?(startDate: string, days: number): Promise<CalendarEntry[]>;
  getAllNewShowsCalendar?(startDate: string, days: number): Promise<CalendarEntry[]>;
  getAllSeasonPremieresCalendar?(startDate: string, days: number): Promise<CalendarEntry[]>;
  getAllMoviesCalendar?(startDate: string, days: number): Promise<CalendarEntry[]>;
  getAllDvdCalendar?(startDate: string, days: number): Promise<CalendarEntry[]>;
  
  // Lists
  getList?(id: number): Promise<UnifiedList>;
  getListItems?(id: number, type?: string): Promise<ListItem[]>;
  
  // Comments
  getComment?(id: number): Promise<UnifiedComment>;
  getCommentReplies?(id: number): Promise<UnifiedComment[]>;
  getCommentItem?(id: number): Promise<SearchResult>;
  getTrendingComments?(): Promise<UnifiedComment[]>;
  getRecentComments?(): Promise<UnifiedComment[]>;
  getUpdatedComments?(): Promise<UnifiedComment[]>;
  
  // Certifications, Genres, Networks
  getCertifications?(): Promise<Record<string, { name: string; slug: string; description?: string }[]>>;
  getGenres?(type: 'movies' | 'shows'): Promise<{ name: string; slug: string }[]>;
  getNetworks?(): Promise<{ name: string; country?: string; ids?: { trakt?: number; tmdb?: number } }[]>;
  getCountries?(type: 'movies' | 'shows'): Promise<{ name: string; code: string }[]>;
  getLanguages?(type: 'movies' | 'shows'): Promise<{ name: string; code: string }[]>;
  
  // Utility
  isAvailable?(): Promise<boolean>;
  getRateLimit?(): Promise<{ limit: number; remaining: number; reset: number }>;
}

// ============================================================================
// STATS TYPES
// ============================================================================

export interface MovieStats {
  watchers: number;
  plays: number;
  collectors: number;
  comments: number;
  lists: number;
  votes: number;
}

export interface ShowStats {
  watchers: number;
  plays: number;
  collectors: number;
  comments: number;
  lists: number;
  votes: number;
}

export interface SeasonStats {
  watchers: number;
  plays: number;
  collectors: number;
  comments: number;
  lists: number;
  votes: number;
}

export interface EpisodeStats {
  watchers: number;
  plays: number;
  collectors: number;
  comments: number;
  lists: number;
  votes: number;
}

// ============================================================================
// AGGREGATION TYPES
// ============================================================================

export interface AggregatedMetadata {
  movies?: UnifiedMovie[];
  shows?: UnifiedShow[];
  episodes?: UnifiedEpisode[];
  people?: UnifiedPerson[];
  lists?: UnifiedList[];
  comments?: UnifiedComment[];
  trending?: TrendingItem<UnifiedMovie | UnifiedShow>[];
  popular?: (UnifiedMovie | UnifiedShow)[];
  anticipated?: AnticipatedItem<UnifiedMovie | UnifiedShow>[];
  calendar?: CalendarEntry[];
  searchResults?: SearchResult[];
}

export interface MetadataRequest {
  type: 'movie' | 'show' | 'episode' | 'person' | 'list' | 'search' | 'trending' | 'popular' | 'anticipated' | 'calendar';
  id?: string | number;
  ids?: MediaIds;
  query?: string;
  season?: number;
  episode?: number;
  startDate?: string;
  days?: number;
  period?: string;
  sort?: string;
  filters?: Record<string, string | string[]>;
  page?: number;
  limit?: number;
  extended?: 'images' | 'full' | 'full,images' | 'metadata';
  providers?: string[];
}

export interface MetadataCacheEntry<T> {
  key: string;
  data: T;
  timestamp: number;
  expiresAt: number;
  provider: string;
}

// ============================================================================
// CONFIG TYPES
// ============================================================================

export interface MetadataProviderConfig {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  apiKey?: string;
  baseUrl?: string;
  timeout: number;
  retryCount: number;
  cacheDuration: number;
  rateLimit: number;
  customHeaders?: Record<string, string>;
}

export interface UnifiedMetadataConfig {
  providers: MetadataProviderConfig[];
  cacheEnabled: boolean;
  defaultCacheDuration: number;
  maxConcurrentRequests: number;
  requestTimeout: number;
  fallbackEnabled: boolean;
  deduplicateResults: boolean;
  preferFullExtended: boolean;
  defaultLanguage: string;
}