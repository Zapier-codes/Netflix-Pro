// src/services/supabase/searchAggregationService.ts
import { supabase } from './supabaseClient';
import { deviceManager } from '../device/DeviceManager';

export interface TrendingSearchRow {
  query: string;
  search_count: number;
}

export interface SearchCategoryRow {
  category: string;
  search_count: number;
}

// Supabase's PostgrestError (and most thrown errors here) don't print anything
// useful through `console.error('label', error)` on Hermes/React Native — the
// object's message/code/details/hint aren't picked up by the default formatter,
// so you end up with just the label and nothing after it. Log the actual fields.
function logSupabaseError(label: string, error: unknown): void {
  if (error && typeof error === 'object') {
    const err = error as { message?: string; code?: string; details?: string; hint?: string };
    console.error(label, {
      message: err.message ?? '(no message)',
      code: err.code ?? '(no code)',
      details: err.details ?? '(no details)',
      hint: err.hint ?? '(no hint)',
      raw: JSON.stringify(error),
    });
  } else {
    console.error(label, String(error));
  }
}

export class SearchAggregationService {
  private static instance: SearchAggregationService;

  static getInstance(): SearchAggregationService {
    if (!SearchAggregationService.instance) {
      SearchAggregationService.instance = new SearchAggregationService();
    }
    return SearchAggregationService.instance;
  }

  // ─────────────────────────────────────────────
  // RECORD SEARCH
  // ─────────────────────────────────────────────
  async recordSearch(query: string, category?: string): Promise<boolean> {
    try {
      const trimmed = query.trim();
      if (!trimmed) return false;

      const device = await deviceManager.initialize();

      if (!device?.id) {
        console.error('[SearchAggregationService] Record error: device.id is missing — deviceManager.initialize() did not return a usable device id, skipping insert', device);
        return false;
      }

      const { error } = await supabase.from('search_queries').insert({
        query: trimmed,
        category: category || null,
        device_id: device.id,
      });

      if (error) {
        logSupabaseError('[SearchAggregationService] Record error:', error);
        return false;
      }

      return true;
    } catch (error) {
      logSupabaseError('[SearchAggregationService] Error:', error);
      return false;
    }
  }

  // ─────────────────────────────────────────────
  // GET TRENDING SEARCHES
  // ─────────────────────────────────────────────
  async getTrendingSearches(limit: number = 20, category?: string): Promise<string[]> {
    try {
      const { data, error } = await supabase.rpc('get_trending_searches', {
        limit_count: limit,
        category_filter: category || null,
      });

      if (error) {
        logSupabaseError('[SearchAggregationService] Trending error:', error);
        return [];
      }

      return ((data as TrendingSearchRow[]) || []).map((row) => row.query);
    } catch (error) {
      logSupabaseError('[SearchAggregationService] Error:', error);
      return [];
    }
  }

  // ─────────────────────────────────────────────
  // GET SEARCH CATEGORIES
  // ─────────────────────────────────────────────
  async getSearchCategories(): Promise<string[]> {
    try {
      const { data, error } = await supabase.rpc('get_search_categories');

      if (error) {
        logSupabaseError('[SearchAggregationService] Categories error:', error);
        return [];
      }

      return ((data as SearchCategoryRow[]) || []).map((row) => row.category);
    } catch (error) {
      logSupabaseError('[SearchAggregationService] Error:', error);
      return [];
    }
  }
}

export const searchAggregationService = SearchAggregationService.getInstance();