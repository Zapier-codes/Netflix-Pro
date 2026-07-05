/**
 * ConsumetStreamAdapter - Adapter that wraps ConsumetApiService to implement IStreamProvider.
 * Translates Consumet's movie/TV/anime APIs into the unified StreamSource format.
 */

import { IStreamProvider, StreamBackendConfig } from '../../types/ProviderTypes'
import { StreamSource, StreamQuality } from '../../types/StreamTypes'
import { consumetApiService, ConsumetStream } from '../consumet/ConsumetProvider'

export class ConsumetStreamAdapter implements IStreamProvider {
  readonly name = 'consumet'
  private config: StreamBackendConfig

  constructor(config: StreamBackendConfig = {}) {
    this.config = {
      timeout: 30000,
      retryCount: 2,
      defaultQuality: 'auto',
      ...config,
    }
  }

  /**
   * Get streaming sources for a movie or TV show.
   */
  async getStreams(request: {
    id: string
    type: 'movie' | 'tv'
    season?: number
    episode?: number
  }): Promise<StreamSource[]> {
    const { id, type, season, episode } = request

    try {
      let sources: ConsumetStream[] = []

      if (type === 'movie') {
        sources = await consumetApiService.getMovieSources(id)
      } else if (type === 'tv' && season !== undefined && episode !== undefined) {
        sources = await consumetApiService.getTVSources(id, season, episode)
      } else {
        throw new Error('TV show requires season and episode numbers')
      }

      if (!sources || sources.length === 0) {
        return []
      }

      return sources.map((source, index) => ({
        id: `consumet-${index}-${Date.now()}`,
        provider: this.name,
        url: source.url,
        quality: this.normalizeQuality(source.quality),
        type: this.guessStreamType(source.url, source.format),
        headers: source.headers || {},
        subtitles: [],
        isProxyRequired: false,
        duration: undefined,
        size: undefined,
      }))
    } catch (error) {
      console.error(`[ConsumetStreamAdapter] Failed to get streams for ${type} ${id}:`, error)
      return []
    }
  }

  /**
   * Health check - verify Consumet API is responsive.
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Try to fetch recent movies as a health check
      const result = await consumetApiService.getRecentMovies()
      return Array.isArray(result)
    } catch {
      return false
    }
  }

  /**
   * Normalize quality string to standard format.
   */
  private normalizeQuality(quality: string): StreamQuality {
    if (!quality) return 'auto'
    const q = quality.toLowerCase().trim()
    
    if (q.includes('4k') || q.includes('2160')) return '4K'
    if (q.includes('1440')) return '1440p'
    if (q.includes('1080')) return '1080p'
    if (q.includes('720')) return '720p'
    if (q.includes('480')) return '480p'
    if (q.includes('360')) return '360p'
    if (q.includes('240')) return '240p'
    if (q.includes('144')) return '144p'
    return 'auto'
  }

  /**
   * Guess stream type from URL and format info.
   */
  private guessStreamType(url: string, format?: string): 'hls' | 'dash' | 'mp4' | 'mkv' | 'm3u8' | 'iframe' | 'direct' {
    if (format?.toLowerCase() === 'hls' || url.includes('.m3u8')) return 'hls'
    if (format?.toLowerCase() === 'dash' || url.includes('.mpd')) return 'dash'
    if (format?.toLowerCase() === 'mp4' || url.includes('.mp4')) return 'mp4'
    if (format?.toLowerCase() === 'mkv' || url.includes('.mkv')) return 'mkv'
    if (url.includes('.m3u8')) return 'm3u8'
    return 'direct'
  }
}

export default ConsumetStreamAdapter