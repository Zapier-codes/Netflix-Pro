/**
 * Unified Media Service - Main entry point for the unified media layer.
 * Aggregates metadata, streaming, subtitles, and social features from multiple providers.
 */

// Types
export * from './types/MetadataTypes'
export * from './types/ProviderTypes'
export * from './types/SocialTypes'
export * from './types/StreamTypes'

// Core services
export { UnifiedMediaService } from './UnifiedMediaService'
export { MetadataAggregator } from './MetadataAggregator'
export { ProviderFactory } from './ProviderFactory'
export { ProviderRegistry } from './ProviderRegistry'
export { StreamNormalizer } from './StreamNormalizer'

// Metadata providers
export { MetadataAggregator as MetadataAggregatorImpl } from './metadata/MetadataAggregator'
export { KuryanaMetadata } from './metadata/KuryanaMetadata'
export { SIMKLMetadata } from './metadata/SIMKLMetadata'
export { TMDBMetadata } from './metadata/TMDBMetadata'
export { TraktMetadata } from './metadata/TraktMetadata'

// Streaming providers
export { ConsumetProvider } from './providers/consumet/ConsumetProvider'
export { MovieboxProvider } from './providers/moviebox/MovieboxProvider'
export { VidSrcProvider } from './providers/vidsrc/VidSrcProvider'
export { XyraProvider } from './providers/xyra/XyraProvider'

// Subtitle providers
export { OpenSubtitlesProvider } from './subtitles/OpenSubtitlesProvider'
export { SubdlProvider } from './subtitles/SubdlProvider'
export { UnifiedSubtitles } from './subtitles/UnifiedSubtitles'
export { XyraSubtitleProvider } from './subtitles/XyraSubtitleProvider'

// Social services
export { SIMKLService } from './social/SIMKLService'
export { TraktService } from './social/TraktService'