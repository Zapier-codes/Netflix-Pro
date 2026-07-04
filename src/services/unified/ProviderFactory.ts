/**
 * ProviderFactory - Factory for creating streaming provider instances.
 * Maps provider names to their implementations with configurable options.
 */

import {
  IStreamProvider,
  ProviderType,
  ProviderConfig,
  StreamQuality,
  StreamSource,
} from './types/ProviderTypes'
import { ConsumetProvider } from './providers/consumet/ConsumetProvider'
import { MovieboxProvider } from './providers/moviebox/MovieboxProvider'
import { VidSrcProvider } from './providers/vidsrc/VidSrcProvider'
import { XyraProvider } from './providers/xyra/XyraProvider'

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
    type: ProviderType,
    config?: ProviderConfig,
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
    type: ProviderType,
    config?: ProviderConfig,
    options?: ProviderFactoryOptions
  ): IStreamProvider {
    const mergedConfig: ProviderConfig = {
      ...config,
      defaultQuality: options?.defaultQuality ?? 'auto',
      timeout: options?.timeout ?? 30000,
      retryCount: options?.retryCount ?? 2,
    }

    switch (type) {
      case 'consumet':
        return new ConsumetProvider(mergedConfig)
      case 'moviebox':
        return new MovieboxProvider(mergedConfig)
      case 'vidsrc':
        return new VidSrcProvider(mergedConfig)
      case 'xyra':
        return new XyraProvider(mergedConfig)
      default:
        throw new Error(`Unknown provider type: ${type}`)
    }
  }

  /**
   * Get all available provider types.
   */
  static getAvailableProviders(): ProviderType[] {
    return ['consumet', 'moviebox', 'vidsrc', 'xyra']
  }

  /**
   * Get providers that support a specific content type.
   */
  static getProvidersForContent(contentType: 'movie' | 'tv' | 'anime'): ProviderType[] {
    const map: Record<string, ProviderType[]> = {
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