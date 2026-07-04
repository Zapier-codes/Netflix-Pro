import { NitroModules } from 'react-native-nitro-modules'

/**
 * BoxOffice Nitro Module - JSI interface for moviebox-api SDK operations.
 * Maps to the real moviebox-api Python SDK (v1/v2) search, discovery,
 * details, and download pipeline.
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

// ==================== MODELS ====================

export interface SearchResultsPager {
  hasMore: boolean
  nextPage: number | null
  page: number
  perPage: number
  totalCount: number
}

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

export interface HomepageContent {
  categories: ContentCategory[]
  platformList: { name: string; uploadBy: string }[]
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

export interface Recommendations {
  data: SearchResultItem[]
  pager: SearchResultsPager
  version: ApiVersion
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

// ==================== NITRO INTERFACE ====================

export interface BoxOfficeNitroModule {
  // Lifecycle
  configure(config: { apiVersion?: ApiVersion; downloadDir?: string; captionLanguage?: string; quality?: string }): Promise<CommandResult>
  start(): Promise<CommandResult>
  stop(): Promise<CommandResult>
  getStatus(): Promise<EngineStatus>

  // Search
  search(query: string, page: number, perPage: number, subjectType: SubjectType, version: ApiVersion): Promise<SearchResults>
  searchSuggestions(query: string, version: ApiVersion): Promise<SearchSuggestions>

  // Discovery
  getTrending(page: number, perPage: number, version: ApiVersion): Promise<TrendingResults>
  getHomepage(version: ApiVersion): Promise<HomepageContent>
  getHotContent(version: ApiVersion): Promise<HotContent>
  getPopularSearches(version: ApiVersion): Promise<PopularSearches>

  // Details
  getMovieDetails(urlOrItem: string, version: ApiVersion): Promise<MovieDetails>
  getTVSeriesDetails(urlOrItem: string, version: ApiVersion): Promise<TVSeriesDetails>
  getItemDetails(urlOrItem: string): Promise<V2ItemDetails>

  // Downloadable files
  getDownloadableFiles(item: any, subjectType: SubjectType, version: ApiVersion): Promise<DownloadableFiles>

  // Downloads
  downloadMovie(title: string, quality: string, captionLanguage: string, downloadDir: string, year: number): Promise<DownloadMovieResult>
  downloadTVSeries(title: string, season: number, episode: number, limit: number, quality: string, captionLanguage: string, downloadDir: string, autoMode: boolean): Promise<DownloadTVSeriesResult>
  getDownloadStatus(downloadId?: string): Promise<DownloadStatusList>
  cancelDownload(downloadId: string): Promise<CommandResult>

  // Recommendations
  getRecommendations(urlOrItem: string, page: number, perPage: number, version: ApiVersion): Promise<Recommendations>

  // Events
  addListener(event: 'onBoxOfficeStatusChange', callback: (event: StatusChangeEvent) => void): void
  addListener(event: 'onBoxOfficeCommandExecuted', callback: (event: CommandExecutedEvent) => void): void
  addListener(event: 'onBoxOfficeDownloadProgress', callback: (event: DownloadProgressEvent) => void): void
  addListener(event: 'onBoxOfficeError', callback: (event: ErrorEvent) => void): void
  removeListener(event: string, callback: (...args: any[]) => void): void
}

export const BoxOfficeNitroModule = NitroModules.createHybridObject<BoxOfficeNitroModule>('BoxOfficeNitroModule')