// src/screens/search/SearchScreen.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  Keyboard,
  Platform,
  ScrollView,
  Dimensions,
  Animated,
  Easing,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Zustand Stores
import { useAppStore } from '../../store/zustand';
import { useSearchPreloader } from '../../hooks/content/useSearchPreloader';
import { useSearchAggregation } from '../../hooks/supabase/useSearchAggregation';
import { useTheme } from '../../contexts/ThemeContext';
import { useAlert } from '../../contexts/AlertContext';

// ─── Unified multi-source search engine (TMDB + Kuryana + MovieBox) ───
import { unifiedMediaService } from '../../services/unified/UnifiedMediaService';
import { IMetadataResult } from '../../services/unified/types/MetadataTypes';
import { DiscoverFilters } from '../../services/unified/types/MetadataTypes';

// ─── MavinEngine for search suggestions ───
import MavinEngine from '../../../modules/mavin-engine';

// Utils
import { saveSearchQuery, getSearchHistory, removeSearchQuery, clearSearchHistory } from '../../utils/storage';
import { getContinueWatching, saveContinueWatching, removeFromContinueWatching, ContinueWatchingItem } from '../../utils/continueWatching';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// TMDB CDN prefix used by the rest of the app
const TMDB_POSTER_PREFIX = 'https://image.tmdb.org/t/p/w500';

// ─── Grid Layout (4-up) ───
const GRID_GAP = 8;
const GRID_CARD_WIDTH = (SCREEN_WIDTH - 16 * 2 - GRID_GAP * 3) / 4;
const GRID_CARD_HEIGHT = GRID_CARD_WIDTH * 1.5;

const toRawPosterPath = (fullPosterUrl?: string): string => {
  if (!fullPosterUrl) return '';
  return fullPosterUrl.startsWith(TMDB_POSTER_PREFIX)
    ? fullPosterUrl.slice(TMDB_POSTER_PREFIX.length)
    : fullPosterUrl;
};

// ─── Sort options (MovieBox-style) ───
type SortOption = 'popularity' | 'rating' | 'release_date' | 'az';

const SORT_OPTIONS: { key: SortOption; label: string; icon: string }[] = [
  { key: 'popularity', label: 'Popularity', icon: 'flame-outline' },
  { key: 'rating', label: 'Rating', icon: 'star-outline' },
  { key: 'release_date', label: 'Release Date', icon: 'calendar-outline' },
  { key: 'az', label: 'A-Z', icon: 'text-outline' },
];

const sortResults = (items: IMetadataResult[], sortBy: SortOption): IMetadataResult[] => {
  const arr = [...items];
  switch (sortBy) {
    case 'rating':
      return arr.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    case 'release_date':
      return arr.sort((a, b) => (b.year || 0) - (a.year || 0));
    case 'az':
      return arr.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    case 'popularity':
    default:
      // Popularity falls back to rating when IMetadataResult has no explicit
      // popularity field — swap in a real popularity field if your API returns one.
      return arr.sort((a, b) => {
        const popA = (a as any).popularity ?? (a.rating || 0);
        const popB = (b as any).popularity ?? (b.rating || 0);
        return popB - popA;
      });
  }
};

// ─── Local watchlist (self-contained; wire to your real watchlist store if you have one) ───
const WATCHLIST_KEY = 'search_screen_watchlist_ids';

const getWatchlistIds = async (): Promise<Set<string>> => {
  try {
    const raw = await AsyncStorage.getItem(WATCHLIST_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
};

const saveWatchlistIds = async (ids: Set<string>) => {
  try {
    await AsyncStorage.setItem(WATCHLIST_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // non-critical local cache — safe to ignore
  }
};

// ─── Trending fallback queries for the empty state ───
const TRENDING_SUGGESTIONS = [
  'Marvel', 'Korean Drama', 'Action 2024', 'Anime', 'True Crime', 'Comedy',
];

// ─── Filter Types ───
interface SearchFilters {
  type: 'all' | 'movie' | 'tv';
  year: string;
  minRating: number;
  source: 'all' | 'tmdb' | 'kuryana' | 'moviebox';
  genre: string;
  language: string;
  certification: string;
  yearRange: string;
}

type ActiveMode = 'discover' | 'typed' | 'category' | 'genre';

// ─── Category Cards with real classification signals ───
const CATEGORY_CARDS: { 
  label: string; 
  query: string; 
  icon: string; 
  filters: Partial<DiscoverFilters>;
}[] = [
  { 
    label: 'Hollywood', 
    query: 'hollywood', 
    icon: 'film-outline',
    filters: { languages: ['en'], countries: ['US'], type: 'movie' }
  },
  { 
    label: 'Bollywood', 
    query: 'bollywood', 
    icon: 'film-outline',
    filters: { languages: ['hi', 'bn', 'te', 'ta', 'ml'], countries: ['IN'], type: 'movie' }
  },
  { 
    label: 'Nollywood', 
    query: 'nollywood', 
    icon: 'film-outline',
    filters: { languages: ['en', 'yo', 'ig', 'ha'], countries: ['NG'], type: 'movie' }
  },
  { 
    label: 'Anime', 
    query: 'anime', 
    icon: 'sparkles-outline',
    filters: { languages: ['ja'], countries: ['JP'], genres: ['Animation', 'Anime'] }
  },
  { 
    label: 'K-Drama', 
    query: 'korean drama', 
    icon: 'tv-outline',
    filters: { languages: ['ko'], countries: ['KR'], genres: ['Drama'], type: 'tv' }
  },
  { 
    label: 'Chinese Drama', 
    query: 'chinese drama', 
    icon: 'globe-outline',
    filters: { languages: ['zh', 'cn'], countries: ['CN', 'TW', 'HK'], genres: ['Drama'], type: 'tv' }
  },
];

// ─── Year options ───
const currentYear = new Date().getFullYear();
const YEAR_OPTIONS: string[] = Array.from({ length: 12 }, (_, i) => String(currentYear - i));
const YEAR_RANGE_OPTIONS: string[] = ['2020-2024', '2010-2019', '2000-2009', '1990-1999', 'Pre-1990'];

// ─── Language options ───
const LANGUAGE_OPTIONS: { label: string; code: string }[] = [
  { label: 'All', code: '' },
  { label: 'English', code: 'en' },
  { label: 'Hindi', code: 'hi' },
  { label: 'Korean', code: 'ko' },
  { label: 'Japanese', code: 'ja' },
  { label: 'Chinese', code: 'zh' },
  { label: 'Spanish', code: 'es' },
  { label: 'French', code: 'fr' },
  { label: 'German', code: 'de' },
  { label: 'Italian', code: 'it' },
  { label: 'Portuguese', code: 'pt' },
  { label: 'Russian', code: 'ru' },
  { label: 'Arabic', code: 'ar' },
  { label: 'Turkish', code: 'tr' },
  { label: 'Thai', code: 'th' },
  { label: 'Vietnamese', code: 'vi' },
];

// ─── Certification options ───
const CERTIFICATION_OPTIONS: { label: string; code: string }[] = [
  { label: 'All', code: '' },
  { label: 'G', code: 'G' },
  { label: 'PG', code: 'PG' },
  { label: 'PG-13', code: 'PG-13' },
  { label: 'R', code: 'R' },
  { label: 'NC-17', code: 'NC-17' },
  { label: 'TV-Y', code: 'TV-Y' },
  { label: 'TV-Y7', code: 'TV-Y7' },
  { label: 'TV-PG', code: 'TV-PG' },
  { label: 'TV-14', code: 'TV-14' },
  { label: 'TV-MA', code: 'TV-MA' },
];

const SearchScreen = () => {
  const { colors, isDark } = useTheme();
  const { showToast } = useAlert();
  const { networkStatus } = useAppStore();

  const { trendingItems, loading: preloadLoading } = useSearchPreloader();
  const { recordSearch: recordSearchToSupabase } = useSearchAggregation();

  // ─── Search bar text ───
  const [query, setQuery] = useState('');

  // ─── Active mode ───
  const [activeMode, setActiveMode] = useState<ActiveMode>('discover');
  const [resultsTitle, setResultsTitle] = useState('Popular Searches');

  // ─── Results ───
  const [results, setResults] = useState<IMetadataResult[]>([]);
  const [filteredResults, setFilteredResults] = useState<IMetadataResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  // ─── Continue Watching ───
  const [continueWatching, setContinueWatching] = useState<ContinueWatchingItem[]>([]);

  // ─── Search Suggestions ───
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  // ─── Sort control (Popularity / Rating / Release Date / A-Z) ───
  const [sortBy, setSortBy] = useState<SortOption>('popularity');
  const [showSortMenu, setShowSortMenu] = useState(false);

  // ─── Results tab segmentation (All / Movies / TV) ───
  const [activeTab, setActiveTab] = useState<'all' | 'movie' | 'tv'>('all');

  // ─── Local watchlist ids for inline bookmark toggle ───
  const [watchlistIds, setWatchlistIds] = useState<Set<string>>(new Set());

  // ─── Filter State ───
  const [filters, setFilters] = useState<SearchFilters>({
    type: 'all',
    year: '',
    minRating: 0,
    source: 'all',
    genre: '',
    language: '',
    certification: '',
    yearRange: '',
  });

  const [availableGenres] = useState<string[]>([
    'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary',
    'Drama', 'Family', 'Fantasy', 'Horror', 'Mystery', 'Romance',
    'Sci-Fi', 'Thriller', 'War', 'Western',
    // Asian drama genres
    'Wuxia', 'Xianxia', 'Historical', 'Period', 'Martial Arts',
    'Sageuk', 'Melodrama', 'Slice of Life', 'School', 'Youth',
  ]);

  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  const suggestionsTimeout = useRef<NodeJS.Timeout | null>(null);
  const isMounted = useRef(true);
  const engineInitialized = useRef(false);

  // ─── Refs for current state ───
  const filtersRef = useRef(filters);
  useEffect(() => { filtersRef.current = filters; }, [filters]);

  const sortByRef = useRef(sortBy);
  useEffect(() => { sortByRef.current = sortBy; }, [sortBy]);

  const activeSearchQueryRef = useRef('');
  const activeModeRef = useRef<ActiveMode>('discover');
  const activeTitleRef = useRef('Popular Searches');
  const activeFiltersRef = useRef<Partial<DiscoverFilters>>({});

  const skipQueryEffectRef = useRef(false);

  // ─── Skeleton pulse ───
  const skeletonPulse = useRef(new Animated.Value(0.45)).current;

  // ─── Load continue watching ───
  const loadContinueWatching = useCallback(async () => {
    const items = await getContinueWatching();
    if (isMounted.current) {
      setContinueWatching(items);
    }
  }, []);

  // ─── Load search history ───
  const loadSearchHistory = useCallback(async () => {
    const history = await getSearchHistory();
    if (isMounted.current) {
      setSearchHistory(history);
    }
  }, []);

  const isGridLoading = loading || (activeMode === 'discover' && preloadLoading && trendingItems.length === 0);
  
  useEffect(() => {
    if (!isGridLoading) return;
    skeletonPulse.setValue(0.45);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(skeletonPulse, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(skeletonPulse, { toValue: 0.45, duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isGridLoading, skeletonPulse]);

  // ─── Initialize engines ───
  useEffect(() => {
    if (!engineInitialized.current) {
      unifiedMediaService.initialize().catch((err) =>
        console.error('[Search] Failed to initialize unified media service:', err)
      );
      engineInitialized.current = true;
    }
  }, []);

  // ─── Apply filters ───
  const applyFilters = useCallback((resultsToFilter: IMetadataResult[], currentFilters: SearchFilters): IMetadataResult[] => {
    let filtered = [...resultsToFilter];

    if (currentFilters.type !== 'all') {
      filtered = filtered.filter(item => item.type === currentFilters.type);
    }

    if (currentFilters.year) {
      const yearNum = parseInt(currentFilters.year);
      if (!isNaN(yearNum)) {
        filtered = filtered.filter(item => item.year === yearNum);
      }
    }

    if (currentFilters.minRating > 0) {
      filtered = filtered.filter(item => (item.rating || 0) >= currentFilters.minRating);
    }

    if (currentFilters.source !== 'all') {
      filtered = filtered.filter(item => (item as any).source === currentFilters.source);
    }

    if (currentFilters.genre) {
      filtered = filtered.filter(item =>
        item.genres?.some(g => g.toLowerCase().includes(currentFilters.genre.toLowerCase()))
      );
    }

    if (currentFilters.language) {
      filtered = filtered.filter(item =>
        item.originalLanguage?.toLowerCase() === currentFilters.language.toLowerCase()
      );
    }

    if (currentFilters.certification) {
      filtered = filtered.filter(item =>
        item.certification?.toUpperCase() === currentFilters.certification.toUpperCase()
      );
    }

    if (currentFilters.yearRange) {
      const [start, end] = currentFilters.yearRange.split('-').map(Number);
      if (start && end) {
        filtered = filtered.filter(item => (item.year || 0) >= start && (item.year || 0) <= end);
      } else if (currentFilters.yearRange === 'Pre-1990') {
        filtered = filtered.filter(item => (item.year || 0) < 1990);
      }
    }

    return filtered;
  }, []);

  // ─── Reset to discover ───
  const resetToDiscover = useCallback(() => {
    activeSearchQueryRef.current = '';
    activeModeRef.current = 'discover';
    activeTitleRef.current = 'Popular Searches';
    activeFiltersRef.current = {};
    setActiveMode('discover');
    setResultsTitle('Popular Searches');
    setResults([]);
    setFilteredResults([]);
    setNoResults(false);
    setShowSuggestions(false);
    setSuggestions([]);
    loadSearchHistory();
    loadContinueWatching();
  }, [loadSearchHistory, loadContinueWatching]);

  // ─── Perform search with full filters ───
  const performSearch = useCallback(async (
    searchQuery: string,
    mode: Exclude<ActiveMode, 'discover'>,
    title: string,
    categoryFilters?: Partial<DiscoverFilters>,
    saveToHistory: boolean = true
  ) => {
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery && !categoryFilters) {
      resetToDiscover();
      return;
    }

    activeSearchQueryRef.current = trimmedQuery;
    activeModeRef.current = mode;
    activeTitleRef.current = title;
    if (categoryFilters) {
      activeFiltersRef.current = categoryFilters;
    }

    setLoading(true);
    setNoResults(false);
    setActiveMode(mode);
    setResultsTitle(title);
    setShowSuggestions(false);

    try {
      const currentFilters = filtersRef.current;
      
      // Build search options with all filters
      const searchOptions: any = {
        query: trimmedQuery,
        limit: 50,
        ...categoryFilters,
      };

      // Add type filter
      if (currentFilters.type !== 'all') {
        searchOptions.type = currentFilters.type;
      }

      // Add language filter
      if (currentFilters.language) {
        searchOptions.language = currentFilters.language;
      }

      // Add certification filter
      if (currentFilters.certification) {
        searchOptions.certification = currentFilters.certification;
      }

      // Add year range
      if (currentFilters.year) {
        searchOptions.year = parseInt(currentFilters.year);
      }

      // Add rating filter
      if (currentFilters.minRating > 0) {
        searchOptions.minRating = currentFilters.minRating;
      }

      // Add genre filter
      if (currentFilters.genre) {
        searchOptions.genres = [currentFilters.genre];
      }

      // Use discover mode if no query and we have category filters
      let searchResults: IMetadataResult[];
      if (!trimmedQuery && categoryFilters) {
        // Use discover mode
        const discoverFilters: DiscoverFilters = {
          ...categoryFilters,
          type: currentFilters.type !== 'all' ? currentFilters.type : categoryFilters.type || 'all',
          limit: 50,
        };
        // @ts-ignore - discover is available
        searchResults = await unifiedMediaService.discover(discoverFilters);
      } else {
        // Regular search
        searchResults = await unifiedMediaService.search(searchOptions);
      }

      if (!isMounted.current) return;

      const withPosters = searchResults.filter((item) => !!item.poster);
      setResults(withPosters);

      const applied = applyFilters(withPosters, currentFilters);
      const sorted = sortResults(applied, sortByRef.current);
      setFilteredResults(sorted);
      setNoResults(sorted.length === 0);

      // Save to history only for typed searches
      if (saveToHistory && mode === 'typed' && sorted.length > 0) {
        await saveSearchQuery(trimmedQuery);
        loadSearchHistory();
        recordSearchToSupabase(trimmedQuery);
      }
    } catch (error) {
      console.error('[Search] Error:', error);
      setResults([]);
      setFilteredResults([]);
      setNoResults(true);
      showToast('Search failed. Please try again.');
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [applyFilters, loadSearchHistory, recordSearchToSupabase, showToast, resetToDiscover]);

  // ─── Debounced search suggestions using MavinEngine ───
  useEffect(() => {
    if (skipQueryEffectRef.current) {
      skipQueryEffectRef.current = false;
      return;
    }

    // Clear suggestions if query is empty
    if (!query.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Show suggestions after 300ms of typing
    if (suggestionsTimeout.current) {
      clearTimeout(suggestionsTimeout.current);
    }

    setIsLoadingSuggestions(true);
    suggestionsTimeout.current = setTimeout(async () => {
      try {
        // Use MavinEngine for search suggestions
        const result = await MavinEngine.getSearchSuggestions(query, 0);
        if (result && result.suggestions) {
          setSuggestions(result.suggestions.slice(0, 10));
          setShowSuggestions(true);
        }
      } catch (error) {
        console.error('[Search] Suggestions error:', error);
        // Fallback: use query as suggestion
        setSuggestions([query]);
        setShowSuggestions(true);
      } finally {
        setIsLoadingSuggestions(false);
      }
    }, 300);

    return () => {
      if (suggestionsTimeout.current) {
        clearTimeout(suggestionsTimeout.current);
      }
    };
  }, [query]);

  // ─── Debounced search execution ───
  useEffect(() => {
    if (skipQueryEffectRef.current) {
      skipQueryEffectRef.current = false;
      return;
    }

    if (!query.trim()) {
      resetToDiscover();
      return;
    }

    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    debounceTimeout.current = setTimeout(() => {
      performSearch(query, 'typed', 'Searched Results', undefined, false);
    }, 500);

    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, [query, performSearch, resetToDiscover]);

  // ─── Re-apply filters, tab, and sort whenever any of them change ───
  useEffect(() => {
    if (results.length > 0) {
      const tabFiltered = activeTab === 'all'
        ? results
        : results.filter((item) => item.type === activeTab);
      const filtered = sortResults(applyFilters(tabFiltered, filters), sortBy);
      setFilteredResults(filtered);
      setNoResults(filtered.length === 0);
    }
  }, [filters, results, applyFilters, sortBy, activeTab]);

  // ─── Type filter re-runs search ───
  const isFirstTypeRender = useRef(true);
  useEffect(() => {
    if (isFirstTypeRender.current) {
      isFirstTypeRender.current = false;
      return;
    }
    if (activeSearchQueryRef.current || Object.keys(activeFiltersRef.current).length > 0) {
      performSearch(
        activeSearchQueryRef.current, 
        activeModeRef.current as Exclude<ActiveMode, 'discover'>, 
        activeTitleRef.current,
        activeFiltersRef.current,
        false
      );
    }
  }, [filters.type, performSearch]);

  useFocusEffect(
    useCallback(() => {
      isMounted.current = true;
      loadSearchHistory();
      loadContinueWatching();
      getWatchlistIds().then((ids) => { if (isMounted.current) setWatchlistIds(ids); });
      return () => { isMounted.current = false; };
    }, [loadSearchHistory, loadContinueWatching])
  );

  // ─── Toggle watchlist membership from search results (no need to open detail) ───
  const handleToggleWatchlist = useCallback((item: IMetadataResult) => {
    setWatchlistIds((prev) => {
      const next = new Set(prev);
      const id = String(item.id);
      if (next.has(id)) {
        next.delete(id);
        showToast(`Removed "${item.title}" from watchlist`);
      } else {
        next.add(id);
        showToast(`Added "${item.title}" to watchlist`);
      }
      saveWatchlistIds(next);
      return next;
    });
  }, [showToast]);

  // ─── Handlers ───
  const handleItemPress = useCallback((item: IMetadataResult) => {
    const rawPosterPath = toRawPosterPath(item.poster);
    router.push(
      `/movie/${item.id}?mediaType=${item.type}&title=${encodeURIComponent(item.title)}&poster_path=${encodeURIComponent(rawPosterPath)}`
    );
  }, []);

  const handleSuggestionPress = useCallback((suggestion: string) => {
    skipQueryEffectRef.current = true;
    setQuery(suggestion);
    setShowSuggestions(false);
    performSearch(suggestion, 'typed', 'Searched Results', undefined, true);
    Keyboard.dismiss();
  }, [performSearch]);

  const handleHistoryItemPress = useCallback((historyQuery: string) => {
    skipQueryEffectRef.current = true;
    setQuery(historyQuery);
    setShowSuggestions(false);
    performSearch(historyQuery, 'typed', 'Searched Results', undefined, true);
    Keyboard.dismiss();
  }, [performSearch]);

  const handleRemoveHistoryItem = async (historyQuery: string) => {
    await removeSearchQuery(historyQuery);
    loadSearchHistory();
  };

  const handleClearAllHistory = async () => {
    await clearSearchHistory();
    loadSearchHistory();
    showToast('Search history cleared');
  };

  // ─── Voice search entry point ───
  // NOTE: real speech-to-text needs a native module (e.g. @react-native-voice/voice
  // or expo-speech-recognition) that isn't part of this project yet. Wire your
  // chosen library's start/stop/result listeners into this handler; for now it
  // surfaces the affordance without silently pretending to listen.
  const handleVoiceSearch = () => {
    showToast('Voice search needs a speech-to-text module wired in — tap to type for now');
  };

  const handleClearQuery = () => {
    skipQueryEffectRef.current = true;
    setQuery('');
    setShowSuggestions(false);
    resetToDiscover();
  };

  const handleCategoryPress = useCallback((cat: typeof CATEGORY_CARDS[0]) => {
    Keyboard.dismiss();
    setShowSuggestions(false);
    
    if (query.length > 0) {
      skipQueryEffectRef.current = true;
      setQuery('');
    }
    
    performSearch(cat.query, 'category', cat.label, cat.filters, false);
  }, [query, performSearch]);

  // ─── Continue Watching handler ───
  const handleContinueWatchingPress = useCallback((item: ContinueWatchingItem) => {
    router.push(
      `/movie/${item.id}?mediaType=${item.type}&title=${encodeURIComponent(item.title)}&poster_path=${encodeURIComponent(item.poster || '')}&resume=${item.progress}`
    );
  }, []);

  const handleRemoveContinueWatching = async (id: string) => {
    await removeFromContinueWatching(id);
    loadContinueWatching();
  };

  // ─── Genre toggle ───
  const handleGenreToggle = useCallback((genre: string) => {
    const turningOff = filters.genre === genre;

    if (activeMode === 'category' || activeMode === 'typed') {
      setFilters(prev => ({ ...prev, genre: turningOff ? '' : genre }));
      return;
    }

    if (turningOff) {
      setFilters(prev => ({ ...prev, genre: '' }));
      resetToDiscover();
      return;
    }

    setFilters(prev => ({ ...prev, genre }));
    if (query.length > 0) {
      skipQueryEffectRef.current = true;
      setQuery('');
    }
    performSearch(genre.toLowerCase(), 'genre', genre, { genres: [genre] }, false);
  }, [filters.genre, activeMode, query, performSearch, resetToDiscover]);

  // ─── Filter toggle helpers ───
  const toggleLanguage = useCallback((code: string) => {
    setFilters(prev => ({ ...prev, language: prev.language === code ? '' : code }));
  }, []);

  const toggleCertification = useCallback((code: string) => {
    setFilters(prev => ({ ...prev, certification: prev.certification === code ? '' : code }));
  }, []);

  const toggleYearRange = useCallback((range: string) => {
    setFilters(prev => ({ ...prev, yearRange: prev.yearRange === range ? '' : range }));
  }, []);

  // ─── Render suggestions dropdown ───
  const renderSuggestions = () => {
    if (!showSuggestions || suggestions.length === 0) return null;

    return (
      <View style={[
        styles.suggestionsContainer,
        {
          backgroundColor: isDark ? 'rgba(30,30,30,0.95)' : 'rgba(255,255,255,0.95)',
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
        }
      ]}>
        <ScrollView 
          style={styles.suggestionsScroll}
          keyboardShouldPersistTaps="always"
        >
          {suggestions.map((suggestion, index) => (
            <TouchableOpacity
              key={`suggestion-${index}`}
              style={[
                styles.suggestionItem,
                index < suggestions.length - 1 && {
                  borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                  borderBottomWidth: 1,
                }
              ]}
              onPress={() => handleSuggestionPress(suggestion)}
              activeOpacity={0.7}
            >
              <Ionicons name="search-outline" size={16} color={colors.textMuted} />
              <Text style={[styles.suggestionText, { color: colors.text }]}>
                {suggestion}
              </Text>
            </TouchableOpacity>
          ))}
          
          {/* Recent searches in suggestions */}
          {searchHistory.length > 0 && (
            <>
              <View style={styles.suggestionDivider}>
                <Text style={[styles.suggestionDividerText, { color: colors.textMuted }]}>
                  Recent Searches
                </Text>
              </View>
              {searchHistory.slice(0, 5).map((historyItem, index) => (
                <TouchableOpacity
                  key={`history-${index}`}
                  style={[
                    styles.suggestionItem,
                    {
                      borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                      borderBottomWidth: 1,
                    }
                  ]}
                  onPress={() => handleHistoryItemPress(historyItem)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="time-outline" size={16} color={colors.textMuted} />
                  <Text style={[styles.suggestionText, { color: colors.text }]}>
                    {historyItem}
                  </Text>
                </TouchableOpacity>
              ))}
            </>
          )}
        </ScrollView>
      </View>
    );
  };

  // ─── Render Continue Watching row ───
  const renderContinueWatching = () => {
    if (continueWatching.length === 0) return null;

    return (
      <View style={styles.continueWatchingContainer}>
        <Text style={[styles.continueWatchingTitle, { color: colors.text }]}>
          Continue Watching
        </Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.continueWatchingScroll}
        >
          {continueWatching.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.continueWatchingCard}
              onPress={() => handleContinueWatchingPress(item)}
              onLongPress={() => handleRemoveContinueWatching(item.id)}
              activeOpacity={0.7}
            >
              <View style={styles.continueWatchingPosterContainer}>
                <Image
                  source={item.poster ? { uri: item.poster } : require('../../../assets/icon.png')}
                  style={styles.continueWatchingPoster}
                  resizeMode="cover"
                />
                <View style={styles.continueWatchingProgressContainer}>
                  <View style={[
                    styles.continueWatchingProgressBar,
                    { width: `${Math.min(item.progress * 100, 100)}%` }
                  ]} />
                </View>
                <View style={styles.continueWatchingOverlay}>
                  <Ionicons name="play-circle" size={32} color="white" />
                </View>
              </View>
              <Text style={[styles.continueWatchingTitleText, { color: colors.text }]} numberOfLines={1}>
                {item.title}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  // ─── Render filters ───
  const renderFilters = () => {
    const pillBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    const pillBorder = (active: boolean) => active ? colors.gold : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)');
    const pillText = (active: boolean) => active ? colors.gold : colors.textMuted;

    const renderRow = (
      label: string,
      items: { key: string; label: string; active: boolean; onPress: () => void }[]
    ) => (
      <View style={styles.filterRow} key={label}>
        <Text style={[styles.filterRowLabel, { color: colors.textMuted }]}>{label}:</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterRowScroll}
          contentContainerStyle={styles.filterRowScrollContent}
        >
          {items.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.filterOptionPill,
                { backgroundColor: pillBg, borderColor: pillBorder(item.active) }
              ]}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterOptionPillText, { color: pillText(item.active) }]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );

    const typeItems = (['movie', 'tv'] as const).map((type) => ({
      key: type,
      label: type.charAt(0).toUpperCase() + type.slice(1),
      active: filters.type === type,
      onPress: () => setFilters({ ...filters, type: filters.type === type ? 'all' : type }),
    }));

    const genreItems = availableGenres.map((genre) => ({
      key: genre,
      label: genre,
      active: filters.genre === genre,
      onPress: () => handleGenreToggle(genre),
    }));

    const yearItems = YEAR_OPTIONS.map((year) => ({
      key: year,
      label: year,
      active: filters.year === year,
      onPress: () => setFilters({ ...filters, year: filters.year === year ? '' : year }),
    }));

    const languageItems = LANGUAGE_OPTIONS.map((lang) => ({
      key: lang.code || 'all',
      label: lang.label,
      active: filters.language === lang.code,
      onPress: () => toggleLanguage(lang.code),
    }));

    const certificationItems = CERTIFICATION_OPTIONS.map((cert) => ({
      key: cert.code || 'all',
      label: cert.label,
      active: filters.certification === cert.code,
      onPress: () => toggleCertification(cert.code),
    }));

    const yearRangeItems = YEAR_RANGE_OPTIONS.map((range) => ({
      key: range,
      label: range,
      active: filters.yearRange === range,
      onPress: () => toggleYearRange(range),
    }));

    return (
      <View style={styles.filtersContainer}>
        {renderRow('Type', typeItems)}
        {renderRow('Genre', genreItems)}
        {renderRow('Language', languageItems)}
        {renderRow('Certification', certificationItems)}
        {renderRow('Year', yearItems)}
        {renderRow('Year Range', yearRangeItems)}
      </View>
    );
  };

  // ─── Render results tabs (All / Movies / TV) ───
  const renderResultsTabs = () => {
    const tabs: { key: 'all' | 'movie' | 'tv'; label: string }[] = [
      { key: 'all', label: 'All' },
      { key: 'movie', label: 'Movies' },
      { key: 'tv', label: 'TV Shows' },
    ];
    return (
      <View style={styles.tabsRow}>
        {tabs.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tabItem,
                active && { borderBottomColor: colors.gold, borderBottomWidth: 2 },
              ]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabItemText, { color: active ? colors.gold : colors.textMuted }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
        {/* People / Collections tabs are omitted — they need a cast/collection search
            endpoint that unifiedMediaService does not currently expose. */}

        {/* Sort control */}
        <TouchableOpacity
          style={styles.sortButton}
          onPress={() => setShowSortMenu((v) => !v)}
          activeOpacity={0.7}
        >
          <Ionicons name="swap-vertical-outline" size={14} color={colors.textMuted} />
          <Text style={[styles.sortButtonText, { color: colors.textMuted }]}>
            {SORT_OPTIONS.find((s) => s.key === sortBy)?.label}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ─── Render sort options dropdown ───
  const renderSortMenu = () => {
    if (!showSortMenu) return null;
    return (
      <View style={[
        styles.sortMenu,
        {
          backgroundColor: isDark ? 'rgba(30,30,30,0.98)' : 'rgba(255,255,255,0.98)',
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
        }
      ]}>
        {SORT_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.key}
            style={styles.sortMenuItem}
            onPress={() => { setSortBy(opt.key); setShowSortMenu(false); }}
            activeOpacity={0.7}
          >
            <Ionicons name={opt.icon as any} size={15} color={sortBy === opt.key ? colors.gold : colors.textMuted} />
            <Text style={[styles.sortMenuItemText, { color: sortBy === opt.key ? colors.gold : colors.text }]}>
              {opt.label}
            </Text>
            {sortBy === opt.key && <Ionicons name="checkmark" size={15} color={colors.gold} />}
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // ─── Recent searches as horizontal chips (not buried in a dropdown) ───
  const renderRecentSearchChips = () => {
    if (searchHistory.length === 0) return null;
    return (
      <View style={styles.recentChipsContainer}>
        <View style={styles.recentChipsHeader}>
          <Text style={[styles.recentChipsTitle, { color: colors.textMuted }]}>Recent</Text>
          <TouchableOpacity onPress={handleClearAllHistory}>
            <Text style={[styles.recentChipsClear, { color: colors.gold }]}>Clear all</Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.recentChipsScroll}
        >
          {searchHistory.map((historyItem, index) => (
            <TouchableOpacity
              key={`recent-chip-${index}`}
              style={[
                styles.recentChip,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                }
              ]}
              onPress={() => handleHistoryItemPress(historyItem)}
              activeOpacity={0.7}
            >
              <Ionicons name="time-outline" size={12} color={colors.textMuted} />
              <Text style={[styles.recentChipText, { color: colors.text }]} numberOfLines={1}>
                {historyItem}
              </Text>
              <TouchableOpacity
                onPress={() => handleRemoveHistoryItem(historyItem)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons name="close" size={12} color={colors.textMuted} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  // ─── Trending suggestion chips shown in the empty state ───
  const renderTrendingSuggestionChips = () => (
    <View style={styles.trendingChipsContainer}>
      {TRENDING_SUGGESTIONS.map((label) => (
        <TouchableOpacity
          key={label}
          style={[
            styles.trendingChip,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
            }
          ]}
          onPress={() => { setQuery(label); performSearch(label, 'typed', 'Searched Results', undefined, true); }}
          activeOpacity={0.7}
        >
          <Ionicons name="trending-up-outline" size={12} color={colors.gold} />
          <Text style={[styles.trendingChipText, { color: colors.text }]}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // ─── Render category cards ───
  const renderCategoryCards = () => (
    <View style={styles.categoryGrid}>
      {CATEGORY_CARDS.map((cat) => (
        <TouchableOpacity
          key={cat.label}
          style={[
            styles.categoryCard,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.5)',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            }
          ]}
          onPress={() => handleCategoryPress(cat)}
          activeOpacity={0.7}
        >
          <Ionicons name={cat.icon as any} size={14} color={colors.gold} />
          <Text style={[styles.categoryCardText, { color: colors.text }]} numberOfLines={1}>
            {cat.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // ─── Card renderers ───
  const renderGridCard = (item: IMetadataResult, rank?: number) => {
    const isBookmarked = watchlistIds.has(String(item.id));
    const runtimeLabel = (item as any).runtime
      ? `${Math.floor((item as any).runtime / 60)}h ${(item as any).runtime % 60}m`
      : null;
    const metaChips = [runtimeLabel, item.certification, item.year].filter(Boolean);

    return (
      <TouchableOpacity
        key={`${(item as any).source || 'default'}-${item.type}-${item.id}`}
        style={styles.trendingCard}
        onPress={() => handleItemPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.posterWrap}>
          <Image
            source={item.poster ? { uri: item.poster } : require('../../../assets/icon.png')}
            style={styles.trendingPoster}
            resizeMode="cover"
          />

          {/* Rank badge (Top 10 style) */}
          {rank != null && (
            <View style={styles.rankBadge}>
              <Text style={styles.rankBadgeText}>{rank}</Text>
            </View>
          )}

          {/* Rating badge, top-right */}
          {!!item.rating && (
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={9} color="#000" />
              <Text style={styles.ratingBadgeText}>{item.rating.toFixed(1)}</Text>
            </View>
          )}

          {/* HD / source quality tag, bottom-left */}
          <View style={styles.hdBadge}>
            <Text style={styles.hdBadgeText}>HD</Text>
          </View>

          {/* Inline watchlist toggle — add/remove without opening detail */}
          <TouchableOpacity
            style={styles.bookmarkButton}
            onPress={(e) => { e.stopPropagation?.(); handleToggleWatchlist(item); }}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons
              name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
              size={15}
              color={isBookmarked ? colors.gold : '#fff'}
            />
          </TouchableOpacity>
        </View>

        <Text style={[styles.trendingTitle, { color: colors.text }]} numberOfLines={1}>
          {item.title}
        </Text>

        {/* Metadata chip line: runtime • certification • year */}
        {metaChips.length > 0 && (
          <Text style={[styles.trendingMeta, { color: colors.textMuted }]} numberOfLines={1}>
            {metaChips.join(' • ')}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  const renderCardGrid = (items: IMetadataResult[], rankedTop10: boolean = false) => (
    <View style={styles.trendingGrid}>
      {items.map((item, index) => renderGridCard(item, rankedTop10 && index < 10 ? index + 1 : undefined))}
    </View>
  );

  const skeletonBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const renderSkeletonCard = (key: string) => (
    <Animated.View key={key} style={[styles.trendingCard, { opacity: skeletonPulse }]}>
      <View style={[styles.trendingPoster, { backgroundColor: skeletonBg }]} />
      <View style={[styles.skeletonTitleBar, { backgroundColor: skeletonBg }]} />
    </Animated.View>
  );

  const renderSkeletonGrid = (count: number = 12) => (
    <View style={styles.trendingGrid}>
      {Array.from({ length: count }).map((_, i) => renderSkeletonCard(`skeleton-${i}`))}
    </View>
  );

  // ─── Empty state ───
  const renderEmptyState = () => (
    <View style={styles.centerContent}>
      <View style={[
        styles.emptyIconContainer,
        {
          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
          borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
        }
      ]}>
        <Ionicons name="search-outline" size={48} color={colors.textMuted} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        Search Movies & TV Shows
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
        Find content from TMDB, MovieBox, and more
      </Text>
      {renderTrendingSuggestionChips()}
    </View>
  );

  // ─── No results state ───
  const renderNoResultsState = () => (
    <View style={styles.centerContent}>
      <View style={[
        styles.emptyIconContainer,
        {
          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
          borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
        }
      ]}>
        <Ionicons name="search-outline" size={48} color={colors.textMuted} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        No results found
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
        Try adjusting your search or filters
      </Text>
      <TouchableOpacity 
        style={[styles.clearFiltersButton, { borderColor: colors.gold }]}
        onPress={() => {
          setFilters({
            type: 'all',
            year: '',
            minRating: 0,
            source: 'all',
            genre: '',
            language: '',
            certification: '',
            yearRange: '',
          });
        }}
      >
        <Text style={[styles.clearFiltersText, { color: colors.gold }]}>
          Clear all filters
        </Text>
      </TouchableOpacity>

      {trendingItems.length > 0 && (
        <View style={styles.noResultsFallback}>
          <Text style={[styles.sectionTitle, { color: colors.text, paddingHorizontal: 0, marginTop: 0 }]}>
            You might like
          </Text>
          {renderCardGrid(trendingItems.slice(0, 8))}
        </View>
      )}
    </View>
  );

  const isDiscover = activeMode === 'discover';

  // ─── Main Render ───
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: 'transparent' }]}
      edges={['top']}
    >
      {/* Background */}
      {!isDark && (
        <LinearGradient
          colors={['#E8F0F8', '#D4E4F7', '#C8D8EF']}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      )}

      {isDark && (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000000' }]} />
      )}

      {/* Search Bar */}
      <View style={[
        styles.searchContainer,
        {
          backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.6)',
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.3)',
        }
      ]}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search movies, TV shows, and more..."
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          onFocus={() => {
            if (query.trim()) {
              setShowSuggestions(true);
            }
          }}
        />
        {isLoadingSuggestions && (
          <ActivityIndicator size="small" color={colors.gold} style={styles.suggestionLoader} />
        )}
        {query.length > 0 && (
          <TouchableOpacity onPress={handleClearQuery} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={17} color={colors.textMuted} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={handleVoiceSearch}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ marginLeft: 10 }}
        >
          <Ionicons name="mic-outline" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Search scope indicator while a search is in flight */}
      {loading && !isDiscover && (
        <Text style={[styles.searchScopeText, { color: colors.textMuted }]}>
          Searching TMDB · Kuryana · MovieBox…
        </Text>
      )}

      {/* Search Suggestions Dropdown */}
      {renderSuggestions()}

      {/* Continue Watching Row */}
      {isDiscover && renderContinueWatching()}

      {/* Recent searches as scrollable chips (discover mode only) */}
      {isDiscover && renderRecentSearchChips()}

      {/* Filters */}
      {renderFilters()}

      {/* Main Content */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.discoverContent}
        keyboardShouldPersistTaps="handled"
      >
        {renderCategoryCards()}

        {isDiscover ? (
          (trendingItems.length > 0 || preloadLoading) && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Popular Searches</Text>
              {preloadLoading && trendingItems.length === 0
                ? renderSkeletonGrid(8)
                : renderCardGrid(trendingItems, true)}
            </>
          )
        ) : (
          <>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{resultsTitle}</Text>
              {!loading && filteredResults.length > 0 && (
                <Text style={[styles.resultsCount, { color: colors.textMuted }]}>
                  {filteredResults.length} {filteredResults.length === 1 ? 'result' : 'results'}
                  {results.length !== filteredResults.length && ` (of ${results.length})`}
                </Text>
              )}
            </View>

            {/* Segmented result tabs + sort control */}
            {!loading && results.length > 0 && renderResultsTabs()}
            {!loading && results.length > 0 && renderSortMenu()}

            {loading
              ? renderSkeletonGrid(12)
              : (filteredResults.length > 0 ? renderCardGrid(filteredResults) : (noResults && renderNoResultsState()))}
          </>
        )}

        {isDiscover && !preloadLoading && searchHistory.length === 0 && trendingItems.length === 0 && (
          renderEmptyState()
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 4 : 2,
    borderWidth: 1,
    ...(Platform.OS === 'ios' && {
      backdropFilter: 'blur(20px)',
    }),
    position: 'relative',
    zIndex: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: Platform.OS === 'ios' ? 6 : 4,
    marginLeft: 8,
  },
  suggestionLoader: {
    marginRight: 8,
  },

  // ─── Suggestions Dropdown ───
  suggestionsContainer: {
    marginHorizontal: 16,
    marginTop: 4,
    borderRadius: 10,
    borderWidth: 1,
    maxHeight: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 20,
  },
  suggestionsScroll: {
    maxHeight: 300,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  suggestionText: {
    fontSize: 14,
    flex: 1,
  },
  suggestionDivider: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  suggestionDividerText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ─── Continue Watching ───
  continueWatchingContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  continueWatchingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  continueWatchingScroll: {
    gap: 10,
    paddingRight: 16,
  },
  continueWatchingCard: {
    width: 120,
  },
  continueWatchingPosterContainer: {
    position: 'relative',
    width: 120,
    height: 170,
    borderRadius: 8,
    overflow: 'hidden',
  },
  continueWatchingPoster: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  continueWatchingProgressContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  continueWatchingProgressBar: {
    height: '100%',
    backgroundColor: '#E8A838',
  },
  continueWatchingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  continueWatchingTitleText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
  },

  // ─── Filters ───
  filtersContainer: {
    paddingTop: 4,
    paddingBottom: 8,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    paddingLeft: 16,
  },
  filterRowLabel: {
    fontSize: 11,
    fontWeight: '700',
    width: 44,
  },
  filterRowScroll: {
    flex: 1,
  },
  filterRowScrollContent: {
    gap: 6,
    alignItems: 'center',
    paddingRight: 16,
  },
  filterOptionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  filterOptionPillText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // ─── Categories ───
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 8,
  },
  categoryCard: {
    width: (SCREEN_WIDTH - 16 * 2 - 8 * 2) / 3,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  categoryCardText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // ─── Content ───
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: 200,
  },
  discoverContent: {
    paddingBottom: 40,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 12,
  },
  resultsCount: {
    fontSize: 12,
    fontWeight: '500',
  },

  // ─── Grid ───
  trendingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: GRID_GAP,
  },
  trendingCard: {
    width: GRID_CARD_WIDTH,
    marginBottom: 16,
  },
  posterWrap: {
    position: 'relative',
  },
  trendingPoster: {
    width: GRID_CARD_WIDTH,
    height: GRID_CARD_HEIGHT,
    borderRadius: 8,
    backgroundColor: '#333',
  },
  trendingTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  trendingMeta: {
    fontSize: 10,
    marginTop: 2,
  },
  rankBadge: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    minWidth: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  rankBadgeText: {
    color: '#E8A838',
    fontSize: 12,
    fontWeight: '800',
  },
  ratingBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  ratingBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#000',
  },
  hdBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  hdBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fff',
  },
  bookmarkButton: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  skeletonTitleBar: {
    height: 11,
    borderRadius: 4,
    marginTop: 6,
    width: '70%',
  },

  // ─── Empty State ───
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  clearFiltersButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  clearFiltersText: {
    fontSize: 14,
    fontWeight: '600',
  },
  noResultsFallback: {
    width: '100%',
    alignSelf: 'stretch',
    marginTop: 24,
  },

  // ─── Results Tabs + Sort ───
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 4,
  },
  tabItem: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemText: {
    fontSize: 13,
    fontWeight: '700',
  },
  sortButton: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  sortButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sortMenu: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sortMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sortMenuItemText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },

  // ─── Recent Search Chips ───
  recentChipsContainer: {
    marginTop: 4,
    marginBottom: 8,
  },
  recentChipsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  recentChipsTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  recentChipsClear: {
    fontSize: 12,
    fontWeight: '600',
  },
  recentChipsScroll: {
    gap: 8,
    paddingHorizontal: 16,
  },
  recentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
  },
  recentChipText: {
    fontSize: 12,
    fontWeight: '500',
    maxWidth: 120,
  },

  // ─── Trending Suggestion Chips (empty state) ───
  trendingChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    paddingHorizontal: 10,
  },
  trendingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
  },
  trendingChipText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // ─── Search Scope Indicator ───
  searchScopeText: {
    fontSize: 11,
    paddingHorizontal: 16,
    marginBottom: 4,
    fontStyle: 'italic',
  },
});

export default SearchScreen;