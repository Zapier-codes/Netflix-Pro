/**
 * Unified Provider Types
 * Defines all type interfaces for stream and metadata providers
 */

import { StreamSource as MediaStreamSource, StreamQuality } from './StreamTypes';
import { IMetadataResult } from './MetadataTypes';

// Import stream types from StreamTypes to avoid duplication
import {
  StreamSource,
  StreamRequest,
  StreamMeta,
  StreamProvider as StreamProviderType,
  StreamProviderConfig as StreamProviderConfigType,
} from './StreamTypes';

// Re-export them so they're available from ProviderTypes
export type { StreamSource, StreamRequest, StreamMeta, StreamProviderType, StreamProviderConfigType };

// ============================================================================
// BASE PROVIDER TYPES
// ============================================================================

export interface BaseProvider {
  id: string;
  name: string;
  displayName: string;
  version: string;
  description?: string;
  enabled: boolean;
  priority: number;
  isPremium: boolean;
  requiresAuth: boolean;
  supportsProxy: boolean;
  baseUrl?: string;
  apiKey?: string;
}

// ============================================================================
// STREAM PROVIDER TYPES
// ============================================================================

export interface StreamProvider extends BaseProvider {
  type: 'stream';
  capabilities: StreamCapabilities;
  config: StreamProviderConfigType;
  
  getStreams(request: StreamRequest): Promise<StreamResult>;
  resolveStream(sourceId: string): Promise<ResolvedStream>;
  isAvailable(): Promise<boolean>;
  healthCheck(): Promise<ProviderHealth>;
}

export interface StreamCapabilities {
  movies: boolean;
  shows: boolean;
  episodes: boolean;
  liveTv: boolean;
  maxQuality: '4K' | '1080p' | '720p' | '480p' | 'unknown';
  subtitleSupport: boolean;
  proxyRequired: boolean;
  geoRestricted: boolean;
  supportedCountries?: string[];
}

export interface StreamResult {
  sources: StreamSource[];
  subtitles?: SubtitleTrack[];
  meta?: StreamMeta;
  expiresAt?: number;
}

export interface ResolvedStream {
  url: string;
  headers?: Record<string, string>;
  type: 'hls' | 'dash' | 'mp4' | 'mkv' | 'm3u8' | 'iframe' | 'direct';
  quality: string;
  duration?: number;
}

// ============================================================================
// METADATA PROVIDER TYPES
// ============================================================================

export interface MetadataProvider extends BaseProvider {
  type: 'metadata';
  capabilities: MetadataCapabilities;
  config: MetadataProviderConfig;
  
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  getMovie(id: string | number): Promise<MovieMetadata | null>;
  getShow(id: string | number): Promise<ShowMetadata | null>;
  getEpisode(showId: string | number, season: number, episode: number): Promise<EpisodeMetadata | null>;
  getPerson(id: string | number): Promise<PersonMetadata | null>;
  getTrending?(type: 'movies' | 'shows' | 'all'): Promise<TrendingResult[]>;
  getPopular?(type: 'movies' | 'shows' | 'all'): Promise<PopularResult[]>;
  getCalendar?(startDate: string, days: number): Promise<CalendarEntry[]>;
  isAvailable(): Promise<boolean>;
  healthCheck(): Promise<ProviderHealth>;
}

export interface MetadataCapabilities {
  movies: boolean;
  shows: boolean;
  episodes: boolean;
  people: boolean;
  images: boolean;
  ratings: boolean;
  reviews: boolean;
  trending: boolean;
  popular: boolean;
  calendar: boolean;
  search: boolean;
  supportsExtendedInfo: boolean;
  supportsFilters: boolean;
  maxExtendedLevel: 'minimal' | 'full' | 'images';
}

export interface SearchOptions {
  type?: ('movie' | 'show' | 'episode' | 'person')[];
  year?: number;
  language?: string;
  page?: number;
  limit?: number;
  extended?: boolean;
  filters?: Record<string, string | string[]>;
}

export interface SearchResult {
  type: 'movie' | 'show' | 'episode' | 'person' | 'list';
  score: number;
  movie?: MovieMetadata;
  show?: ShowMetadata;
  episode?: EpisodeMetadata;
  person?: PersonMetadata;
  list?: ListMetadata;
}

// ============================================================================
// SUBTITLE PROVIDER TYPES
// ============================================================================

export interface SubtitleProvider extends BaseProvider {
  type: 'subtitle';
  capabilities: SubtitleCapabilities;
  config: SubtitleProviderConfig;
  
  search(request: SubtitleSearchRequest): Promise<SubtitleTrack[]>;
  download(trackId: string): Promise<string>;
  isAvailable(): Promise<boolean>;
  healthCheck(): Promise<ProviderHealth>;
}

export interface SubtitleCapabilities {
  movies: boolean;
  shows: boolean;
  episodes: boolean;
  hearingImpaired: boolean;
  forced: boolean;
  machineTranslated: boolean;
  maxLanguages: number;
  requiresAuth: boolean;
}

export interface SubtitleSearchRequest {
  imdbId?: string;
  tmdbId?: number;
  tvdbId?: number;
  title?: string;
  year?: number;
  season?: number;
  episode?: number;
  language?: string;
  forced?: boolean;
  hearingImpaired?: boolean;
}

export interface SubtitleTrack {
  id: string;
  provider: string;
  url: string;
  language: string;
  languageCode: string;
  label: string;
  format: 'srt' | 'vtt' | 'ass' | 'ssa' | 'sub';
  isDefault: boolean;
  isForced: boolean;
  isSDH: boolean;
  rating?: number;
  downloadCount?: number;
  uploadDate?: string;
  uploader?: string;
  fps?: number;
  encoding?: string;
}

// ============================================================================
// SOCIAL PROVIDER TYPES
// ============================================================================

export interface SocialProvider extends BaseProvider {
  type: 'social';
  capabilities: SocialCapabilities;
  config: SocialProviderConfig;
  
  getUserProfile?(username: string): Promise<SocialUser | null>;
  getUserHistory?(username: string, options?: HistoryOptions): Promise<HistoryEntry[]>;
  getUserWatchlist?(username: string, type?: string): Promise<WatchlistEntry[]>;
  getUserCollection?(username: string, type?: string): Promise<CollectionEntry[]>;
  getUserLists?(username: string): Promise<UserList[]>;
  getUserStats?(username: string): Promise<UserStats>;
  isAvailable(): Promise<boolean>;
  healthCheck(): Promise<ProviderHealth>;
}

export interface SocialCapabilities {
  publicProfiles: boolean;
  publicHistory: boolean;
  publicWatchlist: boolean;
  publicCollection: boolean;
  publicLists: boolean;
  publicStats: boolean;
  comments: boolean;
  reviews: boolean;
  ratings: boolean;
  follows: boolean;
  requiresAuthForPublic: boolean;
}

export interface SocialUser {
  username: string;
  private: boolean;
  name?: string;
  vip?: boolean;
  vipEp?: boolean;
  slug: string;
  avatar?: string;
  location?: string;
  about?: string;
  gender?: string;
  age?: number;
  joinedAt?: string;
}

export interface HistoryEntry {
  id: number;
  watchedAt: string;
  action: 'watch' | 'scrobble' | 'checkin';
  type: 'movie' | 'episode';
  movie?: MovieMetadata;
  show?: ShowMetadata;
  episode?: EpisodeMetadata;
}

export interface WatchlistEntry {
  rank: number;
  listedAt: string;
  type: 'movie' | 'show' | 'season' | 'episode';
  movie?: MovieMetadata;
  show?: ShowMetadata;
  season?: SeasonMetadata;
  episode?: EpisodeMetadata;
}

export interface CollectionEntry {
  collectedAt: string;
  updatedAt: string;
  type: 'movie' | 'show' | 'episode';
  movie?: MovieMetadata;
  show?: ShowMetadata;
  season?: SeasonMetadata;
  episode?: EpisodeMetadata;
  metadata?: {
    mediaType?: string;
    resolution?: string;
    hdr?: string;
    audio?: string;
    audioChannels?: string;
    '3d'?: boolean;
  };
}

export interface UserList {
  name: string;
  description?: string;
  privacy: 'private' | 'friends' | 'public';
  type: 'personal' | 'official' | 'watchlists';
  displayNumbers: boolean;
  allowComments: boolean;
  sortBy: string;
  sortHow: string;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
  commentCount: number;
  likes: number;
  ids: {
    trakt?: number;
    slug?: string;
  };
  user?: SocialUser;
}

export interface UserStats {
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
}

export interface HistoryOptions {
  type?: 'movies' | 'shows' | 'episodes' | 'all';
  startAt?: string;
  endAt?: string;
  page?: number;
  limit?: number;
}

// ============================================================================
// COMMON METADATA TYPES
// ============================================================================

export interface MediaIds {
  trakt?: number;
  slug?: string;
  imdb?: string;
  tmdb?: number;
  tvdb?: number;
  tvrage?: number;
}

export interface MovieMetadata {
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
  rating?: number;
  votes?: number;
  commentCount?: number;
  updatedAt?: string;
  language?: string;
  availableTranslations?: string[];
  genres?: string[];
  certification?: string;
  images?: MediaImages;
}

export interface ShowMetadata {
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
  country?: string;
  trailer?: string;
  homepage?: string;
  status?: string;
  rating?: number;
  votes?: number;
  commentCount?: number;
  updatedAt?: string;
  language?: string;
  availableTranslations?: string[];
  genres?: string[];
  airedEpisodes?: number;
  images?: MediaImages;
  seasons?: SeasonMetadata[];
}

export interface SeasonMetadata {
  number: number;
  ids: MediaIds;
  title?: string;
  overview?: string;
  rating?: number;
  votes?: number;
  episodeCount?: number;
  airedEpisodes?: number;
  firstAired?: string;
  updatedAt?: string;
  network?: string;
  images?: MediaImages;
  episodes?: EpisodeMetadata[];
}

export interface EpisodeMetadata {
  season: number;
  number: number;
  title: string;
  ids: MediaIds;
  overview?: string;
  rating?: number;
  votes?: number;
  commentCount?: number;
  firstAired?: string;
  updatedAt?: string;
  availableTranslations?: string[];
  runtime?: number;
  images?: MediaImages;
}

export interface PersonMetadata {
  name: string;
  ids: MediaIds;
  biography?: string;
  birthday?: string;
  death?: string;
  birthplace?: string;
  homepage?: string;
  gender?: string;
  knownForDepartment?: string;
  images?: MediaImages;
}

export interface ListMetadata {
  name: string;
  description?: string;
  privacy?: string;
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
  user?: SocialUser;
}

export interface MediaImages {
  poster?: string[];
  fanart?: string[];
  banner?: string[];
  logo?: string[];
  clearart?: string[];
  thumb?: string[];
  screenshot?: string[];
  headshot?: string[];
}

// ============================================================================
// TRENDING / POPULAR / CALENDAR
// ============================================================================

export interface TrendingResult {
  watchers: number;
  movie?: MovieMetadata;
  show?: ShowMetadata;
}

export interface PopularResult {
  movie?: MovieMetadata;
  show?: ShowMetadata;
}

export interface CalendarEntry {
  released: string;
  episode?: EpisodeMetadata;
  show?: ShowMetadata;
  movie?: MovieMetadata;
}

// ============================================================================
// PROVIDER HEALTH & CONFIG
// ============================================================================

export interface ProviderHealth {
  status: 'healthy' | 'degraded' | 'down';
  latency: number;
  lastChecked: number;
  message?: string;
  error?: string;
}

export interface ProviderConfig {
  timeout: number;
  retryCount: number;
  retryDelay: number;
  cacheEnabled: boolean;
  cacheDuration: number;
  maxConcurrent: number;
  requestDelay: number;
}

export interface MetadataProviderConfig extends ProviderConfig {
  maxResults: number;
  extendedInfo: boolean;
  includeImages: boolean;
  language: string;
}

export interface SubtitleProviderConfig extends ProviderConfig {
  maxResults: number;
  languagePreference: string[];
  includeHearingImpaired: boolean;
  includeForced: boolean;
}

export interface SocialProviderConfig extends ProviderConfig {
  publicOnly: boolean;
  includePrivate: boolean;
  maxHistoryItems: number;
}

// ============================================================================
// PROVIDER REGISTRY TYPES
// ============================================================================

export type ProviderType = 'stream' | 'metadata' | 'subtitle' | 'social';

export interface RegisteredProvider {
  provider: StreamProvider | MetadataProvider | SubtitleProvider | SocialProvider;
  config: ProviderConfig;
  health: ProviderHealth;
  lastUsed: number;
  useCount: number;
  errorCount: number;
}

export interface ProviderRegistry {
  register(provider: StreamProvider | MetadataProvider | SubtitleProvider | SocialProvider): void;
  unregister(providerId: string): void;
  get(providerId: string): RegisteredProvider | undefined;
  getByType(type: ProviderType): RegisteredProvider[];
  getEnabled(type: ProviderType): RegisteredProvider[];
  getHealthy(type: ProviderType): RegisteredProvider[];
  updateHealth(providerId: string, health: ProviderHealth): void;
  getAll(): RegisteredProvider[];
}

// ============================================================================
// FACTORY TYPES
// ============================================================================

export interface ProviderFactory {
  createStreamProvider(config: StreamProviderConfigType): StreamProvider;
  createMetadataProvider(config: MetadataProviderConfig): MetadataProvider;
  createSubtitleProvider(config: SubtitleProviderConfig): SubtitleProvider;
  createSocialProvider(config: SocialProviderConfig): SocialProvider;
}

// ============================================================================
// UNIFIED SERVICE TYPES
// ============================================================================

export interface UnifiedRequest {
  mediaType: 'movie' | 'show' | 'episode';
  id?: string | number;
  ids?: MediaIds;
  title?: string;
  year?: number;
  season?: number;
  episode?: number;
  language?: string;
  quality?: string;
  includeSubtitles?: boolean;
  subtitleLanguage?: string;
  providers?: string[];
}

export interface UnifiedResponse {
  streams: StreamSource[];
  subtitles: SubtitleTrack[];
  metadata?: MovieMetadata | ShowMetadata | EpisodeMetadata;
  sources: ProviderSource[];
  errors: ProviderError[];
  timestamp: number;
}

export interface ProviderSource {
  provider: string;
  type: 'stream' | 'metadata' | 'subtitle';
  data: unknown;
  latency: number;
  cached: boolean;
}

export interface ProviderError {
  provider: string;
  type: 'stream' | 'metadata' | 'subtitle' | 'social';
  code: string;
  message: string;
  retryable: boolean;
}

// ============================================================================
// AGGREGATION TYPES
// ============================================================================

export interface AggregationStrategy {
  id: string;
  name: string;
  description: string;
  
  aggregateStreams(sources: StreamSource[]): StreamSource[];
  aggregateSubtitles(tracks: SubtitleTrack[]): SubtitleTrack[];
  aggregateMetadata(results: SearchResult[]): SearchResult[];
  deduplicate<T extends { ids?: MediaIds }>(items: T[]): T[];
  rank<T>(items: T[], criteria: RankingCriteria): T[];
}

export interface RankingCriteria {
  quality?: number;
  reliability?: number;
  speed?: number;
  freshness?: number;
  popularity?: number;
}

// ============================================================================
// STREAMING BACKEND TYPES
// (identifiers for concrete streaming implementations)
// ============================================================================

export type StreamProviderId = 'consumet' | 'moviebox' | 'vidsrc' | 'xyra';

export interface IStreamProvider {
  name: string;
  getStreams(request: {
    id: string;
    type: 'movie' | 'tv';
    season?: number;
    episode?: number;
  }): Promise<MediaStreamSource[]>;
  healthCheck(): Promise<boolean>;
}

export interface StreamProviderHealthStatus {
  provider: StreamProviderId;
  isHealthy: boolean;
  responseTime: number;
  lastChecked: number;
}

export interface StreamBackendConfig {
  defaultQuality?: StreamQuality;
  timeout?: number;
  retryCount?: number;
  [key: string]: unknown;
}

// ============================================================================
// UNIFIED SERVICE TYPES (consumed by UnifiedMediaService)
// ============================================================================

export interface UnifiedSearchOptions {
  query: string;
  type?: 'movie' | 'tv';
  year?: number;
  limit?: number;
}

export interface UnifiedStreamOptions {
  id: string;
  type: 'movie' | 'tv';
  season?: number;
  episode?: number;
  preferredQuality?: StreamQuality;
}

export interface UnifiedSubtitleOptions {
  imdbId?: string;
  tmdbId?: string;
  season?: number;
  episode?: number;
  language?: string;
}

export interface UnifiedMediaResult {
  id: string;
  title: string;
  type: 'movie' | 'tv';
  year?: number;
  /** Full release/air date string, when the source provider exposes one (see IMetadataResult). */
  releaseDate?: string;
  poster?: string;
  backdrop?: string;
  overview?: string;
  rating?: number;
  genres?: string[];
  runtime?: number;
  cast?: unknown[];
  /** Which metadata provider this came from (e.g. 'tmdb', 'kuryana', 'moviebox'). */
  source?: string;
  sources: MediaStreamSource[];
  metadata: IMetadataResult;
}