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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

// Zustand Stores
import { useAppStore } from '../../store/zustand';
import { useSearchPreloader } from "../../hooks/content/useContent";`nimport { useTheme } from '../../contexts/ThemeContext';
import { useAlert } from '../../contexts/AlertContext';

// API
import { searchMedia, getImageUrl } from '../../api/tmdbApi';

// Utils
import { saveSearchQuery, getSearchHistory, removeSearchQuery, clearSearchHistory } from '../../utils/storage';

const SearchScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const { showToast } = useAlert();
  const { networkStatus } = useAppStore();

  const { trendingSearches, categories, loading: preloadLoading } = useSearchPreloader();`n  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(true);

  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  const isMounted = useRef(true);

  // Load search history
  const loadSearchHistory = useCallback(async () => {
    const history = await getSearchHistory();
    if (isMounted.current) {
      setSearchHistory(history);
    }
  }, []);

  // Perform search
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
      const searchResults = await searchMedia(trimmedQuery);
      const filtered = searchResults.filter(
        (item: any) =>
          (item.poster_path || item.backdrop_path) &&
          (item.media_type === 'movie' || item.media_type === 'tv')
      );
      setResults(filtered);
      setNoResults(filtered.length === 0);

      if (saveToHistory && filtered.length > 0) {
        await saveSearchQuery(trimmedQuery);
        loadSearchHistory();
      }
    } catch (error) {
      console.error('[Search] Error:', error);
      setResults([]);
      setNoResults(true);
    } finally {
      setLoading(false);
    }
  }, [loadSearchHistory]);

  // Debounced search
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

  const handleItemPress = useCallback((item: any) => {
    const mediaType = item.media_type || (item.title ? 'movie' : 'tv');
    navigation.navigate('DetailScreen', {
      mediaId: item.id,
      mediaType,
      title: mediaType === 'tv' ? item.name : item.title,
      poster_path: item.poster_path,
    });
  }, [navigation]);

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

  const renderSearchResult = ({ item }: { item: any }) => {
    const title = item.title || item.name || 'Unknown';
    const imageSource = item.poster_path
      ? { uri: getImageUrl(item.poster_path) }
      : require('../../assets/placeholder.png');

    return (
      <TouchableOpacity style={[styles.resultItem, { borderBottomColor: colors.border }]} onPress={() => handleItemPress(item)}>
        <Image source={imageSource} style={styles.poster} />
        <View style={styles.itemDetails}>
          <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={2}>{title}</Text>
          <Text style={[styles.itemOverview, { color: colors.textSub }]} numberOfLines={2}>
            {item.overview || 'No description available'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderHistoryItem = ({ item }: { item: string }) => (
    <TouchableOpacity style={[styles.historyItem, { borderBottomColor: colors.border }]} onPress={() => handleHistoryItemPress(item)}>
      <Text style={[styles.historyItemText, { color: colors.text }]}>{item}</Text>
      <TouchableOpacity onPress={() => handleRemoveHistoryItem(item)}>
        <Ionicons name="close-circle" size={20} color={colors.textMuted} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search" size={22} color={colors.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search movies & TV shows..."
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          autoFocus
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Loading */}
      {loading && (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      )}

      {/* Search History */}
      {!loading && showHistory && searchHistory.length > 0 && (
        <>
          <View style={styles.historyHeader}>
            <Text style={[styles.historyHeaderText, { color: colors.text }]}>Recent Searches</Text>
            <TouchableOpacity onPress={handleClearAllHistory}>
              <Text style={[styles.clearAllText, { color: colors.gold }]}>Clear All</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={searchHistory}
            renderItem={renderHistoryItem}
            keyExtractor={(item, index) => ${item}-}
            contentContainerStyle={styles.historyList}
          />
        </>
      )}

      {/* Results */}
      {!loading && !showHistory && results.length > 0 && (
        <FlatList
          data={results}
          renderItem={renderSearchResult}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.resultsList}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* No Results */}
      {!loading && !showHistory && noResults && (
        <View style={styles.centerContent}>
          <Text style={[styles.noResultsText, { color: colors.textMuted }]}>
            No results found for "{query}"
          </Text>
        </View>
      )}

      {/* Empty State */}
      {!loading && showHistory && searchHistory.length === 0 && !query && (
        <View style={styles.centerContent}>
          <Ionicons name="search-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Search for movies and TV shows
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    margin: 16,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 10,
    marginLeft: 10,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  resultsList: { paddingHorizontal: 16 },
  resultItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  poster: {
    width: 80,
    height: 120,
    borderRadius: 6,
    backgroundColor: '#333',
  },
  itemDetails: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  itemOverview: {
    fontSize: 13,
    lineHeight: 18,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  historyHeaderText: { fontSize: 16, fontWeight: 'bold' },
  clearAllText: { fontSize: 14, fontWeight: '600' },
  historyList: { paddingHorizontal: 16 },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  historyItemText: { fontSize: 15 },
  noResultsText: { fontSize: 16, textAlign: 'center' },
  emptyText: { fontSize: 14, marginTop: 12 },
});

export default SearchScreen;

