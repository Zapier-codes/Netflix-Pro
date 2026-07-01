// src/services/preloaderService.ts
import { cacheService } from './cacheService';

export class PreloaderService {
  private static instance: PreloaderService;
  private isPreloading = false;
  private preloadComplete = false;

  static getInstance(): PreloaderService {
    if (!PreloaderService.instance) {
      PreloaderService.instance = new PreloaderService();
    }
    return PreloaderService.instance;
  }

  async preloadHomeScreen(): Promise<any> {
    if (this.isPreloading) return null;
    this.isPreloading = true;
    console.log('[Preloader] 🚀 Starting preload...');

    try {
      const cached = await cacheService.get('home_data');
      if (cached) {
        console.log('[Preloader] ✅ Using cached data');
        this.preloadComplete = true;
        this.isPreloading = false;
        return cached;
      }

      // Fetch fresh data here
      const homeData = {
        trending: [],
        popular: [],
        topRated: [],
        upcoming: [],
      };

      await cacheService.set('home_data', homeData);
      this.preloadComplete = true;
      this.isPreloading = false;
      return homeData;
    } catch (error) {
      console.error('[Preloader] ❌ Failed:', error);
      this.isPreloading = false;
      return null;
    }
  }

  isPreloadComplete(): boolean {
    return this.preloadComplete;
  }
}

export const preloaderService = PreloaderService.getInstance();
