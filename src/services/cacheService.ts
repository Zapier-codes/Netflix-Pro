// src/services/cacheService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export class CacheService {
  private static instance: CacheService;

  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  async set<T>(key: string, data: T, ttl: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    try {
      const entry = { data, timestamp: Date.now(), ttl };
      await AsyncStorage.setItem(pp_cache_, JSON.stringify(entry));
    } catch (error) {
      console.warn('[Cache] Failed to set:', key, error);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(pp_cache_);
      if (!raw) return null;
      const entry = JSON.parse(raw);
      if (Date.now() - entry.timestamp > entry.ttl) {
        await AsyncStorage.removeItem(pp_cache_);
        return null;
      }
      return entry.data;
    } catch (error) {
      console.warn('[Cache] Failed to get:', key, error);
      return null;
    }
  }

  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(pp_cache_);
    } catch (error) {
      console.warn('[Cache] Failed to remove:', key, error);
    }
  }

  async clearAll(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith('app_cache_'));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      console.warn('[Cache] Failed to clear all:', error);
    }
  }
}

export const cacheService = CacheService.getInstance();
