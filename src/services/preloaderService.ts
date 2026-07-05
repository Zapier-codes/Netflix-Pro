// src/services/preloaderService.ts
import { cacheService } from './cacheService';
import { 
  fetchTrending, 
  fetchPopularMovies,
  fetchPopularTVShows,
  fetchTopRatedMovies, 
  fetchTopRatedTVShows,
  fetchUpcomingMovies,
} from './unified/metadata/TMDBMetadata';

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

  // Helper to check if cached data is valid (has actual content)
  private isValidHomeData(data: any): boolean {
    if (!data) return false;
    // Check if any of the arrays have items
    return !!(data.trending?.length > 0 || 
              data.popular?.length > 0 || 
              data.topRated?.length > 0 || 
              data.upcoming?.length > 0);
  }

  async preloadHomeScreen(): Promise<any> {
    if (this.isPreloading) {
      console.log('[Preloader] ⏳ Already preloading, skipping...');
      return null;
    }
    
    this.isPreloading = true;
    console.log('[Preloader] 🚀 Starting preload...');

    try {
      // Check cache first - but only use if it has actual data
      const cached = await cacheService.getHomeData();
      if (cached && this.isValidHomeData(cached)) {
        console.log('[Preloader] ✅ Using cached data with', cached.trending?.length || 0, 'trending items');
        this.preloadComplete = true;
        this.isPreloading = false;
        return cached;
      }

      if (cached) {
        console.log('[Preloader] ⚠️ Cache exists but is empty, fetching fresh data...');
      } else {
        console.log('[Preloader] 📡 No cache found, fetching fresh data from TMDB...');
      }

      // Fetch all data in parallel - use individual functions instead of fetchPopularCombined
      const [trending, popularMovies, popularTVShows, topRatedMovies, topRatedTVShows, upcoming] = await Promise.all([
        fetchTrending('day', 'all'),
        fetchPopularMovies(),
        fetchPopularTVShows(),
        fetchTopRatedMovies({ page: 1 }),
        fetchTopRatedTVShows({ page: 1 }),
        fetchUpcomingMovies({ page: 1 }),
      ]);

      // Combine popular movies and TV shows
      const popular = [
        ...popularMovies.map((item: any) => ({ ...item, media_type: 'movie' })),
        ...popularTVShows.map((item: any) => ({ ...item, media_type: 'tv' })),
      ];

      // Combine top-rated movies and TV shows
      const topRated = [
        ...topRatedMovies.map((item: any) => ({ ...item, media_type: 'movie' })),
        ...topRatedTVShows.map((item: any) => ({ ...item, media_type: 'tv' })),
      ].sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));

      // Build the home data object
      const homeData = {
        trending: trending || [],
        popular: popular || [],
        topRated: topRated || [],
        upcoming: upcoming.map((item: any) => ({ ...item, media_type: 'movie' })) || [],
      };

      console.log(`[Preloader] 📊 Fetched: Trending: ${homeData.trending.length}, Popular: ${homeData.popular.length}, Top Rated: ${homeData.topRated.length}, Upcoming: ${homeData.upcoming.length}`);

      // Save to cache
      await cacheService.setHomeData(homeData);
      console.log('[Preloader] 💾 Saved to cache');

      this.preloadComplete = true;
      this.isPreloading = false;
      return homeData;
    } catch (error) {
      console.error('[Preloader] ❌ Failed to fetch data:', error);
      
      // Try to return cached data even if expired or empty, as fallback
      try {
        const cached = await cacheService.getHomeData();
        if (cached) {
          console.log('[Preloader] ⚠️ Returning cached data as fallback (may be empty)');
          this.preloadComplete = true;
          this.isPreloading = false;
          return cached;
        }
      } catch (cacheError) {
        console.warn('[Preloader] ⚠️ Could not retrieve cache fallback:', cacheError);
      }
      
      this.isPreloading = false;
      throw error;
    }
  }

  isPreloadComplete(): boolean {
    return this.preloadComplete;
  }

  async clearCache(): Promise<void> {
    await cacheService.remove('home_data');
    this.preloadComplete = false;
    console.log('[Preloader] 🗑️ Cache cleared');
  }
}

export const preloaderService = PreloaderService.getInstance();
