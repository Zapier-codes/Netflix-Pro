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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

// Zustand Stores
import { useAppStore } from '../../store/zustand';
import { useSearchPreloader } from '../../hooks/content/useSearchPreloader';
import { useSearchAggregation } from '../../hooks/supabase/useSearchAggregation';
import { useTheme } from '../../contexts/ThemeContext';
import { useAlert } from '../../contexts/AlertContext';

// ─── Unified multi-source search engine (TMDB + Kuryana + MovieBox) ───
import { unifiedMediaService } from '../../services/unified/UnifiedMediaService';
import { IMetadataResult } from '../../services/unified/types/MetadataTypes';

// Utils
import { saveSearchQuery, getSearchHistory, removeSearchQuery, clearSearchHistory } from '../../utils/storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// TMDB CDN prefix used by the rest of the app
const TMDB_POSTER_PREFIX = 'https://image.tmdb.org/t/p/w500';

// ─── Grid Layout (4-up) — shared by "Popular Searches" AND every active
// ─── result set (typed search / category tap / genre-only browse). Only
// ─── the heading above the grid changes; the card layout never does.
const GRID_GAP = 8;
const GRID_CARD_WIDTH = (SCREEN_WIDTH - 16 * 2 - GRID_GAP * 3) / 4;
const GRID_CARD_HEIGHT = GRID_CARD_WIDTH * 1.5;

const toRawPosterPath = (fullPosterUrl?: string): string => {
  if (!fullPosterUrl) return '';
  return fullPosterUrl.startsWith(TMDB_POSTER_PREFIX)
    ? fullPosterUrl.slice(TMDB_POSTER_PREFIX.length)
    : fullPosterUrl;
};

// ─── Sort helper: newest → oldest. Used everywhere an active result set is
// ─── shown. A specific year filter naturally collapses everything to one
// ─── year, so this becomes a no-op in that case — which is the desired
// ─── behavior ("latest always prioritized except user specifically
// ─── selects a year").
const sortNewestFirst = (items: IMetadataResult[]): IMetadataResult[] => {
  return [...items].sort((a, b) => (b.year || 0) - (a.year || 0));
};

// ─── Filter Types ───
interface SearchFilters {
  type: 'all' | 'movie' | 'tv';
  year: string;
  minRating: number;
  source: 'all' | 'tmdb' | 'kuryana' | 'moviebox';
  genre: string;
}

// ─── What is currently driving the grid ───
// 'discover' -> nothing active, show trending "Popular Searches"
// 'typed'    -> user is typing in the search bar
// 'category' -> user tapped a category card (Hollywood, Bollywood, etc.)
// 'genre'    -> user tapped a genre pill with no category/typed search active,
//               so the genre itself becomes the primary browse query
type ActiveMode = 'discover' | 'typed' | 'category' | 'genre';

// ─── Category Cards (2x3 grid) ───
// Tapping one runs it through the same unified search() pipeline as typing a
// query — it's an approximation (text-match against these keywords), not a
// true language/origin filter, since none of the providers expose that field.
const CATEGORY_CARDS: { label: string; query: string; icon: string }[] = [
  { label: 'Hollywood', query: 'hollywood', icon: 'film-outline' },
  { label: 'Bollywood', query: 'bollywood', icon: 'film-outline' },
  { label: 'Nollywood', query: 'nollywood', icon: 'film-outline' },
  { label: 'Anime', query: 'anime', icon: 'sparkles-outline' },
  { label: 'K-Drama', query: 'korean drama', icon: 'tv-outline' },
  { label: 'Chinese', query: 'chinese drama', icon: 'globe-outline' },
];

// ─── Year options shown in the Year filter row ───
const currentYear = new Date().getFullYear();
const YEAR_OPTIONS: string[] = Array.from({ length: 12 }, (_, i) => String(currentYear - i));

// ─── Category -> real classification signals (language / origin country /
// ─── keywords), NOT literal title text. The underlying search API only
// ─── does full-text matching, so sending it "hollywood" as a query returns
// ─── anything with the word "Hollywood" in the title (e.g. "Hollywood
// ─── Ending") — that's wrong, categories aren't titles. We still send the
// ─── keyword to get a candidate pool (no dedicated discover/browse-by-
// ─── region endpoint is confirmed on unifiedMediaService), but then filter
// ─── that pool down to items whose actual metadata matches the category.
// ─── Field names are best-effort (TMDB-style) via defensive `as any` reads
// ─── since MetadataTypes isn't visible here — tighten these once you
// ─── confirm the exact field names in services/unified/types/MetadataTypes.
const CATEGORY_MATCHERS: Record<string, { languages?: string[]; countries?: string[]; keywords?: string[] }> = {
  hollywood: { languages: ['en'], countries: ['US'] },
  bollywood: { languages: ['hi'], countries: ['IN'] },
  nollywood: { languages: ['en', 'yo', 'ig', 'ha'], countries: ['NG'] },
  anime: { languages: ['ja'], keywords: ['anime'] },
  'korean drama': { languages: ['ko'], countries: ['KR'] },
  'chinese drama': { languages: ['zh', 'cn'], countries: ['CN'] },
};

const applyCategoryMatch = (items: IMetadataResult[], categoryQuery: string): IMetadataResult[] => {
  const matcher = CATEGORY_MATCHERS[categoryQuery.toLowerCase()];
  if (!matcher) return items;

  const matched = items.filter((item) => {
    const anyItem = item as any;
    const lang = String(anyItem.originalLanguage || anyItem.original_language || '').toLowerCase();
    const countryRaw = anyItem.originCountry || anyItem.origin_country || anyItem.country || [];
    const countryList: string[] = (Array.isArray(countryRaw) ? countryRaw : [countryRaw])
      .filter(Boolean)
      .map((c: string) => String(c).toUpperCase());
    const keywordList: string[] = (anyItem.keywords || anyItem.tags || [])
      .filter(Boolean)
      .map((k: string) => String(k).toLowerCase());

    const langMatch = !!matcher.languages && matcher.languages.includes(lang);
    const countryMatch = !!matcher.countries && matcher.countries.some((c) => countryList.includes(c));
    const keywordMatch = !!matcher.keywords && matcher.keywords.some((k) => keywordList.includes(k));

    return langMatch || countryMatch || keywordMatch;
  });

  // If none of the providers populated language/country/keyword data for
  // this batch, fall back to the raw keyword results rather than showing an
  // empty grid — partial signal is better than nothing, but real matches
  // always win when they exist.
  return matched.length > 0 ? matched : items;
};

const SearchScreen = () => {
  const { colors, isDark } = useTheme();
  const { showToast } = useAlert();
  const { networkStatus } = useAppStore();

  const { trendingItems, loading: preloadLoading } = useSearchPreloader();
  const { recordSearch: recordSearchToSupabase } = useSearchAggregation();

  // ─── Search bar text — ONLY reflects what the user typed. Category taps
  // ─── and genre-only browsing never write into this. ───
  const [query, setQuery] = useState('');

  // ─── What's currently driving the grid, and what heading to show above it ───
  const [activeMode, setActiveMode] = useState<ActiveMode>('discover');
  const [resultsTitle, setResultsTitle] = useState('Popular Searches');

  const [results, setResults] = useState<IMetadataResult[]>([]);
  const [filteredResults, setFilteredResults] = useState<IMetadataResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  // ─── Filter State — persists across mode switches (typed <-> category <->
  // ─── genre) until the user explicitly changes it. ───
  const [filters, setFilters] = useState<SearchFilters>({
    type: 'all',
    year: '',
    minRating: 0,
    source: 'all',
    genre: '',
  });

  const [availableGenres] = useState<string[]>([
    'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary',
    'Drama', 'Family', 'Fantasy', 'Horror', 'Mystery', 'Romance',
    'Sci-Fi', 'Thriller', 'War', 'Western',
  ]);

  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  const isMounted = useRef(true);
  const engineInitialized = useRef(false);

  // ─── Keeps latest filters readable inside performSearch without having to
  // ─── recreate that callback (and re-trigger effects) on every filter tweak.
  const filtersRef = useRef(filters);
  useEffect(() => { filtersRef.current = filters; }, [filters]);

  // ─── Tracks whatever text query is actually driving the current result
  // ─── set (typed text, category keyword, or genre keyword) so we can
  // ─── re-fetch with the same query when `type` changes (it's a real API
  // ─── param, not something we can just re-filter client-side).
  const activeSearchQueryRef = useRef('');
  const activeModeRef = useRef<ActiveMode>('discover');
  const activeTitleRef = useRef('Popular Searches');

  // ─── Set to true right before programmatically clearing `query` from a
  // ─── non-typing action (category tap, genre-only tap, clear button) so
  // ─── the debounced-search effect below ignores that particular change.
  const skipQueryEffectRef = useRef(false);

  // ─── Recent searches auto-scrolling ticker ───
  const tickerScrollX = useRef(new Animated.Value(0)).current;
  const [tickerSetWidth, setTickerSetWidth] = useState(0);

  // ─── Skeleton pulse — drives every skeleton card's opacity while a grid
  // ─── section is loading. One shared driver instead of one timer per card.
  const skeletonPulse = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    if (tickerSetWidth <= 0) return;
    tickerScrollX.setValue(0);
    const loop = Animated.loop(
      Animated.timing(tickerScrollX, {
        toValue: -tickerSetWidth,
        duration: tickerSetWidth * 25,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [tickerSetWidth, tickerScrollX]);

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

  // ─── Ensure the unified media engine is ready ───
  useEffect(() => {
    if (!engineInitialized.current) {
      unifiedMediaService.initialize().catch((err) =>
        console.error('[Search] Failed to initialize unified media service:', err)
      );
      engineInitialized.current = true;
    }
  }, []);

  // Load search history
  const loadSearchHistory = useCallback(async () => {
    const history = await getSearchHistory();
    if (isMounted.current) {
      setSearchHistory(history);
    }
  }, []);

  // ─── Apply filters to results (client-side, against whatever is
  // ─── currently loaded for the active mode) ───
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

    return filtered;
  }, []);

  // ─── Reset the grid back to the default "Popular Searches" / discover view ───
  const resetToDiscover = useCallback(() => {
    activeSearchQueryRef.current = '';
    activeModeRef.current = 'discover';
    activeTitleRef.current = 'Popular Searches';
    setActiveMode('discover');
    setResultsTitle('Popular Searches');
    setResults([]);
    setFilteredResults([]);
    setNoResults(false);
    loadSearchHistory();
  }, [loadSearchHistory]);

  // ─── Perform a search across all sources and show it in the grid.
  // ─── `mode` + `title` control the heading shown above the grid:
  //   - 'typed'    -> "Searched Results"
  //   - 'category' -> the category label, e.g. "Hollywood"
  //   - 'genre'    -> the genre label, e.g. "Action" (only used when no
  //                    category/typed search is currently active)
  const performSearch = useCallback(async (
    searchQuery: string,
    mode: Exclude<ActiveMode, 'discover'>,
    title: string,
    saveToHistory: boolean = true
  ) => {
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) {
      resetToDiscover();
      return;
    }

    activeSearchQueryRef.current = trimmedQuery;
    activeModeRef.current = mode;
    activeTitleRef.current = title;

    setLoading(true);
    setNoResults(false);
    setActiveMode(mode);
    setResultsTitle(title);

    try {
      const currentFilters = filtersRef.current;
      const searchOptions: any = {
        query: trimmedQuery,
        limit: 50,
      };

      if (currentFilters.type !== 'all') {
        searchOptions.type = currentFilters.type;
      }

      const searchResults = await unifiedMediaService.search(searchOptions);
      if (!isMounted.current) return;

      const sourceCounts: Record<string, number> = {};
      searchResults.forEach(r => {
        const source = (r as any).source || 'unknown';
        sourceCounts[source] = (sourceCounts[source] || 0) + 1;
      });
      console.log('📊 Search results by source:', sourceCounts);

      let withPosters = searchResults.filter((item) => !!item.poster);
      if (mode === 'category') {
        withPosters = applyCategoryMatch(withPosters, trimmedQuery);
      }
      setResults(withPosters);

      const applied = applyFilters(withPosters, currentFilters);
      const sorted = sortNewestFirst(applied);
      setFilteredResults(sorted);
      setNoResults(sorted.length === 0);

      // Only genuine typed searches get saved to search history — category
      // and genre-only browsing have their own dedicated UI already.
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

  // ─── Debounced real-time search whenever the search bar text changes.
  // ─── Typing always takes over as the active mode ("typed"), overriding
  // ─── whatever category/genre browse was active before. ───
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
      performSearch(query, 'typed', 'Searched Results', false);
    }, 500);

    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // ─── Re-apply (and re-sort) filters client-side against whatever is
  // ─── already loaded, any time a filter other than `type` changes. This is
  // ─── what makes "tap Action to filter the list already showing" work
  // ─── without a new network request. ───
  useEffect(() => {
    if (results.length > 0) {
      const filtered = sortNewestFirst(applyFilters(results, filters));
      setFilteredResults(filtered);
      setNoResults(filtered.length === 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, results]);

  // ─── `type` is a real API param, not just a client-side filter, so
  // ─── changing it re-runs the currently active search (whatever query is
  // ─── driving it — typed, category, or genre) with the new type. ───
  const isFirstTypeRender = useRef(true);
  useEffect(() => {
    if (isFirstTypeRender.current) {
      isFirstTypeRender.current = false;
      return;
    }
    if (activeSearchQueryRef.current) {
      performSearch(activeSearchQueryRef.current, activeModeRef.current as Exclude<ActiveMode, 'discover'>, activeTitleRef.current, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.type]);

  useFocusEffect(
    useCallback(() => {
      isMounted.current = true;
      loadSearchHistory();
      return () => { isMounted.current = false; };
    }, [loadSearchHistory])
  );

  // ─── Handlers ───
  const handleItemPress = useCallback((item: IMetadataResult) => {
    const rawPosterPath = toRawPosterPath(item.poster);
    router.push(
      `/movie/${item.id}?mediaType=${item.type}&title=${encodeURIComponent(item.title)}&poster_path=${encodeURIComponent(rawPosterPath)}`
    );
  }, []);

  const handleHistoryItemPress = useCallback((historyQuery: string) => {
    // This IS a text search, so the query bar should show it.
    skipQueryEffectRef.current = true;
    setQuery(historyQuery);
    performSearch(historyQuery, 'typed', 'Searched Results', true);
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

  const handleClearQuery = () => {
    skipQueryEffectRef.current = true;
    setQuery('');
    resetToDiscover();
  };

  // ─── Category card tap: never touches the search bar text. Existing
  // ─── filters (genre/year/type) carry over untouched unless the user
  // ─── changes them afterward. ───
  const handleCategoryPress = useCallback((cat: { label: string; query: string }) => {
    Keyboard.dismiss();
    if (query.length > 0) {
      // Clear any leftover typed text without letting the debounce effect
      // treat this as "user cleared their search" and reset to discover —
      // we're about to show category results instead.
      skipQueryEffectRef.current = true;
      setQuery('');
    }
    performSearch(cat.query, 'category', cat.label, false);
  }, [query, performSearch]);

  // ─── Genre pill tap. Behavior depends on what's currently driving the grid:
  //   - If a category or typed search is already active: genre just narrows
  //     the results already showing (client-side filter only).
  //   - If nothing is active (discover) or genre is already the primary
  //     browse mode: the genre itself becomes the search — "show all Action
  //     movies, latest first" — until the user picks a category or types.
  const handleGenreToggle = useCallback((genre: string) => {
    const turningOff = filters.genre === genre;

    if (activeMode === 'category' || activeMode === 'typed') {
      setFilters(prev => ({ ...prev, genre: turningOff ? '' : genre }));
      return;
    }

    if (turningOff) {
      // Turning off the only thing driving the grid -> back to discover.
      setFilters(prev => ({ ...prev, genre: '' }));
      resetToDiscover();
      return;
    }

    setFilters(prev => ({ ...prev, genre }));
    if (query.length > 0) {
      skipQueryEffectRef.current = true;
      setQuery('');
    }
    performSearch(genre.toLowerCase(), 'genre', genre, false);
  }, [filters.genre, activeMode, query, performSearch, resetToDiscover]);

  // ─── Render every filter as one line: "Label:" inline on the left, then a
  // ─── horizontally-scrollable row of small pills next to it. There's no
  // ─── separate "All" pill — tapping the active pill again clears it back
  // ─── to the default. Active state is shown with a colored border only
  // ─── (background stays neutral), not a filled pill.
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

    return (
      <View style={styles.filtersContainer}>
        {renderRow('Type', typeItems)}
        {renderRow('Genre', genreItems)}
        {renderRow('Year', yearItems)}
      </View>
    );
  };

  // ─── Render 2x3 category cards grid ───
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

  // ─── Single card renderer shared by the "Popular Searches" trending grid
  // ─── AND every active result set (typed / category / genre). Only the
  // ─── heading above changes — the cards themselves never do. ───
  const renderGridCard = (item: IMetadataResult) => (
    <TouchableOpacity
      key={`${(item as any).source || 'default'}-${item.type}-${item.id}`}
      style={styles.trendingCard}
      onPress={() => handleItemPress(item)}
      activeOpacity={0.7}
    >
      <Image
        source={item.poster ? { uri: item.poster } : require('../../../assets/icon.png')}
        style={styles.trendingPoster}
        resizeMode="cover"
      />
      <Text style={[styles.trendingTitle, { color: colors.text }]} numberOfLines={1}>
        {item.title}
      </Text>
    </TouchableOpacity>
  );

  const renderCardGrid = (items: IMetadataResult[]) => (
    <View style={styles.trendingGrid}>
      {items.map(renderGridCard)}
    </View>
  );

  // ─── Skeleton placeholder card — same footprint as a real card, so
  // ─── swapping skeleton <-> real content never reflows the layout. Only
  // ─── the card contents change; the search bar, filters, and category
  // ─── cards are never touched or hidden while this is showing. ───
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

  // ─── Render Recent Searches as a continuously auto-scrolling marquee of
  // ─── small, border-only circular avatars (most recent first — assumes
  // ─── getSearchHistory() already returns newest-first; swap to
  // ─── .slice().reverse() below if it's actually stored oldest-first).
  // ─── The item list is duplicated so the loop resets seamlessly. Each
  // ─── query only has text to go on, so the avatar is always an initial
  // ─── in a colored ring, no fill. Long-press an avatar to remove it;
  // ─── the fixed circle on the left clears everything and doesn't scroll.
  const renderRecentSearchesStrip = () => {
    if (searchHistory.length === 0) return null;

    const renderAvatar = (histQuery: string, key: string) => {
      const initial = histQuery.trim().charAt(0).toUpperCase() || '?';
      return (
        <TouchableOpacity
          key={key}
          style={styles.recentSearchItem}
          onPress={() => handleHistoryItemPress(histQuery)}
          onLongPress={() => handleRemoveHistoryItem(histQuery)}
          activeOpacity={0.7}
        >
          <View style={[styles.recentSearchAvatar, { borderColor: colors.gold }]}>
            <Text style={[styles.recentSearchAvatarText, { color: colors.gold }]}>{initial}</Text>
          </View>
          <Text style={[styles.recentSearchLabel, { color: colors.textMuted }]} numberOfLines={1}>
            {histQuery}
          </Text>
        </TouchableOpacity>
      );
    };

    return (
      <View style={styles.recentSearchesRow}>
        <TouchableOpacity
          style={styles.recentClearButton}
          onPress={handleClearAllHistory}
          activeOpacity={0.7}
        >
          <View style={[
            styles.recentSearchAvatar,
            { borderColor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)' }
          ]}>
            <Ionicons name="close" size={13} color={colors.textMuted} />
          </View>
        </TouchableOpacity>

        <View style={styles.recentTickerViewport}>
          <Animated.View
            style={[styles.recentTickerTrack, { transform: [{ translateX: tickerScrollX }] }]}
            onLayout={(e) => {
              const fullWidth = e.nativeEvent.layout.width;
              if (fullWidth > 0 && tickerSetWidth === 0) {
                setTickerSetWidth(fullWidth / 2);
              }
            }}
          >
            {searchHistory.map((q, i) => renderAvatar(q, `a-${q}-${i}`))}
            {searchHistory.map((q, i) => renderAvatar(q, `b-${q}-${i}`))}
          </Animated.View>
        </View>
      </View>
    );
  };

  // ─── Render Empty State (nothing searched yet, no history, no trending) ───
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
    </View>
  );

  // ─── Render "No results" state for an active search/category/genre ───
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
    </View>
  );

  const isDiscover = activeMode === 'discover';

  // ─── Main Render ───
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: 'transparent' }]}
      edges={['top']}
    >
      {/* ─── Background ─── */}
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

      {/* ─── Search Bar — only ever reflects typed text, never category/genre ─── */}
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
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={handleClearQuery} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={17} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* ─── Recent Searches: only shown in the default discover state ─── */}
      {isDiscover && renderRecentSearchesStrip()}

      {/* ─── Filters: always visible, one row per filter ─── */}
      {renderFilters()}

      {/* ─── Grid: category cards, search bar, and filters stay put and
           visible at all times. Only the grid section's contents swap
           between skeleton placeholders and real cards — no full-screen
           spinner, no remount, no layout jump. ─── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.discoverContent}
      >
        {renderCategoryCards()}

        {isDiscover ? (
          (trendingItems.length > 0 || preloadLoading) && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Popular Searches</Text>
              {preloadLoading && trendingItems.length === 0 ? renderSkeletonGrid(8) : renderCardGrid(trendingItems)}
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
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: Platform.OS === 'ios' ? 6 : 4,
    marginLeft: 8,
  },
  // ─── Always-visible filter rows: label + one horizontally-scrollable
  // ─── pill line per filter (Type / Genre / Year).
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
  // ─── Category Pills Grid (3 per row x 2 rows) ───
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
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
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
  // ─── Shared card grid: used for BOTH the trending "Popular Searches" grid
  // ─── and every active typed/category/genre result set. ───
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
  // ─── Recent Searches: fixed Clear circle + auto-scrolling marquee track ───
  recentSearchesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    paddingLeft: 16,
  },
  recentClearButton: {
    marginRight: 10,
  },
  recentTickerViewport: {
    flex: 1,
    height: 58,
    overflow: 'hidden',
  },
  recentTickerTrack: {
    flexDirection: 'row',
  },
  recentSearchItem: {
    width: 46,
    alignItems: 'center',
    marginRight: 14,
  },
  recentSearchAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    backgroundColor: 'transparent',
  },
  recentSearchAvatarText: {
    fontSize: 13,
    fontWeight: '700',
  },
  recentSearchLabel: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
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
  skeletonTitleBar: {
    height: 11,
    borderRadius: 4,
    marginTop: 6,
    width: '70%',
  },
});

export default SearchScreen;