/**
 * useSearchPagination - Hook for managing infinite scroll pagination
 * Features: load more, page cursor, merge results, loading state
 * Works with MavinEngine's pageUrl cursor pattern
 */

import { useState, useCallback, useRef } from 'react';
import { IMetadataResult } from '../../services/unified/types/MetadataTypes';

export interface PaginationState<T> {
  items: T[];
  hasNextPage: boolean;
  isLoadingMore: boolean;
  isRefreshing: boolean;
  error: string | null;
  page: number;
  totalCount?: number;
}

export interface UseSearchPaginationOptions {
  initialPage?: number;
  pageSize?: number;
  autoLoad?: boolean;
}

export interface UseSearchPaginationReturn<T> {
  // State
  items: T[];
  hasNextPage: boolean;
  isLoadingMore: boolean;
  isRefreshing: boolean;
  error: string | null;
  page: number;
  totalCount?: number;
  isEmpty: boolean;

  // Actions
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  reset: () => void;
  setItems: (items: T[]) => void;
  setTotalCount: (count: number) => void;
  setHasNextPage: (hasNext: boolean) => void;
}

export function useSearchPagination<T = IMetadataResult>(
  fetchPage: (page: number, options?: any) => Promise<{ items: T[]; hasNextPage: boolean; totalCount?: number }>,
  options: UseSearchPaginationOptions = {}
): UseSearchPaginationReturn<T> {
  const {
    initialPage = 1,
    pageSize = 20,
    autoLoad = true,
  } = options;

  const [state, setState] = useState<PaginationState<T>>({
    items: [],
    hasNextPage: true,
    isLoadingMore: false,
    isRefreshing: false,
    error: null,
    page: initialPage,
    totalCount: undefined,
  });

  const isLoadingRef = useRef(false);
  const isMounted = useRef(true);

  // Load more items
  const loadMore = useCallback(async () => {
    // Prevent duplicate loads
    if (isLoadingRef.current || !state.hasNextPage || state.isRefreshing) {
      return;
    }

    isLoadingRef.current = true;
    setState(prev => ({ ...prev, isLoadingMore: true, error: null }));

    try {
      const nextPage = state.page + 1;
      const result = await fetchPage(nextPage);

      if (!isMounted.current) return;

      setState(prev => ({
        ...prev,
        items: [...prev.items, ...result.items],
        hasNextPage: result.hasNextPage,
        isLoadingMore: false,
        page: nextPage,
        totalCount: result.totalCount || prev.totalCount,
        error: null,
      }));
    } catch (err) {
      if (!isMounted.current) return;
      setState(prev => ({
        ...prev,
        isLoadingMore: false,
        error: err instanceof Error ? err.message : 'Failed to load more',
      }));
      console.error('[useSearchPagination] Load more error:', err);
    } finally {
      isLoadingRef.current = false;
    }
  }, [state.page, state.hasNextPage, state.isRefreshing, fetchPage]);

  // Refresh - reset and load first page
  const refresh = useCallback(async () => {
    if (isLoadingRef.current) return;

    isLoadingRef.current = true;
    setState(prev => ({ ...prev, isRefreshing: true, error: null }));

    try {
      const result = await fetchPage(initialPage);

      if (!isMounted.current) return;

      setState({
        items: result.items,
        hasNextPage: result.hasNextPage,
        isLoadingMore: false,
        isRefreshing: false,
        error: null,
        page: initialPage,
        totalCount: result.totalCount,
      });
    } catch (err) {
      if (!isMounted.current) return;
      setState(prev => ({
        ...prev,
        isRefreshing: false,
        error: err instanceof Error ? err.message : 'Failed to refresh',
      }));
      console.error('[useSearchPagination] Refresh error:', err);
    } finally {
      isLoadingRef.current = false;
    }
  }, [initialPage, fetchPage]);

  // Reset to initial state
  const reset = useCallback(() => {
    setState({
      items: [],
      hasNextPage: true,
      isLoadingMore: false,
      isRefreshing: false,
      error: null,
      page: initialPage,
      totalCount: undefined,
    });
    isLoadingRef.current = false;
  }, [initialPage]);

  // Manual set items
  const setItems = useCallback((newItems: T[]) => {
    setState(prev => ({ ...prev, items: newItems }));
  }, []);

  // Manual set total count
  const setTotalCount = useCallback((count: number) => {
    setState(prev => ({ ...prev, totalCount: count }));
  }, []);

  // Manual set hasNextPage
  const setHasNextPage = useCallback((hasNext: boolean) => {
    setState(prev => ({ ...prev, hasNextPage: hasNext }));
  }, []);

  // Auto-load on mount
  // This would be handled by the parent component calling refresh()
  // We don't auto-load here to give parent control

  // Cleanup
  const cleanup = useCallback(() => {
    isMounted.current = false;
  }, []);

  return {
    // State
    items: state.items,
    hasNextPage: state.hasNextPage,
    isLoadingMore: state.isLoadingMore,
    isRefreshing: state.isRefreshing,
    error: state.error,
    page: state.page,
    totalCount: state.totalCount,
    isEmpty: state.items.length === 0 && !state.isLoadingMore && !state.isRefreshing,

    // Actions
    loadMore,
    refresh,
    reset,
    setItems,
    setTotalCount,
    setHasNextPage,
  };
}

export default useSearchPagination;