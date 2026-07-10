// src/screens/search/SearchScreen.tsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  ScrollView,
  Modal,
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

// ─── Filter Types ───
interface SearchFilters {
  type: 'all' | 'movie' | 'tv';
  year: string;
  minRating: number;
  source: 'all' | 'tmdb' | 'kuryana' | 'moviebox';
  genre: string;
}

const SearchScreen = () => {
  const { colors, isDark } = useTheme();
  const { showToast } = useAlert();
  const { networkStatus } = useAppStore();

  const { trendingSearches, categories, loading: preloadLoading } = useSearchPreloader();
  const { recordSearch: recordSearchToSupabase } = useSearchAggregation();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<IMetadataResult[]>([]);
  const [filteredResults, setFilteredResults] = useState<IMetadataResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(true);
  const [showFilterModal, setShowFilterModal] = useState(false);

  // ─── Filter State ───
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

  // ─── Apply filters to results ───
  const applyFilters = useCallback((resultsToFilter: IMetadataResult[], currentFilters: SearchFilters): IMetadataResult[] => {
    let filtered = [...resultsToFilter];

    // Filter by type
    if (currentFilters.type !== 'all') {
      filtered = filtered.filter(item => item.type === currentFilters.type);
    }

    // Filter by year
    if (currentFilters.year) {
      const yearNum = parseInt(currentFilters.year);
      if (!isNaN(yearNum)) {
        filtered = filtered.filter(item => item.year === yearNum);
      }
    }

    // Filter by minimum rating
    if (currentFilters.minRating > 0) {
      filtered = filtered.filter(item => (item.rating || 0) >= currentFilters.minRating);
    }

    // Filter by source
    if (currentFilters.source !== 'all') {
      filtered = filtered.filter(item => (item as any).source === currentFilters.source);
    }

    // Filter by genre
    if (currentFilters.genre) {
      filtered = filtered.filter(item => 
        item.genres?.some(g => g.toLowerCase().includes(currentFilters.genre.toLowerCase()))
      );
    }

    return filtered;
  }, []);

  // ─── Perform search across all sources (TMDB + Kuryana + MovieBox) ───
  const performSearch = useCallback(async (searchQuery: string, saveToHistory: boolean = true) => {
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) {
      setResults([]);
      setFilteredResults([]);
      setNoResults(false);
      setShowHistory(true);
      loadSearchHistory();
      return;
    }

    setLoading(true);
    setNoResults(false);
    setShowHistory(false);

    try {
      // Build search options
      const searchOptions: any = {
        query: trimmedQuery,
        limit: 50,
      };

      // Add type filter if not 'all'
      if (filters.type !== 'all') {
        searchOptions.type = filters.type;
      }

      // Search using UnifiedMediaService
      const searchResults = await unifiedMediaService.search(searchOptions);

      // Log source breakdown for debugging
      const sourceCounts: Record<string, number> = {};
      searchResults.forEach(r => {
        const source = (r as any).source || 'unknown';
        sourceCounts[source] = (sourceCounts[source] || 0) + 1;
      });
      console.log('📊 Search results by source:', sourceCounts);

      // Filter results that have a poster
      const filtered = searchResults.filter((item) => !!item.poster);

      setResults(filtered);
      
      // Apply filters
      const filteredResults = applyFilters(filtered, filters);
      setFilteredResults(filteredResults);
      setNoResults(filteredResults.length === 0);

      if (saveToHistory && filteredResults.length > 0) {
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
      setLoading(false);
    }
  }, [filters, applyFilters, loadSearchHistory, recordSearchToSupabase, showToast]);

  // ─── Debounced search ───
  useEffect(() => {
    if (!query.trim()) {
      setShowHistory(true);
      setResults([]);
      setFilteredResults([]);
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

  // ─── Re-apply filters when filters change ───
  useEffect(() => {
    if (results.length > 0) {
      const filtered = applyFilters(results, filters);
      setFilteredResults(filtered);
      setNoResults(filtered.length === 0);
    }
  }, [filters, results, applyFilters]);

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
    setFilteredResults([]);
    setNoResults(false);
    setShowHistory(true);
    loadSearchHistory();
  };

  const handleToggleFilter = () => {
    setShowFilterModal(!showFilterModal);
  };

  const handleApplyFilters = () => {
    setShowFilterModal(false);
    if (query.trim()) {
      performSearch(query, false);
    }
  };

  const handleResetFilters = () => {
    setFilters({
      type: 'all',
      year: '',
      minRating: 0,
      source: 'all',
      genre: '',
    });
  };

  // ─── Render Filter Chip ───
  const renderFilterChip = (label: string, value: string | number, onPress: () => void) => {
    const hasValue = value !== '' && value !== 'all' && value !== 0;
    return (
      <TouchableOpacity
        style={[
          styles.filterChip,
          {
            backgroundColor: hasValue ? colors.gold : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'),
            borderColor: hasValue ? colors.gold : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'),
          }
        ]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <Text style={[
          styles.filterChipText,
          { color: hasValue ? '#FFFFFF' : colors.textMuted }
        ]}>
          {label}{hasValue ? `: ${value}` : ''}
        </Text>
        {hasValue && (
          <Ionicons name="close-circle" size={14} color="#FFFFFF" style={styles.filterChipIcon} />
        )}
      </TouchableOpacity>
    );
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

    const source = (item as any).source || 'default';

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
            {renderSourceBadge(source)}
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
            {(item.rating || 0) > 0 && (
              <View style={styles.ratingContainer}>
                <Ionicons name="star" size={12} color="#FFD700" />
                <Text style={[styles.ratingText, { color: colors.textSub }]}>
                  {(item.rating || 0).toFixed(1)}
                </Text>
              </View>
            )}
            <View style={styles.typeBadge}>
              <Text style={[styles.typeText, { color: colors.textMuted }]}>
                {item.type === 'tv' ? 'TV Series' : 'Movie'}
              </Text>
            </View>
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

  // ─── Render Filter Modal ───
  const renderFilterModal = () => (
    <Modal
      visible={showFilterModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowFilterModal(false)}
    >
      <TouchableOpacity 
        style={styles.modalOverlay} 
        activeOpacity={1} 
        onPress={() => setShowFilterModal(false)}
      >
        <View style={[
          styles.modalContent,
          {
            backgroundColor: isDark ? colors.surface : 'rgba(255,255,255,0.95)',
          }
        ]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Filters</Text>
            <TouchableOpacity onPress={() => setShowFilterModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Type Filter */}
            <View style={styles.filterSection}>
              <Text style={[styles.filterLabel, { color: colors.text }]}>Type</Text>
              <View style={styles.filterOptions}>
                {['all', 'movie', 'tv'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.filterOption,
                      {
                        backgroundColor: filters.type === type ? colors.gold : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'),
                        borderColor: filters.type === type ? colors.gold : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'),
                      }
                    ]}
                    onPress={() => setFilters({ ...filters, type: type as any })}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      { color: filters.type === type ? '#FFFFFF' : colors.textMuted }
                    ]}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Source Filter */}
            <View style={styles.filterSection}>
              <Text style={[styles.filterLabel, { color: colors.text }]}>Source</Text>
              <View style={styles.filterOptions}>
                {['all', 'tmdb', 'kuryana', 'moviebox'].map((source) => (
                  <TouchableOpacity
                    key={source}
                    style={[
                      styles.filterOption,
                      {
                        backgroundColor: filters.source === source ? colors.gold : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'),
                        borderColor: filters.source === source ? colors.gold : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'),
                      }
                    ]}
                    onPress={() => setFilters({ ...filters, source: source as any })}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      { color: filters.source === source ? '#FFFFFF' : colors.textMuted }
                    ]}>
                      {source.charAt(0).toUpperCase() + source.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Year Filter */}
            <View style={styles.filterSection}>
              <Text style={[styles.filterLabel, { color: colors.text }]}>Year</Text>
              <TextInput
                style={[
                  styles.filterInput,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                    color: colors.text,
                  }
                ]}
                placeholder="e.g., 2024"
                placeholderTextColor={colors.textMuted}
                value={filters.year}
                onChangeText={(text) => setFilters({ ...filters, year: text })}
                keyboardType="numeric"
                maxLength={4}
              />
            </View>

            {/* Min Rating Filter */}
            <View style={styles.filterSection}>
              <Text style={[styles.filterLabel, { color: colors.text }]}>Minimum Rating</Text>
              <View style={styles.ratingOptions}>
                {[0, 3, 5, 7, 8].map((rating) => (
                  <TouchableOpacity
                    key={rating}
                    style={[
                      styles.filterOption,
                      {
                        backgroundColor: filters.minRating === rating ? colors.gold : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'),
                        borderColor: filters.minRating === rating ? colors.gold : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'),
                      }
                    ]}
                    onPress={() => setFilters({ ...filters, minRating: rating })}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      { color: filters.minRating === rating ? '#FFFFFF' : colors.textMuted }
                    ]}>
                      {rating === 0 ? 'All' : `${rating}+`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Genre Filter */}
            <View style={styles.filterSection}>
              <Text style={[styles.filterLabel, { color: colors.text }]}>Genre</Text>
              <View style={styles.genreOptions}>
                {availableGenres.map((genre) => (
                  <TouchableOpacity
                    key={genre}
                    style={[
                      styles.genreOption,
                      {
                        backgroundColor: filters.genre === genre ? colors.gold : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'),
                        borderColor: filters.genre === genre ? colors.gold : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'),
                      }
                    ]}
                    onPress={() => setFilters({ ...filters, genre: filters.genre === genre ? '' : genre })}
                  >
                    <Text style={[
                      styles.genreOptionText,
                      { color: filters.genre === genre ? '#FFFFFF' : colors.textMuted }
                    ]}>
                      {genre}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.resetButton, { borderColor: colors.border }]}
              onPress={handleResetFilters}
            >
              <Text style={[styles.resetButtonText, { color: colors.textMuted }]}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.applyButton, { backgroundColor: colors.gold }]}
              onPress={handleApplyFilters}
            >
              <Text style={styles.applyButtonText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
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
        <TouchableOpacity 
          onPress={handleToggleFilter}
          style={styles.filterButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="options-outline" size={22} color={colors.textMuted} />
          {(filters.type !== 'all' || filters.year || filters.minRating > 0 || filters.source !== 'all' || filters.genre) && (
            <View style={[styles.filterDot, { backgroundColor: colors.gold }]} />
          )}
        </TouchableOpacity>
      </View>

      {/* ─── Filter Chips ─── */}
      {(filters.type !== 'all' || filters.year || filters.minRating > 0 || filters.source !== 'all' || filters.genre) && (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.filterChipsContainer}
          contentContainerStyle={styles.filterChipsContent}
        >
          {filters.type !== 'all' && renderFilterChip('Type', filters.type, () => setFilters({ ...filters, type: 'all' }))}
          {filters.year && renderFilterChip('Year', filters.year, () => setFilters({ ...filters, year: '' }))}
          {filters.minRating > 0 && renderFilterChip('Rating', `${filters.minRating}+`, () => setFilters({ ...filters, minRating: 0 }))}
          {filters.source !== 'all' && renderFilterChip('Source', filters.source, () => setFilters({ ...filters, source: 'all' }))}
          {filters.genre && renderFilterChip('Genre', filters.genre, () => setFilters({ ...filters, genre: '' }))}
        </ScrollView>
      )}

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
      {!loading && !showHistory && filteredResults.length > 0 && (
        <FlatList
          data={filteredResults}
          renderItem={renderSearchResult}
          keyExtractor={(item) => `${(item as any).source || 'default'}-${item.type}-${item.id}`}
          contentContainerStyle={styles.resultsList}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.resultsHeader}>
              <Text style={[styles.resultsCount, { color: colors.textMuted }]}>
                {filteredResults.length} {filteredResults.length === 1 ? 'result' : 'results'} found
                {results.length !== filteredResults.length && ` (filtered from ${results.length})`}
              </Text>
            </View>
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
            Try adjusting your search or filters
          </Text>
        </View>
      )}

      {/* ─── Empty State ─── */}
      {!loading && showHistory && searchHistory.length === 0 && !query && (
        renderEmptyState()
      )}

      {/* ─── Filter Modal ─── */}
      {renderFilterModal()}
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
  filterButton: {
    padding: 4,
    marginLeft: 4,
    position: 'relative',
  },
  filterDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  filterChipsContainer: {
    maxHeight: 44,
    marginBottom: 4,
  },
  filterChipsContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
    height: 32,
    gap: 4,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  filterChipIcon: {
    marginLeft: 2,
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
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 8,
  },
  resultsCount: {
    fontSize: 13,
    fontWeight: '500',
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
  // ─── Filter Modal Styles ───
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
    ...(Platform.OS === 'ios' && {
      backdropFilter: 'blur(20px)',
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalBody: {
    paddingTop: 16,
  },
  filterSection: {
    marginBottom: 20,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    minWidth: 60,
    alignItems: 'center',
  },
  filterOptionText: {
    fontSize: 13,
    fontWeight: '500',
  },
  filterInput: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    borderWidth: 1,
  },
  ratingOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  genreOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  genreOption: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  genreOptionText: {
    fontSize: 12,
    fontWeight: '500',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 16,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  resetButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  applyButton: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default SearchScreen;