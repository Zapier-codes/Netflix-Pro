// src/api/consumet/consumetApi.ts

import {
  ANIME,
  MOVIES,
  MANGA,
  LIGHT_NOVELS,
  META,
  ProviderManager,
  ExtractorManager,
  createProviderContext,
  createExtractorContext,
  ExtensionRegistry,
} from 'react-native-consumet';

// ─── INTERFACES ───

export interface ConsumetMovie {
  id: string;
  title: string;
  overview: string;
  poster: string;
  backdrop: string;
  rating: number;
  genres: string[];
  releaseDate: string;
  runtime: number;
  status: string;
}

export interface ConsumetTVShow {
  id: string;
  title: string;
  overview: string;
  poster: string;
  backdrop: string;
  rating: number;
  genres: string[];
  releaseDate: string;
  seasons: number;
  episodes: number;
  status: string;
}

export interface ConsumetAnime {
  id: string;
  title: string;
  synopsis: string;
  image: string;
  cover: string;
  rating: number;
  genres: string[];
  totalEpisodes: number;
  status: string;
}

export interface ConsumetManga {
  id: string;
  title: string;
  image: string;
  chapters: number;
  status: string;
}

export interface ConsumetLightNovel {
  id: string;
  title: string;
  image: string;
  chapters: number;
  status: string;
}

export interface ConsumetStream {
  url: string;
  quality: string;
  format: string;
  headers?: Record<string, string>;
  isM3U8?: boolean;
}

export interface ProviderStatus {
  name: string;
  initialized: boolean;
  type: 'movie' | 'tv' | 'anime' | 'manga' | 'lightnovel' | 'meta';
}

// ─── SERVICE CLASS ───

export class ConsumetApiService {
  private static instance: ConsumetApiService;

  // ─── MOVIE / TV PROVIDERS ───
  private multiMoviesProvider: any;
  private netflixMirrorProvider: any;
  private hiMoviesProvider: any;
  private yFlixProvider: any;
  private multiStreamProvider: any;

  // ─── ANIME PROVIDERS ───
  private animePaheProvider: any;
  private zoroProvider: any;
  private animeDriveProvider: any;
  private anifyProvider: any;
  private marinProvider: any;
  private animeUnityProvider: any;
  private animeKaiProvider: any;
  private aniKotoProvider: any;

  // ─── MANGA PROVIDERS ───
  private mangaDexProvider: any;
  private comicKProvider: any;
  private mangaHereProvider: any;
  private mangaKakalotProvider: any;
  private mangasee123Provider: any;
  private mangaparkProvider: any;
  private mangaPillProvider: any;
  private mangaReaderProvider: any;
  private asuraScansProvider: any;
  private flameScansProvider: any;
  private mangaHostProvider: any;
  private brMangasProvider: any;
  private readMangaProvider: any;
  private vyvyMangaProvider: any;

  // ─── LIGHT NOVEL PROVIDERS ───
  private readLightNovelsProvider: any;
  private novelUpdatesProvider: any;

  // ─── META PROVIDERS ───
  private anilistProvider: any;
  private myanimelistProvider: any;
  private tmdbProvider: any;

  // ─── MANAGERS (Extension System) ───
  private providerManager: any;
  private extractorManager: any;

  private constructor() {
    this.initializeAllProviders();
  }

  private initializeAllProviders(): void {
    try {
      // ─── MOVIE / TV PROVIDERS ───
      this.multiMoviesProvider = new MOVIES.MultiMovies();
      this.netflixMirrorProvider = new MOVIES.NetflixMirror();
      this.hiMoviesProvider = new MOVIES.HiMovies();
      this.yFlixProvider = new MOVIES.YFlix();
      this.multiStreamProvider = new MOVIES.MultiStream();

      // ─── ANIME PROVIDERS ───
      this.animePaheProvider = new ANIME.AnimePahe();
      this.zoroProvider = new ANIME.Zoro();
      this.animeDriveProvider = new ANIME.AnimeDrive();
      this.anifyProvider = new ANIME.Anify();
      this.marinProvider = new ANIME.Marin();
      this.animeUnityProvider = new ANIME.AnimeUnity();
      this.animeKaiProvider = new ANIME.AnimeKai();
      this.aniKotoProvider = new ANIME.AniKoto();

      // ─── MANGA PROVIDERS ───
      this.mangaDexProvider = new MANGA.MangaDex();
      this.comicKProvider = new MANGA.ComicK();
      this.mangaHereProvider = new MANGA.MangaHere();
      this.mangaKakalotProvider = new MANGA.MangaKakalot();
      this.mangasee123Provider = new MANGA.Mangasee123();
      this.mangaparkProvider = new MANGA.Mangapark();
      this.mangaPillProvider = new MANGA.MangaPill();
      this.mangaReaderProvider = new MANGA.MangaReader();
      this.asuraScansProvider = new MANGA.AsuraScans();
      this.flameScansProvider = new MANGA.FlameScans();
      this.mangaHostProvider = new MANGA.MangaHost();
      this.brMangasProvider = new MANGA.BRMangas();
      this.readMangaProvider = new MANGA.ReadManga();
      this.vyvyMangaProvider = new MANGA.VyvyManga();

      // ─── LIGHT NOVEL PROVIDERS ───
      this.readLightNovelsProvider = new LIGHT_NOVELS.ReadLightNovels();
      this.novelUpdatesProvider = new LIGHT_NOVELS.NovelUpdates();

      // ─── META PROVIDERS ───
      this.anilistProvider = new META.Anilist();
      this.myanimelistProvider = new META.Myanimelist();
      this.tmdbProvider = new META.TMDB();

      // ─── INITIALIZE MANAGERS WITH REGISTRY ───
      // ProviderManager and ExtractorManager REQUIRE the ExtensionRegistry as first argument
      this.providerManager = new ProviderManager(ExtensionRegistry);
      this.extractorManager = new ExtractorManager(ExtensionRegistry);

      console.log('[ConsumetApiService] All providers initialized successfully');
      console.log(`[ConsumetApiService] Movies/TV: ${this.getMovieProviderNames().length}`);
      console.log(`[ConsumetApiService] Anime: ${this.getAnimeProviderNames().length}`);
      console.log(`[ConsumetApiService] Manga: ${this.getMangaProviderNames().length}`);
      console.log(`[ConsumetApiService] Light Novels: ${this.getLightNovelProviderNames().length}`);
      console.log(`[ConsumetApiService] Meta: ${this.getMetaProviderNames().length}`);
    } catch (error: any) {
      console.error('[ConsumetApiService] Failed to initialize providers:', error);
    }
  }

  static getInstance(): ConsumetApiService {
    if (!ConsumetApiService.instance) {
      ConsumetApiService.instance = new ConsumetApiService();
    }
    return ConsumetApiService.instance;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EXTENSION SYSTEM METHODS (Recommended)
  // ─────────────────────────────────────────────────────────────────────────

  getProviderManager(): any {
    return this.providerManager;
  }

  getExtractorManager(): any {
    return this.extractorManager;
  }

  /**
   * Search across all providers of a category using the Extension System
   */
  async searchWithManager(category: 'anime' | 'movies' | 'manga' | 'lightnovels' | 'meta', query: string, page?: number): Promise<any[]> {
    try {
      const results = await this.providerManager.searchAcrossProviders(category, query, page);
      return results || [];
    } catch (error: any) {
      console.error(`[ConsumetApiService] Manager search failed:`, error.message || error);
      return [];
    }
  }

  /**
   * Get a specific provider via the Extension System
   */
  async getProviderViaManager(category: 'anime' | 'movies' | 'manga' | 'lightnovels' | 'meta', providerId: string): Promise<any> {
    try {
      switch (category) {
        case 'anime':
          return await this.providerManager.getAnimeProvider(providerId);
        case 'movies':
          return await this.providerManager.getMovieProvider(providerId);
        case 'manga':
          return await this.providerManager.getMangaProvider(providerId);
        case 'lightnovels':
          return await this.providerManager.getLightNovelProvider(providerId);
        case 'meta':
          return await this.providerManager.getMetaProvider(providerId);
        default:
          return null;
      }
    } catch (error: any) {
      console.error(`[ConsumetApiService] Failed to get provider ${providerId}:`, error.message || error);
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET ALL PROVIDER NAMES
  // ─────────────────────────────────────────────────────────────────────────

  getMovieProviderNames(): string[] {
    // Ordered by observed reliability: MultiStream and NetflixMirror
    // currently succeed; MultiMovies/HiMovies/YFlix currently fail on
    // most queries (403 / 520 / network errors from the upstream sites).
    // Trying the reliable ones first means most searches resolve without
    // ever touching a broken mirror.
    return ['MultiStream', 'NetflixMirror', 'MultiMovies', 'HiMovies', 'YFlix'];
  }

  getAnimeProviderNames(): string[] {
    return ['AnimePahe', 'Zoro', 'AnimeDrive', 'Anify', 'Marin', 'AnimeUnity', 'AnimeKai', 'AniKoto'];
  }

  getMangaProviderNames(): string[] {
    return ['MangaDex', 'ComicK', 'MangaHere', 'MangaKakalot', 'Mangasee123', 'Mangapark', 'MangaPill', 'MangaReader', 'AsuraScans', 'FlameScans', 'MangaHost', 'BRMangas', 'ReadManga', 'VyvyManga'];
  }

  getLightNovelProviderNames(): string[] {
    return ['ReadLightNovels', 'NovelUpdates'];
  }

  getMetaProviderNames(): string[] {
    return ['Anilist', 'Myanimelist', 'TMDB'];
  }

  getAllProviderNames(): string[] {
    return [
      ...this.getMovieProviderNames(),
      ...this.getAnimeProviderNames(),
      ...this.getMangaProviderNames(),
      ...this.getLightNovelProviderNames(),
      ...this.getMetaProviderNames(),
    ];
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SEARCH WITH FALLBACK
  // ─────────────────────────────────────────────────────────────────────────

  private async searchWithFallback<T>(
    providers: any[],
    providerNames: string[],
    searchFn: (provider: any) => Promise<any>,
    mapFn: (item: any) => T
  ): Promise<T[]> {
    const results: T[] = [];
    let anySucceeded = false;

    for (let i = 0; i < providers.length; i++) {
      try {
        const provider = providers[i];
        if (!provider) continue;
        const result = await searchFn(provider);
        const mapped = (result.results || []).map(mapFn);
        if (mapped.length > 0) {
          console.log(`[ConsumetApiService] ${providerNames[i]} returned ${mapped.length} results`);
          results.push(...mapped);
          anySucceeded = true;
          if (results.length >= 20) break;
        }
      } catch (error: any) {
        // A single mirror failing is expected — that's what the fallback
        // chain is for. Only escalate to a warning if nothing recovers.
        console.log(`[ConsumetApiService] ${providerNames[i]} unavailable:`, error.message || error);
      }
    }

    if (!anySucceeded) {
      console.warn('[ConsumetApiService] All movie/TV mirrors failed for this query');
    }

    return results.slice(0, 20);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MOVIES / TV - ALL PROVIDERS
  // ─────────────────────────────────────────────────────────────────────────

  async searchMoviesAllProviders(query: string, page: number = 1): Promise<ConsumetMovie[]> {
    const providers = [
      this.multiStreamProvider,
      this.netflixMirrorProvider,
      this.multiMoviesProvider,
      this.hiMoviesProvider,
      this.yFlixProvider,
    ];
    const names = this.getMovieProviderNames();

    return this.searchWithFallback(
      providers,
      names,
      (provider) => provider.search(query, page),
      (item: any) => ({
        id: item.id,
        title: item.title,
        overview: item.overview || item.description || '',
        poster: item.image || item.cover || item.poster || '',
        backdrop: item.backdrop || '',
        rating: item.rating || item.imdbRating || 0,
        genres: item.genres || [],
        releaseDate: item.releaseDate || item.released || '',
        runtime: item.duration || item.runtime || 0,
        status: item.status || '',
      })
    );
  }

  async searchMovies(query: string, page: number = 1): Promise<ConsumetMovie[]> {
    try {
      // MultiStream is the current reliable mirror (HiMovies has been
      // returning 520s); try it directly before falling back to the
      // full multi-provider sweep.
      if (!this.multiStreamProvider) {
        console.error('[ConsumetApiService] MultiStream provider not initialized');
        return this.searchMoviesAllProviders(query, page);
      }

      const result = await this.multiStreamProvider.search(query, page);
      return (result.results || []).map((item: any) => ({
        id: item.id,
        title: item.title,
        overview: item.overview || item.description || '',
        poster: item.image || item.cover || item.poster || '',
        backdrop: item.backdrop || '',
        rating: item.rating || item.imdbRating || 0,
        genres: item.genres || [],
        releaseDate: item.releaseDate || item.released || '',
        runtime: item.duration || item.runtime || 0,
        status: item.status || '',
      }));
    } catch (error: any) {
      console.error('[ConsumetApiService] Search movies error:', error);
      return this.searchMoviesAllProviders(query, page);
    }
  }

  async getMovieInfo(id: string): Promise<ConsumetMovie | null> {
    const providers = [
      { name: 'MultiStream', provider: this.multiStreamProvider },
      { name: 'NetflixMirror', provider: this.netflixMirrorProvider },
      { name: 'MultiMovies', provider: this.multiMoviesProvider },
      { name: 'HiMovies', provider: this.hiMoviesProvider },
      { name: 'YFlix', provider: this.yFlixProvider },
    ];

    for (const { name, provider } of providers) {
      try {
        if (!provider) continue;
        const info = await provider.fetchMediaInfo(id);
        if (info) {
          console.log(`[ConsumetApiService] Movie info found via ${name}`);
          return {
            id: info.id || id,
            title: info.title || '',
            overview: info.description || info.overview || '',
            poster: info.image || info.cover || info.poster || '',
            backdrop: info.backdrop || info.cover || '',
            rating: info.rating || 0,
            genres: info.genres || [],
            releaseDate: info.releaseDate || info.released || '',
            runtime: info.duration || info.runtime || 0,
            status: info.status || '',
          };
        }
      } catch (error: any) {
        console.log(`[ConsumetApiService] ${name} movie info unavailable:`, error.message || error);
      }
    }
    return null;
  }

  async getMovieSources(id: string): Promise<ConsumetStream[]> {
    const providers = [
      { name: 'MultiStream', provider: this.multiStreamProvider },
      { name: 'NetflixMirror', provider: this.netflixMirrorProvider },
      { name: 'MultiMovies', provider: this.multiMoviesProvider },
      { name: 'HiMovies', provider: this.hiMoviesProvider },
      { name: 'YFlix', provider: this.yFlixProvider },
    ];

    for (const { name, provider } of providers) {
      try {
        if (!provider) continue;
        const sources = await provider.fetchEpisodeSources(id);
        if (sources && sources.length > 0) {
          console.log(`[ConsumetApiService] Movie sources found via ${name}`);
          return sources.map((source: any) => ({
            url: source.url || '',
            quality: source.quality || 'auto',
            format: source.format || 'mp4',
            headers: source.headers || {},
            isM3U8: source.url?.includes('.m3u8') || false,
          }));
        }
      } catch (error: any) {
        console.log(`[ConsumetApiService] ${name} movie sources unavailable:`, error.message || error);
      }
    }
    return [];
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TV SHOWS - ALL PROVIDERS (Movies providers also handle TV)
  // ─────────────────────────────────────────────────────────────────────────

  async searchTVAllProviders(query: string, page: number = 1): Promise<ConsumetTVShow[]> {
    const providers = [
      this.multiStreamProvider,
      this.netflixMirrorProvider,
      this.multiMoviesProvider,
      this.hiMoviesProvider,
      this.yFlixProvider,
    ];
    const names = this.getMovieProviderNames();

    return this.searchWithFallback(
      providers,
      names,
      (provider) => provider.search(query, page),
      (item: any) => ({
        id: item.id,
        title: item.title,
        overview: item.overview || item.description || '',
        poster: item.image || item.cover || item.poster || '',
        backdrop: item.backdrop || '',
        rating: item.rating || item.imdbRating || 0,
        genres: item.genres || [],
        releaseDate: item.releaseDate || item.released || '',
        seasons: item.seasons || 0,
        episodes: item.episodes || item.totalEpisodes || 0,
        status: item.status || '',
      })
    );
  }

  async searchTVShows(query: string, page: number = 1): Promise<ConsumetTVShow[]> {
    try {
      // MultiStream is the current reliable mirror (HiMovies has been
      // returning 520s); try it directly before falling back to the
      // full multi-provider sweep.
      if (!this.multiStreamProvider) {
        console.error('[ConsumetApiService] MultiStream provider not initialized');
        return this.searchTVAllProviders(query, page);
      }

      const result = await this.multiStreamProvider.search(query, page);
      return (result.results || []).map((item: any) => ({
        id: item.id,
        title: item.title,
        overview: item.overview || item.description || '',
        poster: item.image || item.cover || item.poster || '',
        backdrop: item.backdrop || '',
        rating: item.rating || item.imdbRating || 0,
        genres: item.genres || [],
        releaseDate: item.releaseDate || item.released || '',
        seasons: item.seasons || 0,
        episodes: item.episodes || item.totalEpisodes || 0,
        status: item.status || '',
      }));
    } catch (error: any) {
      console.error('[ConsumetApiService] Search TV error:', error);
      return this.searchTVAllProviders(query, page);
    }
  }

  async getTVInfo(id: string): Promise<ConsumetTVShow | null> {
    const providers = [
      { name: 'MultiStream', provider: this.multiStreamProvider },
      { name: 'NetflixMirror', provider: this.netflixMirrorProvider },
      { name: 'MultiMovies', provider: this.multiMoviesProvider },
      { name: 'HiMovies', provider: this.hiMoviesProvider },
      { name: 'YFlix', provider: this.yFlixProvider },
    ];

    for (const { name, provider } of providers) {
      try {
        if (!provider) continue;
        const info = await provider.fetchMediaInfo(id);
        if (info) {
          console.log(`[ConsumetApiService] TV info found via ${name}`);
          return {
            id: info.id || id,
            title: info.title || '',
            overview: info.description || info.overview || '',
            poster: info.image || info.cover || info.poster || '',
            backdrop: info.backdrop || info.cover || '',
            rating: info.rating || 0,
            genres: info.genres || [],
            releaseDate: info.releaseDate || info.released || '',
            seasons: info.seasons || 0,
            episodes: info.episodes || info.totalEpisodes || 0,
            status: info.status || '',
          };
        }
      } catch (error: any) {
        console.log(`[ConsumetApiService] ${name} TV info unavailable:`, error.message || error);
      }
    }
    return null;
  }

  async getTVSources(id: string, season: number, episode: number): Promise<ConsumetStream[]> {
    const providers = [
      { name: 'MultiStream', provider: this.multiStreamProvider },
      { name: 'NetflixMirror', provider: this.netflixMirrorProvider },
      { name: 'MultiMovies', provider: this.multiMoviesProvider },
      { name: 'HiMovies', provider: this.hiMoviesProvider },
      { name: 'YFlix', provider: this.yFlixProvider },
    ];

    for (const { name, provider } of providers) {
      try {
        if (!provider) continue;
        const sources = await provider.fetchEpisodeSources(id, season, episode);
        if (sources && sources.length > 0) {
          console.log(`[ConsumetApiService] TV sources found via ${name}`);
          return sources.map((source: any) => ({
            url: source.url || '',
            quality: source.quality || 'auto',
            format: source.format || 'mp4',
            headers: source.headers || {},
            isM3U8: source.url?.includes('.m3u8') || false,
          }));
        }
      } catch (error: any) {
        console.log(`[ConsumetApiService] ${name} TV sources unavailable:`, error.message || error);
      }
    }
    return [];
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ANIME - ALL PROVIDERS
  // ─────────────────────────────────────────────────────────────────────────

  async searchAnimeAllProviders(query: string, page: number = 1): Promise<ConsumetAnime[]> {
    const providers = [
      this.animePaheProvider,
      this.zoroProvider,
      this.animeDriveProvider,
      this.anifyProvider,
      this.marinProvider,
      this.animeUnityProvider,
      this.animeKaiProvider,
      this.aniKotoProvider,
    ];
    const names = this.getAnimeProviderNames();

    return this.searchWithFallback(
      providers,
      names,
      (provider) => provider.search(query, page),
      (item: any) => ({
        id: item.id,
        title: item.title,
        synopsis: item.overview || item.description || item.synopsis || '',
        image: item.image || item.cover || '',
        cover: item.cover || item.backdrop || '',
        rating: item.rating || 0,
        genres: item.genres || [],
        totalEpisodes: item.episodes || item.totalEpisodes || 0,
        status: item.status || '',
      })
    );
  }

  async searchAnime(query: string, page: number = 1): Promise<ConsumetAnime[]> {
    try {
      if (!this.zoroProvider) {
        console.error('[ConsumetApiService] Zoro provider not initialized');
        return this.searchAnimeAllProviders(query, page);
      }

      const result = await this.zoroProvider.search(query, page);
      return (result.results || []).map((item: any) => ({
        id: item.id,
        title: item.title,
        synopsis: item.overview || item.description || item.synopsis || '',
        image: item.image || item.cover || '',
        cover: item.cover || item.backdrop || '',
        rating: item.rating || 0,
        genres: item.genres || [],
        totalEpisodes: item.episodes || item.totalEpisodes || 0,
        status: item.status || '',
      }));
    } catch (error: any) {
      console.error('[ConsumetApiService] Search anime error:', error);
      return this.searchAnimeAllProviders(query, page);
    }
  }

  async getAnimeInfo(id: string): Promise<ConsumetAnime | null> {
    const providers = [
      { name: 'AnimePahe', provider: this.animePaheProvider },
      { name: 'Zoro', provider: this.zoroProvider },
      { name: 'AnimeDrive', provider: this.animeDriveProvider },
      { name: 'Anify', provider: this.anifyProvider },
      { name: 'Marin', provider: this.marinProvider },
      { name: 'AnimeUnity', provider: this.animeUnityProvider },
      { name: 'AnimeKai', provider: this.animeKaiProvider },
      { name: 'AniKoto', provider: this.aniKotoProvider },
    ];

    for (const { name, provider } of providers) {
      try {
        if (!provider) continue;
        const info = await provider.fetchAnimeInfo(id);
        if (info) {
          console.log(`[ConsumetApiService] Anime info found via ${name}`);
          return {
            id: info.id || id,
            title: info.title || '',
            synopsis: info.description || info.synopsis || '',
            image: info.image || info.cover || '',
            cover: info.cover || info.backdrop || '',
            rating: info.rating || 0,
            genres: info.genres || [],
            totalEpisodes: info.episodes || info.totalEpisodes || 0,
            status: info.status || '',
          };
        }
      } catch (error: any) {
        console.warn(`[ConsumetApiService] ${name} anime info failed:`, error.message || error);
      }
    }
    return null;
  }

  async getAnimeSources(id: string, episodeId?: string): Promise<ConsumetStream[]> {
    const providers = [
      { name: 'AnimePahe', provider: this.animePaheProvider },
      { name: 'Zoro', provider: this.zoroProvider },
      { name: 'AnimeDrive', provider: this.animeDriveProvider },
      { name: 'Anify', provider: this.anifyProvider },
      { name: 'Marin', provider: this.marinProvider },
      { name: 'AnimeUnity', provider: this.animeUnityProvider },
      { name: 'AnimeKai', provider: this.animeKaiProvider },
      { name: 'AniKoto', provider: this.aniKotoProvider },
    ];

    for (const { name, provider } of providers) {
      try {
        if (!provider) continue;
        const sources = episodeId
          ? await provider.fetchEpisodeSources(episodeId)
          : await provider.fetchEpisodeSources(id);
        if (sources && sources.length > 0) {
          console.log(`[ConsumetApiService] Anime sources found via ${name}`);
          return sources.map((source: any) => ({
            url: source.url || '',
            quality: source.quality || 'auto',
            format: source.format || 'mp4',
            headers: source.headers || {},
            isM3U8: source.url?.includes('.m3u8') || false,
          }));
        }
      } catch (error: any) {
        console.warn(`[ConsumetApiService] ${name} anime sources failed:`, error.message || error);
      }
    }
    return [];
  }

  async getAnimeEpisodeServers(id: string, episodeId: string): Promise<any[]> {
    try {
      if (!this.zoroProvider) return [];
      const servers = await this.zoroProvider.fetchEpisodeServers(episodeId);
      return servers || [];
    } catch (error: any) {
      console.warn('[ConsumetApiService] Fetch episode servers failed:', error.message || error);
      return [];
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MANGA - ALL PROVIDERS
  // ─────────────────────────────────────────────────────────────────────────

  async searchMangaAllProviders(query: string, page: number = 1): Promise<ConsumetManga[]> {
    const providers = [
      this.mangaDexProvider,
      this.comicKProvider,
      this.mangaHereProvider,
      this.mangaKakalotProvider,
      this.mangasee123Provider,
      this.mangaparkProvider,
      this.mangaPillProvider,
      this.mangaReaderProvider,
      this.asuraScansProvider,
      this.flameScansProvider,
      this.mangaHostProvider,
      this.brMangasProvider,
      this.readMangaProvider,
      this.vyvyMangaProvider,
    ];
    const names = this.getMangaProviderNames();

    return this.searchWithFallback(
      providers,
      names,
      (provider) => provider.search(query, page),
      (item: any) => ({
        id: item.id,
        title: item.title,
        image: item.image || item.cover || '',
        chapters: item.chapters || item.totalChapters || 0,
        status: item.status || '',
      })
    );
  }

  async searchManga(query: string, page: number = 1): Promise<ConsumetManga[]> {
    try {
      if (!this.mangaDexProvider) {
        console.error('[ConsumetApiService] MangaDex provider not initialized');
        return this.searchMangaAllProviders(query, page);
      }

      const result = await this.mangaDexProvider.search(query, page);
      return (result.results || []).map((item: any) => ({
        id: item.id,
        title: item.title,
        image: item.image || item.cover || '',
        chapters: item.chapters || item.totalChapters || 0,
        status: item.status || '',
      }));
    } catch (error: any) {
      console.error('[ConsumetApiService] Search manga error:', error);
      return this.searchMangaAllProviders(query, page);
    }
  }

  async getMangaInfo(id: string): Promise<ConsumetManga | null> {
    const providers = [
      { name: 'MangaDex', provider: this.mangaDexProvider },
      { name: 'ComicK', provider: this.comicKProvider },
      { name: 'MangaHere', provider: this.mangaHereProvider },
      { name: 'MangaKakalot', provider: this.mangaKakalotProvider },
      { name: 'Mangasee123', provider: this.mangasee123Provider },
      { name: 'Mangapark', provider: this.mangaparkProvider },
      { name: 'MangaPill', provider: this.mangaPillProvider },
      { name: 'MangaReader', provider: this.mangaReaderProvider },
      { name: 'AsuraScans', provider: this.asuraScansProvider },
      { name: 'FlameScans', provider: this.flameScansProvider },
      { name: 'MangaHost', provider: this.mangaHostProvider },
      { name: 'BRMangas', provider: this.brMangasProvider },
      { name: 'ReadManga', provider: this.readMangaProvider },
      { name: 'VyvyManga', provider: this.vyvyMangaProvider },
    ];

    for (const { name, provider } of providers) {
      try {
        if (!provider) continue;
        const info = await provider.fetchMangaInfo(id);
        if (info) {
          console.log(`[ConsumetApiService] Manga info found via ${name}`);
          return {
            id: info.id || id,
            title: info.title || '',
            image: info.image || info.cover || '',
            chapters: info.chapters?.length || info.totalChapters || 0,
            status: info.status || '',
          };
        }
      } catch (error: any) {
        console.warn(`[ConsumetApiService] ${name} manga info failed:`, error.message || error);
      }
    }
    return null;
  }

  async getMangaChapters(id: string): Promise<any[]> {
    const providers = [
      { name: 'MangaDex', provider: this.mangaDexProvider },
      { name: 'ComicK', provider: this.comicKProvider },
      { name: 'MangaHere', provider: this.mangaHereProvider },
      { name: 'MangaKakalot', provider: this.mangaKakalotProvider },
      { name: 'Mangasee123', provider: this.mangasee123Provider },
      { name: 'Mangapark', provider: this.mangaparkProvider },
      { name: 'MangaPill', provider: this.mangaPillProvider },
      { name: 'MangaReader', provider: this.mangaReaderProvider },
      { name: 'AsuraScans', provider: this.asuraScansProvider },
      { name: 'FlameScans', provider: this.flameScansProvider },
      { name: 'MangaHost', provider: this.mangaHostProvider },
      { name: 'BRMangas', provider: this.brMangasProvider },
      { name: 'ReadManga', provider: this.readMangaProvider },
      { name: 'VyvyManga', provider: this.vyvyMangaProvider },
    ];

    for (const { name, provider } of providers) {
      try {
        if (!provider) continue;
        const info = await provider.fetchMangaInfo(id);
        if (info && info.chapters) {
          console.log(`[ConsumetApiService] Manga chapters found via ${name}`);
          return info.chapters;
        }
      } catch (error: any) {
        console.warn(`[ConsumetApiService] ${name} manga chapters failed:`, error.message || error);
      }
    }
    return [];
  }

  async getMangaChapterPages(chapterId: string): Promise<any[]> {
    const providers = [
      { name: 'MangaDex', provider: this.mangaDexProvider },
      { name: 'ComicK', provider: this.comicKProvider },
      { name: 'MangaHere', provider: this.mangaHereProvider },
      { name: 'MangaKakalot', provider: this.mangaKakalotProvider },
      { name: 'Mangasee123', provider: this.mangasee123Provider },
      { name: 'Mangapark', provider: this.mangaparkProvider },
      { name: 'MangaPill', provider: this.mangaPillProvider },
      { name: 'MangaReader', provider: this.mangaReaderProvider },
      { name: 'AsuraScans', provider: this.asuraScansProvider },
      { name: 'FlameScans', provider: this.flameScansProvider },
      { name: 'MangaHost', provider: this.mangaHostProvider },
      { name: 'BRMangas', provider: this.brMangasProvider },
      { name: 'ReadManga', provider: this.readMangaProvider },
      { name: 'VyvyManga', provider: this.vyvyMangaProvider },
    ];

    for (const { name, provider } of providers) {
      try {
        if (!provider) continue;
        const pages = await provider.fetchChapterPages(chapterId);
        if (pages && pages.length > 0) {
          console.log(`[ConsumetApiService] Manga pages found via ${name}`);
          return pages;
        }
      } catch (error: any) {
        console.warn(`[ConsumetApiService] ${name} manga pages failed:`, error.message || error);
      }
    }
    return [];
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LIGHT NOVELS - ALL PROVIDERS
  // ─────────────────────────────────────────────────────────────────────────

  async searchLightNovelsAllProviders(query: string, page: number = 1): Promise<ConsumetLightNovel[]> {
    const providers = [
      this.readLightNovelsProvider,
      this.novelUpdatesProvider,
    ];
    const names = this.getLightNovelProviderNames();

    return this.searchWithFallback(
      providers,
      names,
      (provider) => provider.search(query, page),
      (item: any) => ({
        id: item.id,
        title: item.title,
        image: item.image || item.cover || '',
        chapters: item.chapters || item.totalChapters || 0,
        status: item.status || '',
      })
    );
  }

  async searchLightNovels(query: string, page: number = 1): Promise<ConsumetLightNovel[]> {
    try {
      if (!this.novelUpdatesProvider) {
        console.error('[ConsumetApiService] NovelUpdates provider not initialized');
        return this.searchLightNovelsAllProviders(query, page);
      }

      const result = await this.novelUpdatesProvider.search(query, page);
      return (result.results || []).map((item: any) => ({
        id: item.id,
        title: item.title,
        image: item.image || item.cover || '',
        chapters: item.chapters || item.totalChapters || 0,
        status: item.status || '',
      }));
    } catch (error: any) {
      console.error('[ConsumetApiService] Search light novels error:', error);
      return this.searchLightNovelsAllProviders(query, page);
    }
  }

  async getLightNovelInfo(id: string): Promise<ConsumetLightNovel | null> {
    const providers = [
      { name: 'ReadLightNovels', provider: this.readLightNovelsProvider },
      { name: 'NovelUpdates', provider: this.novelUpdatesProvider },
    ];

    for (const { name, provider } of providers) {
      try {
        if (!provider) continue;
        const info = await provider.fetchLightNovelInfo(id);
        if (info) {
          console.log(`[ConsumetApiService] Light novel info found via ${name}`);
          return {
            id: info.id || id,
            title: info.title || '',
            image: info.image || info.cover || '',
            chapters: info.chapters?.length || info.totalChapters || 0,
            status: info.status || '',
          };
        }
      } catch (error: any) {
        console.warn(`[ConsumetApiService] ${name} light novel info failed:`, error.message || error);
      }
    }
    return null;
  }

  async getLightNovelChapters(id: string): Promise<any[]> {
    const providers = [
      { name: 'ReadLightNovels', provider: this.readLightNovelsProvider },
      { name: 'NovelUpdates', provider: this.novelUpdatesProvider },
    ];

    for (const { name, provider } of providers) {
      try {
        if (!provider) continue;
        const info = await provider.fetchLightNovelInfo(id);
        if (info && info.chapters) {
          console.log(`[ConsumetApiService] Light novel chapters found via ${name}`);
          return info.chapters;
        }
      } catch (error: any) {
        console.warn(`[ConsumetApiService] ${name} light novel chapters failed:`, error.message || error);
      }
    }
    return [];
  }

  async getLightNovelChapterContent(chapterId: string): Promise<string> {
    const providers = [
      { name: 'ReadLightNovels', provider: this.readLightNovelsProvider },
      { name: 'NovelUpdates', provider: this.novelUpdatesProvider },
    ];

    for (const { name, provider } of providers) {
      try {
        if (!provider) continue;
        const content = await provider.fetchChapterContent(chapterId);
        if (content) {
          console.log(`[ConsumetApiService] Light novel content found via ${name}`);
          return content;
        }
      } catch (error: any) {
        console.warn(`[ConsumetApiService] ${name} light novel content failed:`, error.message || error);
      }
    }
    return '';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // META PROVIDERS (Anilist, MyAnimeList, TMDB)
  // ─────────────────────────────────────────────────────────────────────────

  async searchMeta(query: string, type: 'anime' | 'manga' | 'movie' | 'tv' = 'anime', page: number = 1): Promise<any[]> {
    try {
      if (!this.anilistProvider) {
        console.error('[ConsumetApiService] Anilist provider not initialized');
        return [];
      }

      let result;
      switch (type) {
        case 'anime':
          result = await this.anilistProvider.search(query, page, 20, 'ANIME');
          break;
        case 'manga':
          result = await this.anilistProvider.search(query, page, 20, 'MANGA');
          break;
        default:
          result = await this.anilistProvider.search(query, page);
      }

      return result.results || [];
    } catch (error: any) {
      console.error('[ConsumetApiService] Meta search error:', error);
      return [];
    }
  }

  async getMetaAnimeInfo(id: string): Promise<any | null> {
    try {
      if (!this.anilistProvider) return null;
      return await this.anilistProvider.fetchAnimeInfo(id);
    } catch (error: any) {
      console.warn('[ConsumetApiService] Anilist anime info failed:', error.message || error);
      return null;
    }
  }

  async getMetaMangaInfo(id: string): Promise<any | null> {
    try {
      if (!this.anilistProvider) return null;
      return await this.anilistProvider.fetchMangaInfo(id);
    } catch (error: any) {
      console.warn('[ConsumetApiService] Anilist manga info failed:', error.message || error);
      return null;
    }
  }

  async getTrendingMeta(type: 'anime' | 'manga' = 'anime'): Promise<any[]> {
    try {
      if (!this.anilistProvider) return [];
      const result = type === 'anime'
        ? await this.anilistProvider.fetchTrendingAnime()
        : await this.anilistProvider.fetchTrendingManga();
      return result.results || [];
    } catch (error: any) {
      console.warn('[ConsumetApiService] Meta trending failed:', error.message || error);
      return [];
    }
  }

  async getPopularMeta(type: 'anime' | 'manga' = 'anime'): Promise<any[]> {
    try {
      if (!this.anilistProvider) return [];
      const result = type === 'anime'
        ? await this.anilistProvider.fetchPopularAnime()
        : await this.anilistProvider.fetchPopularManga();
      return result.results || [];
    } catch (error: any) {
      console.warn('[ConsumetApiService] Meta popular failed:', error.message || error);
      return [];
    }
  }

  async getTMDBMovieInfo(id: string): Promise<any | null> {
    try {
      if (!this.tmdbProvider) return null;
      return await this.tmdbProvider.fetchMediaInfo(id);
    } catch (error: any) {
      console.warn('[ConsumetApiService] TMDB info failed:', error.message || error);
      return null;
    }
  }

  async getTMDBTVInfo(id: string): Promise<any | null> {
    try {
      if (!this.tmdbProvider) return null;
      return await this.tmdbProvider.fetchMediaInfo(id, 'tv');
    } catch (error: any) {
      console.warn('[ConsumetApiService] TMDB TV info failed:', error.message || error);
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RECENTLY ADDED / POPULAR
  // ─────────────────────────────────────────────────────────────────────────

  async getRecentMovies(): Promise<ConsumetMovie[]> {
    return this.searchMoviesAllProviders('');
  }

  async getRecentTVShows(): Promise<ConsumetTVShow[]> {
    return this.searchTVAllProviders('');
  }

  async getPopularAnime(): Promise<ConsumetAnime[]> {
    return this.searchAnimeAllProviders('');
  }

  async getRecentManga(): Promise<ConsumetManga[]> {
    return this.searchMangaAllProviders('');
  }

  async getRecentLightNovels(): Promise<ConsumetLightNovel[]> {
    return this.searchLightNovelsAllProviders('');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PROVIDER MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────

  getAvailableProviders(): {
    movies: string[];
    tv: string[];
    anime: string[];
    manga: string[];
    lightNovels: string[];
    meta: string[];
  } {
    return {
      movies: this.getMovieProviderNames(),
      tv: this.getMovieProviderNames(),
      anime: this.getAnimeProviderNames(),
      manga: this.getMangaProviderNames(),
      lightNovels: this.getLightNovelProviderNames(),
      meta: this.getMetaProviderNames(),
    };
  }

  getProviderStatus(): Record<string, string> {
    const status: Record<string, string> = {};
    const providers: { name: string; provider: any }[] = [
      { name: 'MultiStream', provider: this.multiStreamProvider },
      { name: 'NetflixMirror', provider: this.netflixMirrorProvider },
      { name: 'MultiMovies', provider: this.multiMoviesProvider },
      { name: 'HiMovies', provider: this.hiMoviesProvider },
      { name: 'YFlix', provider: this.yFlixProvider },
      { name: 'AnimePahe', provider: this.animePaheProvider },
      { name: 'Zoro', provider: this.zoroProvider },
      { name: 'AnimeDrive', provider: this.animeDriveProvider },
      { name: 'Anify', provider: this.anifyProvider },
      { name: 'Marin', provider: this.marinProvider },
      { name: 'AnimeUnity', provider: this.animeUnityProvider },
      { name: 'AnimeKai', provider: this.animeKaiProvider },
      { name: 'AniKoto', provider: this.aniKotoProvider },
      { name: 'MangaDex', provider: this.mangaDexProvider },
      { name: 'ComicK', provider: this.comicKProvider },
      { name: 'MangaHere', provider: this.mangaHereProvider },
      { name: 'MangaKakalot', provider: this.mangaKakalotProvider },
      { name: 'Mangasee123', provider: this.mangasee123Provider },
      { name: 'Mangapark', provider: this.mangaparkProvider },
      { name: 'MangaPill', provider: this.mangaPillProvider },
      { name: 'MangaReader', provider: this.mangaReaderProvider },
      { name: 'AsuraScans', provider: this.asuraScansProvider },
      { name: 'FlameScans', provider: this.flameScansProvider },
      { name: 'MangaHost', provider: this.mangaHostProvider },
      { name: 'BRMangas', provider: this.brMangasProvider },
      { name: 'ReadManga', provider: this.readMangaProvider },
      { name: 'VyvyManga', provider: this.vyvyMangaProvider },
      { name: 'ReadLightNovels', provider: this.readLightNovelsProvider },
      { name: 'NovelUpdates', provider: this.novelUpdatesProvider },
      { name: 'Anilist', provider: this.anilistProvider },
      { name: 'Myanimelist', provider: this.myanimelistProvider },
      { name: 'TMDB', provider: this.tmdbProvider },
    ];

    for (const { name, provider } of providers) {
      status[name] = provider ? 'initialized' : 'not initialized';
    }
    return status;
  }

  getHealthyProviders(): Promise<ProviderStatus[]> {
    const providers: { name: string; provider: any; type: ProviderStatus['type'] }[] = [
      { name: 'MultiStream', provider: this.multiStreamProvider, type: 'movie' },
      { name: 'NetflixMirror', provider: this.netflixMirrorProvider, type: 'movie' },
      { name: 'MultiMovies', provider: this.multiMoviesProvider, type: 'movie' },
      { name: 'HiMovies', provider: this.hiMoviesProvider, type: 'movie' },
      { name: 'YFlix', provider: this.yFlixProvider, type: 'movie' },
      { name: 'AnimePahe', provider: this.animePaheProvider, type: 'anime' },
      { name: 'Zoro', provider: this.zoroProvider, type: 'anime' },
      { name: 'AnimeDrive', provider: this.animeDriveProvider, type: 'anime' },
      { name: 'Anify', provider: this.anifyProvider, type: 'anime' },
      { name: 'Marin', provider: this.marinProvider, type: 'anime' },
      { name: 'AnimeUnity', provider: this.animeUnityProvider, type: 'anime' },
      { name: 'AnimeKai', provider: this.animeKaiProvider, type: 'anime' },
      { name: 'AniKoto', provider: this.aniKotoProvider, type: 'anime' },
      { name: 'MangaDex', provider: this.mangaDexProvider, type: 'manga' },
      { name: 'ComicK', provider: this.comicKProvider, type: 'manga' },
      { name: 'MangaHere', provider: this.mangaHereProvider, type: 'manga' },
      { name: 'MangaKakalot', provider: this.mangaKakalotProvider, type: 'manga' },
      { name: 'Mangasee123', provider: this.mangasee123Provider, type: 'manga' },
      { name: 'Mangapark', provider: this.mangaparkProvider, type: 'manga' },
      { name: 'MangaPill', provider: this.mangaPillProvider, type: 'manga' },
      { name: 'MangaReader', provider: this.mangaReaderProvider, type: 'manga' },
      { name: 'AsuraScans', provider: this.asuraScansProvider, type: 'manga' },
      { name: 'FlameScans', provider: this.flameScansProvider, type: 'manga' },
      { name: 'MangaHost', provider: this.mangaHostProvider, type: 'manga' },
      { name: 'BRMangas', provider: this.brMangasProvider, type: 'manga' },
      { name: 'ReadManga', provider: this.readMangaProvider, type: 'manga' },
      { name: 'VyvyManga', provider: this.vyvyMangaProvider, type: 'manga' },
      { name: 'ReadLightNovels', provider: this.readLightNovelsProvider, type: 'lightnovel' },
      { name: 'NovelUpdates', provider: this.novelUpdatesProvider, type: 'lightnovel' },
      { name: 'Anilist', provider: this.anilistProvider, type: 'meta' },
      { name: 'Myanimelist', provider: this.myanimelistProvider, type: 'meta' },
      { name: 'TMDB', provider: this.tmdbProvider, type: 'meta' },
    ];

    return Promise.all(
      providers.map(async ({ name, provider, type }) => {
        let initialized = !!provider;
        if (initialized && provider.healthCheck) {
          try {
            initialized = await provider.healthCheck();
          } catch {
            initialized = false;
          }
        }
        return { name, initialized, type };
      })
    );
  }
}

// Export singleton instance
export const consumetApiService = ConsumetApiService.getInstance();