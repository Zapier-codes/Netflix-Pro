/**
 * VidSrcStreamAdapter - Adapter that wraps VidSrc functions to implement IStreamProvider.
 * Translates VidSrc's URL construction logic into the unified StreamSource format.
 */

import { IStreamProvider, StreamBackendConfig } from '../../types/ProviderTypes'
import { StreamSource, StreamQuality } from '../../types/StreamTypes'
import { 
  getActiveStreamSources, 
  getStreamingUrl,
  initializeStreamSources
} from '../vidsrc/VidSrcProvider'

export class VidSrcStreamAdapter implements IStreamProvider {
  readonly name = 'vidsrc'
  private config: StreamBackendConfig
  private initialized = false

  constructor(config: StreamBackendConfig = {}) {
    this.config = {
      timeout: 30000,
      retryCount: 2,
      defaultQuality: 'auto',
      ...config,
    }
  }

  /**
   * Ensure stream sources are initialized.
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await initializeStreamSources()
      this.initialized = true
    }
  }

  /**
   * Get streaming sources for a movie or TV show.
   * VidSrc returns iframe URLs rather than direct media URLs.
   */
  async getStreams(request: {
    id: string
    type: 'movie' | 'tv'
    season?: number
    episode?: number
  }): Promise<StreamSource[]> {
    const { id, type, season, episode } = request

    await this.ensureInitialized()

    try {
      const sources = getActiveStreamSources()
      const results: StreamSource[] = []

      for (let i = 0; i < sources.length; i++) {
        const source = sources[i]
        // Use nullish coalescing to convert number | undefined to null | undefined
        const url = getStreamingUrl(
          source.baseUrl,
          id,
          type,
          season ?? null,
          episode ?? null
        )

        if (url) {
          results.push({
            id: `vidsrc-${i}-${Date.now()}`,
            provider: this.name,
            url: url,
            quality: 'auto' as StreamQuality,
            type: 'iframe',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9',
            },
            subtitles: [],
            isProxyRequired: false,
            duration: undefined,
            size: undefined,
          })
        }
      }

      return results
    } catch (error) {
      console.error(`[VidSrcStreamAdapter] Failed to get streams for ${type} ${id}:`, error)
      return []
    }
  }

  /**
   * Health check - verify VidSrc sources are initialized and responsive.
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.ensureInitialized()
      const sources = getActiveStreamSources()
      return sources && sources.length > 0
    } catch {
      return false
    }
  }
}

export default VidSrcStreamAdapter