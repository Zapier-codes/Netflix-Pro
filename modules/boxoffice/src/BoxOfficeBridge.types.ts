/**
 * Type definitions for the BoxOffice Bridge.
 * Re-exports shared types and adds bridge-specific types.
 */

export {
  // Enums
  SubjectType,
  ApiVersion,
} from '../nitro/shared/types'

export type {
  // Core
  ContentImage,
  SearchResultsPager,
  SearchResultItem,
  
  // Search
  SearchResults,
  SuggestedItem,
  SearchSuggestions,
  
  // Discovery
  TrendingResults,
  ContentCategory,
  Platform,
  HomepageContent,
  HotContent,
  PopularSearchItem,
  PopularSearches,
  
  // Video & Files
  VideoAddress,
  SubjectTrailer,
  MediaFile,
  CaptionFile,
  DownloadableFiles,
  
  // Stars & Resource
  StarsModel,
  ResourceModel,
  MetadataModel,
  
  // Post List
  PostListItem,
  PostList,
  
  // Details
  MovieDetails,
  TVSeriesDetails,
  V2ItemDetails,
  
  // Downloads
  DownloadedFile,
  DownloadMovieResult,
  EpisodeDownload,
  DownloadTVSeriesResult,
  DownloadStatus,
  DownloadStatusList,
  
  // Recommendations
  Recommendations,
  
  // Engine
  EngineConfig,
  EngineStatus,
  CommandResult,
  PongResult,
  
  // Events
  StatusChangeEvent,
  CommandExecutedEvent,
  DownloadProgressEvent,
  ErrorEvent,
} from '../nitro/shared/types'

// ==================== BRIDGE-SPECIFIC TYPES ====================

export interface BridgeOptions {
  useNitro?: boolean
  fallbackToLegacy?: boolean
}

export interface SearchOptions {
  query: string
  page?: number
  perPage?: number
  subjectType?: SubjectType
  version?: ApiVersion
}

export interface DiscoveryOptions {
  page?: number
  perPage?: number
  version?: ApiVersion
}

export interface DetailsOptions {
  urlOrItem: string
  version?: ApiVersion
}

export interface DownloadOptions {
  title: string
  quality?: string
  captionLanguage?: string
  downloadDir?: string
}

export interface DownloadMovieOptions extends DownloadOptions {
  year?: number
}

export interface DownloadTVSeriesOptions extends DownloadOptions {
  season?: number
  episode?: number
  limit?: number
  autoMode?: boolean
}

export interface DownloadableFilesOptions {
  item: any
  subjectType?: SubjectType
  version?: ApiVersion
}

export interface RecommendationsOptions {
  urlOrItem: string
  page?: number
  perPage?: number
  version?: ApiVersion
}

// ==================== HOOK TYPES ====================

export type LoadingState = 'idle' | 'loading' | 'success' | 'error'

export interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: string | null
}