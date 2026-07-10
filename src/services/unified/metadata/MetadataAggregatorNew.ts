// src/services/unified/metadata/MetadataAggregatorNew.ts

/**
 * MetadataAggregator - Coordinates metadata from multiple providers using adapters.
 * Uses the adapter pattern to unify different metadata sources.
 */
import { IMetadataResult } from '../../unified/types/MetadataTypes';
import { TMDBMetadataAdapter } from './adapters/TMDBMetadataAdapter';
import { KuryanaMetadataAdapter } from './adapters/KuryanaMetadataAdapter';
import { MovieBoxMetadataAdapter } from './adapters/MovieBoxMetadataAdapter';

interface MetadataProvider {
  search(query: string, type?: 'movie' | 'tv', limit?: number): Promise<IMetadataResult[]>;
  getById(id: string, type: 'movie' | 'tv'): Promise<IMetadataResult | null>;
}

export class MetadataAggregator {
  private providers: MetadataProvider[] = [];
  private initialized = false;

  constructor() {
    // Register ALL metadata providers
    this.providers = [
      new TMDBMetadataAdapter(),
      new KuryanaMetadataAdapter(),
      new MovieBoxMetadataAdapter(), // ✅ MovieBox is now included!
    ];
  }

  /**
   * Initialize the aggregator and all providers.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    // Initialize each provider that has an initialize method
    for (const provider of this.providers) {
      if (typeof (provider as any).ensureInitialized === 'function') {
        try {
          await (provider as any).ensureInitialized();
        } catch (error) {
          console.error('[MetadataAggregator] Provider init failed:', error);
        }
      }
    }
    
    this.initialized = true;
    console.log('[MetadataAggregator] Initialized with', this.providers.length, 'providers');
  }

  /**
   * Search for content across all metadata providers.
   */
  async search(query: string, type?: 'movie' | 'tv', limit: number = 20): Promise<IMetadataResult[]> {
    await this.initialize();

    const allResults: IMetadataResult[] = [];

    for (const provider of this.providers) {
      try {
        const results = await provider.search(query, type, limit);
        allResults.push(...results);
      } catch (error) {
        console.error('[MetadataAggregator] Provider', provider.constructor.name, 'search failed:', error);
      }
    }

    // Deduplicate by ID and source
    const seen = new Set<string>();
    const deduplicated = allResults.filter(result => {
      const key = result.source + '-' + result.type + '-' + result.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort by relevance
    return deduplicated
      .sort((a, b) => {
        // Prefer exact title matches
        const aExact = a.title.toLowerCase().includes(query.toLowerCase()) ? 1 : 0;
        const bExact = b.title.toLowerCase().includes(query.toLowerCase()) ? 1 : 0;
        if (aExact !== bExact) return bExact - aExact;

        // Then by rating
        return (b.rating || 0) - (a.rating || 0);
      })
      .slice(0, limit);
  }

  /**
   * Get metadata by ID from any provider.
   */
  async getById(id: string, type: 'movie' | 'tv'): Promise<IMetadataResult | null> {
    await this.initialize();

    for (const provider of this.providers) {
      try {
        const result = await provider.getById(id, type);
        if (result) return result;
      } catch (error) {
        console.error('[MetadataAggregator] Provider', provider.constructor.name, 'getById failed:', error);
      }
    }

    return null;
  }

  /**
   * Get all registered providers.
   */
  getProviders(): MetadataProvider[] {
    return this.providers;
  }

  /**
   * Clear all resources.
   */
  destroy(): void {
    this.providers = [];
    this.initialized = false;
    console.log('[MetadataAggregator] Destroyed');
  }
}

export default MetadataAggregator;