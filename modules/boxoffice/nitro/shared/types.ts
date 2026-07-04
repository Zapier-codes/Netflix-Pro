/**
 * Shared types between Nitro native and JavaScript layers.
 * These are the canonical type definitions used across the JSI bridge.
 */

// ==================== ENUMS ====================

export enum SubjectType {
  ALL = 'ALL',
  MOVIES = 'MOVIES',
  TV_SERIES = 'TV_SERIES',
  EDUCATION = 'EDUCATION',
  MUSIC = 'MUSIC',
  ANIME = 'ANIME',
  OTHER = 'OTHER',
}

export enum ApiVersion {
  V1 = 'v1',
  V2 = 'v2',
}

// ==================== CORE TYPES ====================

export interface ContentImage {
  url: string
  width: number
  height: number
  size: number
  format: string
  thumbnail: string
  blurHash: string
  gif?: string
  avgHueLight: string
  avgHueDark: string
  id: string
}

export interface SearchResultsPager {
  hasMore: boolean
  nextPage: number | null
  page: number
  perPage: number
  totalCount: number
}

export interface SearchResultItem {
  subjectId: string
  subjectType: SubjectType
  title: string
  description?: string
  releaseDate?: string
  duration?: number
  genre: string[]
  cover?: ContentImage
  countryName?: string
  imdbRatingValue?: number
  detailPath: string
  hasResource: boolean
  subtitles: string[]
  corner?: string
  stafflist?: any[]
  appointmentCnt?: number
  appointmentDate?: string
}

// ==================== SEARCH ====================

export interface SearchResults {
  items: SearchResultItem[]
  pager: SearchResultsPager
  query: string
  version: ApiVersion
}

export interface SuggestedItem {
  type?: SubjectType
  subject?: string | null
  word: string
}

export interface SearchSuggestions {
  items: SuggestedItem[]
  keyword: string
  version: ApiVersion
}

// ==================== DISCOVERY ====================

export interface TrendingResults {
  data: SearchResultItem[]
  pager: SearchResultsPager
  version: ApiVersion
}

export interface ContentCategory {
  type: string
  position: number
  title: string
  subjects: SearchResultItem[]
  url?: string
  opId?: string
}

export interface Platform {
  name: string
  uploadBy: string
}

export interface HomepageContent {
  categories: ContentCategory[]
  platformList: Platform[]
  version: ApiVersion
}

export interface HotContent {
  movies: SearchResultItem[]
  tvSeries: SearchResultItem[]
  version: ApiVersion
}

export interface PopularSearchItem {
  title: string
}

export interface PopularSearches {
  data: PopularSearchItem[]
  version: ApiVersion
}

// ==================== VIDEO & FILES ====================

export interface VideoAddress {
  videoId: string
  definition: string
  url: string
  duration: number
  width: number
  height: number
  size: number
  fps: number
  type: number
}

export interface SubjectTrailer {
  videoAddress: VideoAddress
  cover: ContentImage
}

export interface MediaFile {
  id: string
  url: string
  resolution: number
  size: number
}

export interface CaptionFile {
  id: string
  lan: string
  lanName: string
  url: string
  size: number
  delay: number
}

export interface DownloadableFiles {
  downloads: MediaFile[]
  captions: CaptionFile[]
  limited: boolean
  limitedCode?: string
  hasResource: boolean
}

// ==================== STARS & RESOURCE ====================

export interface StarsModel {
  avatarUrl: string
  character: string
  detailPath: string
  name: string
  staffId: string
  staffType: number
}

export interface ResourceModel {
  seasons: any[]
  source: string
  uploadBy: string
}

export interface MetadataModel {
  description: string
  image: string
  keyWords: string[]
  referer?: string
  title: string
  url?: string
}

// ==================== POST LIST ====================

export interface PostListItem {
  id: string
  title: string
  content: string
  createTime: string
}

export interface PostList {
  items: PostListItem[]
  pager: SearchResultsPager
}

// ==================== DETAILS ====================

export interface MovieDetails {
  subject: SearchResultItem
  stars: StarsModel[]
  resource: ResourceModel
  metadata: MetadataModel
  postList: PostList
  isForbid: boolean
  watchTimeLimit: number
  version: ApiVersion
}

export interface TVSeriesDetails {
  subject: SearchResultItem
  stars: StarsModel[]
  resource: ResourceModel
  metadata: MetadataModel
  postList: PostList
  version: ApiVersion
}

export interface V2ItemDetails {
  subject: SearchResultItem
  stars: StarsModel[]
  resource: ResourceModel
  metadata: MetadataModel
  isForbid: boolean
  watchTimeLimit: number
  version: ApiVersion
}

// ==================== DOWNLOADS ====================

export interface DownloadedFile {
  savedTo: string
  size: number
}

export interface DownloadMovieResult {
  movieFile: DownloadedFile
  subtitleFile?: DownloadedFile | null
}

export interface EpisodeDownload {
  savedTo: string
  size: number
}

export interface DownloadTVSeriesResult {
  episodes: Record<string, EpisodeDownload>
  total: number
}

export interface DownloadStatus {
  downloadId: string
  downloadedSize: number
  expectedSize: number
  percent: number
  isComplete: boolean
  savedTo?: string
}

export interface DownloadStatusList {
  data: DownloadStatus[]
}

// ==================== RECOMMENDATIONS ====================

export interface Recommendations {
  data: SearchResultItem[]
  pager: SearchResultsPager
  version: ApiVersion
}

// ==================== ENGINE ====================

export interface EngineConfig {
  apiVersion?: ApiVersion
  downloadDir?: string
  captionLanguage?: string
  quality?: string
}

export interface EngineStatus {
  status: string
  running: boolean
  defaultVersion: ApiVersion
  timestamp: string
}

export interface CommandResult {
  success: boolean
  data?: any
  error?: string
  message?: string
  timestamp?: string
}

export interface PongResult {
  success: boolean
  response: string
  timestamp: string
  sdkAvailable: boolean
  sdkVersion: string
}

// ==================== EVENTS ====================

export interface StatusChangeEvent {
  status: string
  timestamp: string
}

export interface CommandExecutedEvent {
  command: string
  success: boolean
  timestamp: string
}

export interface DownloadProgressEvent {
  downloadId: string
  downloadedSize: number
  expectedSize: number
  percent: number
  isComplete: boolean
  savedTo?: string
}

export interface ErrorEvent {
  errorCode: string
  errorMessage: string
  command?: string
}