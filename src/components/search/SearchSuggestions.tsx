/**
 * SearchSuggestions - Search autocomplete dropdown component
 * Features: suggestions list, recent searches, tap to fill search
 * Uses MavinEngine for autocomplete suggestions
 */

import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface SearchSuggestion {
  id: string;
  text: string;
  type: 'suggestion' | 'recent' | 'trending';
}

interface SearchSuggestionsProps {
  suggestions: string[];
  recentSearches: string[];
  loading?: boolean;
  visible: boolean;
  onSuggestionPress: (suggestion: string) => void;
  onRecentPress: (query: string) => void;
  onClearHistory?: () => void;
  maxSuggestions?: number;
  maxRecent?: number;
}

export function SearchSuggestions({
  suggestions,
  recentSearches,
  loading = false,
  visible,
  onSuggestionPress,
  onRecentPress,
  onClearHistory,
  maxSuggestions = 8,
  maxRecent = 5,
}: SearchSuggestionsProps) {
  const { colors, isDark } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Animate in/out
  React.useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, fadeAnim]);

  if (!visible) return null;

  const showSuggestions = suggestions.length > 0;
  const showRecent = recentSearches.length > 0 && !loading;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? 'rgba(30,30,30,0.98)' : 'rgba(255,255,255,0.98)',
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
          opacity: fadeAnim,
          transform: [
            {
              translateY: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-10, 0],
              }),
            },
          ],
        },
      ]}
    >
      <ScrollView
        style={styles.scrollView}
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}
      >
        {/* Loading State */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.gold} />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>
              Loading suggestions...
            </Text>
          </View>
        )}

        {/* Suggestions */}
        {showSuggestions && !loading && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
                Suggestions
              </Text>
            </View>
            {suggestions.slice(0, maxSuggestions).map((suggestion, index) => (
              <TouchableOpacity
                key={`suggestion-${index}`}
                style={[
                  styles.item,
                  index < suggestions.length - 1 && {
                    borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                    borderBottomWidth: 1,
                  },
                ]}
                onPress={() => onSuggestionPress(suggestion)}
                activeOpacity={0.7}
              >
                <Ionicons name="search-outline" size={18} color={colors.textMuted} />
                <Text style={[styles.itemText, { color: colors.text }]}>
                  {suggestion}
                </Text>
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* Recent Searches */}
        {showRecent && !loading && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
                Recent Searches
              </Text>
              {onClearHistory && (
                <TouchableOpacity onPress={onClearHistory}>
                  <Text style={[styles.clearText, { color: colors.textMuted }]}>
                    Clear
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            {recentSearches.slice(0, maxRecent).map((query, index) => (
              <TouchableOpacity
                key={`recent-${index}`}
                style={[
                  styles.item,
                  index < recentSearches.length - 1 && {
                    borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                    borderBottomWidth: 1,
                  },
                ]}
                onPress={() => onRecentPress(query)}
                activeOpacity={0.7}
              >
                <Ionicons name="time-outline" size={18} color={colors.textMuted} />
                <Text style={[styles.itemText, { color: colors.text }]}>
                  {query}
                </Text>
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* Empty State */}
        {!showSuggestions && !showRecent && !loading && (
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={32} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              Start typing to search...
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Close Button */}
      <TouchableOpacity
        style={[styles.closeButton, { borderColor: colors.textMuted }]}
        onPress={() => {
          // Parent will handle closing
        }}
        activeOpacity={0.7}
      >
        <Ionicons name="close" size={16} color={colors.textMuted} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 56,
    left: 16,
    right: 16,
    maxHeight: 320,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 100,
    overflow: 'hidden',
  },
  scrollView: {
    maxHeight: 320,
    paddingVertical: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  clearText: {
    fontSize: 11,
    fontWeight: '500',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  itemText: {
    fontSize: 14,
    flex: 1,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
});

export default SearchSuggestions;