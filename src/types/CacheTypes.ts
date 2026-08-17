// src/types/CacheTypes.ts
export interface CachedStreamData {
  url: string;
  provider: string;
  qualities: string[];
  extractedAt?: string;
}

export interface StreamCache {
  [key: string]: CachedStreamData;
}