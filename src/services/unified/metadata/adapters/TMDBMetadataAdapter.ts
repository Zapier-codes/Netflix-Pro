/**
 * TMDBMetadataAdapter - Adapter that wraps TMDB functions to implement the metadata provider interface.
 * Translates TMDB's standalone functions into the unified metadata provider shape.
 */

import { IMetadataResult } from '../../types/MetadataTypes'
import tmdbApi from '../TMDBMetadata'

export class TMDBMetadataAdapter {
  readonly name = 'TMDB'
  readonly id = 'tmdb'
  readonly priority = 1
  readonly enabled = true

  /**
   * Search for movies or TV shows.
   */
  async search(query: string, type?: 'movie' | 'tv', limit: number = 20): Promise<IMetadataResult[]> {
    try {
      const results = await tmdbApi.searchMedia(query)

      // Filter by type if specified
      let filtered = results
      if (type === 'movie') {
        filtered = results.filter((item: any) => item.media_type === 'movie' || item.title)
      } else if (type === 'tv') {
        filtered = results.filter((item: any) => item.media_type === 'tv' || item.name)
      }

      return filtered.slice(0, limit).map((item: any) => ({
        id: item.id?.toString() || '',
        title: item.title || item.name || '',
        type: item.title || item.media_type === 'movie' ? 'movie' : 'tv',
        year: item.release_date ? parseInt(item.release_date.split('-')[0]) : 
              item.first_air_date ? parseInt(item.first_air_date.split('-')[0]) : 
              undefined,
        poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : undefined,
        backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : undefined,
        overview: item.overview || '',
        rating: item.vote_average || 0,
        genres: item.genre_ids?.map((id: number) => id.toString()) || [],
        runtime: undefined,
        cast: [],
      }))
    } catch (error) {
      console.error('[TMDBMetadataAdapter] Search failed:', error)
      return []
    }
  }

  /**
   * Get metadata by ID.
   */
  async getById(id: string, type: 'movie' | 'tv'): Promise<IMetadataResult | null> {
    try {
      let item: any = null

      if (type === 'movie') {
        item = await tmdbApi.fetchMovieDetails(parseInt(id))
      } else {
        item = await tmdbApi.fetchTVShowDetails(parseInt(id))
      }

      if (!item) return null

      return {
        id: item.id?.toString() || '',
        title: item.title || item.name || '',
        type: type,
        year: item.release_date ? parseInt(item.release_date.split('-')[0]) : 
              item.first_air_date ? parseInt(item.first_air_date.split('-')[0]) : 
              undefined,
        poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : undefined,
        backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : undefined,
        overview: item.overview || '',
        rating: item.vote_average || 0,
        genres: item.genres?.map((g: any) => g.name) || [],
        runtime: item.runtime,
        cast: item.credits?.cast?.slice(0, 10).map((c: any) => ({
          character: c.character,
          person: {
            name: c.name,
            ids: {},
          },
        })) || [],
      }
    } catch (error) {
      console.error(`[TMDBMetadataAdapter] Get by ID ${id} failed:`, error)
      return null
    }
  }
}

export default TMDBMetadataAdapter