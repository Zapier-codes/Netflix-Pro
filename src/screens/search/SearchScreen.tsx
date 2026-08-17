// src/screens/search/SearchScreen.tsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
import { useQuery } from '@tanstack/react-query';

// ─── Zustand Stores ───
import { useAppStore } from '../../store/zustand';
import { usePreloadedMediaStore } from '../../store/zustand';
import { useSearchAggregation } from '../../hooks/supabase/useSearchAggregation';
import { useTheme } from '../../contexts/ThemeContext';
import { useAlert } from '../../contexts/AlertContext';

// ─── Unified multi-source search engine ───
import { unifiedMediaService } from '../../services/unified/UnifiedMediaService';
import { IMetadataResult, DiscoverFilters } from '../../services/unified/types/MetadataTypes';

// ─── MavinEngine for search suggestions ───
import MavinEngine from '../../../modules/mavin-engine';

// Utils
import { saveSearchQuery, getSearchHistory, removeSearchQuery, clearSearchHistory } from '../../utils/storage';
import { getContinueWatching, saveContinueWatching, removeFromContinueWatching, ContinueWatchingItem } from '../../utils/continueWatching';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// TMDB CDN prefix
const TMDB_POSTER_PREFIX = 'https://image.tmdb.org/t/p/w500';

// ─── Grid Layout (4-up) ───
const GRID_GAP = 8;
const GRID_CARD_WIDTH = (SCREEN_WIDTH - 16 * 2 - GRID_GAP * 3) / 4;
const GRID_CARD_HEIGHT = GRID_CARD_WIDTH * 1.5;

// ─── Paged 4x3 results grid ───
const GRID_COLUMNS = 4;
const GRID_ROWS = 3;
const ITEMS_PER_PAGE = GRID_COLUMNS * GRID_ROWS;
const GRID_CARD_TEXT_HEIGHT = 6 + 16 + 2 + 13 + 16;
const GRID_ROW_HEIGHT = GRID_CARD_HEIGHT + GRID_CARD_TEXT_HEIGHT;
const GRID_PAGE_HEIGHT = GRID_ROW_HEIGHT * GRID_ROWS;

function chunkIntoPages<T>(items: T[], pageSize: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += pageSize) {
    pages.push(items.slice(i, i + pageSize));
  }
  return pages;
}

const toRawPosterPath = (fullPosterUrl?: string): string => {
  if (!fullPosterUrl) return '';
  return fullPosterUrl.startsWith(TMDB_POSTER_PREFIX)
    ? fullPosterUrl.slice(TMDB_POSTER_PREFIX.length)
    : fullPosterUrl;
};

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
      return arr.sort((a, b) => {
        const popA = (a as any).popularity ?? (a.rating || 0);
        const popB = (b as any).popularity ?? (b.rating || 0);
        return popB - popA;
      });
  }
};

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

const TRENDING_SUGGESTIONS = [
  'Marvel', 'Korean Drama', 'Action 2024', 'Anime', 'True Crime', 'Comedy',
];

interface SearchFilters {
  type: 'all' | 'movie' | 'tv';
  year: string;
  minRating: number;
  source: 'all' | 'tmdb' | 'kuryana' | 'moviebox' | 'consumet';
  genres: string[];
  languages: string[];
  certifications: string[];
  yearRange: string;
  contentCategory: 'all' | 'cartoon';
}

type ActiveMode = 'discover' | 'typed' | 'category' | 'genre';

const CATEGORY_CARDS: { 
  label: string; 
  icon: string; 
  filters: Partial<DiscoverFilters>;
  sources?: string[];
}[] = [
  { 
    label: 'Hollywood', 
    icon: 'film-outline',
    filters: { languages: ['en'], countries: ['US'], type: 'movie' }
  },
  { 
    label: 'Bollywood', 
    icon: 'film-outline',
    filters: { languages: ['hi', 'bn', 'te', 'ta', 'ml'], countries: ['IN'], type: 'movie' }
  },
  { 
    label: 'Nollywood', 
    icon: 'film-outline',
    filters: { languages: ['en', 'yo', 'ig', 'ha'], countries: ['NG'], type: 'movie' }
  },
  { 
    label: 'Anime', 
    icon: 'sparkles-outline',
    filters: { languages: ['ja'], countries: ['JP'], genres: ['Animation', 'Anime'] },
    sources: ['tmdb', 'consumet'],
  },
  {
    label: 'Cartoons',
    icon: 'happy-outline',
    filters: { genres: ['Animation'], excludeLanguages: ['ja'] } as Partial<DiscoverFilters>,
    sources: ['tmdb'],
  },
  { 
    label: 'Asian', 
    icon: 'globe-outline',
    filters: {
      languages: ['ko', 'zh', 'cn'],
      countries: ['KR', 'CN', 'TW', 'HK'],
      genres: ['Drama'],
      type: 'tv',
    },
    sources: ['kuryana', 'consumet', 'tmdb'],
  },
];

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS: string[] = Array.from({ length: 12 }, (_, i) => String(currentYear - i));
const YEAR_RANGE_OPTIONS: string[] = ['2020-2024', '2010-2019', '2000-2009', '1990-1999', 'Pre-1990'];

const parseYearRange = (range: string): { startYear?: number; endYear?: number } => {
  if (!range) return {};
  if (range === 'Pre-1990') return { endYear: 1989 };
  const [start, end] = range.split('-').map(Number);
  if (start && end) return { startYear: start, endYear: end };
  return {};
};

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

// ─── Genre name to TMDB ID mapping ───
const GENRE_NAME_TO_ID: Record<string, number> = {
  'Action': 28,
  'Adventure': 12,
  'Animation': 16,
  'Comedy': 35,
  'Crime': 80,
  'Documentary': 99,
  'Drama': 18,
  'Family': 10751,
  'Fantasy': 14,
  'Horror': 27,
  'Mystery': 9648,
  'Romance': 10749,
  'Sci-Fi': 878,
  'Thriller': 53,
  'War': 10752,
  'Western': 37,
  'History': 36,
  'Music': 10402,
  'TV Movie': 10770,
  // TV-specific
  'Action & Adventure': 10759,
  'Kids': 10762,
  'News': 10763,
  'Reality': 10764,
  'Sci-Fi & Fantasy': 10765,
  'Soap': 10766,
  'Talk': 10767,
  'War & Politics': 10768,
};

// ─── Deduplicate results ───
const deduplicateResults = (items: IMetadataResult[]): IMetadataResult[] => {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = `${item.source || 'unknown'}-${item.type}-${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/**
 * Helper: Get genre IDs from item
 * Normalizes genres to numeric IDs for navigation
 */
const getGenreIds = (item: IMetadataResult): number[] => {
  if (!item.genres || item.genres.length === 0) return [];
  
  // If genres are already numbers, return them
  if (typeof item.genres[0] === 'number') {
    return item.genres as number[];
  }
  
  // If genres are strings, they're either numeric-ID strings ("28") or
  // human-readable names ("Action"). Check numeric FIRST — this branch was
  // previously unreachable because the name-lookup branch ran first and
  // always returned, silently dropping any numeric-string genre as 0.
  if (typeof item.genres[0] === 'string') {
    if (/^\d+$/.test(item.genres[0] as string)) {
      return (item.genres as string[]).map((id) => parseInt(id, 10)).filter(id => id > 0);
    }
    return (item.genres as string[])
      .map((name) => GENRE_NAME_TO_ID[name] || 0)
      .filter(id => id > 0);
  }
  
  return [];
};

/**
 * Helper: Filter seasons for display
 * Excludes season 0 (specials), seasons without air dates, and specials
 */
const filterDisplaySeasons = (seasons: any[]): number[] => {
  if (!seasons || !Array.isArray(seasons)) return [];
  
  return seasons
    .filter((season: any) => {
      // EXCLUDE season 0 (specials)
      if (season.season_number === 0) return false;
      // EXCLUDE seasons with no air date
      if (!season.air_date) return false;
      // EXCLUDE seasons marked as type 'special'
      if (season.type && season.type === 'special') return false;
      return true;
    })
    .map((season: any) => season.season_number)
    .sort((a: number, b: number) => a - b);
};

// ─── Number of TV shows to preload details for ───
const PRELOAD_TV_DETAILS_COUNT = 20;
const PRELOAD_STREAMS_COUNT = 10;

const SearchScreen = () => {
  const { colors, isDark } = useTheme();
  const { showToast } = useAlert();
  const { networkStatus } = useAppStore();

  // ─── Zustand Preloaded Store ───
  const {
    allItems,
    categories,
    setAllItems,
    setCategories,
    getRandomItems,
    getItemById,
    initialized: preloadInitialized,
    isLoading: preloadLoading,
    error: preloadError,
    setLoading: setPreloadLoading,
    setInitialized: setPreloadInitialized,
    setError: setPreloadError,
    setLastFetchedAt,
    // ─── NEW: Preloaded data actions ───
    setPreloadedTVDetails,
    setPreloadedStreams,
    setPreloadedSeason,
    batchPreloadTVDetails,
    batchPreloadStreams,
    batchPreloadSeasons,
    hasPreloadedTVDetails,
    hasPreloadedStreams,
    setLastStreamPreloadAt,
  } = usePreloadedMediaStore();

  const { recordSearch: recordSearchToSupabase } = useSearchAggregation();

  const [query, setQuery] = useState('');

  const [activeMode, setActiveMode] = useState<ActiveMode>('discover');
  const [resultsTitle, setResultsTitle] = useState('Popular Searches');

  const [activeCategoryLabel, setActiveCategoryLabel] = useState<string | null>(null);

  const loaderSweep1 = useRef(new Animated.Value(0)).current;
  const loaderSweep2 = useRef(new Animated.Value(0)).current;

  const [results, setResults] = useState<IMetadataResult[]>([]);
  const [filteredResults, setFilteredResults] = useState<IMetadataResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  const [continueWatching, setContinueWatching] = useState<ContinueWatchingItem[]>([]);

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  const [sortBy, setSortBy] = useState<SortOption>('popularity');
  const [showSortMenu, setShowSortMenu] = useState(false);

  const [activeTab, setActiveTab] = useState<'all' | 'movie' | 'tv'>('all');

  const [watchlistIds, setWatchlistIds] = useState<Set<string>>(new Set());

  const [filters, setFilters] = useState<SearchFilters>({
    type: 'all',
    year: '',
    minRating: 0,
    source: 'all',
    genres: [],
    languages: [],
    certifications: [],
    yearRange: '',
    contentCategory: 'all',
  });

  const [availableGenres] = useState<string[]>([
    'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary',
    'Drama', 'Family', 'Fantasy', 'Horror', 'Mystery', 'Romance',
    'Sci-Fi', 'Thriller', 'War', 'Western',
    'Wuxia', 'Xianxia', 'Historical', 'Period', 'Martial Arts',
    'Sageuk', 'Melodrama', 'Slice of Life', 'School', 'Youth',
  ]);

  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  const suggestionsTimeout = useRef<NodeJS.Timeout | null>(null);
  const isMounted = useRef(true);
  const engineInitialized = useRef(false);

  const filtersRef = useRef(filters);
  useEffect(() => { filtersRef.current = filters; }, [filters]);

  const sortByRef = useRef(sortBy);
  useEffect(() => { sortByRef.current = sortBy; }, [sortBy]);

  const activeSearchQueryRef = useRef('');
  const activeModeRef = useRef<ActiveMode>('discover');
  const activeTitleRef = useRef('Popular Searches');
  const activeFiltersRef = useRef<Partial<DiscoverFilters>>({});

  const skipQueryEffectRef = useRef(false);
  // Guards the filters-watching effect below (isFirstTypeRender) from firing a
  // *second*, redundant search when a handler (e.g. handleGenreToggle) already
  // triggers performTextSearch/performDiscover/resetToDiscover directly in the
  // same update as a filters.* change.
  const skipFiltersEffectRef = useRef(false);

  const skeletonPulse = useRef(new Animated.Value(0.45)).current;

  const loadContinueWatching = useCallback(async () => {
    const items = await getContinueWatching();
    if (isMounted.current) {
      setContinueWatching(items);
    }
  }, []);

  const loadSearchHistory = useCallback(async () => {
    const history = await getSearchHistory();
    if (isMounted.current) {
      setSearchHistory(history);
    }
  }, []);

  // ─── ENHANCED: TanStack Query for preloading ───
  const { data: preloadedData, isLoading: isPreloading, refetch: refetchPreload } = useQuery({
    queryKey: ['preloadedMedia', 'all'],
    queryFn: async () => {
      console.log('[Preloader] 🔄 Fetching preloaded media...');
      setPreloadLoading(true);
      
      try {
        await unifiedMediaService.initialize();
        
        // ─── Step 1: Fetch all categories in parallel ───
        const [trending, popular, topRated, anime, movies, tvShows] = await Promise.all([
          unifiedMediaService.getTrending(30),
          unifiedMediaService.discover({ sortBy: 'popularity.desc', type: 'movie' }, 30),
          unifiedMediaService.discover({ sortBy: 'vote_average.desc', type: 'movie' }, 30),
          unifiedMediaService.discover({ 
            genres: ['Animation', 'Anime'], 
            languages: ['ja'], 
            type: 'tv' 
          }, 30),
          unifiedMediaService.discover({ type: 'movie' }, 30),
          unifiedMediaService.discover({ type: 'tv' }, 30),
        ]);
        
        // Combine all items for the main pool
        const allItems = [...trending, ...popular, ...topRated, ...anime, ...movies, ...tvShows];
        
        // Deduplicate by ID and source
        const uniqueItems = deduplicateResults(allItems);
        
        console.log(`[Preloader] ✅ Fetched ${uniqueItems.length} unique items`);
        console.log(`[Preloader] 📊 Trending: ${trending.length}, Popular: ${popular.length}, Top Rated: ${topRated.length}, Anime: ${anime.length}, Movies: ${movies.length}, TV: ${tvShows.length}`);
        
        // Store in Zustand
        setAllItems(uniqueItems);
        setCategories({
          trending,
          popular,
          topRated,
          anime,
          movies,
          tvShows,
          koreanDramas: [],
          bollywood: [],
        });
        
        // ─── Step 2: Preload TV details with seasons ───
        console.log('[Preloader] 📡 Preloading TV details with seasons...');
        const tvItems = tvShows.filter((item: any) => item.id);
        const tvItemsToPreload = tvItems.slice(0, PRELOAD_TV_DETAILS_COUNT);
        
        const tvDetailsPromises = tvItemsToPreload.map(async (item: any) => {
          try {
            const details = await unifiedMediaService.getById(item.id, 'tv');
            if (details) {
              const displaySeasons = details.displaySeasons || filterDisplaySeasons(details.seasons || []);
              return {
                id: details.id,
                title: details.title,
                numberOfSeasons: details.numberOfSeasons || 0,
                numberOfEpisodes: details.numberOfEpisodes || 0,
                seasons: details.seasons || [],
                displaySeasons: displaySeasons,
                lastAirDate: details.lastAirDate,
                inProduction: details.inProduction,
                status: details.status,
                networks: details.networks,
              };
            }
            return null;
          } catch (error) {
            console.warn(`[Preloader] ⚠️ Failed to preload TV details for ${item.id}:`, error);
            return null;
          }
        });
        
        const tvDetailsResults = await Promise.all(tvDetailsPromises);
        const validTVDetails = tvDetailsResults.filter((d): d is any => d !== null);
        
        if (validTVDetails.length > 0) {
          batchPreloadTVDetails(validTVDetails);
          console.log(`[Preloader] ✅ Preloaded ${validTVDetails.length} TV details with seasons`);
          
          // ─── Step 3: Preload season data for first season of each TV show ───
          console.log('[Preloader] 📡 Preloading season 1 data...');
          const seasonPromises = validTVDetails.map(async (detail) => {
            try {
              if (detail.displaySeasons && detail.displaySeasons.length > 0) {
                const seasonNum = detail.displaySeasons[0];
                const seasonData = await unifiedMediaService.getSeasonDetails?.(parseInt(detail.id), seasonNum);
                if (seasonData && seasonData.episodes) {
                  return {
                    tvId: detail.id,
                    seasonNumber: seasonNum,
                    episodes: seasonData.episodes,
                    episodeCount: seasonData.episodes.length,
                    airDate: seasonData.air_date,
                    name: seasonData.name,
                    overview: seasonData.overview,
                  };
                }
              }
              return null;
            } catch (error) {
              console.warn(`[Preloader] ⚠️ Failed to preload season for ${detail.id}:`, error);
              return null;
            }
          });
          
          const seasonResults = await Promise.all(seasonPromises);
          const validSeasons = seasonResults.filter((s): s is any => s !== null);
          
          if (validSeasons.length > 0) {
            batchPreloadSeasons(validSeasons);
            console.log(`[Preloader] ✅ Preloaded ${validSeasons.length} season 1 data`);
          }
        }
        
        // ─── Step 4: Pre-extract streams for popular content ───
        console.log('[Preloader] ⚡ Pre-extracting streams...');
        const allPopularItems = [...trending, ...popular, ...movies, ...tvShows];
        const itemsToPreloadStreams = allPopularItems.slice(0, PRELOAD_STREAMS_COUNT);
        
        const streamPromises = itemsToPreloadStreams.map(async (item: any) => {
          try {
            const isTV = item.type === 'tv' || item.media_type === 'tv';
            const streams = await unifiedMediaService.preloadStreams?.(
              item.id,
              isTV ? 'tv' : 'movie',
              isTV ? 1 : undefined,
              isTV ? 1 : undefined
            );
            
            if (streams && streams.length > 0) {
              const qualities = streams.map(s => s.quality).filter(Boolean) as string[];
              const uniqueQualities = Array.from(new Set(qualities));
              
              return {
                id: item.id,
                type: isTV ? 'tv' : 'movie',
                season: isTV ? 1 : undefined,
                episode: isTV ? 1 : undefined,
                streams: streams,
                qualities: uniqueQualities,
                extractedAt: new Date().toISOString(),
              };
            }
            return null;
          } catch (error) {
            console.warn(`[Preloader] ⚠️ Failed to preload streams for ${item.id}:`, error);
            return null;
          }
        });
        
        const streamResults = await Promise.all(streamPromises);
        const validStreams = streamResults.filter((s): s is any => s !== null);
        
        if (validStreams.length > 0) {
          batchPreloadStreams(validStreams);
          setLastStreamPreloadAt(new Date().toISOString());
          console.log(`[Preloader] ✅ Pre-extracted streams for ${validStreams.length} items`);
        }
        
        setPreloadInitialized(true);
        setLastFetchedAt(new Date().toISOString());
        
        console.log('[Preloader] 🎯 Preload complete!');
        
        return { 
          all: uniqueItems, 
          trending, 
          popular, 
          topRated, 
          anime, 
          movies, 
          tvShows,
          tvDetails: validTVDetails,
          streams: validStreams,
        };
      } catch (error) {
        console.error('[Preloader] ❌ Failed to preload:', error);
        setPreloadError(error instanceof Error ? error.message : 'Failed to preload');
        throw error;
      } finally {
        setPreloadLoading(false);
      }
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 2,
    enabled: !preloadInitialized, // Only run if not initialized
  });

  // ─── Get random 12 items for display ───
  const displayItems = useMemo(() => {
    if (!preloadInitialized || allItems.length === 0) return [];
    // Get 12 random items from the pool - different every render
    return getRandomItems(ITEMS_PER_PAGE, 'all');
  }, [preloadInitialized, allItems, getRandomItems]);

  const isGridLoading = loading || (activeMode === 'discover' && (isPreloading || preloadLoading) && displayItems.length === 0);
  
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

  useEffect(() => {
    if (!engineInitialized.current) {
      unifiedMediaService.initialize().catch((err) =>
        console.error('[Search] Failed to initialize unified media service:', err)
      );
      engineInitialized.current = true;
    }
  }, []);

  const resetToDiscover = useCallback(() => {
    activeSearchQueryRef.current = '';
    activeModeRef.current = 'discover';
    activeTitleRef.current = 'Popular Searches';
    activeFiltersRef.current = {};
    setActiveMode('discover');
    setActiveCategoryLabel(null);
    setResultsTitle('Popular Searches');
    setResults([]);
    setFilteredResults([]);
    setNoResults(false);
    setShowSuggestions(false);
    setSuggestions([]);
    loadSearchHistory();
    loadContinueWatching();
  }, [loadSearchHistory, loadContinueWatching]);

  const performDiscover = useCallback(async (
    categoryFilters: Partial<DiscoverFilters>,
    title: string,
    label: string
  ) => {
    console.log(`[Discover] 🎯 ===== STARTING DISCOVER =====`);
    console.log(`[Discover] 📋 Category: "${title}"`);
    console.log(`[Discover] 📋 Label: "${label}"`);
    console.log(`[Discover] 📋 Filters:`, JSON.stringify(categoryFilters, null, 2));
    
    if (!categoryFilters || Object.keys(categoryFilters).length === 0) {
      console.log('[Discover] ⚠️ No filters provided — resetting to discover');
      resetToDiscover();
      return;
    }

    activeSearchQueryRef.current = '';
    activeModeRef.current = 'category';
    activeTitleRef.current = title;
    activeFiltersRef.current = categoryFilters;

    setLoading(true);
    setNoResults(false);
    setActiveMode('category');
    setResultsTitle(title);
    setActiveCategoryLabel(label);
    setShowSuggestions(false);

    try {
      console.log('[Discover] 🔧 Ensuring UnifiedMediaService is initialized...');
      await unifiedMediaService.initialize();
      console.log('[Discover] ✅ UnifiedMediaService is ready');

      const activeUIFilters = filtersRef.current;
      const activeYearRange = parseYearRange(activeUIFilters.yearRange);
      const parsedYear = activeUIFilters.year ? parseInt(activeUIFilters.year, 10) : undefined;

      const discoverFilters: DiscoverFilters = {
        ...categoryFilters,
        type: (activeUIFilters.type !== 'all'
          ? activeUIFilters.type
          : (categoryFilters.type as 'movie' | 'tv' | 'all') || 'all'),
        limit: 100,
        sortBy: 'popularity.desc',
        ...(parsedYear && !isNaN(parsedYear) ? { year: parsedYear } : {}),
        ...activeYearRange,
        ...(activeUIFilters.genres.length > 0 ? { genres: activeUIFilters.genres } : {}),
        ...(activeUIFilters.languages.length > 0 ? { languages: activeUIFilters.languages } : {}),
        ...(activeUIFilters.certifications.length > 0 ? { certifications: activeUIFilters.certifications } : {}),
        ...(activeUIFilters.minRating ? { minRating: activeUIFilters.minRating } : {}),
        ...(activeUIFilters.contentCategory === 'cartoon'
          ? {
              genres: ['Animation'],
              excludeLanguages: Array.from(
                new Set([...(categoryFilters as any).excludeLanguages || [], 'ja'])
              ),
            } as Partial<DiscoverFilters>
          : {}),
      };

      console.log(`[Discover] 🔄 Calling unifiedMediaService.discover() with filters:`, JSON.stringify(discoverFilters, null, 2));
      
      const searchResults = await unifiedMediaService.discover(discoverFilters);

      console.log(`[Discover] 📥 Received ${searchResults.length} results from discover`);

      if (!isMounted.current) {
        console.log('[Discover] ⚠️ Component unmounted — ignoring results');
        return;
      }

      const sourceGroups: Record<string, number> = {};
      searchResults.forEach((item: any) => {
        const source = item.source || 'unknown';
        sourceGroups[source] = (sourceGroups[source] || 0) + 1;
      });
      console.log(`[Discover] 📊 Results by source:`, sourceGroups);

      const resultsWithFallbackPosters = searchResults.map(item => {
        if (!item.poster) {
          const cover = (item as any).cover;
          const image = (item as any).image;
          const thumbnail = (item as any).thumbnail;
          const backdrop = item.backdrop;
          
          const fallbackPoster = cover || image || thumbnail || backdrop || '';
          
          return {
            ...item,
            poster: fallbackPoster || 'https://via.placeholder.com/300x450/1a1a2e/ffffff?text=No+Image',
            _originalSource: item.source,
          };
        }
        return item;
      });

      setResults(resultsWithFallbackPosters);

      const sorted = sortResults(resultsWithFallbackPosters, sortByRef.current);
      console.log(`[Discover] 📊 After sorting: ${sorted.length} results`);

      setFilteredResults(sorted);
      setNoResults(sorted.length === 0);

      if (sorted.length === 0) {
        console.log(`[Discover] ❌ NO RESULTS for "${title}"`);
      } else {
        console.log(`[Discover] ✅ Found ${sorted.length} results for "${title}"`);
      }
    } catch (error) {
      console.error('[Discover] ❌ Error during discover:', error);
      if (error instanceof Error) {
        console.error('[Discover] ❌ Error name:', error.name);
        console.error('[Discover] ❌ Error message:', error.message);
        console.error('[Discover] ❌ Error stack:', error.stack);
      }
      setResults([]);
      setFilteredResults([]);
      setNoResults(true);
      showToast('Failed to load content. Please try again.');
    } finally {
      if (isMounted.current) {
        setLoading(false);
        console.log(`[Discover] 🏁 Discover completed for "${title}"`);
        console.log(`[Discover] 🎯 ===== DISCOVER COMPLETE =====`);
      }
    }
  }, [showToast, resetToDiscover]);

  const performTextSearch = useCallback(async (
    searchQuery: string,
    title: string,
    saveToHistory: boolean = true
  ) => {
    const trimmedQuery = searchQuery.trim();
    
    console.log(`[Search] 🔍 ===== STARTING TEXT SEARCH =====`);
    console.log(`[Search] 📋 Query: "${trimmedQuery}"`);
    console.log(`[Search] 📋 Title: "${title}"`);
    
    if (!trimmedQuery) {
      console.log('[Search] ⚠️ Empty query — resetting to discover');
      resetToDiscover();
      return;
    }

    activeSearchQueryRef.current = trimmedQuery;
    activeModeRef.current = 'typed';
    activeTitleRef.current = title;
    activeFiltersRef.current = {};

    setLoading(true);
    setNoResults(false);
    setActiveMode('typed');
    setResultsTitle(title);
    setActiveCategoryLabel(null);
    setShowSuggestions(false);

    try {
      console.log('[Search] 🔧 Ensuring UnifiedMediaService is initialized...');
      await unifiedMediaService.initialize();
      console.log('[Search] ✅ UnifiedMediaService is ready');

      const currentFilters = filtersRef.current;
      
      const searchOptions: any = {
        query: trimmedQuery,
        limit: 50,
      };

      if (currentFilters.type !== 'all') {
        searchOptions.type = currentFilters.type;
      }

      if (currentFilters.languages.length > 0) {
        searchOptions.language = currentFilters.languages[0];
      }

      if (currentFilters.certifications.length > 0) {
        searchOptions.certification = currentFilters.certifications[0];
      }

      if (currentFilters.year) {
        searchOptions.year = parseInt(currentFilters.year);
      }

      if (currentFilters.yearRange) {
        const { startYear, endYear } = parseYearRange(currentFilters.yearRange);
        if (startYear !== undefined) searchOptions.startYear = startYear;
        if (endYear !== undefined) searchOptions.endYear = endYear;
      }

      if (currentFilters.minRating > 0) {
        searchOptions.minRating = currentFilters.minRating;
      }

      if (currentFilters.genres.length > 0) {
        searchOptions.genres = currentFilters.genres;
      }

      if (currentFilters.source !== 'all') {
        searchOptions.source = currentFilters.source;
      }

      if (currentFilters.contentCategory === 'cartoon') {
        searchOptions.genres = ['Animation'];
        searchOptions.excludeLanguages = Array.from(
          new Set([...(searchOptions.excludeLanguages || []), 'ja'])
        );
      }

      console.log(`[Search] 📤 Calling unifiedMediaService.search() with options:`, JSON.stringify(searchOptions, null, 2));

      const searchResults = await unifiedMediaService.search(searchOptions);

      console.log(`[Search] 📥 Received ${searchResults.length} results from search`);

      if (!isMounted.current) {
        console.log('[Search] ⚠️ Component unmounted — ignoring results');
        return;
      }

      const resultsWithFallbackPosters = searchResults.map(item => {
        if (!item.poster) {
          const cover = (item as any).cover;
          const image = (item as any).image;
          const thumbnail = (item as any).thumbnail;
          const backdrop = item.backdrop;
          
          const fallbackPoster = cover || image || thumbnail || backdrop || '';
          
          return {
            ...item,
            poster: fallbackPoster || 'https://via.placeholder.com/300x450/1a1a2e/ffffff?text=No+Image',
            _originalSource: item.source,
          };
        }
        return item;
      });

      setResults(resultsWithFallbackPosters);

      const sorted = sortResults(resultsWithFallbackPosters, sortByRef.current);
      console.log(`[Search] 📊 After sorting: ${sorted.length} results`);

      setFilteredResults(sorted);
      setNoResults(sorted.length === 0);

      if (saveToHistory && sorted.length > 0) {
        console.log(`[Search] 💾 Saving to search history: "${trimmedQuery}"`);
        await saveSearchQuery(trimmedQuery);
        loadSearchHistory();
        recordSearchToSupabase(trimmedQuery);
      }
    } catch (error) {
      console.error('[Search] ❌ Error during search:', error);
      if (error instanceof Error) {
        console.error('[Search] ❌ Error name:', error.name);
        console.error('[Search] ❌ Error message:', error.message);
        console.error('[Search] ❌ Error stack:', error.stack);
      }
      setResults([]);
      setFilteredResults([]);
      setNoResults(true);
      showToast('Search failed. Please try again.');
    } finally {
      if (isMounted.current) {
        setLoading(false);
        console.log(`[Search] 🏁 Search completed for "${trimmedQuery}"`);
        console.log(`[Search] 🔍 ===== SEARCH COMPLETE =====`);
      }
    }
  }, [loadSearchHistory, recordSearchToSupabase, showToast, resetToDiscover]);

  // ─── Debounced search suggestions using MavinEngine ───
  useEffect(() => {
    if (skipQueryEffectRef.current) {
      skipQueryEffectRef.current = false;
      return;
    }

    if (!query.trim() || activeMode !== 'discover') {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    if (suggestionsTimeout.current) {
      clearTimeout(suggestionsTimeout.current);
    }

    setIsLoadingSuggestions(true);
    suggestionsTimeout.current = setTimeout(async () => {
      try {
        console.log(`[Suggestions] 🔍 Fetching suggestions for: "${query}"`);
        const result = await MavinEngine.getSearchSuggestions(query, 0);
        if (result && result.suggestions) {
          const suggestionList = result.suggestions.slice(0, 6);
          console.log(`[Suggestions] ✅ Received ${suggestionList.length} suggestions:`, suggestionList);
          setSuggestions(suggestionList);
          setShowSuggestions(suggestionList.length > 0);
        } else {
          console.log('[Suggestions] ⚠️ No suggestions returned');
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } catch (error) {
        console.error('[Suggestions] ❌ Error fetching suggestions:', error);
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setIsLoadingSuggestions(false);
      }
    }, 200);

    return () => {
      if (suggestionsTimeout.current) {
        clearTimeout(suggestionsTimeout.current);
      }
    };
  }, [query, activeMode]);

  // ─── Debounced text search execution ───
  useEffect(() => {
    if (skipQueryEffectRef.current) {
      skipQueryEffectRef.current = false;
      return;
    }

    if (!query.trim()) {
      resetToDiscover();
      return;
    }

    setShowSuggestions(false);
    setSuggestions([]);

    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    debounceTimeout.current = setTimeout(() => {
      performTextSearch(query, 'Searched Results', false);
    }, 600);

    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, [query, performTextSearch, resetToDiscover]);

  useEffect(() => {
    if (results.length > 0) {
      const tabFiltered = activeTab === 'all'
        ? results
        : results.filter((item) => item.type === activeTab);
      const sorted = sortResults(tabFiltered, sortBy);
      setFilteredResults(sorted);
      setNoResults(sorted.length === 0);
    }
  }, [results, sortBy, activeTab]);

  useEffect(() => {
    const isActiveSearch = loading && activeMode !== 'discover';
    if (!isActiveSearch) return;

    loaderSweep1.setValue(0);
    loaderSweep2.setValue(0);

    const makeSweep = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 1300,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );

    const sweep1 = makeSweep(loaderSweep1, 0);
    const sweep2 = makeSweep(loaderSweep2, 650);
    sweep1.start();
    sweep2.start();

    return () => {
      sweep1.stop();
      sweep2.stop();
    };
  }, [loading, activeMode, loaderSweep1, loaderSweep2]);

  const isFirstTypeRender = useRef(true);
  useEffect(() => {
    if (isFirstTypeRender.current) {
      isFirstTypeRender.current = false;
      return;
    }
    if (skipFiltersEffectRef.current) {
      skipFiltersEffectRef.current = false;
      return;
    }
    if (activeSearchQueryRef.current) {
      performTextSearch(activeSearchQueryRef.current, activeTitleRef.current, false);
    } else if (Object.keys(activeFiltersRef.current).length > 0) {
      performDiscover(activeFiltersRef.current, activeTitleRef.current, activeCategoryLabel || 'Category');
    }
  }, [
    filters.type,
    filters.year,
    filters.yearRange,
    filters.genres,
    filters.languages,
    filters.certifications,
    filters.minRating,
    filters.contentCategory,
    performTextSearch,
    performDiscover,
  ]);

  useFocusEffect(
    useCallback(() => {
      isMounted.current = true;
      loadSearchHistory();
      loadContinueWatching();
      getWatchlistIds().then((ids) => { if (isMounted.current) setWatchlistIds(ids); });
      return () => { isMounted.current = false; };
    }, [loadSearchHistory, loadContinueWatching])
  );

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

  /**
   * ─── ENHANCED: Pass ALL metadata to DetailsScreen ───
   * v2.1 - Added displaySeasons support for TV shows
   * - For TV shows, fetches full details to get seasons data
   * - Passes displaySeasons to DetailsScreen for season pills
   * - Checks preloaded store first for instant data
   */
  const handleItemPress = useCallback(async (item: IMetadataResult) => {
    const rawPosterPath = toRawPosterPath(item.poster);
    const ratingValue = item.rating || (item as any).vote_average || 0;
    const voteCount = (item as any).vote_count || (item as any).voteCount || 0;
    const year = item.year || '';
    const overview = item.overview || '';
    const backdrop = item.backdrop || '';
    const runtime = (item as any).runtime || '';
    const certification = item.certification || '';
    const tagline = (item as any).tagline || '';
    const status = (item as any).status || '';
    const releaseDate = item.releaseDate || '';
    const popularity = (item as any).popularity || 0;
    const originalLanguage = (item as any).originalLanguage || '';
    const originCountry = (item as any).originCountry || [];
    const lastAirDate = (item as any).lastAirDate || '';
    const inProduction = (item as any).inProduction || false;
    const networks = (item as any).networks || [];
    const budget = (item as any).budget || 0;
    const revenue = (item as any).revenue || 0;
    const productionCompanies = (item as any).productionCompanies || [];
    const productionCountries = (item as any).productionCountries || [];
    const spokenLanguages = (item as any).spokenLanguages || [];
    const watchProviders = (item as any).watchProviders || [];
    const keywords = (item as any).keywords || [];
    const belongsToCollection = (item as any).belongsToCollection || null;
    const cast = (item as any).cast || [];
    const isTVShow = item.type === 'tv';
    
    // ─── Get genre IDs for navigation ───
    const genreIds = getGenreIds(item);
    
    // ─── Get season data - Check preloaded store first ───
    let numberOfSeasons = (item as any).numberOfSeasons || 0;
    let numberOfEpisodes = (item as any).numberOfEpisodes || 0;
    let displaySeasons: number[] = [];
    let fullSeasons: any[] = [];
    
    if (isTVShow) {
      // ─── NEW: Check preloaded store first ───
      const preloadedTVDetails = hasPreloadedTVDetails(item.id) 
        ? usePreloadedMediaStore.getState().getPreloadedTVDetails(item.id)
        : null;
      
      if (preloadedTVDetails) {
        // Use preloaded data instantly
        numberOfSeasons = preloadedTVDetails.numberOfSeasons || 0;
        numberOfEpisodes = preloadedTVDetails.numberOfEpisodes || 0;
        displaySeasons = preloadedTVDetails.displaySeasons || [];
        fullSeasons = preloadedTVDetails.seasons || [];
        console.log(`[Search] ⚡ Using preloaded TV details for "${item.title}"`);
        console.log(`[Search] 📊 Display seasons: [${displaySeasons.join(', ')}]`);
      } else {
        // Fallback: fetch on demand
        try {
          console.log(`[Search] 📡 Fetching TV details for: "${item.title}"`);
          const tvDetails = await unifiedMediaService.getById(item.id, 'tv');
          
          if (tvDetails) {
            numberOfSeasons = tvDetails.numberOfSeasons || 0;
            numberOfEpisodes = tvDetails.numberOfEpisodes || 0;
            fullSeasons = tvDetails.seasons || [];
            displaySeasons = tvDetails.displaySeasons || filterDisplaySeasons(fullSeasons);
            
            console.log(`[Search] 📊 Found ${numberOfSeasons} seasons, display: [${displaySeasons.join(', ')}]`);
          }
        } catch (error) {
          console.error('[Search] ❌ Failed to fetch TV details:', error);
          numberOfSeasons = (item as any).numberOfSeasons || 0;
          numberOfEpisodes = (item as any).numberOfEpisodes || 0;
          displaySeasons = (item as any).displaySeasons || [];
        }
      }
    }
    
    console.log(`[Search] 📤 Navigating to details for: "${item.title}"`);
    console.log(`[Search] 📤 ID: ${item.id}, Type: ${item.type}`);
    console.log(`[Search] 📤 Year: ${year}, Rating: ${ratingValue}, Votes: ${voteCount}`);
    if (isTVShow) {
      console.log(`[Search] 📤 Seasons: ${numberOfSeasons}, Display: [${displaySeasons.join(', ')}]`);
    }
    
    // Build comprehensive URL params
    const params = new URLSearchParams();
    params.set('mediaType', item.type);
    params.set('title', item.title);
    params.set('poster_path', rawPosterPath);
    params.set('rating', String(ratingValue));
    params.set('year', year);
    params.set('overview', overview);
    params.set('genres', JSON.stringify(genreIds));
    params.set('backdrop', backdrop);
    params.set('vote_count', String(voteCount));
    params.set('runtime', runtime);
    params.set('certification', certification);
    params.set('tagline', tagline);
    params.set('status', status);
    params.set('release_date', releaseDate);
    params.set('popularity', String(popularity));
    params.set('original_language', originalLanguage);
    params.set('origin_country', JSON.stringify(originCountry));
    params.set('number_of_seasons', String(numberOfSeasons));
    params.set('number_of_episodes', String(numberOfEpisodes));
    params.set('display_seasons', JSON.stringify(displaySeasons));
    params.set('last_air_date', lastAirDate);
    params.set('in_production', String(inProduction));
    params.set('networks', JSON.stringify(networks));
    params.set('budget', String(budget));
    params.set('revenue', String(revenue));
    params.set('production_companies', JSON.stringify(productionCompanies));
    params.set('production_countries', JSON.stringify(productionCountries));
    params.set('spoken_languages', JSON.stringify(spokenLanguages));
    params.set('watch_providers', JSON.stringify(watchProviders));
    params.set('keywords', JSON.stringify(keywords));
    params.set('belongs_to_collection', JSON.stringify(belongsToCollection));
    params.set('cast', JSON.stringify(cast));
    
    router.push(`/movie/${item.id}?${params.toString()}`);
  }, []);

  const handleSuggestionPress = useCallback((suggestion: string) => {
    console.log(`[Suggestion] 🔍 Selected suggestion: "${suggestion}"`);
    skipQueryEffectRef.current = true;
    setQuery(suggestion);
    setShowSuggestions(false);
    setSuggestions([]);
    performTextSearch(suggestion, 'Searched Results', true);
    Keyboard.dismiss();
  }, [performTextSearch]);

  const handleHistoryItemPress = useCallback((historyQuery: string) => {
    console.log(`[History] 🔍 Selected history item: "${historyQuery}"`);
    skipQueryEffectRef.current = true;
    setQuery(historyQuery);
    setShowSuggestions(false);
    setSuggestions([]);
    performTextSearch(historyQuery, 'Searched Results', true);
    Keyboard.dismiss();
  }, [performTextSearch]);

  const handleRemoveHistoryItem = async (historyQuery: string) => {
    console.log(`[History] 🗑️ Removing history item: "${historyQuery}"`);
    await removeSearchQuery(historyQuery);
    loadSearchHistory();
  };

  const handleClearAllHistory = async () => {
    console.log('[History] 🗑️ Clearing all search history');
    await clearSearchHistory();
    loadSearchHistory();
    showToast('Search history cleared');
  };

  const handleVoiceSearch = () => {
    console.log('[Voice] 🎤 Voice search triggered');
    showToast('Voice search needs a speech-to-text module wired in — tap to type for now');
  };

  const handleClearQuery = () => {
    console.log('[Search] 🧹 Clearing search query');
    skipQueryEffectRef.current = true;
    setQuery('');
    setShowSuggestions(false);
    setSuggestions([]);
    resetToDiscover();
  };

  const handleCategoryPress = useCallback((cat: typeof CATEGORY_CARDS[0]) => {
    console.log(`[Category] 🏷️ ===== CATEGORY PRESSED: "${cat.label}" =====`);
    console.log(`[Category] 📋 Filters:`, JSON.stringify(cat.filters, null, 2));
    
    Keyboard.dismiss();
    setShowSuggestions(false);
    setSuggestions([]);

    if (query.length > 0) {
      console.log(`[Category] 🧹 Clearing existing query: "${query}"`);
      skipQueryEffectRef.current = true;
      setQuery('');
    }

    if (activeCategoryLabel === cat.label) {
      console.log(`[Category] 🏷️ Deselecting category: "${cat.label}" — returning to discover`);
      setActiveCategoryLabel(null);
      resetToDiscover();
      return;
    }

    console.log(`[Category] 🏷️ Category pressed: "${cat.label}" — using DISCOVER mode (NO text search)`);
    setActiveCategoryLabel(cat.label);
    performDiscover(
      (cat.sources ? { ...cat.filters, sources: cat.sources } : cat.filters) as Partial<DiscoverFilters>,
      cat.label,
      cat.label
    );
  }, [query, activeCategoryLabel, performDiscover, resetToDiscover]);

  const handleContinueWatchingPress = useCallback((item: ContinueWatchingItem) => {
    console.log(`[ContinueWatching] ▶️ Resuming: "${item.title}" at ${item.progress * 100}%`);
    router.push(
      `/movie/${item.id}?mediaType=${item.type}&title=${encodeURIComponent(item.title)}&poster_path=${encodeURIComponent(item.poster || '')}&resume=${item.progress}`
    );
  }, []);

  const handleRemoveContinueWatching = async (id: string) => {
    console.log(`[ContinueWatching] 🗑️ Removing from continue watching: ${id}`);
    await removeFromContinueWatching(id);
    loadContinueWatching();
  };

  const handleGenreToggle = useCallback((genre: string) => {
    const turningOff = filters.genres.includes(genre);
    console.log(`[Genre] 🏷️ Toggling genre: "${genre}" (turning ${turningOff ? 'OFF' : 'ON'})`);

    if (activeMode === 'category' || activeMode === 'typed') {
      setFilters(prev => ({
        ...prev,
        genres: turningOff ? prev.genres.filter(g => g !== genre) : [...prev.genres, genre],
      }));
      return;
    }

    if (turningOff) {
      const remaining = filters.genres.filter(g => g !== genre);
      skipFiltersEffectRef.current = true;
      setFilters(prev => ({ ...prev, genres: remaining }));
      if (remaining.length === 0) {
        resetToDiscover();
        return;
      }
      if (query.length > 0) {
        skipQueryEffectRef.current = true;
        setQuery('');
      }
      performTextSearch(remaining.join(' ').toLowerCase(), remaining.join(', '), false);
      return;
    }

    const nextGenres = [...filters.genres, genre];
    skipFiltersEffectRef.current = true;
    setFilters(prev => ({ ...prev, genres: nextGenres }));
    if (query.length > 0) {
      skipQueryEffectRef.current = true;
      setQuery('');
    }
    performTextSearch(nextGenres.join(' ').toLowerCase(), nextGenres.join(', '), false);
  }, [filters.genres, activeMode, query, performTextSearch, resetToDiscover]);

  const toggleLanguage = useCallback((code: string) => {
    console.log(`[Filter] 🌐 Toggling language: "${code}"`);
    if (!code) {
      setFilters(prev => ({ ...prev, languages: [] }));
      return;
    }
    setFilters(prev => ({
      ...prev,
      languages: prev.languages.includes(code)
        ? prev.languages.filter(l => l !== code)
        : [...prev.languages, code],
    }));
  }, []);

  const toggleCertification = useCallback((code: string) => {
    console.log(`[Filter] 🎫 Toggling certification: "${code}"`);
    if (!code) {
      setFilters(prev => ({ ...prev, certifications: [] }));
      return;
    }
    setFilters(prev => ({
      ...prev,
      certifications: prev.certifications.includes(code)
        ? prev.certifications.filter(c => c !== code)
        : [...prev.certifications, code],
    }));
  }, []);

  const toggleYearRange = useCallback((range: string) => {
    console.log(`[Filter] 📅 Toggling year range: "${range}"`);
    setFilters(prev => ({ ...prev, yearRange: prev.yearRange === range ? '' : range }));
  }, []);

  // ─── Suggestions Bar ───
  const renderSuggestions = () => {
    if (!showSuggestions || suggestions.length === 0 || !query.trim() || activeMode !== 'discover') return null;

    return (
      <View
        style={[
          styles.suggestionsBar,
          {
            backgroundColor: isDark ? 'rgba(20,20,20,0.7)' : 'rgba(255,255,255,0.7)',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          }
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.suggestionsScrollContent}
          keyboardShouldPersistTaps="always"
        >
          {isLoadingSuggestions ? (
            <View style={styles.suggestionsLoading}>
              <ActivityIndicator size="small" color={colors.gold} />
              <Text style={[styles.suggestionsLoadingText, { color: colors.textMuted }]}>Loading...</Text>
            </View>
          ) : (
            suggestions.map((suggestion, index) => (
              <TouchableOpacity
                key={`suggestion-${suggestion}-${index}`}
                style={[
                  styles.suggestionChip,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
                    borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  }
                ]}
                onPress={() => handleSuggestionPress(suggestion)}
                activeOpacity={0.7}
              >
                <Ionicons name="search-outline" size={12} color={colors.textMuted} />
                <Text style={[styles.suggestionChipText, { color: colors.text }]} numberOfLines={1}>
                  {suggestion}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>
    );
  };

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

    const typeItems: { key: string; label: string; active: boolean; onPress: () => void }[] = [
      ...(['movie', 'tv'] as const).map((type) => ({
        key: type,
        label: type.charAt(0).toUpperCase() + type.slice(1),
        active: filters.type === type,
        onPress: () => setFilters({ ...filters, type: filters.type === type ? 'all' : type }),
      })),
      {
        key: 'cartoon',
        label: 'Cartoons',
        active: filters.contentCategory === 'cartoon',
        onPress: () => setFilters({
          ...filters,
          contentCategory: filters.contentCategory === 'cartoon' ? 'all' : 'cartoon',
        }),
      },
    ];

    const genreItems = availableGenres.map((genre) => ({
      key: genre,
      label: genre,
      active: filters.genres.includes(genre),
      onPress: () => handleGenreToggle(genre),
    }));

    const yearItems = YEAR_OPTIONS.map((year) => ({
      key: year,
      label: year,
      active: filters.year === year,
      onPress: () => setFilters({ ...filters, year: filters.year === year ? '' : year }),
    }));

    return (
      <View style={styles.filtersContainer}>
        {renderRow('Type', typeItems)}
        {renderRow('Genre', genreItems)}
        {renderRow('Year', yearItems)}
      </View>
    );
  };

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

        {!loading && filteredResults.length > 0 && (
          <View style={styles.resultsCountBadge}>
            <Ionicons name="albums-outline" size={13} color={colors.textMuted} />
            <Text style={[styles.resultsCountBadgeText, { color: colors.textMuted }]}>
              {filteredResults.length}
            </Text>
          </View>
        )}

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

        {renderSortMenu()}
      </View>
    );
  };

  const renderSortMenu = () => {
    if (!showSortMenu) return null;
    return (
      <LinearGradient
        colors={
          isDark
            ? ['rgba(35,35,35,0.6)', 'rgba(20,20,20,0.5)']
            : ['rgba(255,255,255,0.65)', 'rgba(255,255,255,0.45)']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[
          styles.sortMenu,
          { borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)' }
        ]}
      >
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
            {sortBy === opt.key && <Ionicons name="checkmark" size={14} color={colors.gold} style={{ marginLeft: 6 }} />}
          </TouchableOpacity>
        ))}
      </LinearGradient>
    );
  };

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
          onPress={() => { setQuery(label); performTextSearch(label, 'Searched Results', true); }}
          activeOpacity={0.7}
        >
          <Ionicons name="trending-up-outline" size={12} color={colors.gold} />
          <Text style={[styles.trendingChipText, { color: colors.text }]}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderSearchLoadingBar = () => {
    const trackWidth = SCREEN_WIDTH - 32;
    const segmentWidth = trackWidth * 0.45;

    const translateFor = (anim: Animated.Value) =>
      anim.interpolate({
        inputRange: [0, 1],
        outputRange: [-segmentWidth, trackWidth],
      });

    return (
      <View
        style={[
          styles.loadingBarTrack,
          { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(97,0,238,0.12)' },
        ]}
      >
        <Animated.View
          style={[
            styles.loadingBarSegment,
            { width: segmentWidth, transform: [{ translateX: translateFor(loaderSweep1) }] },
          ]}
        >
          <LinearGradient
            colors={['transparent', colors.gold, 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.loadingBarSegment,
            { width: segmentWidth, transform: [{ translateX: translateFor(loaderSweep2) }] },
          ]}
        >
          <LinearGradient
            colors={['transparent', colors.gold, 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>
      </View>
    );
  };

  const renderCategoryCards = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.categoryScrollContent}
      style={styles.categoryScroll}
    >
      {CATEGORY_CARDS.map((cat) => {
        const isActive = activeCategoryLabel === cat.label;
        return (
          <TouchableOpacity
            key={cat.label}
            style={[
              styles.categoryCard,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.5)',
                borderColor: isActive
                  ? colors.gold
                  : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
                borderWidth: isActive ? 1.5 : 1,
              }
            ]}
            onPress={() => handleCategoryPress(cat)}
            activeOpacity={0.7}
          >
            <Ionicons name={cat.icon as any} size={12} color={colors.gold} />
            <Text
              style={[
                styles.categoryCardText,
                { color: colors.text },
              ]}
              numberOfLines={1}
            >
              {cat.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

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

          {rank != null && (
            <View style={styles.rankBadge}>
              <Text style={styles.rankBadgeText}>{rank}</Text>
            </View>
          )}

          {!!item.rating && (
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={9} color="#000" />
              <Text style={styles.ratingBadgeText}>{item.rating.toFixed(1)}</Text>
            </View>
          )}

          <View style={styles.hdBadge}>
            <Text style={styles.hdBadgeText}>HD</Text>
          </View>

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

  const renderPagedCardGrid = (items: IMetadataResult[], rankedTop10: boolean = false) => {
    const pages = chunkIntoPages(items, ITEMS_PER_PAGE);
    if (pages.length === 0) return null;

    return (
      <FlatList
        data={pages}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, pageIndex) => `results-page-${pageIndex}`}
        initialNumToRender={2}
        windowSize={3}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
        renderItem={({ item: pageItems, index: pageIndex }) => (
          <View style={{ width: SCREEN_WIDTH, minHeight: GRID_PAGE_HEIGHT }}>
            <View style={styles.trendingGrid}>
              {pageItems.map((item, i) =>
                renderGridCard(
                  item,
                  rankedTop10 && pageIndex === 0 && i < 10 ? i + 1 : undefined
                )
              )}
            </View>
          </View>
        )}
      />
    );
  };

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
        Find content from TMDB, Kuryana, MovieBox, and Consumet
      </Text>
      {renderTrendingSuggestionChips()}
    </View>
  );

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
        No results found for "{activeSearchQueryRef.current || activeTitleRef.current}"
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
            genres: [],
            languages: [],
            certifications: [],
            yearRange: '',
            contentCategory: 'all',
          });
          resetToDiscover();
        }}
      >
        <Text style={[styles.clearFiltersText, { color: colors.gold }]}>
          Clear all filters
        </Text>
      </TouchableOpacity>

      {displayItems.length > 0 && (
        <View style={styles.noResultsFallback}>
          <Text style={[styles.sectionTitle, { color: colors.text, paddingHorizontal: 0, marginTop: 0 }]}>
            You might like
          </Text>
          {renderCardGrid(displayItems.slice(0, 8))}
        </View>
      )}
    </View>
  );

  const isDiscover = activeMode === 'discover';

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
          placeholder="Search movies, TV shows, anime, and more..."
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          onFocus={() => {
            if (query.trim() && activeMode === 'discover') {
              setShowSuggestions(true);
            }
          }}
          onSubmitEditing={() => {
            if (query.trim()) {
              setShowSuggestions(false);
              setSuggestions([]);
              performTextSearch(query, 'Searched Results', true);
              Keyboard.dismiss();
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

      {/* Suggestions Bar */}
      {renderSuggestions()}

      {/* Search progress indicator */}
      {loading && !isDiscover && renderSearchLoadingBar()}

      {/* Continue Watching Row */}
      {isDiscover && renderContinueWatching()}

      {/* Recent searches as scrollable chips */}
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
          (displayItems.length > 0 || isPreloading || preloadLoading) && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Popular Searches</Text>
              {(isPreloading || preloadLoading) && displayItems.length === 0
                ? renderSkeletonGrid(ITEMS_PER_PAGE)
                : renderCardGrid(displayItems, true)}
            </>
          )
        ) : (
          <>
            {!loading && results.length > 0 && renderResultsTabs()}

            {loading
              ? renderSkeletonGrid(12)
              : (filteredResults.length > 0 ? renderPagedCardGrid(filteredResults) : (noResults && renderNoResultsState()))}
          </>
        )}

        {isDiscover && !isPreloading && !preloadLoading && searchHistory.length === 0 && displayItems.length === 0 && (
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
    borderRadius: 9,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === 'ios' ? 2 : 0,
    height: 38,
    borderWidth: 1,
    ...(Platform.OS === 'ios' && {
      backdropFilter: 'blur(20px)',
    }),
    position: 'relative',
    zIndex: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
    marginLeft: 8,
  },
  suggestionLoader: {
    marginRight: 8,
  },
  loadingBarTrack: {
    height: 3,
    borderRadius: 2,
    marginHorizontal: 16,
    marginTop: 2,
    marginBottom: 6,
    overflow: 'hidden',
  },
  loadingBarSegment: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
  },

  // ─── Suggestions Bar ───
  suggestionsBar: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 4,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 4,
    minHeight: 40,
    ...(Platform.OS === 'ios' && {
      backdropFilter: 'blur(20px)',
    }),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    zIndex: 20,
  },
  suggestionsScrollContent: {
    paddingHorizontal: 4,
    alignItems: 'center',
    gap: 8,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
  },
  suggestionChipText: {
    fontSize: 13,
    fontWeight: '500',
    maxWidth: 150,
  },
  suggestionsLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  suggestionsLoadingText: {
    fontSize: 12,
    fontWeight: '500',
  },

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

  categoryScroll: {
    marginTop: 8,
  },
  categoryScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryCard: {
    height: 28,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  categoryCardText: {
    fontSize: 11,
    fontWeight: '600',
  },

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
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 12,
  },

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

  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 4,
    position: 'relative',
    zIndex: 10,
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
  resultsCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  resultsCountBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sortButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sortMenu: {
    position: 'absolute',
    top: 40,
    right: 16,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'flex-start',
    zIndex: 50,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  sortMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignSelf: 'stretch',
  },
  sortMenuItemText: {
    fontSize: 13,
    fontWeight: '600',
  },

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
});

export default SearchScreen;