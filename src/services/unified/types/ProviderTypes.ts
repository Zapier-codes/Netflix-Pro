/**
 * Unified Provider Types
 * Defines all type interfaces for stream and metadata providers
 * 
 * v2.0 - Extended with industry-standard fields for complete provider management
 * Supports: language/country filtering, discover mode, watch providers,
 * rich metadata, and full provider lifecycle management.
 */

import { StreamSource as MediaStreamSource, StreamQuality } from './StreamTypes';
import { IMetadataResult, DiscoverFilters, WatchProvider, BelongsToCollection } from './MetadataTypes';

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
  
  // NEW: Provider metadata
  website?: string;
  documentationUrl?: string;
  supportUrl?: string;
  privacyPolicyUrl?: string;
  termsOfServiceUrl?: string;
  contactEmail?: string;
  socialLinks?: {
    twitter?: string;
    github?: string;
    discord?: string;
  };
  
  // NEW: Provider status
  status?: 'active' | 'maintenance' | 'deprecated' | 'inactive';
  lastUpdate?: string;
  versionReleaseDate?: string;
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
  
  // NEW: Additional stream methods
  getStreamsWithMetadata?(request: StreamRequest): Promise<StreamResultWithMetadata>;
  getAvailableQualities?(id: string, type: 'movie' | 'tv'): Promise<StreamQuality[]>;
  getStreamUrl?(id: string, quality?: StreamQuality): Promise<string>;
  getStreamHeaders?(id: string): Promise<Record<string, string>>;
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
  
  // NEW: Enhanced capabilities
  audioTracks?: boolean;
  multiAudioTrackSupport?: boolean;
  hdrSupport?: boolean;
  dolbyAtmos?: boolean;
  dolbyVision?: boolean;
  hdr10Plus?: boolean;
  hlg?: boolean;
  drmSupport?: ('widevine' | 'playready' | 'fairplay')[];
  downloadable?: boolean;
  offlineSupport?: boolean;
  adaptiveBitrate?: boolean;
  hevcSupport?: boolean;
  av1Support?: boolean;
  vp9Support?: boolean;
  maxBitrate?: number;
  minBitrate?: number;
  subtitleFormats?: ('srt' | 'vtt' | 'ass' | 'ssa' | 'sub' | 'ttml')[];
  subtitleLanguages?: string[];
  audioLanguages?: string[];
}

export interface StreamResult {
  sources: StreamSource[];
  subtitles?: SubtitleTrack[];
  meta?: StreamMeta;
  expiresAt?: number;
  
  // NEW: Additional stream metadata
  audioTracks?: AudioTrack[];
  availableQualities?: string[];
  recommendedQuality?: string;
  drmInfo?: DRMInfo;
  downloadInfo?: DownloadInfo;
  hdrInfo?: HDRInfo;
}

export interface StreamResultWithMetadata extends StreamResult {
  metadata: {
    title: string;
    type: 'movie' | 'tv';
    year?: number;
    duration?: number;
    poster?: string;
    backdrop?: string;
    overview?: string;
    genres?: string[];
    rating?: number;
    certification?: string;
    releaseDate?: string;
    cast?: string[];
    director?: string;
    imdbId?: string;
    tmdbId?: number;
  };
}

export interface ResolvedStream {
  url: string;
  headers?: Record<string, string>;
  type: 'hls' | 'dash' | 'mp4' | 'mkv' | 'm3u8' | 'iframe' | 'direct';
  quality: string;
  duration?: number;
  
  // NEW: Additional resolution info
  bitrate?: number;
  codec?: string;
  container?: string;
  resolution?: {
    width: number;
    height: number;
  };
  fps?: number;
  isHDR?: boolean;
  hdrType?: 'hdr10' | 'hdr10plus' | 'dolbyvision' | 'hlg';
  hasAudio?: boolean;
  audioCodec?: string;
  audioChannels?: number;
  audioBitrate?: number;
  hasSubtitles?: boolean;
  subtitleUrls?: Record<string, string>;
  drmLicenseUrl?: string;
  expiresAt?: number;
}

// ============================================================================
// AUDIO TRACK TYPES (NEW)
// ============================================================================

export interface AudioTrack {
  id: string;
  language: string;
  languageCode: string;
  label: string;
  codec: string;
  bitrate?: number;
  channels?: number;
  sampleRate?: number;
  isDefault: boolean;
  isOriginal: boolean;
  isDubbed: boolean;
  isAudioDescription: boolean;
  isCommentary: boolean;
  url?: string;
  format?: 'aac' | 'mp3' | 'ac3' | 'eac3' | 'dts' | 'truehd' | 'flac' | 'opus';
  hdr?: boolean;
  atmos?: boolean;
  spatialAudio?: boolean;
  channelLayout?: 'mono' | 'stereo' | '5.1' | '7.1' | 'atmos';
}

// ============================================================================
// HDR/DRM/DOWNLOAD TYPES (NEW)
// ============================================================================

export interface HDRInfo {
  type: 'hdr10' | 'hdr10plus' | 'dolbyvision' | 'hlg' | 'none';
  supported: boolean;
  metadata?: {
    masteringDisplay?: {
      primaryR: { x: number; y: number };
      primaryG: { x: number; y: number };
      primaryB: { x: number; y: number };
      whitePoint: { x: number; y: number };
      maxLuminance: number;
      minLuminance: number;
    };
    contentLightLevel?: {
      maxCLL: number;
      maxFALL: number;
    };
  };
  pixelFormat?: '10bit' | '12bit';
  colorPrimaries?: 'bt709' | 'bt2020' | 'p3';
  transferCharacteristics?: 'bt709' | 'bt2020' | 'smpte2084' | 'hlg' | 'pq';
  matrixCoefficients?: 'bt709' | 'bt2020ncl' | 'bt2020cl';
}

export interface DRMInfo {
  type: 'widevine' | 'playready' | 'fairplay' | 'clear' | 'none';
  licenseUrl?: string;
  keyId?: string;
  keySystem?: string;
  securityLevel?: 'L1' | 'L2' | 'L3' | 'unknown';
  robustnessLevel?: 'SW_SECURE_CRYPTO' | 'SW_SECURE_DECODE' | 'HW_SECURE_CRYPTO' | 'HW_SECURE_DECODE' | 'HW_SECURE_ALL';
  requiresDeviceId?: boolean;
  requiresUserId?: boolean;
  sessionId?: string;
  certificateUrl?: string;
  rightsUrl?: string;
  expirationDate?: string;
  licenseRequestHeaders?: Record<string, string>;
  persistLicense?: boolean;
}

export interface DownloadInfo {
  isDownloadable: boolean;
  maxDownloads?: number;
  availableForOffline?: boolean;
  expiresAt?: string;
  downloadUrl?: string;
  fileSize?: number;
  fileFormat?: string;
  bitrate?: number;
  resolution?: string;
  quality?: string;
  downloadLimit?: number;
  requiresAuth?: boolean;
  storageLocation?: 'internal' | 'external';
  downloadProgress?: number;
  downloadStatus?: 'pending' | 'downloading' | 'complete' | 'failed' | 'expired';
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
  
  // NEW: Enhanced subtitle methods
  getSubtitleLanguages?(): Promise<string[]>;
  getSubtitleFormats?(): Promise<string[]>;
  uploadSubtitle?(track: SubtitleUploadRequest): Promise<SubtitleTrack>;
  reportSubtitleIssue?(trackId: string, issue: string): Promise<void>;
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
  
  // NEW: Enhanced capabilities
  uploadSupport?: boolean;
  reportSupport?: boolean;
  automaticTranslation?: boolean;
  syncCorrection?: boolean;
  formattingStyles?: boolean;
  customColors?: boolean;
  fontSelection?: boolean;
  backgroundOpacity?: boolean;
  subtitleDelay?: boolean;
  multipleFormatSupport?: boolean;
  automaticLanguageDetection?: boolean;
  subtitlePreview?: boolean;
  subtitleSearch?: boolean;
  subtitleSync?: boolean;
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
  
  // NEW: Additional search params
  fps?: number;
  duration?: number;
  uploader?: string;
  rating?: number;
  downloadCount?: number;
  uploadDate?: string;
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
  
  // NEW: Additional subtitle metadata
  isHearingImpaired?: boolean;
  isMachineTranslated?: boolean;
  isOriginal?: boolean;
  isCommunity?: boolean;
  comments?: number;
  size?: number;
  lines?: number;
  preview?: string;
  syncOffset?: number;
  delay?: number;
  backgroundColor?: string;
  fontColor?: string;
  fontSize?: number;
  fontFamily?: string;
}

export interface SubtitleUploadRequest {
  title: string;
  year?: number;
  season?: number;
  episode?: number;
  language: string;
  format: string;
  content: string | File;
  isHearingImpaired?: boolean;
  isForced?: boolean;
  isMachineTranslated?: boolean;
  fps?: number;
  encoding?: string;
}

// ============================================================================
// METADATA PROVIDER TYPES (ENHANCED)
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
  
  // NEW: Discover mode - category browsing without keyword
  discover?(filters: DiscoverFilters): Promise<SearchResult[]>;
  
  // NEW: Enhanced metadata methods
  getWatchProviders?(id: string, type: 'movie' | 'tv'): Promise<WatchProvider[]>;
  getExternalIds?(id: string, type: 'movie' | 'tv'): Promise<ExternalIds>;
  getVideos?(id: string, type: 'movie' | 'tv'): Promise<VideoMetadata[]>;
  getImages?(id: string, type: 'movie' | 'tv'): Promise<ImageSet>;
  getKeywords?(id: string, type: 'movie' | 'tv'): Promise<Keyword[]>;
  getReviews?(id: string, type: 'movie' | 'tv'): Promise<Review[]>;
  getSimilar?(id: string, type: 'movie' | 'tv'): Promise<RelatedContent[]>;
  getRecommendations?(id: string, type: 'movie' | 'tv'): Promise<RelatedContent[]>;
  getCollection?(id: number): Promise<Collection>;
  getCollectionsByMovie?(id: string): Promise<Collection[]>;
  getCompanies?(id: string, type: 'movie' | 'tv'): Promise<ProductionCompany[]>;
  getNetworks?(): Promise<Network[]>;
  getGenres?(): Promise<Genre[]>;
  getCertifications?(): Promise<Certification[]>;
  getLanguages?(): Promise<Language[]>;
  getCountries?(): Promise<Country[]>;
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
  
  // NEW: Enhanced capabilities
  supportsDiscover?: boolean; // NEW: Category browsing without keyword
  supportsWatchProviders?: boolean;
  supportsVideos?: boolean;
  supportsKeywords?: boolean;
  supportsCollections?: boolean;
  supportsSimilar?: boolean;
  supportsRecommendations?: boolean;
  supportsCompanies?: boolean;
  supportsNetworks?: boolean;
  supportsLanguages?: boolean;
  supportsCountries?: boolean;
  supportsCertifications?: boolean;
  supportsGenres?: boolean;
  supportsExternalIds?: boolean;
  supportsImagesFull?: boolean;
  supportsVideoTrailers?: boolean;
  supportsVideoTeasers?: boolean;
  supportsVideoClips?: boolean;
  supportsVideoBehindTheScenes?: boolean;
  supportsVideoInterviews?: boolean;
  supportsVideoFeaturettes?: boolean;
  supportsVideoBloopers?: boolean;
  supportsVideoOpeningCredits?: boolean;
}

export interface SearchOptions {
  type?: ('movie' | 'show' | 'episode' | 'person')[];
  year?: number;
  language?: string;
  page?: number;
  limit?: number;
  extended?: boolean;
  filters?: Record<string, string | string[]>;
  
  // NEW: Enhanced search options
  countries?: string[];
  languages?: string[];
  genres?: string[];
  certifications?: string[];
  minRating?: number;
  maxRating?: number;
  minVotes?: number;
  startYear?: number;
  endYear?: number;
  keywords?: string[];
  withCast?: string[];
  withCrew?: string[];
  withCompanies?: string[];
  withoutGenres?: string[];
  watchProviders?: number[];
  region?: string;
  sortBy?: 'popularity.desc' | 'popularity.asc' | 'release_date.desc' | 'release_date.asc' | 'vote_average.desc' | 'vote_average.asc' | 'vote_count.desc' | 'vote_count.asc';
  includeAdult?: boolean;
}

export interface SearchResult {
  type: 'movie' | 'show' | 'episode' | 'person' | 'list';
  score: number;
  movie?: MovieMetadata;
  show?: ShowMetadata;
  episode?: EpisodeMetadata;
  person?: PersonMetadata;
  list?: ListMetadata;
  
  // NEW: Additional search metadata
  relevanceScore?: number;
  matchType?: 'exact' | 'partial' | 'fuzzy' | 'synonym' | 'autocomplete';
  matchFields?: string[];
}

// ============================================================================
// SOCIAL PROVIDER TYPES (ENHANCED)
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
  
  // NEW: Enhanced social methods
  getUserFollowers?(username: string): Promise<SocialUser[]>;
  getUserFollowing?(username: string): Promise<SocialUser[]>;
  getUserFriends?(username: string): Promise<SocialUser[]>;
  getTrendingMovies?(): Promise<TrendingMovie[]>;
  getTrendingShows?(): Promise<TrendingShow[]>;
  getPopularMovies?(): Promise<PopularMovie[]>;
  getPopularShows?(): Promise<PopularShow[]>;
  getAnticipatedMovies?(): Promise<AnticipatedMovie[]>;
  getAnticipatedShows?(): Promise<AnticipatedShow[]>;
  searchUsers?(query: string): Promise<SocialUser[]>;
  searchMedia?(query: string, type?: string): Promise<SearchResult[]>;
  getComment?(id: number): Promise<Comment>;
  getCommentReplies?(id: number): Promise<Comment[]>;
  getTrendingComments?(): Promise<Comment[]>;
  getRecentComments?(): Promise<Comment[]>;
  getUpdatedComments?(): Promise<Comment[]>;
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
  
  // NEW: Enhanced capabilities
  trending?: boolean;
  popular?: boolean;
  anticipated?: boolean;
  search?: boolean;
  lists?: boolean;
  friends?: boolean;
  recommendations?: boolean;
  socialSharing?: boolean;
  watchParty?: boolean;
  groupWatch?: boolean;
  liveWatch?: boolean;
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
  
  // NEW: Additional user data
  stats?: UserStats;
  followingCount?: number;
  followersCount?: number;
  friendsCount?: number;
  isFollowing?: boolean;
  isFollowed?: boolean;
  isFriend?: boolean;
  isBlocked?: boolean;
  isMuted?: boolean;
  lastActive?: string;
  website?: string;
  socialLinks?: {
    twitter?: string;
    instagram?: string;
    facebook?: string;
    youtube?: string;
  };
}

export interface HistoryEntry {
  id: number;
  watchedAt: string;
  action: 'watch' | 'scrobble' | 'checkin';
  type: 'movie' | 'episode';
  movie?: MovieMetadata;
  show?: ShowMetadata;
  episode?: EpisodeMetadata;
  
  // NEW: Additional history data
  progress?: number;
  duration?: number;
  platform?: string;
  deviceType?: string;
  rewatchCount?: number;
  isCompleted?: boolean;
  isPaused?: boolean;
  resumeAt?: number;
}

export interface WatchlistEntry {
  rank: number;
  listedAt: string;
  type: 'movie' | 'show' | 'season' | 'episode';
  movie?: MovieMetadata;
  show?: ShowMetadata;
  season?: SeasonMetadata;
  episode?: EpisodeMetadata;
  
  // NEW: Additional watchlist data
  notes?: string;
  priority?: 'high' | 'medium' | 'low';
  tags?: string[];
  isWatched?: boolean;
  rating?: number;
  watchedAt?: string;
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
  
  // NEW: Additional collection data
  quality?: string;
  size?: number;
  location?: string;
  isPhysical?: boolean;
  isDigital?: boolean;
  purchaseDate?: string;
  purchasePrice?: number;
  purchaseCurrency?: string;
  retailer?: string;
  notes?: string;
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
  
  // NEW: Additional list data
  tags?: string[];
  isFeatured?: boolean;
  isStaffPick?: boolean;
  views?: number;
  shares?: number;
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
  
  // NEW: Additional stats
  watchTime?: {
    total: number;
    daily: number;
    weekly: number;
    monthly: number;
    yearly: number;
  };
  streaks?: {
    current: number;
    longest: number;
    lastWatch: string;
  };
  achievements?: string[];
  badges?: string[];
}

export interface HistoryOptions {
  type?: 'movies' | 'shows' | 'episodes' | 'all';
  startAt?: string;
  endAt?: string;
  page?: number;
  limit?: number;
  
  // NEW: Additional options
  sortBy?: 'date' | 'title' | 'rating' | 'duration';
  sortOrder?: 'asc' | 'desc';
  filterCompleted?: boolean;
  filterUnfinished?: boolean;
}

// ============================================================================
// COMMON METADATA TYPES (ENHANCED)
// ============================================================================

export interface MediaIds {
  trakt?: number;
  slug?: string;
  imdb?: string;
  tmdb?: number;
  tvdb?: number;
  tvrage?: number;
  
  // NEW: Additional ID types
  facebookId?: string;
  instagramId?: string;
  twitterId?: string;
  youtubeId?: string;
  spotifyId?: string;
  appleMusicId?: string;
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
  
  // NEW: Industry-standard fields
  originalLanguage?: string;
  originCountry?: string[];
  originalTitle?: string;
  popularity?: number;
  voteCount?: number;
  belongsToCollection?: BelongsToCollection;
  watchProviders?: WatchProvider[];
  budget?: number;
  revenue?: number;
  imdbId?: string;
  productionCompanies?: ProductionCompany[];
  productionCountries?: ProductionCountry[];
  spokenLanguages?: SpokenLanguage[];
  keywords?: string[];
  releaseDate?: string;
  voteAverage?: number;
  posterPath?: string;
  backdropPath?: string;
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
  
  // NEW: Industry-standard fields
  originalLanguage?: string;
  originCountry?: string[];
  originalTitle?: string;
  popularity?: number;
  voteCount?: number;
  belongsToCollection?: BelongsToCollection;
  watchProviders?: WatchProvider[];
  networks?: Network[];
  episodeRunTime?: number[];
  inProduction?: boolean;
  lastAirDate?: string;
  nextEpisodeToAir?: EpisodeMetadata;
  numberOfEpisodes?: number;
  numberOfSeasons?: number;
  type?: 'Documentary' | 'News' | 'Reality' | 'Scripted' | 'Talk Show' | 'Video';
  voteAverage?: number;
  posterPath?: string;
  backdropPath?: string;
  originCountry?: string[];
  originalName?: string;
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
  
  // NEW: Industry-standard fields
  airDate?: string;
  posterPath?: string;
  seasonNumber?: number;
  name?: string;
  voteAverage?: number;
  voteCount?: number;
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
  
  // NEW: Industry-standard fields
  alsoKnownAs?: string[];
  adult?: boolean;
  placeOfBirth?: string;
  profilePath?: string;
  popularity?: number;
  imdbId?: string;
  deathday?: string;
  biography?: string;
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
  
  // NEW: Additional image types
  backdrop?: string[];
  still?: string[];
  profile?: string[];
  tvposter?: string[];
  tvbanner?: string[];
  tvthumb?: string[];
  seasonposter?: string[];
  seasonthumb?: string[];
  seasonbanner?: string[];
}

// ============================================================================
// TRENDING / POPULAR / CALENDAR (ENHANCED)
// ============================================================================

export interface TrendingResult {
  watchers: number;
  movie?: MovieMetadata;
  show?: ShowMetadata;
  
  // NEW: Additional metrics
  score?: number;
  rank?: number;
  trendScore?: number;
  period?: 'day' | 'week' | 'month' | 'year';
  watchersGrowth?: number;
  watchersGrowthPercent?: number;
  peakWatchers?: number;
  peakDate?: string;
}

export interface PopularResult {
  movie?: MovieMetadata;
  show?: ShowMetadata;
  
  // NEW: Additional metrics
  popularityScore?: number;
  rank?: number;
  views?: number;
  likes?: number;
}

export interface CalendarEntry {
  released: string;
  episode?: EpisodeMetadata;
  show?: ShowMetadata;
  movie?: MovieMetadata;
  
  // NEW: Additional calendar data
  isPremiere?: boolean;
  isFinale?: boolean;
  isSpecial?: boolean;
  countdownDays?: number;
  formattedDate?: string;
  timezone?: string;
}

// ============================================================================
// NEW: ADDITIONAL TYPES (Industry-Standard)
// ============================================================================

export interface ExternalIds {
  imdb?: string;
  tmdb?: number;
  tvdb?: number;
  trakt?: number;
  tvrage?: number;
  facebook?: string;
  instagram?: string;
  twitter?: string;
  youtube?: string;
  spotify?: string;
  appleMusic?: string;
  deezer?: string;
  soundcloud?: string;
}

export interface VideoMetadata {
  id: string;
  name: string;
  key: string;
  site: string;
  type: 'Trailer' | 'Teaser' | 'Clip' | 'Featurette' | 'Behind the Scenes' | 'Interview' | 'Bloopers' | 'Opening Credits' | 'Other';
  size: number;
  official: boolean;
  publishedAt: string;
  resolution?: string;
  aspectRatio?: string;
  language?: string;
  subtitles?: string[];
  thumbnail?: string;
  url?: string;
  embedUrl?: string;
  views?: number;
  likes?: number;
}

export interface ImageSet {
  posters: Image[];
  backdrops: Image[];
  stills: Image[];
  profiles: Image[];
  logos: Image[];
  banners: Image[];
}

export interface Image {
  url: string;
  width: number;
  height: number;
  aspectRatio: number;
  language?: string;
  voteAverage?: number;
  voteCount?: number;
}

export interface Keyword {
  id: number;
  name: string;
  popularity?: number;
  type?: 'genre' | 'topic' | 'theme' | 'setting' | 'character' | 'mood';
}

export interface Review {
  id: string;
  author: string;
  content: string;
  rating: number;
  createdAt: string;
  updatedAt: string;
  language: string;
  source?: string;
  url?: string;
  likes?: number;
  dislikes?: number;
  isSpoiler?: boolean;
  isVerified?: boolean;
  isFeatured?: boolean;
}

export interface RelatedContent {
  id: string;
  title: string;
  type: 'movie' | 'show';
  year: number;
  poster?: string;
  backdrop?: string;
  overview?: string;
  rating?: number;
  similarityScore?: number;
  recommendationScore?: number;
  reason?: string;
  genres?: string[];
}

export interface Collection {
  id: number;
  name: string;
  overview?: string;
  posterPath?: string;
  backdropPath?: string;
  parts: CollectionPart[];
  totalParts?: number;
  releaseDateRange?: {
    start: string;
    end: string;
  };
  averageRating?: number;
  totalRevenue?: number;
  totalBudget?: number;
}

export interface CollectionPart {
  id: string;
  title: string;
  type: 'movie' | 'show';
  year: number;
  poster?: string;
  backdrop?: string;
  order?: number;
  releaseDate?: string;
}

export interface ProductionCompany {
  id: number;
  name: string;
  logoPath?: string;
  originCountry?: string;
  parentCompany?: string;
  description?: string;
  headquarters?: string;
  founded?: string;
  founder?: string;
  ceo?: string;
  revenue?: number;
  employees?: number;
  website?: string;
}

export interface ProductionCountry {
  iso3166_1: string;
  name: string;
  countryCode?: string;
  region?: string;
  languages?: string[];
}

export interface SpokenLanguage {
  englishName: string;
  iso639_1: string;
  name: string;
  code?: string;
  nativeName?: string;
}

export interface Network {
  id: number;
  name: string;
  logoPath?: string;
  originCountry?: string;
  headquarters?: string;
  parentCompany?: string;
  founded?: string;
  founder?: string;
  website?: string;
  type?: 'broadcast' | 'cable' | 'satellite' | 'streaming' | 'radio' | 'other';
  availableIn?: string[];
  subscriberCount?: number;
  launchDate?: string;
  keyPeople?: string[];
}

export interface Genre {
  id: number;
  name: string;
  slug: string;
  description?: string;
  parentGenre?: string;
  childGenres?: string[];
  popularity?: number;
  averageRating?: number;
  totalContent?: number;
}

export interface Certification {
  id: string;
  name: string;
  country: string;
  description?: string;
  order?: number;
  ageRange?: {
    min: number;
    max: number;
  };
  content?: string[];
}

export interface Language {
  code: string;
  name: string;
  nativeName: string;
  countryCode?: string;
  isOfficial?: boolean;
  speakers?: number;
}

export interface Country {
  code: string;
  name: string;
  nativeName: string;
  region: string;
  subregion?: string;
  languages: string[];
  timezones: string[];
  currencies: string[];
}

// ============================================================================
// PROVIDER HEALTH & CONFIG (ENHANCED)
// ============================================================================

export interface ProviderHealth {
  status: 'healthy' | 'degraded' | 'down';
  latency: number;
  lastChecked: number;
  message?: string;
  error?: string;
  
  // NEW: Enhanced health metrics
  uptime?: number;
  responseTime?: number;
  errorRate?: number;
  successRate?: number;
  dailyRequests?: number;
  dailyErrors?: number;
  rateLimitRemaining?: number;
  rateLimitReset?: number;
  quotaRemaining?: number;
  quotaReset?: number;
}

export interface ProviderConfig {
  timeout: number;
  retryCount: number;
  retryDelay: number;
  cacheEnabled: boolean;
  cacheDuration: number;
  maxConcurrent: number;
  requestDelay: number;
  
  // NEW: Enhanced config options
  circuitBreaker?: {
    enabled: boolean;
    failureThreshold: number;
    successThreshold: number;
    timeout: number;
  };
  rateLimiting?: {
    enabled: boolean;
    requestsPerSecond: number;
    burst?: number;
  };
  retryStrategy?: 'linear' | 'exponential' | 'random';
  requestTimeout?: number;
  connectTimeout?: number;
  readTimeout?: number;
  writeTimeout?: number;
  keepAlive?: boolean;
  compression?: boolean;
  proxy?: {
    enabled: boolean;
    url?: string;
    username?: string;
    password?: string;
  };
}

export interface MetadataProviderConfig extends ProviderConfig {
  maxResults: number;
  extendedInfo: boolean;
  includeImages: boolean;
  language: string;
  
  // NEW: Enhanced config
  includeAdult?: boolean;
  includeVideo?: boolean;
  includeTrailers?: boolean;
  includeKeywords?: boolean;
  includeCollections?: boolean;
  includeWatchProviders?: boolean;
  includeExternalIds?: boolean;
  defaultRegion?: string;
  defaultCertificationCountry?: string;
  imageQuality?: 'low' | 'medium' | 'high' | 'original';
}

export interface SubtitleProviderConfig extends ProviderConfig {
  maxResults: number;
  languagePreference: string[];
  includeHearingImpaired: boolean;
  includeForced: boolean;
  
  // NEW: Enhanced config
  defaultFormat?: 'srt' | 'vtt' | 'ass' | 'ssa';
  includeAutoGenerated?: boolean;
  includeCommunity?: boolean;
  includeOfficial?: boolean;
  minRating?: number;
  minDownloadCount?: number;
  maxFileSize?: number;
  filterDuplicate?: boolean;
  filterLanguageVariants?: boolean;
  filterSimilar?: boolean;
}

export interface SocialProviderConfig extends ProviderConfig {
  publicOnly: boolean;
  includePrivate: boolean;
  maxHistoryItems: number;
  
  // NEW: Enhanced config
  includeFriends?: boolean;
  includeFollowers?: boolean;
  includeFollowing?: boolean;
  includeWatchlist?: boolean;
  includeCollection?: boolean;
  includeStats?: boolean;
  includeComments?: boolean;
  includeRatings?: boolean;
  includeReviews?: boolean;
  defaultPrivacy?: 'public' | 'private' | 'friends';
}

// ============================================================================
// PROVIDER REGISTRY TYPES (ENHANCED)
// ============================================================================

export type ProviderType = 'stream' | 'metadata' | 'subtitle' | 'social';

export interface RegisteredProvider {
  provider: StreamProvider | MetadataProvider | SubtitleProvider | SocialProvider;
  config: ProviderConfig;
  health: ProviderHealth;
  lastUsed: number;
  useCount: number;
  errorCount: number;
  
  // NEW: Enhanced registration data
  registeredAt?: number;
  lastSuccess?: number;
  lastError?: number;
  consecutiveFailures?: number;
  consecutiveSuccesses?: number;
  averageLatency?: number;
  successRate?: number;
  totalRequests?: number;
  totalErrors?: number;
  statusHistory?: {
    status: 'healthy' | 'degraded' | 'down';
    timestamp: number;
  }[];
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
  
  // NEW: Enhanced registry methods
  getBestProvider(type: ProviderType, criteria?: ProviderSelectionCriteria): RegisteredProvider | undefined;
  getProvidersForContent(contentType: 'movie' | 'tv' | 'anime'): RegisteredProvider[];
  getProviderStats(): ProviderStats;
  resetProvider(providerId: string): void;
  prioritizeProvider(providerId: string, priority: number): void;
  enableProvider(providerId: string): void;
  disableProvider(providerId: string): void;
}

export interface ProviderSelectionCriteria {
  minHealth: 'healthy' | 'degraded';
  maxLatency?: number;
  preferLowestLatency?: boolean;
  preferHighestPriority?: boolean;
  preferWithCapabilities?: string[];
  preferWithFeatures?: string[];
  avoidProviders?: string[];
  avoidOverloaded?: boolean;
}

export interface ProviderStats {
  totalProviders: number;
  healthyProviders: number;
  degradedProviders: number;
  downProviders: number;
  averageLatency: number;
  totalRequests: number;
  totalErrors: number;
  providersByType: Record<ProviderType, number>;
}

// ============================================================================
// FACTORY TYPES (ENHANCED)
// ============================================================================

export interface ProviderFactory {
  createStreamProvider(config: StreamProviderConfigType): StreamProvider;
  createMetadataProvider(config: MetadataProviderConfig): MetadataProvider;
  createSubtitleProvider(config: SubtitleProviderConfig): SubtitleProvider;
  createSocialProvider(config: SocialProviderConfig): SocialProvider;
  
  // NEW: Factory helper methods
  getDefaultConfig(providerType: ProviderType): ProviderConfig;
  getConfigForProvider(providerId: string): ProviderConfig;
  validateConfig(providerType: ProviderType, config: ProviderConfig): boolean;
  createWithDefaults(providerType: ProviderType, overrides?: Partial<ProviderConfig>): ProviderConfig;
}

// ============================================================================
// UNIFIED SERVICE TYPES (ENHANCED)
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
  
  // NEW: Enhanced request options
  region?: string;
  country?: string;
  certification?: string;
  minRating?: number;
  includeHDR?: boolean;
  includeDolbyAtmos?: boolean;
  include4K?: boolean;
  include1080p?: boolean;
  include720p?: boolean;
  preferredAudioLanguage?: string;
  preferredAudioTrack?: string;
  preferredSubtitleLanguage?: string;
  preferredSubtitleFormat?: string;
  downloadForOffline?: boolean;
  streamInBackground?: boolean;
  preferProxy?: boolean;
}

export interface UnifiedResponse {
  streams: StreamSource[];
  subtitles: SubtitleTrack[];
  metadata?: MovieMetadata | ShowMetadata | EpisodeMetadata;
  sources: ProviderSource[];
  errors: ProviderError[];
  timestamp: number;
  
  // NEW: Enhanced response
  audioTracks?: AudioTrack[];
  hdrInfo?: HDRInfo;
  drmInfo?: DRMInfo;
  downloadInfo?: DownloadInfo;
  recommendedQuality?: string;
  availableQualities?: string[];
  availableLanguages?: string[];
  duration?: number;
  size?: number;
  expiresAt?: number;
  playbackUrl?: string;
  manifestUrl?: string;
}

export interface ProviderSource {
  provider: string;
  type: 'stream' | 'metadata' | 'subtitle';
  data: unknown;
  latency: number;
  cached: boolean;
  
  // NEW: Additional source data
  success?: boolean;
  error?: string;
  quality?: string;
  format?: string;
  bitrate?: number;
  codec?: string;
}

export interface ProviderError {
  provider: string;
  type: 'stream' | 'metadata' | 'subtitle' | 'social';
  code: string;
  message: string;
  retryable: boolean;
  
  // NEW: Additional error data
  statusCode?: number;
  retryAfter?: number;
  rateLimited?: boolean;
  authRequired?: boolean;
  geoRestricted?: boolean;
  premiumRequired?: boolean;
  expired?: boolean;
}

// ============================================================================
// AGGREGATION TYPES (ENHANCED)
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
  
  // NEW: Enhanced aggregation methods
  mergeDuplicates<T extends { ids?: MediaIds }>(items: T[]): T[];
  prioritizeBySource<T extends { source?: string }>(items: T[], sourcePriority: string[]): T[];
  filterByQuality<T extends { quality?: string }>(items: T[], minQuality: string): T[];
  sortByRelevance<T>(items: T[], query: string): T[];
  filterByAvailability<T extends { availability?: string }>(items: T[]): T[];
  filterByGeo<T extends { geoRestricted?: boolean }>(items: T[], region: string): T[];
}

export interface RankingCriteria {
  quality?: number;
  reliability?: number;
  speed?: number;
  freshness?: number;
  popularity?: number;
  
  // NEW: Additional ranking criteria
  relevance?: number;
  rating?: number;
  votes?: number;
  recency?: number;
  sourcePriority?: number;
  availability?: number;
  qualityScore?: number;
  completeness?: number;
  accuracy?: number;
}

// ============================================================================
// STREAMING BACKEND TYPES (Enhanced)
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
  
  // NEW: Enhanced stream provider methods
  getStreamsWithMetadata?(request: {
    id: string;
    type: 'movie' | 'tv';
    season?: number;
    episode?: number;
  }): Promise<{
    sources: MediaStreamSource[];
    metadata?: {
      title: string;
      duration?: number;
      quality?: string;
    };
  }>;
  getAvailableQualities?(id: string, type: 'movie' | 'tv'): Promise<string[]>;
  getStreamUrl?(id: string, quality?: string): Promise<string>;
  getSubtitles?(id: string, language?: string): Promise<{
    url: string;
    language: string;
    format: string;
  }[]>;
}

export interface StreamProviderHealthStatus {
  provider: StreamProviderId;
  isHealthy: boolean;
  responseTime: number;
  lastChecked: number;
  
  // NEW: Additional health data
  errorRate?: number;
  successRate?: number;
  uptime?: number;
  dailyRequests?: number;
  dailyErrors?: number;
}

export interface StreamBackendConfig {
  defaultQuality?: StreamQuality;
  timeout?: number;
  retryCount?: number;
  [key: string]: unknown;
  
  // NEW: Enhanced config
  maxRetries?: number;
  retryDelay?: number;
  cacheEnabled?: boolean;
  cacheDuration?: number;
  preferHLS?: boolean;
  preferDASH?: boolean;
  preferMP4?: boolean;
  maxSources?: number;
  minQuality?: StreamQuality;
  maxQuality?: StreamQuality;
  includeSubtitles?: boolean;
  includeAudioTracks?: boolean;
  includeHDR?: boolean;
  includeDolbyAtmos?: boolean;
  includeDRM?: boolean;
  includeDownload?: boolean;
  region?: string;
  language?: string;
}

// ============================================================================
// UNIFIED SERVICE TYPES (Enhanced)
// ============================================================================

export interface UnifiedSearchOptions {
  query: string;
  type?: 'movie' | 'tv';
  year?: number;
  limit?: number;
  
  // NEW: Industry-standard search filters
  language?: string;          // Original language filter
  country?: string;           // Origin country filter
  region?: string;            // Region for regional content
  genres?: string[];          // Genre filtering
  certification?: string;     // Parental rating
  minRating?: number;         // Minimum rating
  maxRating?: number;         // Maximum rating
  minVotes?: number;          // Minimum vote count
  startYear?: number;         // Year range start
  endYear?: number;           // Year range end
  keywords?: string[];        // Keyword matching
  watchProviders?: number[];  // Where to watch
  withCast?: string[];        // Cast filter
  withCrew?: string[];        // Crew filter
  withCompanies?: string[];   // Production companies
  withoutGenres?: string[];   // Exclude genres
  sortBy?: 'popularity.desc' | 'popularity.asc' | 'release_date.desc' | 'release_date.asc' | 'vote_average.desc' | 'vote_average.asc' | 'vote_count.desc' | 'vote_count.asc';
  includeAdult?: boolean;     // Include adult content
  languageCode?: string;      // Result language
  watchRegion?: string;       // Watch region
  page?: number;              // Pagination
}

export interface UnifiedStreamOptions {
  id: string;
  type: 'movie' | 'tv';
  season?: number;
  episode?: number;
  preferredQuality?: StreamQuality;
  
  // NEW: Enhanced stream options
  preferredAudioLanguage?: string;
  preferredSubtitleLanguage?: string;
  includeHDR?: boolean;
  includeDolbyAtmos?: boolean;
  includeSubtitles?: boolean;
  includeAudioTracks?: boolean;
  includeDRM?: boolean;
  includeDownloadInfo?: boolean;
  minQuality?: StreamQuality;
  maxQuality?: StreamQuality;
  region?: string;
}

export interface UnifiedSubtitleOptions {
  imdbId?: string;
  tmdbId?: string;
  season?: number;
  episode?: number;
  language?: string;
  
  // NEW: Enhanced subtitle options
  format?: 'srt' | 'vtt' | 'ass' | 'ssa' | 'sub';
  hearingImpaired?: boolean;
  forced?: boolean;
  machineTranslated?: boolean;
  minRating?: number;
  minDownloads?: number;
  maxResults?: number;
  includeAutoGenerated?: boolean;
  includeCommunity?: boolean;
  includeOfficial?: boolean;
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
  
  // NEW: Industry-standard fields
  originalLanguage?: string;
  originCountry?: string[];
  originalTitle?: string;
  popularity?: number;
  voteCount?: number;
  certification?: string;
  tagline?: string;
  status?: string;
  belongsToCollection?: BelongsToCollection;
  watchProviders?: WatchProvider[];
  keywords?: string[];
  budget?: number;
  revenue?: number;
  networks?: Network[];
  spokenLanguages?: SpokenLanguage[];
  productionCompanies?: ProductionCompany[];
  productionCountries?: ProductionCountry[];
  numberOfSeasons?: number;
  numberOfEpisodes?: number;
  lastAirDate?: string;
  inProduction?: boolean;
}

// ============================================================================
// DEFAULT EXPORTS
// ============================================================================

export default {
  // Types for external use
  StreamProviderId,
  StreamQuality,
  ProviderType,
  
  // New types
  AudioTrack,
  HDRInfo,
  DRMInfo,
  DownloadInfo,
  ExternalIds,
  VideoMetadata,
  ImageSet,
  Image,
  Keyword,
  Review,
  RelatedContent,
  Collection,
  CollectionPart,
  ProductionCompany,
  ProductionCountry,
  SpokenLanguage,
  Network,
  Genre,
  Certification,
  Language,
  Country,
  ProviderSelectionCriteria,
  ProviderStats,
};