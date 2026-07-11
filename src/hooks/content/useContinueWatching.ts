/**
 * useContinueWatching - Hook for managing continue watching state
 * Uses existing watch progress storage - no duplicate data
 * Handles: loading, formatting, and displaying watch progress
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getContinueWatching,
  getContinueWatchingItem,
  isInContinueWatching,
  getContinueWatchingProgress,
  removeFromContinueWatching,
  clearContinueWatching,
  ContinueWatchingItem,
} from '../../utils/continueWatching';

interface UseContinueWatchingReturn {
  items: ContinueWatchingItem[];
  loading: boolean;
  error: string | null;
  getItem: (id: string, type: 'movie' | 'tv', season?: number, episode?: number) => Promise<ContinueWatchingItem | null>;
  isWatching: (id: string, type: 'movie' | 'tv', season?: number, episode?: number) => Promise<boolean>;
  getProgress: (id: string, type: 'movie' | 'tv', season?: number, episode?: number) => Promise<number | null>;
  removeItem: (id: string, type: 'movie' | 'tv', season?: number, episode?: number) => Promise<void>;
  clearAll: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useContinueWatching(): UseContinueWatchingReturn {
  const [items, setItems] = useState<ContinueWatchingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load items from existing watch progress
  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getContinueWatching();
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load continue watching');
      console.error('[useContinueWatching] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Get a specific item
  const getItem = useCallback(async (
    id: string,
    type: 'movie' | 'tv',
    season?: number,
    episode?: number
  ): Promise<ContinueWatchingItem | null> => {
    try {
      return await getContinueWatchingItem(id, type, season, episode);
    } catch (err) {
      console.error('[useContinueWatching] Get item error:', err);
      return null;
    }
  }, []);

  // Check if watching
  const isWatching = useCallback(async (
    id: string,
    type: 'movie' | 'tv',
    season?: number,
    episode?: number
  ): Promise<boolean> => {
    try {
      return await isInContinueWatching(id, type, season, episode);
    } catch (err) {
      console.error('[useContinueWatching] Check error:', err);
      return false;
    }
  }, []);

  // Get progress
  const getProgress = useCallback(async (
    id: string,
    type: 'movie' | 'tv',
    season?: number,
    episode?: number
  ): Promise<number | null> => {
    try {
      return await getContinueWatchingProgress(id, type, season, episode);
    } catch (err) {
      console.error('[useContinueWatching] Progress error:', err);
      return null;
    }
  }, []);

  // Remove item (marks as completed)
  const removeItem = useCallback(async (
    id: string,
    type: 'movie' | 'tv',
    season?: number,
    episode?: number
  ) => {
    try {
      await removeFromContinueWatching(id, type, season, episode);
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove item');
      console.error('[useContinueWatching] Remove error:', err);
    }
  }, [loadItems]);

  // Clear all
  const clearAll = useCallback(async () => {
    try {
      await clearContinueWatching();
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear items');
      console.error('[useContinueWatching] Clear error:', err);
    }
  }, [loadItems]);

  // Refresh
  const refresh = useCallback(async () => {
    await loadItems();
  }, [loadItems]);

  // Initial load
  useEffect(() => {
    loadItems();
  }, [loadItems]);

  return {
    items,
    loading,
    error,
    getItem,
    isWatching,
    getProgress,
    removeItem,
    clearAll,
    refresh,
  };
}

export default useContinueWatching;