/**
 * useSearchSuggestions - Hook for managing search suggestions
 * Uses MavinEngine for autocomplete suggestions
 * Features: debounced input, loading state, error handling
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import MavinEngine from '../../../../modules/mavin-engine';

interface UseSearchSuggestionsReturn {
  suggestions: string[];
  loading: boolean;
  error: string | null;
  setQuery: (query: string) => void;
  clearSuggestions: () => void;
  isVisible: boolean;
}

export function useSearchSuggestions(
  debounceDelay: number = 300,
  maxSuggestions: number = 10
): UseSearchSuggestionsReturn {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [query, setQueryState] = useState('');

  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  const isMounted = useRef(true);

  // Clear suggestions when query is empty
  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      setIsVisible(false);
      setLoading(false);
      return;
    }
  }, [query]);

  // Fetch suggestions with debounce
  useEffect(() => {
    if (!query.trim()) {
      return;
    }

    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    setLoading(true);
    setError(null);

    debounceTimeout.current = setTimeout(async () => {
      try {
        const result = await MavinEngine.getSearchSuggestions(query, 0);
        
        if (!isMounted.current) return;
        
        if (result && result.suggestions) {
          const limited = result.suggestions.slice(0, maxSuggestions);
          setSuggestions(limited);
          setIsVisible(limited.length > 0);
        } else {
          setSuggestions([]);
          setIsVisible(false);
        }
      } catch (err) {
        if (!isMounted.current) return;
        setError(err instanceof Error ? err.message : 'Failed to get suggestions');
        // Fallback: use query as a suggestion
        setSuggestions([query]);
        setIsVisible(true);
        console.error('[useSearchSuggestions] Error:', err);
      } finally {
        if (isMounted.current) {
          setLoading(false);
        }
      }
    }, debounceDelay);

    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, [query, debounceDelay, maxSuggestions]);

  // Cleanup on unmount
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, []);

  const setQuery = useCallback((newQuery: string) => {
    setQueryState(newQuery);
    if (!newQuery.trim()) {
      setSuggestions([]);
      setIsVisible(false);
      setLoading(false);
    }
  }, []);

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
    setIsVisible(false);
    setLoading(false);
    setError(null);
  }, []);

  return {
    suggestions,
    loading,
    error,
    setQuery,
    clearSuggestions,
    isVisible,
  };
}

export default useSearchSuggestions;