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

      const { error } = await supabase.from('search_queries').insert({
        query: trimmed,
        category: category || null,
        device_id: device.id,
      });

      if (error) {
        console.error('[SearchAggregationService] Record error:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[SearchAggregationService] Error:', error);
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
        console.error('[SearchAggregationService] Trending error:', error);
        return [];
      }

      return ((data as TrendingSearchRow[]) || []).map((row) => row.query);
    } catch (error) {
      console.error('[SearchAggregationService] Error:', error);
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
        console.error('[SearchAggregationService] Categories error:', error);
        return [];
      }

      return ((data as SearchCategoryRow[]) || []).map((row) => row.category);
    } catch (error) {
      console.error('[SearchAggregationService] Error:', error);
      return [];
    }
  }
}

export const searchAggregationService = SearchAggregationService.getInstance();