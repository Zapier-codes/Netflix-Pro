/**
 * UnifiedMediaService - Main orchestrator for the unified media layer.
 * Coordinates metadata, streaming, subtitles, and social features.
 */

import { MetadataAggregator } from './metadata/MetadataAggregatorNew'
import { ProviderRegistry } from './ProviderRegistry'
import { StreamNormalizer } from './StreamNormalizer'
import { UnifiedSubtitles } from './subtitles/UnifiedSubtitles'
import {
  UnifiedMediaResult,
  UnifiedSearchOptions,
  UnifiedStreamOptions,
  UnifiedSubtitleOptions,
} from './types/ProviderTypes'
import { NormalizedStream } from './types/StreamTypes'
import { IMetadataResult } from './types/MetadataTypes'

export class UnifiedMediaService {
  private metadataAggregator: MetadataAggregator
  private providerRegistry: ProviderRegistry
  private subtitleService: UnifiedSubtitles
  private initialized: boolean = false

  constructor() {
    this.metadataAggregator = new MetadataAggregator()
    this.providerRegistry = new ProviderRegistry()
    this.subtitleService = new UnifiedSubtitles()
  }

  /**
   * Initialize all subsystems.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    // Register default streaming providers
    this.providerRegistry.registerMultiple(['vidsrc', 'moviebox', 'xyra', 'consumet'])

    this.initialized = true
    console.log('[UnifiedMediaService] Initialized')
  }

  /**
   * Search for content across all sources.
   */
  async search(options: UnifiedSearchOptions): Promise<UnifiedMediaResult[]> {
    this.ensureInitialized()

    const { query, type, year, limit = 20 } = options

    // Search metadata sources
    const metadataResults = await this.metadataAggregator.search(query, type, limit)

    // Convert to unified results
    const results: UnifiedMediaResult[] = metadataResults.map(meta => ({
      id: meta.id,
      title: meta.title,
      type: meta.type,
      year: meta.year,
      releaseDate: meta.releaseDate,
      poster: meta.poster,
      backdrop: meta.backdrop,
      overview: meta.overview,
      rating: meta.rating,
      genres: meta.genres,
      runtime: meta.runtime,
      cast: meta.cast,
      source: meta.source,
      sources: [],
      metadata: meta,
    }))

    return results.slice(0, limit)
  }

  /**
   * Get trending content across all metadata sources.
   */
  async getTrending(limit: number = 20): Promise<IMetadataResult[]> {
    this.ensureInitialized()
    return this.metadataAggregator.getTrending(limit)
  }

  /**
   * Get streaming sources for a specific title.
   */
  async getStreams(options: UnifiedStreamOptions): Promise<NormalizedStream[]> {
    this.ensureInitialized()

    const { id, type, season, episode, preferredQuality = 'auto' } = options

    const provider = this.providerRegistry.getBestProvider(type)
    if (!provider) {
      throw new Error('No healthy streaming provider available')
    }

    const sources = await provider.getStreams({
      id,
      type,
      season,
      episode,
    })

    return StreamNormalizer.normalizeAll(sources, provider.name, {
      preferredQuality,
    })
  }

  /**
   * Get subtitles for a specific title.
   */
  async getSubtitles(options: UnifiedSubtitleOptions): Promise<any[]> {
    this.ensureInitialized()

    return this.subtitleService.getSubtitles({
      imdbId: options.imdbId,
      tmdbId: options.tmdbId,
      season: options.season,
      episode: options.episode,
      language: options.language ?? 'en',
    })
  }

  /**
   * Get full media details with streams and subtitles.
   */
  async getFullMedia(
    id: string,
    type: 'movie' | 'tv',
    options: {
      season?: number
      episode?: number
      preferredQuality?: string
      subtitleLanguage?: string
    } = {}
  ): Promise<{
    metadata: IMetadataResult | null
    streams: NormalizedStream[]
    subtitles: any[]
  }> {
    this.ensureInitialized()

    const [metadata, streams, subtitles] = await Promise.allSettled([
      this.metadataAggregator.getById(id, type),
      this.getStreams({
        id,
        type,
        season: options.season,
        episode: options.episode,
        preferredQuality: options.preferredQuality as any,
      }),
      this.getSubtitles({
        imdbId: id,
        season: options.season,
        episode: options.episode,
        language: options.subtitleLanguage,
      }),
    ])

    return {
      metadata: metadata.status === 'fulfilled' ? metadata.value : null,
      streams: streams.status === 'fulfilled' ? streams.value : [],
      subtitles: subtitles.status === 'fulfilled' ? subtitles.value : [],
    }
  }

  /**
   * Health check all providers.
   */
  async healthCheck(): Promise<{ provider: string; isHealthy: boolean }[]> {
    if (!this.initialized) return []
    return this.providerRegistry.healthCheck()
  }

  /**
   * Dispose of all resources.
   */
  destroy(): void {
    this.providerRegistry.clear()
    this.initialized = false
    console.log('[UnifiedMediaService] Destroyed')
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('UnifiedMediaService not initialized. Call initialize() first.')
    }
  }
}

export const unifiedMediaService = new UnifiedMediaService()
export default UnifiedMediaService