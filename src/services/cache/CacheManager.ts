// src/services/cache/CacheManager.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LegacyFileSystem from 'expo-file-system/legacy';

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  version: number;
}

export class CacheManager {
  private static instance: CacheManager;
  private cacheVersion = 2;
  private memoryCache: Map<string, CacheEntry> = new Map();
  private readonly CACHE_DIR = `${LegacyFileSystem.documentDirectory}cache/`;

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  private async ensureCacheDir(): Promise<void> {
    try {
      const info = await LegacyFileSystem.getInfoAsync(this.CACHE_DIR);
      if (!info.exists) {
        await LegacyFileSystem.makeDirectoryAsync(this.CACHE_DIR, { intermediates: true });
      }
    } catch (error) {
      console.warn('[CacheManager] Failed to create cache dir:', error);
    }
  }

  async set<T>(key: string, data: T, ttl: number = 300000): Promise<void> {
    await this.ensureCacheDir();

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      version: this.cacheVersion,
    };

    // Store in memory
    this.memoryCache.set(key, entry);

    // Store in file system
    try {
      const filePath = `${this.CACHE_DIR}${key}.json`;
      await LegacyFileSystem.writeAsStringAsync(filePath, JSON.stringify(entry));
    } catch (error) {
      console.warn('[CacheManager] Set error:', error);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    // Check memory first
    if (this.memoryCache.has(key)) {
      const entry = this.memoryCache.get(key) as CacheEntry<T>;
      if (Date.now() - entry.timestamp <= entry.ttl && entry.version === this.cacheVersion) {
        return entry.data;
      }
      this.memoryCache.delete(key);
    }

    // Check file system
    try {
      const filePath = `${this.CACHE_DIR}${key}.json`;
      const info = await LegacyFileSystem.getInfoAsync(filePath);
      if (!info.exists) return null;

      const raw = await LegacyFileSystem.readAsStringAsync(filePath);
      const entry: CacheEntry<T> = JSON.parse(raw);

      if (entry.version !== this.cacheVersion) {
        await LegacyFileSystem.deleteAsync(filePath, { idempotent: true });
        return null;
      }

      if (Date.now() - entry.timestamp > entry.ttl) {
        await LegacyFileSystem.deleteAsync(filePath, { idempotent: true });
        return null;
      }

      // Store in memory
      this.memoryCache.set(key, entry);
      return entry.data;
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    this.memoryCache.delete(key);
    try {
      const filePath = `${this.CACHE_DIR}${key}.json`;
      await LegacyFileSystem.deleteAsync(filePath, { idempotent: true });
    } catch {
      // Ignore
    }
  }

  async clear(): Promise<void> {
    this.memoryCache.clear();
    try {
      await LegacyFileSystem.deleteAsync(this.CACHE_DIR, { idempotent: true });
    } catch {
      // Ignore
    }
  }

  has(key: string): boolean {
    return this.memoryCache.has(key);
  }

  async preload(): Promise<Record<string, any>> {
    const result: Record<string, any> = {};
    try {
      await this.ensureCacheDir();
      const files = await LegacyFileSystem.readDirectoryAsync(this.CACHE_DIR);

      for (const file of files) {
        if (file.endsWith('.json')) {
          const key = file.replace('.json', '');
          const value = await this.get(key);
          if (value !== null) {
            result[key] = value;
          }
        }
      }
    } catch (error) {
      console.warn('[CacheManager] Preload error:', error);
    }
    return result;
  }

  async getSize(): Promise<number> {
    try {
      const files = await LegacyFileSystem.readDirectoryAsync(this.CACHE_DIR);
      return files.filter(f => f.endsWith('.json')).length;
    } catch {
      return 0;
    }
  }

  async clearExpired(): Promise<void> {
    try {
      const files = await LegacyFileSystem.readDirectoryAsync(this.CACHE_DIR);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const key = file.replace('.json', '');
          const raw = await LegacyFileSystem.readAsStringAsync(`${this.CACHE_DIR}${file}`);
          try {
            const entry: CacheEntry = JSON.parse(raw);
            if (Date.now() - entry.timestamp > entry.ttl) {
              await LegacyFileSystem.deleteAsync(`${this.CACHE_DIR}${file}`, { idempotent: true });
              this.memoryCache.delete(key);
            }
          } catch {
            await LegacyFileSystem.deleteAsync(`${this.CACHE_DIR}${file}`, { idempotent: true });
          }
        }
      }
    } catch (error) {
      console.warn('[CacheManager] Clear expired error:', error);
    }
  }
}

export const cacheManager = CacheManager.getInstance();