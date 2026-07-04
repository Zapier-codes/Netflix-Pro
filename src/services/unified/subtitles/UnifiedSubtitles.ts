// src/api/subtitles/unifiedSubtitles.ts
// The file is at src/api/opensubtitlesApi.tsx, so we need to go up one level
import { opensubtitlesApiService } from '../opensubtitlesApi';
import { subdlApiService } from './subdlApi';

export interface SubtitleResult {
  id: string;
  language: string;
  languageCode: string;
  url: string;
  provider: 'opensubtitles' | 'subdl';
  rating?: number;
  downloads?: number;
  fileId?: string;
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
      const osResults = await opensubtitlesApiService.searchSubtitles(tmdbId, language, season, episode);
      
      if (osResults && Array.isArray(osResults)) {
        for (const sub of osResults) {
          results.push({
            id: sub.id || sub.file_id || `os-${Date.now()}-${Math.random()}`,
            language: sub.language || sub.language_name || language,
            languageCode: sub.language_code || language,
            url: sub.url || sub.link || '',
            provider: 'opensubtitles',
            rating: sub.ratings?.rating || 0,
            downloads: sub.downloads || 0,
            fileId: sub.file_id || sub.id
          });
        }
      }
    } catch (error) {
      console.warn('[UnifiedSubtitles] OpenSubtitles error:', error);
    }

    if (results.length === 0) {
      try {
        const subdlResults = await subdlApiService.searchSubtitles(tmdbId, language);
        
        if (subdlResults && Array.isArray(subdlResults)) {
          for (const sub of subdlResults) {
            results.push({
              id: sub.id || `subdl-${Date.now()}-${Math.random()}`,
              language: sub.language || language,
              languageCode: sub.languageCode || language,
              url: sub.url || '',
              provider: 'subdl',
              rating: sub.rating || 0,
              downloads: sub.downloads || 0,
              fileId: sub.id
            });
          }
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
        return await opensubtitlesApiService.downloadSubtitle(id);
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
export default unifiedSubtitlesService;