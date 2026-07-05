/**
 * ProviderFactory - Factory for creating streaming provider instances.
 * Maps provider names to their implementations using adapters.
 */

import {
  IStreamProvider,
  StreamProviderId,
  StreamBackendConfig,
} from './types/ProviderTypes'
import { StreamQuality } from './types/StreamTypes'

// Import adapters from the correct paths
import { ConsumetStreamAdapter } from './providers/adapters/ConsumetStreamAdapter'
import { XyraStreamAdapter } from './providers/adapters/XyraStreamAdapter'
import { VidSrcStreamAdapter } from './providers/adapters/VidSrcStreamAdapter'
// Moviebox already implements IStreamProvider directly
import { MovieboxProvider } from './providers/moviebox/MovieboxProvider'

export interface ProviderFactoryOptions {
  defaultQuality?: StreamQuality
  timeout?: number
  retryCount?: number
}

export class ProviderFactory {
  private static instances: Map<string, IStreamProvider> = new Map()

  /**
   * Create or get a cached provider instance.
   */
  static getProvider(
    type: StreamProviderId,
    config?: StreamBackendConfig,
    options?: ProviderFactoryOptions
  ): IStreamProvider {
    const key = `${type}-${JSON.stringify(config)}`

    if (this.instances.has(key)) {
      return this.instances.get(key)!
    }

    const provider = this.createProvider(type, config, options)
    this.instances.set(key, provider)
    return provider
  }

  /**
   * Create a fresh provider instance without caching.
   */
  static createProvider(
    type: StreamProviderId,
    config?: StreamBackendConfig,
    options?: ProviderFactoryOptions
  ): IStreamProvider {
    const mergedConfig: StreamBackendConfig = {
      ...config,
      defaultQuality: options?.defaultQuality ?? 'auto',
      timeout: options?.timeout ?? 30000,
      retryCount: options?.retryCount ?? 2,
    }

    switch (type) {
      case 'consumet':
        return new ConsumetStreamAdapter(mergedConfig)
      case 'moviebox':
        return new MovieboxProvider(mergedConfig)
      case 'vidsrc':
        return new VidSrcStreamAdapter(mergedConfig)
      case 'xyra':
        return new XyraStreamAdapter(mergedConfig)
      default:
        throw new Error(`Unknown provider type: ${type}`)
    }
  }

  /**
   * Get all available provider types.
   */
  static getAvailableProviders(): StreamProviderId[] {
    return ['consumet', 'moviebox', 'vidsrc', 'xyra']
  }

  /**
   * Get providers that support a specific content type.
   */
  static getProvidersForContent(contentType: 'movie' | 'tv' | 'anime'): StreamProviderId[] {
    const map: Record<string, StreamProviderId[]> = {
      movie: ['consumet', 'moviebox', 'vidsrc', 'xyra'],
      tv: ['consumet', 'moviebox', 'vidsrc', 'xyra'],
      anime: ['consumet', 'xyra'],
    }
    return map[contentType] ?? ['vidsrc']
  }

  /**
   * Clear all cached provider instances.
   */
  static clearCache(): void {
    this.instances.clear()
  }
}

export default ProviderFactory