// src/services/unified/ProviderRegistry.ts

import {
  IStreamProvider,
  StreamProviderId,
  StreamProviderHealthStatus,
  StreamBackendConfig,
} from './types/ProviderTypes';
import { ProviderFactory } from './ProviderFactory';

export interface RegisteredProvider {
  type: StreamProviderId;
  instance: IStreamProvider;
  priority: number;
  isHealthy: boolean;
  lastUsed: number;
  failureCount: number;
}

export class ProviderRegistry {
  private providers: Map<StreamProviderId, RegisteredProvider> = new Map();
  private defaultPriority: Record<StreamProviderId, number> = {
    'vidsrc-bypass': 0, // NEW - highest priority
    vidsrc: 1,
    moviebox: 2,
    xyra: 3,
    consumet: 4,
  };

  register(type: StreamProviderId, priority?: number): void {
    if (this.providers.has(type)) {
      console.warn(`[ProviderRegistry] Provider ${type} already registered, overwriting`);
    }

    const instance = ProviderFactory.getProvider(type);
    const registered: RegisteredProvider = {
      type,
      instance,
      priority: priority ?? this.defaultPriority[type] ?? 99,
      isHealthy: true,
      lastUsed: 0,
      failureCount: 0,
    };

    this.providers.set(type, registered);
    console.log(`[ProviderRegistry] Registered ${type} with priority ${registered.priority}`);
  }

  registerMultiple(types: StreamProviderId[]): void {
    types.forEach(type => this.register(type));
  }

  unregister(type: StreamProviderId): void {
    this.providers.delete(type);
    console.log(`[ProviderRegistry] Unregistered ${type}`);
  }

  get(type: StreamProviderId): IStreamProvider | undefined {
    const registered = this.providers.get(type);
    if (!registered || !registered.isHealthy) return undefined;
    registered.lastUsed = Date.now();
    return registered.instance;
  }

  getHealthyProviders(): RegisteredProvider[] {
    return Array.from(this.providers.values())
      .filter(p => p.isHealthy)
      .sort((a, b) => a.priority - b.priority);
  }

  /**
   * Returns all registered, healthy provider instances sorted by priority.
   * Used for exhaustive fallback loops (as opposed to getBestProvider,
   * which returns only a single, content-type-matched instance).
   */
  getAllProviders(): IStreamProvider[] {
    return this.getHealthyProviders().map(p => p.instance);
  }

  getBestProvider(contentType: 'movie' | 'tv' | 'anime'): IStreamProvider | undefined {
    const supported = ProviderFactory.getProvidersForContent(contentType);
    const healthy = this.getHealthyProviders();

    for (const provider of healthy) {
      if (supported.includes(provider.type)) {
        return provider.instance;
      }
    }

    return undefined;
  }

  reportFailure(type: StreamProviderId): void {
    const provider = this.providers.get(type);
    if (!provider) return;

    provider.failureCount++;
    if (provider.failureCount >= 3) {
      provider.isHealthy = false;
      console.warn(`[ProviderRegistry] ${type} marked unhealthy after ${provider.failureCount} failures`);
    }
  }

  reportSuccess(type: StreamProviderId): void {
    const provider = this.providers.get(type);
    if (!provider) return;

    provider.failureCount = 0;
    provider.isHealthy = true;
  }

  async healthCheck(): Promise<StreamProviderHealthStatus[]> {
    const checks: Promise<StreamProviderHealthStatus>[] = [];

    for (const [type, registered] of this.providers) {
      checks.push(
        (async (): Promise<StreamProviderHealthStatus> => {
          try {
            const isHealthy = await registered.instance.healthCheck();
            registered.isHealthy = isHealthy;
            return {
              provider: type,
              isHealthy,
              responseTime: 0,
              lastChecked: Date.now(),
            };
          } catch {
            registered.isHealthy = false;
            return {
              provider: type,
              isHealthy: false,
              responseTime: -1,
              lastChecked: Date.now(),
            };
          }
        })()
      );
    }

    return Promise.all(checks);
  }

  getRegisteredTypes(): StreamProviderId[] {
    return Array.from(this.providers.keys());
  }

  clear(): void {
    this.providers.clear();
  }
}

export const providerRegistry = new ProviderRegistry();
export default ProviderRegistry;