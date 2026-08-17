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

export { MetadataAggregatorNew } from './metadata/MetadataAggregatorNew'

// ============================================================================
// METADATA PROVIDERS - COMPLETE LIST (5 providers)
// ============================================================================

export { MetadataAggregatorNew as MetadataAggregatorNewImpl } from './metadata/MetadataAggregatorNew'
export { default as TMDBMetadata } from './metadata/TMDBMetadata'
export { default as KuryanaMetadata } from './metadata/KuryanaMetadata'
export { TMDBMetadataAdapter } from './metadata/adapters/TMDBMetadataAdapter'
export { KuryanaMetadataAdapter } from './metadata/adapters/KuryanaMetadataAdapter'
export { TraktMetadataAdapter } from './metadata/adapters/TraktMetadataAdapter'

// ============================================================================
// STREAMING
// ============================================================================
// Phase 1 removed all piracy-scraping providers (VidSrc, Consumet, MovieBox,
// Xyra) and their stream adapters, along with the orchestrator
// (UnifiedMediaService/ProviderFactory/ProviderRegistry) that cascaded
// between them. Phase 2 wires playback to a licensed backend instead — see
// src/services/licensedPlayback/LicensedPlaybackService.ts.

// ============================================================================
// SUBTITLE PROVIDERS
// ============================================================================

export { default as OpenSubtitlesProvider } from './subtitles/OpenSubtitlesProvider'
export { default as SubdlProvider } from './subtitles/SubdlProvider'
export { UnifiedSubtitlesService as UnifiedSubtitles } from './subtitles/UnifiedSubtitles'
// XyraSubtitleProvider removed — depended on the deleted Xyra piracy API.

// ============================================================================
// SOCIAL SERVICES
// ============================================================================

export { TraktService } from './social/TraktService'
