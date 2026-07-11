/**
 * useSearchHistory - Hook for managing search history
 * Features: save, load, remove individual, clear all, group by date
 * Uses AsyncStorage for persistence
 */

import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SEARCH_HISTORY_KEY = '@search_history';
const MAX_HISTORY_ITEMS = 50;

export interface SearchHistoryItem {
  query: string;
  timestamp: number;
  resultCount?: number;
  type?: 'typed' | 'category' | 'suggestion';
}

export interface GroupedSearchHistory {
  today: SearchHistoryItem[];
  yesterday: SearchHistoryItem[];
  thisWeek: SearchHistoryItem[];
  earlier: SearchHistoryItem[];
}

interface UseSearchHistoryReturn {
  history: SearchHistoryItem[];
  grouped: GroupedSearchHistory;
  loading: boolean;
  error: string | null;
  addItem: (query: string, resultCount?: number, type?: 'typed' | 'category' | 'suggestion') => Promise<void>;
  removeItem: (query: string) => Promise<void>;
  clearAll: () => Promise<void>;
  refresh: () => Promise<void>;
  getRecent: (limit?: number) => Promise<SearchHistoryItem[]>;
  searchHistory: string[];
}

export function useSearchHistory(): UseSearchHistoryReturn {
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load history from storage
  const loadHistory = useCallback(async (): Promise<SearchHistoryItem[]> => {
    try {
      const data = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
      if (!data) return [];
      return JSON.parse(data);
    } catch (err) {
      console.error('[useSearchHistory] Load error:', err);
      return [];
    }
  }, []);

  // Save history to storage
  const saveHistory = useCallback(async (items: SearchHistoryItem[]): Promise<void> => {
    try {
      await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(items));
    } catch (err) {
      console.error('[useSearchHistory] Save error:', err);
    }
  }, []);

  // Refresh the history
  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const items = await loadHistory();
      setHistory(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history');
      console.error('[useSearchHistory] Refresh error:', err);
    } finally {
      setLoading(false);
    }
  }, [loadHistory]);

  // Add a new item
  const addItem = useCallback(async (
    query: string,
    resultCount?: number,
    type: 'typed' | 'category' | 'suggestion' = 'typed'
  ) => {
    try {
      const trimmedQuery = query.trim();
      if (!trimmedQuery) return;

      const currentHistory = await loadHistory();
      
      // Remove duplicate if exists
      const filtered = currentHistory.filter(item => item.query !== trimmedQuery);
      
      // Add new item at the beginning
      const newItem: SearchHistoryItem = {
        query: trimmedQuery,
        timestamp: Date.now(),
        resultCount,
        type,
      };
      
      const updated = [newItem, ...filtered].slice(0, MAX_HISTORY_ITEMS);
      
      await saveHistory(updated);
      setHistory(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add history item');
      console.error('[useSearchHistory] Add error:', err);
    }
  }, [loadHistory, saveHistory]);

  // Remove a specific item
  const removeItem = useCallback(async (query: string) => {
    try {
      const currentHistory = await loadHistory();
      const updated = currentHistory.filter(item => item.query !== query);
      await saveHistory(updated);
      setHistory(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove history item');
      console.error('[useSearchHistory] Remove error:', err);
    }
  }, [loadHistory, saveHistory]);

  // Clear all history
  const clearAll = useCallback(async () => {
    try {
      await saveHistory([]);
      setHistory([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear history');
      console.error('[useSearchHistory] Clear error:', err);
    }
  }, [saveHistory]);

  // Get recent items
  const getRecent = useCallback(async (limit: number = 10): Promise<SearchHistoryItem[]> => {
    try {
      const items = await loadHistory();
      return items.slice(0, limit);
    } catch (err) {
      console.error('[useSearchHistory] Get recent error:', err);
      return [];
    }
  }, [loadHistory]);

  // Group history by date
  const getGrouped = useCallback((items: SearchHistoryItem[]): GroupedSearchHistory => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const thisWeek = new Date(today);
    thisWeek.setDate(thisWeek.getDate() - 7);

    const grouped: GroupedSearchHistory = {
      today: [],
      yesterday: [],
      thisWeek: [],
      earlier: [],
    };

    items.forEach(item => {
      const itemDate = new Date(item.timestamp);
      const itemDay = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate());

      if (itemDay.getTime() === today.getTime()) {
        grouped.today.push(item);
      } else if (itemDay.getTime() === yesterday.getTime()) {
        grouped.yesterday.push(item);
      } else if (itemDay.getTime() >= thisWeek.getTime()) {
        grouped.thisWeek.push(item);
      } else {
        grouped.earlier.push(item);
      }
    });

    return grouped;
  }, []);

  // Get search history as string array (for backward compatibility)
  const searchHistory = history.map(item => item.query);

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    history,
    grouped: getGrouped(history),
    loading,
    error,
    addItem,
    removeItem,
    clearAll,
    refresh,
    getRecent,
    searchHistory,
  };
}

export default useSearchHistory;