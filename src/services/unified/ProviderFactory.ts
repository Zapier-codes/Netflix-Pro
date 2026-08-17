// src/services/unified/ProviderFactory.ts

import {
  IStreamProvider,
  StreamProviderId,
  StreamBackendConfig,
} from './types/ProviderTypes';
import { StreamQuality } from './types/StreamTypes';

import { ConsumetStreamAdapter } from './providers/adapters/ConsumetStreamAdapter';
import { XyraStreamAdapter } from './providers/adapters/XyraStreamAdapter';
import { VidSrcStreamAdapter } from './providers/adapters/VidSrcStreamAdapter';
import { MovieboxProvider } from './providers/moviebox/MovieboxProvider';
import { VidsrcBypassProvider } from './providers/vidsrc/VidsrcBypassProvider';

export interface ProviderFactoryOptions {
  defaultQuality?: StreamQuality;
  timeout?: number;
  retryCount?: number;
}

export class ProviderFactory {
  private static instances: Map<string, IStreamProvider> = new Map();

  static getProvider(
    type: StreamProviderId,
    config?: StreamBackendConfig,
    options?: ProviderFactoryOptions
  ): IStreamProvider {
    const key = `${type}-${JSON.stringify(config)}`;

    if (this.instances.has(key)) {
      return this.instances.get(key)!;
    }

    const provider = this.createProvider(type, config, options);
    this.instances.set(key, provider);
    return provider;
  }

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
    };

    switch (type) {
      case 'vidsrc-bypass':
        return new VidsrcBypassProvider(mergedConfig);
      case 'consumet':
        return new ConsumetStreamAdapter(mergedConfig);
      case 'moviebox':
        return new MovieboxProvider(mergedConfig);
      case 'vidsrc':
        return new VidSrcStreamAdapter(mergedConfig);
      case 'xyra':
        return new XyraStreamAdapter(mergedConfig);
      default:
        throw new Error(`Unknown provider type: ${type}`);
    }
  }

  static getAvailableProviders(): StreamProviderId[] {
    return ['vidsrc-bypass', 'consumet', 'moviebox', 'vidsrc', 'xyra'];
  }

  static getProvidersForContent(contentType: 'movie' | 'tv' | 'anime'): StreamProviderId[] {
    const map: Record<string, StreamProviderId[]> = {
      movie: ['vidsrc-bypass', 'consumet', 'moviebox', 'vidsrc', 'xyra'],
      tv: ['vidsrc-bypass', 'consumet', 'moviebox', 'vidsrc', 'xyra'],
      anime: ['vidsrc-bypass', 'consumet', 'xyra'],
    };
    return map[contentType] ?? ['vidsrc-bypass', 'vidsrc'];
  }

  static clearCache(): void {
    this.instances.clear();
  }
}

export default ProviderFactory;