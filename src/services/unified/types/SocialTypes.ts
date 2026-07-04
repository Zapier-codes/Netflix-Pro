/**
 * Unified Social Types
 * Defines all type interfaces for social/tracking providers (Trakt, SIMKL, etc.)
 */

// ============================================================================
// BASE SOCIAL TYPES
// ============================================================================

export interface SocialProviderConfig {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  apiKey?: string;
  clientId?: string;
  clientSecret?: string;
  baseUrl: string;
  timeout: number;
  retryCount: number;
  cacheDuration: number;
  rateLimit: number;
  publicOnly: boolean;
  customHeaders?: Record<string, string>;
}

export interface SocialProvider {
  id: string;
  name: string;
  displayName: string;
  enabled: boolean;
  priority: number;
  requiresAuth: boolean;
  supportsPublic: boolean;
  baseUrl: string;
  
  // Health
  isAvailable(): Promise<boolean>;
  healthCheck(): Promise<SocialHealth>;
  
  // Public Profile (no auth required)
  getUserProfile(username: string): Promise<SocialUserProfile | null>;
  getUserStats(username: string): Promise<SocialUserStats | null>;
  
  // Public History (no auth required)
  getUserHistory(username: string, options?: HistoryQueryOptions): Promise<SocialHistoryEntry[]>;
  getUserWatchedMovies(username: string): Promise<SocialWatchedMovie[]>;
  getUserWatchedShows(username: string): Promise<SocialWatchedShow[]>;
  
  // Public Watchlist (no auth required)
  getUserWatchlist(username: string, type?: 'movies' | 'shows' | 'all'): Promise<SocialWatchlistEntry[]>;
  
  // Public Collection (no auth required)
  getUserCollection(username: string, type?: 'movies' | 'shows' | 'all'): Promise<SocialCollectionEntry[]>;
  
  // Public Lists (no auth required)
  getUserLists(username: string): Promise<SocialUserList[]>;
  getListItems(listId: string | number, type?: string): Promise<SocialListItem[]>;
  
  // Public Ratings (no auth required)
  getUserRatings(username: string, type?: 'movies' | 'shows' | 'seasons' | 'episodes' | 'all'): Promise<SocialRatingEntry[]>;
  
  // Public Comments/Reviews (no auth required)
  getUserComments(username: string, type?: 'reviews' | 'shouts' | 'all'): Promise<SocialComment[]>;
  
  // Public Followers (no auth required)
  getUserFollowers(username: string): Promise<SocialUserMini[]>;
  getUserFollowing(username: string): Promise<SocialUserMini[]>;
  getUserFriends(username: string): Promise<SocialUserMini[]>;
  
  // Global Public Data (no auth required)
  getTrendingMovies?(): Promise<SocialTrendingMovie[]>;
  getTrendingShows?(): Promise<SocialTrendingShow[]>;
  getPopularMovies?(): Promise<SocialPopularMovie[]>;
  getPopularShows?(): Promise<SocialPopularShow[]>;
  getAnticipatedMovies?(): Promise<SocialAnticipatedMovie[]>;
  getAnticipatedShows?(): Promise<SocialAnticipatedShow[]>;
  
  // Search (no auth required)
  searchUsers?(query: string): Promise<SocialUserMini[]>;
  searchMedia?(query: string, type?: string): Promise<SocialSearchResult[]>;
}

export interface SocialHealth {
  status: 'healthy' | 'degraded' | 'down';
  latency: number;
  lastChecked: number;
  message?: string;
  error?: string;
  rateLimitRemaining?: number;
  rateLimitReset?: number;
}

// ============================================================================
// USER PROFILE TYPES
// ============================================================================

export interface SocialUserProfile {
  username: string;
  private: boolean;
  name?: string;
  vip?: boolean;
  vipEp?: boolean;
  ids: {
    slug: string;
    trakt?: number;
    imdb?: string;
    tmdb?: number;
  };
  images?: {
    avatar?: SocialImage;
    avatarFull?: SocialImage;
  };
  location?: string;
  about?: string;
  gender?: string;
  age?: number;
  joinedAt: string;
  timezone?: string;
  protected?: boolean;
  
  // Provider-specific
  provider?: string;
  providerData?: Record<string, unknown>;
}

export interface SocialUserMini {
  username: string;
  private: boolean;
  name?: string;
  vip?: boolean;
  ids: {
    slug: string;
  };
  images?: {
    avatar?: SocialImage;
  };
  followedAt?: string;
  approvedAt?: string;
}

export interface SocialImage {
  full?: string;
  medium?: string;
  thumb?: string;
}

// ============================================================================
// STATS TYPES
// ============================================================================

export interface SocialUserStats {
  username: string;
  movies: {
    plays: number;
    watched: number;
    minutes: number;
    collected: number;
    ratings: number;
    comments: number;
  };
  shows: {
    watched: number;
    collected: number;
    ratings: number;
    comments: number;
  };
  seasons: {
    ratings: number;
    comments: number;
  };
  episodes: {
    plays: number;
    watched: number;
    minutes: number;
    collected: number;
    ratings: number;
    comments: number;
  };
  network: {
    friends: number;
    followers: number;
    following: number;
  };
  ratings: {
    total: number;
    distribution: Record<string, number>;
  };
  
  // Provider-specific
  provider?: string;
  providerData?: Record<string, unknown>;
}

// ============================================================================
// HISTORY TYPES
// ============================================================================

export interface HistoryQueryOptions {
  type?: 'movies' | 'shows' | 'episodes' | 'all';
  startAt?: string;
  endAt?: string;
  page?: number;
  limit?: number;
  extended?: 'minimal' | 'full' | 'images';
}

export interface SocialHistoryEntry {
  id: number;
  watchedAt: string;
  action: 'watch' | 'scrobble' | 'checkin';
  type: 'movie' | 'episode';
  
  // Movie data
  movie?: SocialMovie;
  
  // Show/Episode data
  show?: SocialShow;
  episode?: SocialEpisode;
  
  // Provider-specific
  provider?: string;
  providerData?: Record<string, unknown>;
}

export interface SocialWatchedMovie {
  plays: number;
  lastWatchedAt: string;
  lastUpdatedAt: string;
  movie: SocialMovie;
  provider?: string;
}

export interface SocialWatchedShow {
  plays: number;
  lastWatchedAt: string;
  lastUpdatedAt: string;
  resetAt?: string;
  show: SocialShow;
  seasons?: SocialWatchedSeason[];
  provider?: string;
}

export interface SocialWatchedSeason {
  number: number;
  episodes: SocialWatchedEpisode[];
}

export interface SocialWatchedEpisode {
  number: number;
  plays: number;
  lastWatchedAt: string;
  episode?: SocialEpisode;
}

// ============================================================================
// WATCHLIST TYPES
// ============================================================================

export interface SocialWatchlistEntry {
  rank: number;
  listedAt: string;
  type: 'movie' | 'show' | 'season' | 'episode';
  
  movie?: SocialMovie;
  show?: SocialShow;
  season?: SocialSeason;
  episode?: SocialEpisode;
  
  provider?: string;
  providerData?: Record<string, unknown>;
}

// ============================================================================
// COLLECTION TYPES
// ============================================================================

export interface SocialCollectionEntry {
  collectedAt: string;
  updatedAt: string;
  type: 'movie' | 'show' | 'episode';
  
  movie?: SocialMovie;
  show?: SocialShow;
  season?: SocialSeason;
  episode?: SocialEpisode;
  
  metadata?: SocialMediaMetadata;
  
  provider?: string;
  providerData?: Record<string, unknown>;
}

export interface SocialMediaMetadata {
  mediaType?: string;
  resolution?: string;
  hdr?: string;
  audio?: string;
  audioChannels?: string;
  '3d'?: boolean;
}

// ============================================================================
// LIST TYPES
// ============================================================================

export interface SocialUserList {
  name: string;
  description?: string;
  privacy: 'private' | 'friends' | 'public';
  type: 'personal' | 'official' | 'watchlists';
  displayNumbers: boolean;
  allowComments: boolean;
  sortBy: string;
  sortHow: 'asc' | 'desc';
  createdAt: string;
  updatedAt: string;
  itemCount: number;
  commentCount: number;
  likes: number;
  ids: {
    trakt?: number;
    slug?: string;
  };
  user?: SocialUserMini;
  
  provider?: string;
  providerData?: Record<string, unknown>;
}

export interface SocialListItem {
  rank: number;
  listedAt: string;
  type: 'movie' | 'show' | 'season' | 'episode' | 'person';
  
  movie?: SocialMovie;
  show?: SocialShow;
  season?: SocialSeason;
  episode?: SocialEpisode;
  person?: SocialPerson;
  
  provider?: string;
  providerData?: Record<string, unknown>;
}

// ============================================================================
// RATING TYPES
// ============================================================================

export interface SocialRatingEntry {
  rating: number;
  ratedAt: string;
  type: 'movie' | 'show' | 'season' | 'episode';
  
  movie?: SocialMovie;
  show?: SocialShow;
  season?: SocialSeason;
  episode?: SocialEpisode;
  
  provider?: string;
  providerData?: Record<string, unknown>;
}

// ============================================================================
// COMMENT TYPES
// ============================================================================

export interface SocialComment {
  id: number;
  parentId?: number;
  createdAt: string;
  updatedAt: string;
  comment: string;
  spoiler: boolean;
  review: boolean;
  replies: number;
  likes: number;
  userRating?: number;
  user: SocialUserMini;
  
  // What the comment is on
  commentType?: 'movie' | 'show' | 'season' | 'episode' | 'list';
  movie?: SocialMovie;
  show?: SocialShow;
  season?: SocialSeason;
  episode?: SocialEpisode;
  list?: SocialUserList;
  
  provider?: string;
  providerData?: Record<string, unknown>;
}

// ============================================================================
// MEDIA OBJECT TYPES (Minimal for social)
// ============================================================================

export interface SocialMediaIds {
  trakt?: number;
  slug?: string;
  imdb?: string;
  tmdb?: number;
  tvdb?: number;
  tvrage?: number;
}

export interface SocialMovie {
  title: string;
  year: number;
  ids: SocialMediaIds;
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
  language?: string;
  availableTranslations?: string[];
  genres?: string[];
  certification?: string;
  images?: SocialMediaImages;
}

export interface SocialShow {
  title: string;
  year: number;
  ids: SocialMediaIds;
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
  country?: string;
  trailer?: string;
  homepage?: string;
  status?: string;
  rating?: number;
  votes?: number;
  language?: string;
  availableTranslations?: string[];
  genres?: string[];
  airedEpisodes?: number;
  images?: SocialMediaImages;
}

export interface SocialSeason {
  number: number;
  ids: SocialMediaIds;
  title?: string;
  overview?: string;
  rating?: number;
  votes?: number;
  episodeCount?: number;
  airedEpisodes?: number;
  firstAired?: string;
  updatedAt?: string;
  network?: string;
  images?: SocialMediaImages;
}

export interface SocialEpisode {
  season: number;
  number: number;
  title: string;
  ids: SocialMediaIds;
  overview?: string;
  rating?: number;
  votes?: number;
  firstAired?: string;
  updatedAt?: string;
  availableTranslations?: string[];
  runtime?: number;
  images?: SocialMediaImages;
}

export interface SocialPerson {
  name: string;
  ids: SocialMediaIds;
  biography?: string;
  birthday?: string;
  death?: string;
  birthplace?: string;
  homepage?: string;
  gender?: string;
  knownForDepartment?: string;
  images?: SocialMediaImages;
}

export interface SocialMediaImages {
  poster?: string[];
  fanart?: string[];
  banner?: string[];
  logo?: string[];
  clearart?: string[];
  thumb?: string[];
  screenshot?: string[];
  headshot?: string[];
  avatar?: SocialImage;
}

// ============================================================================
// TRENDING / POPULAR / ANTICIPATED
// ============================================================================

export interface SocialTrendingMovie {
  watchers: number;
  movie: SocialMovie;
  provider?: string;
}

export interface SocialTrendingShow {
  watchers: number;
  show: SocialShow;
  provider?: string;
}

export interface SocialPopularMovie {
  movie: SocialMovie;
  provider?: string;
}

export interface SocialPopularShow {
  show: SocialShow;
  provider?: string;
}

export interface SocialAnticipatedMovie {
  listCount: number;
  movie: SocialMovie;
  provider?: string;
}

export interface SocialAnticipatedShow {
  listCount: number;
  show: SocialShow;
  provider?: string;
}

// ============================================================================
// SEARCH RESULTS
// ============================================================================

export interface SocialSearchResult {
  type: 'movie' | 'show' | 'episode' | 'person' | 'user' | 'list';
  score: number;
  
  movie?: SocialMovie;
  show?: SocialShow;
  episode?: SocialEpisode;
  person?: SocialPerson;
  user?: SocialUserMini;
  list?: SocialUserList;
  
  provider?: string;
}

// ============================================================================
// CALENDAR TYPES
// ============================================================================

export interface SocialCalendarEntry {
  released: string;
  episode?: SocialEpisode;
  show?: SocialShow;
  movie?: SocialMovie;
  provider?: string;
}

// ============================================================================
// FOLLOW TYPES
// ============================================================================

export interface SocialFollowRequest {
  id: number;
  requestedAt: string;
  user: SocialUserMini;
}

// ============================================================================
// SETTINGS TYPES
// ============================================================================

export interface SocialUserSettings {
  user: SocialUserProfile;
  account: {
    timezone: string;
    time24hr: boolean;
    weekStartDay: string;
    coverImage?: string;
  };
  connections: {
    twitter: boolean;
    tumblr: boolean;
    medium: boolean;
    apple: boolean;
  };
  sharingText: {
    watching: string;
    watched: string;
  };
  provider?: string;
}

// ============================================================================
// ACTIVITY TYPES
// ============================================================================

export interface SocialLastActivity {
  all: string;
  movies: {
    watchedAt: string;
    collectedAt: string;
    ratedAt: string;
    watchlistedAt: string;
    commentedAt: string;
    pausedAt: string;
    hiddenAt: string;
  };
  episodes: {
    watchedAt: string;
    collectedAt: string;
    ratedAt: string;
    watchlistedAt: string;
    commentedAt: string;
    pausedAt: string;
    hiddenAt: string;
  };
  shows: {
    ratedAt: string;
    watchlistedAt: string;
    commentedAt: string;
    hiddenAt: string;
  };
  seasons: {
    ratedAt: string;
    watchlistedAt: string;
    commentedAt: string;
    hiddenAt: string;
  };
  comments: {
    likedAt: string;
  };
  lists: {
    likedAt: string;
    updatedAt: string;
    commentedAt: string;
  };
  watchlist: {
    updatedAt: string;
  };
  favorites: {
    updatedAt: string;
  };
  recommendations: {
    updatedAt: string;
  };
  provider?: string;
}

// ============================================================================
// HIDDEN ITEMS
// ============================================================================

export interface SocialHiddenItem {
  hiddenAt: string;
  type: 'movie' | 'show' | 'season';
  
  movie?: SocialMovie;
  show?: SocialShow;
  season?: SocialSeason;
  
  provider?: string;
}

// ============================================================================
// PLAYBACK PROGRESS
// ============================================================================

export interface SocialPlaybackProgress {
  id: number;
  progress: number;
  pausedAt: string;
  type: 'movie' | 'episode';
  
  movie?: SocialMovie;
  show?: SocialShow;
  episode?: SocialEpisode;
  
  provider?: string;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export class SocialError extends Error {
  constructor(
    message: string,
    public code: SocialErrorCode,
    public provider?: string,
    public statusCode?: number,
    public isRetryable: boolean = false
  ) {
    super(message);
    this.name = 'SocialError';
  }
}

export type SocialErrorCode = 
  | 'USER_NOT_FOUND'
  | 'PRIVATE_PROFILE'
  | 'RATE_LIMITED'
  | 'PROVIDER_UNAVAILABLE'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'PARSE_ERROR'
  | 'INVALID_REQUEST'
  | 'AUTH_REQUIRED'
  | 'NOT_SUPPORTED';

// ============================================================================
// AGGREGATION TYPES
// ============================================================================

export interface SocialAggregationConfig {
  providers: string[];
  deduplicateBy: 'imdb' | 'tmdb' | 'tvdb' | 'trakt' | 'title';
  preferProvider?: string;
  includePrivate: boolean;
  maxResults: number;
  sortBy: 'date' | 'rating' | 'popularity' | 'provider';
  sortOrder: 'asc' | 'desc';
}

export interface AggregatedSocialData {
  profile?: SocialUserProfile;
  stats?: SocialUserStats;
  history: SocialHistoryEntry[];
  watchlist: SocialWatchlistEntry[];
  collection: SocialCollectionEntry[];
  ratings: SocialRatingEntry[];
  lists: SocialUserList[];
  comments: SocialComment[];
  followers: SocialUserMini[];
  following: SocialUserMini[];
  friends: SocialUserMini[];
  
  sources: {
    provider: string;
    dataType: string;
    latency: number;
    cached: boolean;
  }[];
  
  errors: {
    provider: string;
    code: SocialErrorCode;
    message: string;
  }[];
  
  timestamp: number;
}