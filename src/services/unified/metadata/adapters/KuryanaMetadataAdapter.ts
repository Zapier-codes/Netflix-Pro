/**
 * KuryanaMetadataAdapter - Adapter that wraps KuryanaApiService to implement the metadata provider interface.
 * Translates Kuryana's API into the unified metadata provider shape.
 */

import { IMetadataResult } from '../../types/MetadataTypes'
import { kuryanaApiService } from '../KuryanaMetadata'

export class KuryanaMetadataAdapter {
  readonly name = 'Kuryana'
  readonly id = 'kuryana'
  readonly priority = 2
  readonly enabled = true

  /**
   * Search for movies or TV shows (Kuryana primarily handles dramas/asian content).
   */
  async search(query: string, type?: 'movie' | 'tv', limit: number = 20): Promise<IMetadataResult[]> {
    try {
      const results = await kuryanaApiService.searchDramas(query)

      return results.slice(0, limit).map((item) => ({
        id: item.id?.toString() || item.slug || '',
        title: item.title || '',
        type: 'tv', // Kuryana only has dramas/TV series
        year: item.year || undefined,
        poster: item.poster || undefined,
        backdrop: item.backdrop || undefined,
        overview: item.synopsis || '',
        rating: item.rating || 0,
        genres: item.genres || [],
        runtime: item.duration ? parseInt(item.duration) : undefined,
        cast: [],
      }))
    } catch (error) {
      console.error('[KuryanaMetadataAdapter] Search failed:', error)
      return []
    }
  }

  /**
   * Get metadata by ID (slug).
   */
  async getById(id: string, type: 'movie' | 'tv'): Promise<IMetadataResult | null> {
    try {
      const item = await kuryanaApiService.getDramaDetails(id)

      if (!item) return null

      return {
        id: item.id?.toString() || item.slug || '',
        title: item.title || '',
        type: 'tv', // Kuryana only has dramas/TV series
        year: item.year || undefined,
        poster: item.poster || undefined,
        backdrop: item.backdrop || undefined,
        overview: item.synopsis || '',
        rating: item.rating || 0,
        genres: item.genres || [],
        runtime: item.duration ? parseInt(item.duration) : undefined,
        cast: item.cast?.map((c) => ({
          character: c.role,
          person: {
            name: c.name,
            ids: {},
          },
        })) || [],
      }
    } catch (error) {
      console.error(`[KuryanaMetadataAdapter] Get by ID ${id} failed:`, error)
      return null
    }
  }
}

export default KuryanaMetadataAdapter