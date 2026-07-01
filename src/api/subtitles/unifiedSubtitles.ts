// src/api/subtitles/unifiedSubtitles.ts
import { openSubtitlesService } from './openSubtitlesApi';
import { subdlApiService } from './subdlApi';

export interface SubtitleResult {
  id: string;
  language: string;
  languageCode: string;
  url: string;
  provider: 'opensubtitles' | 'subdl';
  rating?: number;
  downloads?: number;
}

export class UnifiedSubtitlesService {
  private static instance: UnifiedSubtitlesService;

  static getInstance(): UnifiedSubtitlesService {
    if (!UnifiedSubtitlesService.instance) {
      UnifiedSubtitlesService.instance = new UnifiedSubtitlesService();
    }
    return UnifiedSubtitlesService.instance;
  }

  async searchSubtitles(
    tmdbId: string,
    language: string = 'en',
    season?: number,
    episode?: number
  ): Promise<SubtitleResult[]> {
    const results: SubtitleResult[] = [];

    try {
      const osResults = await openSubtitlesService.searchSubtitles(tmdbId, language, season, episode);
      for (const sub of osResults) {
        results.push({
          id: sub.id || sub.file_id,
          language: sub.language || sub.language_name || language,
          languageCode: sub.language_code || language,
          url: sub.url || sub.link || '',
          provider: 'opensubtitles',
          rating: sub.ratings?.rating || 0,
          downloads: sub.downloads || 0
        });
      }
    } catch (error) {
      console.warn('[UnifiedSubtitles] OpenSubtitles error:', error);
    }

    if (results.length === 0) {
      try {
        const subdlResults = await subdlApiService.searchSubtitles(tmdbId, language);
        for (const sub of subdlResults) {
          results.push({
            id: sub.id,
            language: sub.language,
            languageCode: sub.languageCode,
            url: sub.url,
            provider: 'subdl',
            rating: sub.rating,
            downloads: sub.downloads
          });
        }
      } catch (error) {
        console.warn('[UnifiedSubtitles] SubDL error:', error);
      }
    }

    results.sort((a, b) => {
      const aScore = (a.rating || 0) + (a.downloads || 0) / 1000;
      const bScore = (b.rating || 0) + (b.downloads || 0) / 1000;
      return bScore - aScore;
    });

    return results;
  }

  async downloadSubtitle(id: string, provider: 'opensubtitles' | 'subdl'): Promise<string | null> {
    try {
      if (provider === 'opensubtitles') {
        return await openSubtitlesService.downloadSubtitle(id);
      } else {
        return await subdlApiService.getSubtitleFile(id);
      }
    } catch (error) {
      console.error('[UnifiedSubtitles] Download error:', error);
      return null;
    }
  }

  async getAvailableLanguages(): Promise<{ code: string; name: string }[]> {
    try {
      return await subdlApiService.getLanguages();
    } catch (error) {
      console.error('[UnifiedSubtitles] Languages error:', error);
      return [];
    }
  }
}

export const unifiedSubtitlesService = UnifiedSubtitlesService.getInstance();
