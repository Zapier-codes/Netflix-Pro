/**
 * Unified Media Service - Main entry point for the unified media layer.
 */

// ============================================================================
// TYPES
// ============================================================================

export * from './types/ProviderTypes'

export type {
  StreamSource,
  StreamQuality,
  StreamRequest,
  StreamResponse,
  StreamMeta,
  UnifiedSubtitleTrack,
  StreamProvider,
  StreamProviderConfig,
  UnifiedStreamConfig,
  NormalizedStream,
  StreamCacheEntry,
  StreamError,
  StreamErrorCode,
} from './types/StreamTypes'

export type {
  SocialHealth,
  SocialUserProfile,
  SocialUserMini,
  SocialImage,
  SocialUserStats,
  HistoryQueryOptions,
  SocialHistoryEntry,
  SocialWatchedMovie,
  SocialWatchedShow,
  SocialWatchedSeason,
  SocialWatchedEpisode,
  SocialWatchlistEntry,
  SocialCollectionEntry,
  SocialMediaMetadata,
  SocialUserList,
  SocialListItem,
  SocialRatingEntry,
  SocialComment,
  SocialMediaIds,
  SocialMovie,
  SocialShow,
  SocialSeason,
  SocialEpisode,
  SocialPerson,
  SocialMediaImages,
  SocialTrendingMovie,
  SocialTrendingShow,
  SocialPopularMovie,
  SocialPopularShow,
  SocialAnticipatedMovie,
  SocialAnticipatedShow,
  SocialSearchResult,
  SocialCalendarEntry,
  SocialFollowRequest,
  SocialUserSettings,
  SocialLastActivity,
  SocialHiddenItem,
  SocialPlaybackProgress,
  SocialAggregationConfig,
  AggregatedSocialData,
} from './types/SocialTypes'

export { SocialError } from './types/SocialTypes'
export type { SocialErrorCode } from './types/SocialTypes'

// ============================================================================
// CORE SERVICES
// ============================================================================

export { UnifiedMediaService } from './UnifiedMediaService'
export { MetadataAggregatorNew } from './MetadataAggregatorNew'
export { ProviderFactory } from './ProviderFactory'
export { ProviderRegistry } from './ProviderRegistry'
export { StreamNormalizer } from './StreamNormalizer'

// ============================================================================
// METADATA PROVIDERS - COMPLETE LIST (5 providers)
// ============================================================================

export { MetadataAggregatorNew as MetadataAggregatorNewImpl } from './metadata/MetadataAggregatorNew'
export { default as TMDBMetadata } from './metadata/TMDBMetadata'
export { default as KuryanaMetadata } from './metadata/KuryanaMetadata'
export { TMDBMetadataAdapter } from './metadata/adapters/TMDBMetadataAdapter'
export { KuryanaMetadataAdapter } from './metadata/adapters/KuryanaMetadataAdapter'
export { MovieBoxMetadataAdapter } from './metadata/adapters/MovieBoxMetadataAdapter'
export { ConsumetMetadataAdapter } from './metadata/adapters/ConsumetMetadataAdapter'
export { TraktMetadataAdapter } from './metadata/adapters/TraktMetadataAdapter'

// ============================================================================
// STREAMING PROVIDERS
// ============================================================================

export { ConsumetApiService as ConsumetProvider } from './providers/consumet/ConsumetProvider'
export { default as MovieboxProvider } from './providers/moviebox/MovieboxProvider'
export { default as VidSrcProvider } from './providers/vidsrc/VidSrcProvider'
export { default as XyraProvider } from './providers/xyra/XyraProvider'

export { ConsumetStreamAdapter } from './providers/adapters/ConsumetStreamAdapter'
export { XyraStreamAdapter } from './providers/adapters/XyraStreamAdapter'
export { VidSrcStreamAdapter } from './providers/adapters/VidSrcStreamAdapter'

// ============================================================================
// SUBTITLE PROVIDERS
// ============================================================================

export { default as OpenSubtitlesProvider } from './subtitles/OpenSubtitlesProvider'
export { default as SubdlProvider } from './subtitles/SubdlProvider'
export { UnifiedSubtitlesService as UnifiedSubtitles } from './subtitles/UnifiedSubtitles'
export { default as XyraSubtitleProvider } from './subtitles/XyraSubtitleProvider'

// ============================================================================
// SOCIAL SERVICES
// ============================================================================

export { TraktService } from './social/TraktService'
