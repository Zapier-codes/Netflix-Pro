/**
 * ProviderRegistry - Runtime registry for managing active streaming providers.
 * Handles provider priority, failover, and health checks.
 */

import { IStreamProvider, ProviderType, StreamSource, ProviderHealth } from './types/ProviderTypes'
import { ProviderFactory } from './ProviderFactory'

export interface RegisteredProvider {
  type: ProviderType
  instance: IStreamProvider
  priority: number
  isHealthy: boolean
  lastUsed: number
  failureCount: number
}

export class ProviderRegistry {
  private providers: Map<ProviderType, RegisteredProvider> = new Map()
  private defaultPriority: Record<ProviderType, number> = {
    vidsrc: 1,
    moviebox: 2,
    xyra: 3,
    consumet: 4,
  }

  /**
   * Register a provider with the registry.
   */
  register(type: ProviderType, priority?: number): void {
    if (this.providers.has(type)) {
      console.warn(`[ProviderRegistry] Provider ${type} already registered, overwriting`)
    }

    const instance = ProviderFactory.getProvider(type)
    const registered: RegisteredProvider = {
      type,
      instance,
      priority: priority ?? this.defaultPriority[type] ?? 99,
      isHealthy: true,
      lastUsed: 0,
      failureCount: 0,
    }

    this.providers.set(type, registered)
    console.log(`[ProviderRegistry] Registered ${type} with priority ${registered.priority}`)
  }

  /**
   * Register multiple providers at once.
   */
  registerMultiple(types: ProviderType[]): void {
    types.forEach(type => this.register(type))
  }

  /**
   * Unregister a provider.
   */
  unregister(type: ProviderType): void {
    this.providers.delete(type)
    console.log(`[ProviderRegistry] Unregistered ${type}`)
  }

  /**
   * Get a provider by type.
   */
  get(type: ProviderType): IStreamProvider | undefined {
    const registered = this.providers.get(type)
    if (!registered || !registered.isHealthy) return undefined
    registered.lastUsed = Date.now()
    return registered.instance
  }

  /**
   * Get all healthy providers sorted by priority.
   */
  getHealthyProviders(): RegisteredProvider[] {
    return Array.from(this.providers.values())
      .filter(p => p.isHealthy)
      .sort((a, b) => a.priority - b.priority)
  }

  /**
   * Get the best available provider for content type.
   */
  getBestProvider(contentType: 'movie' | 'tv' | 'anime'): IStreamProvider | undefined {
    const supported = ProviderFactory.getProvidersForContent(contentType)
    const healthy = this.getHealthyProviders()

    for (const provider of healthy) {
      if (supported.includes(provider.type)) {
        return provider.instance
      }
    }

    return undefined
  }

  /**
   * Mark a provider as failed.
   */
  reportFailure(type: ProviderType): void {
    const provider = this.providers.get(type)
    if (!provider) return

    provider.failureCount++
    if (provider.failureCount >= 3) {
      provider.isHealthy = false
      console.warn(`[ProviderRegistry] ${type} marked unhealthy after ${provider.failureCount} failures`)
    }
  }

  /**
   * Mark a provider as healthy.
   */
  reportSuccess(type: ProviderType): void {
    const provider = this.providers.get(type)
    if (!provider) return

    provider.failureCount = 0
    provider.isHealthy = true
  }

  /**
   * Run health check on all providers.
   */
  async healthCheck(): Promise<ProviderHealth[]> {
    const checks: Promise<ProviderHealth>[] = []

    for (const [type, registered] of this.providers) {
      checks.push(
        (async (): Promise<ProviderHealth> => {
          try {
            const isHealthy = await registered.instance.healthCheck()
            registered.isHealthy = isHealthy
            return {
              provider: type,
              isHealthy,
              responseTime: 0,
              lastChecked: Date.now(),
            }
          } catch {
            registered.isHealthy = false
            return {
              provider: type,
              isHealthy: false,
              responseTime: -1,
              lastChecked: Date.now(),
            }
          }
        })()
      )
    }

    return Promise.all(checks)
  }

  /**
   * Get all registered provider types.
   */
  getRegisteredTypes(): ProviderType[] {
    return Array.from(this.providers.keys())
  }

  /**
   * Clear all registered providers.
   */
  clear(): void {
    this.providers.clear()
  }
}

export const providerRegistry = new ProviderRegistry()
export default ProviderRegistry