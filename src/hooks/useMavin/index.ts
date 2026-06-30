// src/hooks/useMavin/index.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { requireNativeModule } from 'expo-modules-core';

const Native = requireNativeModule('MavinEngine');

if (!Native) {
  console.error('[useMavin] MavinEngine native module not loaded');
}

export interface MavinItem {
  id: string;
  title: string;
  url: string;
  thumbnails: { url: string; width: number; height: number }[];
  duration: number;
  uploaderName: string;
  viewCount: number;
}

interface TrendingResult {
  success: boolean;
  source: string;
  items: MavinItem[];
  totalAvailable: number;
  errors: string[];
  message?: string;
}

export const useMavinTrending = (category: string = 'movies', limit: number = 12) => {
  const [data, setData] = useState<MavinItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string>('none');

  const fetchTrending = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Use getTrendingWithFallback from native module
      const result = await Native.getTrendingWithFallback(category, 0);
      
      if (result?.success && result.items) {
        setData(result.items.slice(0, limit));
        setSource(result.source || 'mavin');
      } else {
        setError(result?.message || 'Failed to fetch trending content');
        setData([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [category, limit]);

  useEffect(() => {
    fetchTrending();
  }, [fetchTrending]);

  return { data, loading, error, source, refresh: fetchTrending };
};

export const useMavinStream = (url: string) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStream = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    try {
      const result = await Native.getStreamInfo(url);
      if (result?.success) {
        setData(result);
      } else {
        setError(result?.message || 'Failed to fetch stream');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    if (url) fetchStream();
  }, [url, fetchStream]);

  return { data, loading, error, refresh: fetchStream };
};

export default { useMavinTrending, useMavinStream };
