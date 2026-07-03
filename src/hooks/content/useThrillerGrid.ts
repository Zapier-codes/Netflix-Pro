// src/hooks/content/useThrillerGrid.ts
import { useState, useEffect, useCallback } from 'react';
import { thrillerPreloader, ThrillerItem } from '../../services/preloader/ThrillerPreloader';

export const useThrillerGrid = (movies: any[]) => {
  const [items, setItems] = useState<ThrillerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPreloaded, setIsPreloaded] = useState(false);

  // ─── Load thriller items from cache ONLY ───
  // The actual fetching happened in eagerPreload() called from root layout
  const loadThrillerItems = useCallback(async () => {
    if (!movies || movies.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Wait for eager preload to complete (returns immediately if already done)
      const preloaded = await thrillerPreloader.awaitEagerPreload(movies);

      setItems(preloaded);
      setIsPreloaded(true);
      setLoading(false);

      // ─── Background weekly refresh check ───
      // Non-blocking: the screen already has its data above. This just
      // regenerates the batch in the background if it's past 7 days old,
      // so the *next* app open (not this one) gets fresh trailers instead
      // of everyone waiting on a reactive cache-miss fetch.
      thrillerPreloader.checkAndRefreshWeeklyBatch(movies).catch((e) => {
        console.warn('[useThrillerGrid] Background weekly refresh failed:', e);
      });
    } catch (error) {
      console.error('[useThrillerGrid] Error:', error);
      setError('Failed to load thriller content');
      setLoading(false);
    }
  }, [movies]);

  // ─── Reload (force refresh) ───
  const reload = useCallback(async () => {
    await thrillerPreloader.clearCache();
    await loadThrillerItems();
  }, [loadThrillerItems]);

  // ─── Effect ───
  useEffect(() => {
    loadThrillerItems();
  }, [loadThrillerItems]);

  return {
    items,
    loading,
    error,
    isPreloaded,
    reload,
  };
};