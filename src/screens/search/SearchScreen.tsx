// src/screens/search/SearchScreen.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  Keyboard,
  Platform,
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

// TMDB CDN prefix used by the rest of the app
const TMDB_POSTER_PREFIX = 'https://image.tmdb.org/t/p/w500';

const toRawPosterPath = (fullPosterUrl?: string): string => {
  if (!fullPosterUrl) return '';
  return fullPosterUrl.startsWith(TMDB_POSTER_PREFIX)
    ? fullPosterUrl.slice(TMDB_POSTER_PREFIX.length)
    : fullPosterUrl;
};

// ─── Source Badge Configurations ───
const SOURCE_BADGES: Record<string, { label: string; color: string; icon: string }> = {
  moviebox: {
    label: 'MOVIEBOX',
    color: '#FF6B00',
    icon: 'film-outline',
  },
  tmdb: {
    label: 'TMDB',
    color: '#01B4E4',
    icon: 'film-outline',
  },
  kuryana: {
    label: 'KURYANA',
    color: '#9C27B0',
    icon: 'tv-outline',
  },
  default: {
    label: 'SOURCE',
    color: '#666666',
    icon: 'globe-outline',
  },
};

const SearchScreen = () => {
  const { colors, isDark } = useTheme();
  const { showToast } = useAlert();
  const { networkStatus } = useAppStore();

  const { trendingSearches, categories, loading: preloadLoading } = useSearchPreloader();
  const { recordSearch: recordSearchToSupabase } = useSearchAggregation();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<IMetadataResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(true);

  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  const isMounted = useRef(true);
  const engineInitialized = useRef(false);

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

  // ─── Perform search across all sources (TMDB + Kuryana + MovieBox) ───
  const performSearch = useCallback(async (searchQuery: string, saveToHistory: boolean = true) => {
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) {
      setResults([]);
      setNoResults(false);
      setShowHistory(true);
      loadSearchHistory();
      return;
    }

    setLoading(true);
    setNoResults(false);
    setShowHistory(false);

    try {
      // Search using UnifiedMediaService (which now includes MovieBox)
      const searchResults = await unifiedMediaService.search({
        query: trimmedQuery,
        limit: 30,
      });

      // Log source breakdown for debugging
      const sourceCounts: Record<string, number> = {};
      searchResults.forEach(r => {
        const source = r.source || 'unknown';
        sourceCounts[source] = (sourceCounts[source] || 0) + 1;
      });
      console.log('📊 Search results by source:', sourceCounts);

      // Filter results that have a poster
      const filtered = searchResults.filter((item) => !!item.poster);

      setResults(filtered);
      setNoResults(filtered.length === 0);

      if (saveToHistory && filtered.length > 0) {
        await saveSearchQuery(trimmedQuery);
        loadSearchHistory();
        // Fire-and-forget: contributes to global trending search data
        recordSearchToSupabase(trimmedQuery);
      }
    } catch (error) {
      console.error('[Search] Error:', error);
      setResults([]);
      setNoResults(true);
      showToast('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [loadSearchHistory, recordSearchToSupabase, showToast]);

  // ─── Debounced search ───
  useEffect(() => {
    if (!query.trim()) {
      setShowHistory(true);
      setResults([]);
      setNoResults(false);
      loadSearchHistory();
      return;
    }

    setShowHistory(false);

    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    debounceTimeout.current = setTimeout(() => {
      performSearch(query, false);
    }, 500);

    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, [query, performSearch, loadSearchHistory]);

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
    setQuery(historyQuery);
    performSearch(historyQuery, true);
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
    setQuery('');
    setResults([]);
    setNoResults(false);
    setShowHistory(true);
    loadSearchHistory();
  };

  // ─── Render Source Badge ───
  const renderSourceBadge = (source?: string) => {
    const config = SOURCE_BADGES[source || 'default'] || SOURCE_BADGES.default;
    return (
      <View style={[styles.sourceBadge, { backgroundColor: config.color }]}>
        <Ionicons name={config.icon as any} size={10} color="#FFFFFF" />
        <Text style={styles.sourceBadgeText}>{config.label}</Text>
      </View>
    );
  };

  // ─── Render Search Result ───
  const renderSearchResult = ({ item }: { item: IMetadataResult }) => {
    const imageSource = item.poster
      ? { uri: item.poster }
      : require('../../../assets/icon.png');

    return (
      <TouchableOpacity 
        style={[
          styles.resultItem, 
          { 
            borderBottomColor: colors.border,
            backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.3)',
          }
        ]} 
        onPress={() => handleItemPress(item)}
        activeOpacity={0.7}
      >
        <Image 
          source={imageSource} 
          style={styles.poster} 
          resizeMode="cover" 
        />
        <View style={styles.itemDetails}>
          <View style={styles.itemHeader}>
            <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>
              {item.title}
            </Text>
            {renderSourceBadge(item.source)}
          </View>
          <Text style={[styles.itemOverview, { color: colors.textSub }]} numberOfLines={2}>
            {item.overview || 'No description available'}
          </Text>
          <View style={styles.itemFooter}>
            {item.year && (
              <Text style={[styles.itemYear, { color: colors.textMuted }]}>
                {item.year}
              </Text>
            )}
            {item.rating > 0 && (
              <View style={styles.ratingContainer}>
                <Ionicons name="star" size={12} color="#FFD700" />
                <Text style={[styles.ratingText, { color: colors.textSub }]}>
                  {item.rating.toFixed(1)}
                </Text>
              </View>
            )}
            {item.source && (
              <View style={styles.typeBadge}>
                <Text style={[styles.typeText, { color: colors.textMuted }]}>
                  {item.type === 'tv' ? 'TV Series' : 'Movie'}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ─── Render History Item ───
  const renderHistoryItem = ({ item }: { item: string }) => (
    <TouchableOpacity 
      style={[
        styles.historyItem, 
        { 
          borderBottomColor: colors.border,
          backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.2)',
        }
      ]} 
      onPress={() => handleHistoryItemPress(item)}
    >
      <View style={styles.historyItemLeft}>
        <Ionicons name="time-outline" size={18} color={colors.textMuted} style={styles.historyIcon} />
        <Text style={[styles.historyItemText, { color: colors.text }]}>{item}</Text>
      </View>
      <TouchableOpacity 
        onPress={() => handleRemoveHistoryItem(item)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="close-circle" size={20} color={colors.textMuted} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  // ─── Render Empty State ───
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

  // ─── Main Render ───
  return (
    <SafeAreaView 
      style={[styles.container, { backgroundColor: 'transparent' }]} 
      edges={['top']}
    >
      {/* ─── Background Gradient ─── */}
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

      {/* ─── Search Bar ─── */}
      <View style={[
        styles.searchContainer, 
        { 
          backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.6)',
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.3)',
        }
      ]}>
        <Ionicons name="search" size={22} color={colors.textMuted} />
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
            <Ionicons name="close-circle" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* ─── Loading ─── */}
      {loading && (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.gold} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>
            Searching across TMDB, MovieBox, and more...
          </Text>
        </View>
      )}

      {/* ─── Search History ─── */}
      {!loading && showHistory && searchHistory.length > 0 && (
        <>
          <View style={styles.historyHeader}>
            <Text style={[styles.historyHeaderText, { color: colors.text }]}>
              Recent Searches
            </Text>
            <TouchableOpacity onPress={handleClearAllHistory} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[styles.clearAllText, { color: colors.gold }]}>Clear All</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={searchHistory}
            renderItem={renderHistoryItem}
            keyExtractor={(item, index) => `${item}-${index}`}
            contentContainerStyle={styles.historyList}
            showsVerticalScrollIndicator={false}
          />
        </>
      )}

      {/* ─── Results ─── */}
      {!loading && !showHistory && results.length > 0 && (
        <FlatList
          data={results}
          renderItem={renderSearchResult}
          keyExtractor={(item) => `${item.source}-${item.type}-${item.id}`}
          contentContainerStyle={styles.resultsList}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text style={[styles.resultsCount, { color: colors.textMuted }]}>
              {results.length} results found
            </Text>
          }
        />
      )}

      {/* ─── No Results ─── */}
      {!loading && !showHistory && noResults && (
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
            Try adjusting your search terms
          </Text>
        </View>
      )}

      {/* ─── Empty State ─── */}
      {!loading && showHistory && searchHistory.length === 0 && !query && (
        renderEmptyState()
      )}
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
    borderRadius: 12,
    margin: 16,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    borderWidth: 1,
    ...(Platform.OS === 'ios' && {
      backdropFilter: 'blur(20px)',
    }),
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    marginLeft: 10,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  resultsList: { 
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  resultsCount: {
    fontSize: 13,
    fontWeight: '500',
    marginVertical: 12,
    marginLeft: 4,
  },
  resultItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
    marginBottom: 6,
    borderBottomWidth: 0.5,
  },
  poster: {
    width: 80,
    height: 120,
    borderRadius: 8,
    backgroundColor: '#333',
  },
  itemDetails: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
    lineHeight: 22,
  },
  itemOverview: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  itemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
  },
  itemYear: {
    fontSize: 12,
    fontWeight: '500',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '600',
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  typeText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
    flexShrink: 0,
  },
  sourceBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  historyHeaderText: { 
    fontSize: 16, 
    fontWeight: 'bold' 
  },
  clearAllText: { 
    fontSize: 14, 
    fontWeight: '600' 
  },
  historyList: { 
    paddingHorizontal: 16 
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
    borderBottomWidth: 0.5,
  },
  historyItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  historyIcon: {
    marginRight: 12,
  },
  historyItemText: { 
    fontSize: 15,
    flex: 1,
  },
  noResultsText: { 
    fontSize: 16, 
    textAlign: 'center' 
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
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
});

export default SearchScreen;