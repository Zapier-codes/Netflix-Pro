// src/hooks/supabase/useSearchAggregation.ts
import { useState, useCallback } from 'react';
import { searchAggregationService } from '../../services/supabase/searchAggregationService';

export const useSearchAggregation = () => {
  const [isRecording, setIsRecording] = useState(false);

  const recordSearch = useCallback(async (query: string, category?: string) => {
    setIsRecording(true);
    try {
      await searchAggregationService.recordSearch(query, category);
    } catch (error) {
      console.warn('[useSearchAggregation] Error:', error);
    } finally {
      setIsRecording(false);
    }
  }, []);

  const getTrending = useCallback(async (limit?: number, category?: string) => {
    try {
      return await searchAggregationService.getTrendingSearches(limit, category);
    } catch (error) {
      console.warn('[useSearchAggregation] Error:', error);
      return [];
    }
  }, []);

  const getCategories = useCallback(async () => {
    try {
      return await searchAggregationService.getSearchCategories();
    } catch (error) {
      console.warn('[useSearchAggregation] Error:', error);
      return [];
    }
  }, []);

  return {
    recordSearch,
    getTrending,
    getCategories,
    isRecording,
  };
};