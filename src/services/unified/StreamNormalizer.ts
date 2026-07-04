/**
 * StreamNormalizer - Normalizes stream data from various providers into a unified format.
 * Handles quality normalization, URL validation, and source deduplication.
 */

import { StreamSource, StreamQuality, NormalizedStream } from './types/StreamTypes'

export interface NormalizationOptions {
  preferredQuality?: StreamQuality
  allowHLS?: boolean
  allowDASH?: boolean
  allowMP4?: boolean
  maxSources?: number
}

export class StreamNormalizer {
  private static qualityRank: Record<StreamQuality, number> = {
    '4k': 8,
    '2160p': 8,
    '1440p': 7,
    '1080p': 6,
    '720p': 5,
    '480p': 4,
    '360p': 3,
    '240p': 2,
    '144p': 1,
    'auto': 0,
    'unknown': 0,
  }

  /**
   * Normalize a single stream source.
   */
  static normalize(source: StreamSource, provider: string): NormalizedStream {
    return {
      id: `${provider}-${source.quality}-${Date.now()}`,
      url: source.url,
      quality: this.normalizeQuality(source.quality),
      originalQuality: source.quality,
      provider,
      type: source.type,
      headers: source.headers ?? {},
      subtitles: source.subtitles ?? [],
      isHLS: source.type === 'hls' || source.url.includes('.m3u8'),
      isDASH: source.type === 'dash' || source.url.includes('.mpd'),
      duration: source.duration,
      size: source.size,
    }
  }

  /**
   * Normalize multiple sources, deduplicate, and sort by quality.
   */
  static normalizeAll(
    sources: StreamSource[],
    provider: string,
    options: NormalizationOptions = {}
  ): NormalizedStream[] {
    const {
      preferredQuality = 'auto',
      allowHLS = true,
      allowDASH = true,
      allowMP4 = true,
      maxSources = 10,
    } = options

    const normalized = sources
      .map(s => this.normalize(s, provider))
      .filter(s => {
        if (s.isHLS && !allowHLS) return false
        if (s.isDASH && !allowDASH) return false
        if (s.type === 'mp4' && !allowMP4) return false
        return true
      })

    const deduplicated = this.deduplicate(normalized)
    const sorted = this.sortByQuality(deduplicated, preferredQuality)

    return sorted.slice(0, maxSources)
  }

  /**
   * Normalize quality string to standard format.
   */
  static normalizeQuality(quality: string): StreamQuality {
    const q = quality.toLowerCase().trim()

    if (q.includes('4k') || q.includes('2160')) return '2160p'
    if (q.includes('1440')) return '1440p'
    if (q.includes('1080')) return '1080p'
    if (q.includes('720')) return '720p'
    if (q.includes('480')) return '480p'
    if (q.includes('360')) return '360p'
    if (q.includes('240')) return '240p'
    if (q.includes('144')) return '144p'
    if (q === 'auto') return 'auto'

    return 'unknown'
  }

  /**
   * Deduplicate streams by URL.
   */
  static deduplicate(streams: NormalizedStream[]): NormalizedStream[] {
    const seen = new Set<string>()
    return streams.filter(s => {
      if (seen.has(s.url)) return false
      seen.add(s.url)
      return true
    })
  }

  /**
   * Sort streams by quality, preferring the requested quality.
   */
  static sortByQuality(streams: NormalizedStream[], preferred: StreamQuality): NormalizedStream[] {
    const preferredRank = this.qualityRank[preferred] ?? 0

    return streams.sort((a, b) => {
      const aDiff = Math.abs(this.qualityRank[a.quality] - preferredRank)
      const bDiff = Math.abs(this.qualityRank[b.quality] - preferredRank)

      if (aDiff !== bDiff) return aDiff - bDiff
      return this.qualityRank[b.quality] - this.qualityRank[a.quality]
    })
  }

  /**
   * Get the best quality available from a list of streams.
   */
  static getBestQuality(streams: NormalizedStream[]): StreamQuality {
    if (streams.length === 0) return 'unknown'
    return streams.reduce((best, current) => {
      return this.qualityRank[current.quality] > this.qualityRank[best] ? current.quality : best
    }, 'unknown' as StreamQuality)
  }

  /**
   * Filter streams by minimum quality.
   */
  static filterByMinQuality(streams: NormalizedStream[], minQuality: StreamQuality): NormalizedStream[] {
    const minRank = this.qualityRank[minQuality]
    return streams.filter(s => this.qualityRank[s.quality] >= minRank)
  }
}

export default StreamNormalizer