/**
 * BoxOffice Module - Main entry point for the BoxOffice React Native module.
 * Exports the bridge, hooks, utilities, and all types for the moviebox-api SDK.
 */

// ==================== BRIDGE ====================

export { boxOffice, default as BoxOfficeBridge } from './BoxOfficeBridge'
export type {
  BridgeOptions,
  SearchOptions,
  DiscoveryOptions,
  DetailsOptions,
  DownloadOptions,
  DownloadMovieOptions,
  DownloadTVSeriesOptions,
  DownloadableFilesOptions,
  RecommendationsOptions,
  LoadingState,
  AsyncState,
} from './BoxOfficeBridge.types'

// ==================== HOOKS ====================

export { useBoxOfficeEngine } from './hooks/useBoxOfficeEngine'
export { useBoxOfficeStatus } from './hooks/useBoxOfficeStatus'
export { useBoxOfficeSubscription } from './hooks/useBoxOfficeSubscription'

// ==================== UTILITIES ====================

export { EventEmitter } from './utils/event-emitter'
export { Logger } from './utils/logger'

// ==================== TYPES (RE-EXPORTED) ====================

export {
  SubjectType,
  ApiVersion,
} from './BoxOfficeBridge.types'

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
} from './BoxOfficeBridge.types'

// ==================== NITRO EXPORTS (IF AVAILABLE) ====================

export {
  BoxOfficeNitroModule,
} from '../nitro'

export type {
  BoxOfficeNitroModule as IBoxOfficeNitroModule,
} from '../nitro'