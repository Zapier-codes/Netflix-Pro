/**
 * XyraStreamAdapter - Adapter that wraps xyraApiService to implement IStreamProvider.
 * Translates Xyra's drama/movie APIs into the unified StreamSource format.
 */

import { IStreamProvider, StreamBackendConfig } from '../../types/ProviderTypes'
import { StreamSource, StreamQuality } from '../../types/StreamTypes'
import { xyraApiService, XyraDownload } from '../xyra/XyraProvider'

export class XyraStreamAdapter implements IStreamProvider {
  readonly name = 'xyra'
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
   * Note: Xyra uses 'movie' for both movies and series, with type field distinguishing them.
   */
  async getStreams(request: {
    id: string
    type: 'movie' | 'tv'
    season?: number
    episode?: number
  }): Promise<StreamSource[]> {
    const { id } = request

    try {
      // Xyra doesn't distinguish movie vs TV in its ID system - it uses the same info endpoint
      const info = await xyraApiService.getMovieInfo(id)
      
      if (!info || !info.downloads || info.downloads.length === 0) {
        return []
      }

      return info.downloads.map((download: XyraDownload, index: number) => ({
        id: `xyra-${index}-${Date.now()}`,
        provider: this.name,
        url: download.url,
        quality: this.normalizeQuality(download.quality),
        type: this.guessStreamType(download.url),
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        subtitles: [],
        isProxyRequired: false,
        duration: undefined,
        size: undefined,
      }))
    } catch (error) {
      console.error(`[XyraStreamAdapter] Failed to get streams for ID ${id}:`, error)
      return []
    }
  }

  /**
   * Health check - verify Xyra API is responsive.
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await xyraApiService.getHome(1)
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
   * Guess stream type from URL.
   */
  private guessStreamType(url: string): 'hls' | 'dash' | 'mp4' | 'mkv' | 'm3u8' | 'iframe' | 'direct' {
    if (url.includes('.m3u8')) return 'hls'
    if (url.includes('.mpd')) return 'dash'
    if (url.includes('.mp4')) return 'mp4'
    if (url.includes('.mkv')) return 'mkv'
    return 'direct'
  }
}

export default XyraStreamAdapter