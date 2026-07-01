// src/services/supabase/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'your-anon-key';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// src/services/supabase/searchService.ts
import { supabase } from './supabaseClient';
import { deviceManager } from '../device/DeviceManager';

export interface SearchRecord {
  id: string;
  device_id: string;
  query: string;
  category: string;
  created_at: string;
  popularity: number;
}

export class SearchAggregationService {
  private static instance: SearchAggregationService;

  static getInstance(): SearchAggregationService {
    if (!SearchAggregationService.instance) {
      SearchAggregationService.instance = new SearchAggregationService();
    }
    return SearchAggregationService.instance;
  }

  async recordSearch(query: string, category: string = 'general'): Promise<void> {
    try {
      const device = await deviceManager.initialize();
      await supabase
        .from('searches')
        .insert({
          device_id: device.id,
          query: query.trim(),
          category,
          popularity: 1,
        });
    } catch (error) {
      console.warn('[SearchAggregation] Record error:', error);
    }
  }

  async getTrendingSearches(limit: number = 20, category?: string): Promise<string[]> {
    try {
      let query = supabase
        .from('searches')
        .select('query')
        .order('created_at', { ascending: false });

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query.limit(limit * 2);

      if (error) {
        console.warn('[SearchAggregation] Trending error:', error);
        return [];
      }

      const counts: Record<string, number> = {};
      for (const item of data || []) {
        counts[item.query] = (counts[item.query] || 0) + 1;
      }

      const sorted = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([query]) => query);

      return sorted.slice(0, limit);
    } catch (error) {
      console.warn('[SearchAggregation] Error:', error);
      return [];
    }
  }

  async getSearchCategories(): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('searches')
        .select('category')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[SearchAggregation] Categories error:', error);
        return ['movies', 'tv', 'drama', 'anime'];
      }

      const categories = new Set<string>();
      for (const item of data || []) {
        if (item.category) categories.add(item.category);
      }

      return Array.from(categories);
    } catch (error) {
      return ['movies', 'tv', 'drama', 'anime'];
    }
  }

  async getPopularSearchesByCategory(category: string, limit: number = 10): Promise<string[]> {
    try {
      const trending = await this.getTrendingSearches(limit, category);
      if (trending.length > 0) return trending;
      return await this.getTrendingSearches(limit);
    } catch (error) {
      return [];
    }
  }
}

export const searchAggregationService = SearchAggregationService.getInstance();
