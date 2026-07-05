/**
 * BoxOffice Bridge - Main client API for the BoxOffice module.
 * Provides a typed interface to the moviebox-api Python SDK
 * for search, discovery, details, and download operations.
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native'
import { BoxOfficeNitroModule } from '../nitro/BoxOfficeNitroModule.nitro'

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

// ==================== TYPES ====================

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

export interface SearchResultsPager {
  hasMore: boolean
  nextPage: number | null
  page: number
  perPage: number
  totalCount: number
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

// ==================== BRIDGE CLASS ====================

class BoxOfficeBridge {
  private static instance: BoxOfficeBridge
  private eventEmitter: NativeEventEmitter | null = null
  private useNitro: boolean

  private constructor() {
    this.useNitro = !!BoxOfficeNitroModule
    if (!this.useNitro) {
      const { BoxOfficeModule } = NativeModules
      this.eventEmitter = new NativeEventEmitter(BoxOfficeModule)
    }
  }

  static getInstance(): BoxOfficeBridge {
    if (!BoxOfficeBridge.instance) {
      BoxOfficeBridge.instance = new BoxOfficeBridge()
    }
    return BoxOfficeBridge.instance
  }

  // ==================== EVENT LISTENERS ====================

  onStatusChange(callback: (event: StatusChangeEvent) => void): () => void {
    if (this.useNitro) {
      BoxOfficeNitroModule.addStatusChangeListener(callback)
      return () => BoxOfficeNitroModule.removeListener('onBoxOfficeStatusChange', callback)
    }
    const sub = this.eventEmitter!.addListener('onBoxOfficeStatusChange', callback)
    return () => sub.remove()
  }

  onCommandExecuted(callback: (event: CommandExecutedEvent) => void): () => void {
    if (this.useNitro) {
      BoxOfficeNitroModule.addCommandExecutedListener(callback)
      return () => BoxOfficeNitroModule.removeListener('onBoxOfficeCommandExecuted', callback)
    }
    const sub = this.eventEmitter!.addListener('onBoxOfficeCommandExecuted', callback)
    return () => sub.remove()
  }

  onDownloadProgress(callback: (event: DownloadProgressEvent) => void): () => void {
    if (this.useNitro) {
      BoxOfficeNitroModule.addDownloadProgressListener(callback)
      return () => BoxOfficeNitroModule.removeListener('onBoxOfficeDownloadProgress', callback)
    }
    const sub = this.eventEmitter!.addListener('onBoxOfficeDownloadProgress', callback)
    return () => sub.remove()
  }

  onError(callback: (event: ErrorEvent) => void): () => void {
    if (this.useNitro) {
      BoxOfficeNitroModule.addErrorListener(callback)
      return () => BoxOfficeNitroModule.removeListener('onBoxOfficeError', callback)
    }
    const sub = this.eventEmitter!.addListener('onBoxOfficeError', callback)
    return () => sub.remove()
  }

  // ==================== LIFECYCLE ====================

  async configure(config: EngineConfig = {}): Promise<CommandResult> {
    if (this.useNitro) {
      return await BoxOfficeNitroModule.configure({
        apiVersion: config.apiVersion ?? ApiVersion.V2,
        downloadDir: config.downloadDir ?? '',
        captionLanguage: config.captionLanguage ?? 'English',
        quality: config.quality ?? 'best',
      })
    }
    const { BoxOfficeModule } = NativeModules
    return await BoxOfficeModule.configure(config)
  }

  async start(): Promise<CommandResult> {
    if (this.useNitro) {
      return await BoxOfficeNitroModule.start()
    }
    const { BoxOfficeModule } = NativeModules
    return await BoxOfficeModule.start()
  }

  async stop(): Promise<CommandResult> {
    if (this.useNitro) {
      return await BoxOfficeNitroModule.stop()
    }
    const { BoxOfficeModule } = NativeModules
    return await BoxOfficeModule.stop()
  }

  async getStatus(): Promise<EngineStatus> {
    if (this.useNitro) {
      return await BoxOfficeNitroModule.getStatus()
    }
    const { BoxOfficeModule } = NativeModules
    return await BoxOfficeModule.getStatus()
  }

  // ==================== SEARCH ====================

  async search(
    query: string,
    page: number = 1,
    perPage: number = 24,
    subjectType: SubjectType = SubjectType.ALL,
    version: ApiVersion = ApiVersion.V2
  ): Promise<SearchResults> {
    if (this.useNitro) {
      return await BoxOfficeNitroModule.search(query, page, perPage, subjectType, version)
    }
    const { BoxOfficeModule } = NativeModules
    return await BoxOfficeModule.search(query, page, perPage, subjectType, version)
  }

  async searchSuggestions(
    query: string,
    version: ApiVersion = ApiVersion.V2
  ): Promise<SearchSuggestions> {
    if (this.useNitro) {
      return await BoxOfficeNitroModule.searchSuggestions(query, version)
    }
    const { BoxOfficeModule } = NativeModules
    return await BoxOfficeModule.searchSuggestions(query, version)
  }

  // ==================== DISCOVERY ====================

  async getTrending(
    page: number = 1,
    perPage: number = 24,
    version: ApiVersion = ApiVersion.V2
  ): Promise<TrendingResults> {
    if (this.useNitro) {
      return await BoxOfficeNitroModule.getTrending(page, perPage, version)
    }
    const { BoxOfficeModule } = NativeModules
    return await BoxOfficeModule.getTrending(page, perPage, version)
  }

  async getHomepage(version: ApiVersion = ApiVersion.V2): Promise<HomepageContent> {
    if (this.useNitro) {
      return await BoxOfficeNitroModule.getHomepage(version)
    }
    const { BoxOfficeModule } = NativeModules
    return await BoxOfficeModule.getHomepage(version)
  }

  async getHotContent(version: ApiVersion = ApiVersion.V2): Promise<HotContent> {
    if (this.useNitro) {
      return await BoxOfficeNitroModule.getHotContent(version)
    }
    const { BoxOfficeModule } = NativeModules
    return await BoxOfficeModule.getHotContent(version)
  }

  async getPopularSearches(version: ApiVersion = ApiVersion.V2): Promise<PopularSearches> {
    if (this.useNitro) {
      return await BoxOfficeNitroModule.getPopularSearches(version)
    }
    const { BoxOfficeModule } = NativeModules
    return await BoxOfficeModule.getPopularSearches(version)
  }

  // ==================== DETAILS ====================

  async getMovieDetails(
    urlOrItem: string,
    version: ApiVersion = ApiVersion.V1
  ): Promise<MovieDetails> {
    if (this.useNitro) {
      return await BoxOfficeNitroModule.getMovieDetails(urlOrItem, version)
    }
    const { BoxOfficeModule } = NativeModules
    return await BoxOfficeModule.getMovieDetails(urlOrItem, version)
  }

  async getTVSeriesDetails(
    urlOrItem: string,
    version: ApiVersion = ApiVersion.V1
  ): Promise<TVSeriesDetails> {
    if (this.useNitro) {
      return await BoxOfficeNitroModule.getTVSeriesDetails(urlOrItem, version)
    }
    const { BoxOfficeModule } = NativeModules
    return await BoxOfficeModule.getTVSeriesDetails(urlOrItem, version)
  }

  async getItemDetails(urlOrItem: string): Promise<V2ItemDetails> {
    if (this.useNitro) {
      return await BoxOfficeNitroModule.getItemDetails(urlOrItem)
    }
    const { BoxOfficeModule } = NativeModules
    return await BoxOfficeModule.getItemDetails(urlOrItem)
  }

  // ==================== DOWNLOADABLE FILES ====================

  async getDownloadableFiles(
    item: any,
    subjectType: SubjectType = SubjectType.MOVIES,
    version: ApiVersion = ApiVersion.V1
  ): Promise<DownloadableFiles> {
    if (this.useNitro) {
      return await BoxOfficeNitroModule.getDownloadableFiles(item, subjectType, version)
    }
    const { BoxOfficeModule } = NativeModules
    return await BoxOfficeModule.getDownloadableFiles(item, subjectType, version)
  }

  // ==================== DOWNLOADS ====================

  async downloadMovie(
    title: string,
    quality: string = 'best',
    captionLanguage: string = 'English',
    downloadDir: string = '',
    year: number = 0
  ): Promise<DownloadMovieResult> {
    if (this.useNitro) {
      return await BoxOfficeNitroModule.downloadMovie(title, quality, captionLanguage, downloadDir, year)
    }
    const { BoxOfficeModule } = NativeModules
    return await BoxOfficeModule.downloadMovie(title, quality, captionLanguage, downloadDir, year)
  }

  async downloadTVSeries(
    title: string,
    season: number = 1,
    episode: number = 1,
    limit: number = 1,
    quality: string = 'best',
    captionLanguage: string = 'English',
    downloadDir: string = '',
    autoMode: boolean = false
  ): Promise<DownloadTVSeriesResult> {
    if (this.useNitro) {
      return await BoxOfficeNitroModule.downloadTVSeries(
        title, season, episode, limit, quality, captionLanguage, downloadDir, autoMode
      )
    }
    const { BoxOfficeModule } = NativeModules
    return await BoxOfficeModule.downloadTVSeries(
      title, season, episode, limit, quality, captionLanguage, downloadDir, autoMode
    )
  }

  async getDownloadStatus(downloadId?: string): Promise<DownloadStatusList> {
    if (this.useNitro) {
      return await BoxOfficeNitroModule.getDownloadStatus(downloadId ?? null)
    }
    const { BoxOfficeModule } = NativeModules
    return await BoxOfficeModule.getDownloadStatus(downloadId ?? null)
  }

  async cancelDownload(downloadId: string): Promise<CommandResult> {
    if (this.useNitro) {
      return await BoxOfficeNitroModule.cancelDownload(downloadId)
    }
    const { BoxOfficeModule } = NativeModules
    return await BoxOfficeModule.cancelDownload(downloadId)
  }

  // ==================== RECOMMENDATIONS ====================

  async getRecommendations(
    urlOrItem: string,
    page: number = 1,
    perPage: number = 24,
    version: ApiVersion = ApiVersion.V1
  ): Promise<Recommendations> {
    if (this.useNitro) {
      return await BoxOfficeNitroModule.getRecommendations(urlOrItem, page, perPage, version)
    }
    const { BoxOfficeModule } = NativeModules
    return await BoxOfficeModule.getRecommendations(urlOrItem, page, perPage, version)
  }
}

// ==================== EXPORT ====================

export const boxOffice = BoxOfficeBridge.getInstance()
export default BoxOfficeBridge

