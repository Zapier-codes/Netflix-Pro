/**
 * Unified Metadata Types
 * Defines all type interfaces for metadata aggregation across providers
 * 
 * v2.0 - Extended with industry-standard fields for complete content classification
 * Supports: language/country filtering, parental ratings, watch providers,
 * franchise grouping, popularity metrics, and rich content metadata.
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

/**
 * Where to watch this content - streaming availability
 */
export interface WatchProvider {
  providerId: number;
  providerName: string;
  logoPath?: string;
  displayPriority: number;
  region?: string;
  type?: 'flatrate' | 'free' | 'ads' | 'rent' | 'buy';
  price?: {
    amount: number;
    currency: string;
  };
  link?: string;
}

/**
 * Franchise/collection grouping (e.g., "Marvel Cinematic Universe")
 */
export interface BelongsToCollection {
  id: number;
  name: string;
  posterPath?: string;
  backdropPath?: string;
  part?: number; // Which part in the collection
  totalParts?: number;
}

/**
 * Content classification with all industry-standard fields
 */
export interface ContentClassification {
  originalLanguage: string;
  originCountry: string[];
  originalTitle?: string;
  certification?: string;
  contentRating?: string; // Alternative to certification
  tagline?: string;
  status?: 'Released' | 'Post Production' | 'In Production' | 'Planned' | 'Canceled' | 'Ended' | 'Returning Series' | 'Pilot';
  popularity: number;
  voteCount: number;
  voteAverage?: number;
  keywords?: string[];
  spokenLanguages?: string[];
  translations?: string[];
  adult?: boolean;
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
  director?: string;
  writer?: string;
  cast?: CastMember[];
  crew?: CrewMember[];
  studios?: string[];
  keywords?: string[];
  collections?: string[];
  
  // NEW: Industry-standard fields
  originalLanguage?: string;
  originCountry?: string[];
  originalTitle?: string;
  popularity?: number;
  voteCount?: number;
  belongsToCollection?: BelongsToCollection;
  watchProviders?: WatchProvider[];
  productionCompanies?: ProductionCompany[];
  productionCountries?: ProductionCountry[];
  spokenLanguages?: SpokenLanguage[];
  imdbId?: string;
  revenueCurrency?: string;
  budgetCurrency?: string;
  
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
  
  // NEW: Industry-standard fields
  originalLanguage?: string;
  originCountry?: string[];
  originalTitle?: string;
  popularity?: number;
  voteCount?: number;
  belongsToCollection?: BelongsToCollection;
  watchProviders?: WatchProvider[];
  productionCompanies?: ProductionCompany[];
  productionCountries?: ProductionCountry[];
  spokenLanguages?: SpokenLanguage[];
  networks?: Network[];
  episodeRunTime?: number[];
  inProduction?: boolean;
  lastAirDate?: string;
  nextEpisodeToAir?: UnifiedEpisode;
  numberOfEpisodes?: number;
  numberOfSeasons?: number;
  type?: 'Documentary' | 'News' | 'Reality' | 'Scripted' | 'Talk Show' | 'Video';
  
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
  
  // NEW: Industry-standard fields
  airDate?: string;
  posterPath?: string;
  seasonNumber?: number;
  name?: string;
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
  
  // NEW: Industry-standard fields
  airDate?: string;
  episodeNumber?: number;
  name?: string;
  seasonNumber?: number;
  stillPath?: string;
  voteAverage?: number;
  voteCount?: number;
  productionCode?: string;
  director?: string[];
  writer?: string[];
  isSeasonFinale?: boolean;
  isSeriesFinale?: boolean;
  
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
  
  // NEW: Industry-standard fields
  order?: number;
  profilePath?: string;
  characterName?: string;
  department?: string;
  job?: string;
}

export interface CrewMember {
  job?: string;
  jobs?: string[];
  person: UnifiedPerson;
  department?: string;
  
  // NEW: Industry-standard fields
  profilePath?: string;
  order?: number;
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
  
  // NEW: Industry-standard fields
  alsoKnownAs?: string[];
  adult?: boolean;
  placeOfBirth?: string;
  profilePath?: string;
  popularity?: number;
  imdbId?: string;
  deathday?: string;
  biography?: string; // Already exists but keeping for clarity
}

export interface PersonCredits<T> {
  cast?: { character?: string; media: T }[];
  crew?: { job?: string; department?: string; media: T }[];
}

// ============================================================================
// PRODUCTION TYPES
// ============================================================================

export interface ProductionCompany {
  id: number;
  name: string;
  logoPath?: string;
  originCountry?: string;
  parentCompany?: string;
  description?: string;
  headquarters?: string;
}

export interface ProductionCountry {
  iso3166_1: string;
  name: string;
  countryCode?: string;
}

export interface SpokenLanguage {
  englishName: string;
  iso639_1: string;
  name: string;
  code?: string;
}

export interface Network {
  id: number;
  name: string;
  logoPath?: string;
  originCountry?: string;
  headquarters?: string;
  parentCompany?: string;
}

// ============================================================================
// SEARCH TYPES (Enhanced)
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

/**
 * Enhanced SearchRequest with full filtering capabilities
 * Supports all industry-standard filters
 */
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
  
  // NEW: Industry-standard filters
  originalLanguage?: string;
  originCountry?: string[];
  region?: string;
  minRating?: number;
  maxRating?: number;
  minVotes?: number;
  startYear?: number;
  endYear?: number;
  keywords?: string[];
  watchProviders?: number[];
  withCast?: string[];
  withCrew?: string[];
  withCompanies?: string[];
  withoutGenres?: string[];
  sortBy?: 'popularity.desc' | 'popularity.asc' | 'release_date.desc' | 'release_date.asc' | 'vote_average.desc' | 'vote_average.asc' | 'vote_count.desc' | 'vote_count.asc';
  includeAdult?: boolean;
  language?: string; // For localized results
  watchRegion?: string;
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
// TRENDING / POPULAR TYPES (Enhanced)
// ============================================================================

export interface TrendingItem<T> {
  watchers: number;
  media: T;
  
  // NEW: Additional metrics
  score?: number;
  rank?: number;
  trendScore?: number;
  period?: 'day' | 'week' | 'month' | 'year';
}

export interface AnticipatedItem<T> {
  listCount: number;
  media: T;
  
  // NEW: Additional metrics
  anticipationScore?: number;
  rank?: number;
}

export interface BoxOfficeItem {
  revenue: number;
  movie: UnifiedMovie;
  
  // NEW: Additional metrics
  weekendRevenue?: number;
  domesticRevenue?: number;
  internationalRevenue?: number;
  openingRevenue?: number;
  rank?: number;
  weekNumber?: number;
}

export interface UpdatedItem<T> {
  updatedAt: string;
  media: T;
  
  // NEW: Additional metrics
  updateType?: 'full' | 'partial' | 'metadata';
  changes?: string[];
}

// ============================================================================
// CALENDAR TYPES
// ============================================================================

export interface CalendarEntry {
  released: string;
  episode?: UnifiedEpisode;
  show?: UnifiedShow;
  movie?: UnifiedMovie;
  
  // NEW: Additional metrics
  isPremiere?: boolean;
  isFinale?: boolean;
  isSpecial?: boolean;
  countdownDays?: number;
  formattedDate?: string;
  timezone?: string;
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
  
  // NEW: Industry-standard fields
  isPinned?: boolean;
  isVerified?: boolean;
  isHighlighted?: boolean;
  replyCount?: number;
  likeCount?: number;
  dislikeCount?: number;
  userScore?: number;
}

// ============================================================================
// FLAT RESULT TYPE (Enhanced with Industry-Standard Fields)
// ============================================================================

/**
 * IMetadataResult - Flat result type consumed by UnifiedMediaService
 * 
 * v2.0 - Extended with all industry-standard fields for complete content classification
 * 
 * NEW FIELDS:
 * - originalLanguage: What language was it made in? (e.g., "en", "hi", "ko")
 * - originCountry: What country was it made in? (e.g., ["US"], ["IN"], ["KR"])
 * - originalTitle: The original title before translation
 * - popularity: Current popularity score (0-100)
 * - voteCount: Number of votes/ratings
 * - certification: Parental rating (e.g., "PG-13", "R", "TV-MA")
 * - tagline: The movie/show's tagline
 * - status: Release status (e.g., "Released", "Post Production", "Cancelled")
 * - belongsToCollection: Franchise grouping (e.g., "Marvel Cinematic Universe")
 * - watchProviders: Where to watch this content
 * - keywords: Searchable keywords/tags
 * - budget: Production budget (for movies)
 * - revenue: Box office revenue (for movies)
 * - networks: TV networks/streaming platforms (for shows)
 * - spokenLanguages: Languages spoken in the content
 * - productionCompanies: Studios/companies that produced it
 * - productionCountries: Countries where it was produced
 */
export interface IMetadataResult {
  // ─── Core Identity ──────────────────────────────────────────────────────────
  id: string;
  title: string;
  type: 'movie' | 'tv';
  source?: string; // Which metadata provider this came from
  
  // ─── Release Information ──────────────────────────────────────────────────
  year?: number;
  /** Full release/air date string (e.g. "2026-06-15"), when the provider exposes one. */
  releaseDate?: string;
  
  // ─── Visual Assets ─────────────────────────────────────────────────────────
  poster?: string;
  backdrop?: string;
  
  // ─── Content Description ──────────────────────────────────────────────────
  overview?: string;
  tagline?: string; // NEW: Movie/show tagline
  status?: 'Released' | 'Post Production' | 'In Production' | 'Planned' | 'Canceled' | 'Ended' | 'Returning Series' | 'Pilot'; // NEW
  genres?: string[];
  keywords?: string[]; // NEW: Searchable keywords/tags
  
  // ─── Ratings & Metrics ────────────────────────────────────────────────────
  rating?: number;
  popularity?: number; // NEW: Current popularity score
  voteCount?: number; // NEW: Number of votes/ratings
  runtime?: number;
  
  // ─── Classification ───────────────────────────────────────────────────────
  originalLanguage?: string; // NEW: What language was it made in?
  originCountry?: string[]; // NEW: What country was it made in?
  originalTitle?: string; // NEW: The original title before translation
  certification?: string; // NEW: Parental rating (e.g., "PG-13", "R", "TV-MA")
  
  // ─── Franchise & Collections ─────────────────────────────────────────────
  belongsToCollection?: BelongsToCollection; // NEW: Franchise grouping (e.g., "Marvel Cinematic Universe")
  
  // ─── Where to Watch ──────────────────────────────────────────────────────
  watchProviders?: WatchProvider[]; // NEW: Where to watch this content
  
  // ─── Cast & Crew ──────────────────────────────────────────────────────────
  cast?: CastMember[];
  
  // ─── Production Information ──────────────────────────────────────────────
  budget?: number; // NEW: Production budget (for movies)
  revenue?: number; // NEW: Box office revenue (for movies)
  networks?: Network[]; // NEW: TV networks/streaming platforms (for shows)
  spokenLanguages?: SpokenLanguage[]; // NEW: Languages spoken in the content
  productionCompanies?: ProductionCompany[]; // NEW: Studios/companies that produced it
  productionCountries?: ProductionCountry[]; // NEW: Countries where it was produced
  
  // ─── TV-Specific ──────────────────────────────────────────────────────────
  numberOfSeasons?: number; // NEW: Total seasons (for TV shows)
  numberOfEpisodes?: number; // NEW: Total episodes (for TV shows)
  lastAirDate?: string; // NEW: Last air date (for TV shows)
  inProduction?: boolean; // NEW: Is it still in production?
  
  // ─── Provider Data ──────────────────────────────────────────────────────
  providerData?: Record<string, unknown>; // Raw provider data (for debugging)
}

// ============================================================================
// PROVIDER INTERFACE (Enhanced)
// ============================================================================

export interface MetadataProvider {
  name: string;
  id: string;
  priority: number;
  enabled: boolean;
  
  // Search (Enhanced)
  search?(query: SearchRequest): Promise<SearchResult[]>;
  searchById?(idType: string, id: string): Promise<SearchResult[]>;
  
  // Discover (NEW) - Category browsing without keyword
  discover?(filters: DiscoverFilters): Promise<SearchResult[]>;
  
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
// DISCOVER FILTERS (NEW)
// ============================================================================

/**
 * DiscoverFilters - For category browsing without a keyword
 * This is how Netflix/MovieBox do category rows
 */
export interface DiscoverFilters {
  // Core filters
  languages?: string[]; // Original language(s)
  countries?: string[]; // Origin country(s)
  region?: string; // Region for regional content
  genres?: string[];
  certifications?: string[];
  
  // Date/Time filters
  year?: number;
  startYear?: number;
  endYear?: number;
  releaseDateGTE?: string;
  releaseDateLTE?: string;
  firstAirDateGTE?: string;
  firstAirDateLTE?: string;
  
  // Rating filters
  minRating?: number;
  maxRating?: number;
  minVotes?: number;
  
  // Content type
  type?: 'movie' | 'tv' | 'all';
  status?: string[];
  
  // Advanced
  keywords?: string[];
  watchProviders?: number[];
  withCast?: string[];
  withCrew?: string[];
  withCompanies?: string[];
  withoutGenres?: string[];
  sortBy?: 'popularity.desc' | 'popularity.asc' | 'release_date.desc' | 'release_date.asc' | 'vote_average.desc' | 'vote_average.asc' | 'vote_count.desc' | 'vote_count.asc';
  includeAdult?: boolean;
  
  // Pagination
  page?: number;
  limit?: number;
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
  type: 'movie' | 'show' | 'episode' | 'person' | 'list' | 'search' | 'trending' | 'popular' | 'anticipated' | 'calendar' | 'discover';
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
  
  // NEW: Discover filters
  discoverFilters?: DiscoverFilters;
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
  
  // NEW: Region/language defaults
  defaultRegion?: string;
  defaultCertificationCountry?: string;
  includeAdultContent?: boolean;
}