// src/components/header/AnimatedHeader.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Dimensions,
  Platform,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Animation Timing Constants (matches spec exactly) ───
const ANIMATION = {
  PILL_SLIDE_IN_DURATION: 600,      // 0-0.6s
  PILL_VISIBLE_DURATION: 9400,      // 0.6-10.0s (holds steady)
  PILL_FADE_OUT_DURATION: 400,      // 10.0-10.4s
  SEARCH_SLIDE_IN_DURATION: 600,    // 10.4-11.0s
  TOTAL_CYCLE: 11000,               // 11s complete cycle
} as const;

// ─── Debounce Utility ───
const useDebounce = (value: string, delay: number = 400) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
};

interface AnimatedHeaderProps {
  onFilterPress?: () => void;
  onBellPress?: () => void;
  onSearchPress?: () => void;
  notificationCount?: number;
}

export const AnimatedHeader: React.FC<AnimatedHeaderProps> = ({
  onFilterPress,
  onBellPress,
  onSearchPress,
  notificationCount = 0,
}) => {
  const { colors, isDark } = useTheme();
  const navigation = useNavigation();

  // ─── Search State ───
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [showSearchInput, setShowSearchInput] = useState(false);
  const searchInputRef = useRef<TextInput>(null);

  // ─── Debounced search for live search ───
  const debouncedQuery = useDebounce(searchQuery, 400);

  // ─── Live search effect ───
  useEffect(() => {
    if (debouncedQuery.trim().length > 0 && searchFocused) {
      // Emit live search event — parent can listen or navigate
    }
  }, [debouncedQuery, searchFocused]);

  // ─── Reanimated Shared Values ───
  const pillOpacity = useSharedValue(0);
  const pillScale = useSharedValue(0.92);
  const pillTranslateY = useSharedValue(10);
  const pillWidthProgress = useSharedValue(0);

  const searchOpacity = useSharedValue(0);
  const searchTranslateY = useSharedValue(15);
  const searchScale = useSharedValue(0.95);

  // ─── Animation Completion Flag ───
  const animationCompleted = useSharedValue(false);

  // ─── Get Netflix text color based on theme ───
  const netflixTextColor = isDark ? '#4FC3F7' : '#1565C0';

  // ─── Glass gradient colors ───
  const glassGradientColors = isDark
    ? ['rgba(30,30,30,0.4)', 'rgba(20,20,20,0.3)']
    : ['rgba(255,255,255,0.5)', 'rgba(240,240,240,0.4)'];

  // ─── Main Animation Sequence (Once Per Render) ───
  const runAnimationSequence = useCallback(() => {
    // Reset all values
    pillOpacity.value = 0;
    pillScale.value = 0.92;
    pillTranslateY.value = 10;
    pillWidthProgress.value = 0;
    searchOpacity.value = 0;
    searchTranslateY.value = 15;
    searchScale.value = 0.95;
    animationCompleted.value = false;

    // Cancel any running animations
    cancelAnimation(pillOpacity);
    cancelAnimation(pillScale);
    cancelAnimation(pillTranslateY);
    cancelAnimation(pillWidthProgress);
    cancelAnimation(searchOpacity);
    cancelAnimation(searchTranslateY);
    cancelAnimation(searchScale);

    // ─── Phase 1: 0-0.6s — Pill slides in from left ───
    const pillSlideIn = withTiming(1, {
      duration: ANIMATION.PILL_SLIDE_IN_DURATION,
      easing: Easing.out(Easing.ease),
    });

    pillOpacity.value = pillSlideIn;
    pillScale.value = withSpring(1, { damping: 14, stiffness: 100 });
    pillTranslateY.value = withTiming(0, {
      duration: ANIMATION.PILL_SLIDE_IN_DURATION,
      easing: Easing.out(Easing.ease),
    });
    pillWidthProgress.value = pillSlideIn;

    // ─── Phase 2: 10.0-10.4s — Pill fades out ───
    const pillFadeOutStart = ANIMATION.PILL_VISIBLE_DURATION;

    pillOpacity.value = withSequence(
      withTiming(1, { duration: pillFadeOutStart }),
      withTiming(0, {
        duration: ANIMATION.PILL_FADE_OUT_DURATION,
        easing: Easing.inOut(Easing.ease),
      })
    );

    pillScale.value = withSequence(
      withTiming(1, { duration: pillFadeOutStart }),
      withTiming(0.9, {
        duration: ANIMATION.PILL_FADE_OUT_DURATION,
        easing: Easing.inOut(Easing.ease),
      })
    );

    // ─── Phase 3: 10.4-11.0s — Search bar appears ───
    const searchAppearStart = pillFadeOutStart + ANIMATION.PILL_FADE_OUT_DURATION;

    searchOpacity.value = withSequence(
      withTiming(0, { duration: searchAppearStart }),
      withTiming(1, {
        duration: ANIMATION.SEARCH_SLIDE_IN_DURATION,
        easing: Easing.out(Easing.ease),
      })
    );

    searchTranslateY.value = withSequence(
      withTiming(15, { duration: searchAppearStart }),
      withTiming(0, {
        duration: ANIMATION.SEARCH_SLIDE_IN_DURATION,
        easing: Easing.out(Easing.ease),
      })
    );

    searchScale.value = withSequence(
      withTiming(0.95, { duration: searchAppearStart }),
      withSpring(1, { damping: 14, stiffness: 100 })
    );
  }, []);

  // ─── Start Animation on Mount ───
  useEffect(() => {
    runAnimationSequence();

    // Show search input after animation completes (11s)
    const searchTimer = setTimeout(() => {
      setShowSearchInput(true);
      animationCompleted.value = true;
    }, ANIMATION.TOTAL_CYCLE);

    return () => {
      clearTimeout(searchTimer);
      cancelAnimation(pillOpacity);
      cancelAnimation(pillScale);
      cancelAnimation(pillTranslateY);
      cancelAnimation(pillWidthProgress);
      cancelAnimation(searchOpacity);
      cancelAnimation(searchTranslateY);
      cancelAnimation(searchScale);
    };
  }, [runAnimationSequence]);

  // ─── Animated Styles ───
  const pillAnimatedStyle = useAnimatedStyle(() => ({
    opacity: pillOpacity.value,
    transform: [
      { scale: pillScale.value },
      { translateY: pillTranslateY.value },
    ],
    width: pillWidthProgress.value * 80 + 80, // Expands from 80 to 160
  }));

  const searchAnimatedStyle = useAnimatedStyle(() => ({
    opacity: searchOpacity.value,
    transform: [
      { translateY: searchTranslateY.value },
      { scale: searchScale.value },
    ],
  }));

  // ─── Handlers ───
  const handleSearchSubmit = useCallback(() => {
    if (searchQuery.trim()) {
      Keyboard.dismiss();
      navigation.navigate('Search', { query: searchQuery.trim() });
      setSearchQuery('');
    }
  }, [searchQuery, navigation]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    searchInputRef.current?.focus();
  }, []);

  const handleSearchBarTap = useCallback(() => {
    if (showSearchInput) {
      searchInputRef.current?.focus();
    } else if (onSearchPress) {
      onSearchPress();
    }
  }, [showSearchInput, onSearchPress]);

  const handleBellPress = useCallback(() => {
    Keyboard.dismiss();
    onBellPress?.();
  }, [onBellPress]);

  const handleFilterPress = useCallback(() => {
    Keyboard.dismiss();
    onFilterPress?.();
  }, [onFilterPress]);

  // ─── Render ───
  return (
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      {/* ─── Pill (fades out after 10s) ─── */}
      <Animated.View
        style={[
          styles.pillContainer,
          pillAnimatedStyle,
        ]}
        pointerEvents="none" // Pill is non-interactive per spec
      >
        <View style={styles.pillWrapper}>
          {/* Glass effect using LinearGradient + overlay layers */}
          <LinearGradient
            colors={glassGradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.glassGradient}
          >
            {/* Frost overlay for glass depth */}
            <View style={[
              styles.frostOverlay,
              { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.15)' }
            ]} />
            
            <View style={styles.pill}>
              {/* Glass reflection overlay */}
              <View style={styles.glassReflection} />
              
              <Text style={[styles.pillText, { color: netflixTextColor }]}>
                NETFLIX
              </Text>
              
              <View style={styles.pillDot} />
              
              <Text style={[styles.pillTextRed, { color: '#E50914' }]}>
                PRO
              </Text>
            </View>
          </LinearGradient>
        </View>
      </Animated.View>

      {/* ─── Search Bar + Bell (appears after pill fades at 10.4s) ─── */}
      <Animated.View
        style={[
          styles.searchContainer,
          searchAnimatedStyle,
        ]}
      >
        <View style={styles.searchBarContainer}>
          {/* Search Bar */}
          <TouchableOpacity
            activeOpacity={1}
            onPress={handleSearchBarTap}
            style={styles.searchBarTouchable}
          >
            <View
              style={[
                styles.searchBar,
                {
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.05)'
                    : 'rgba(0,0,0,0.05)',
                  borderColor: searchFocused
                    ? 'rgba(229, 9, 20, 0.6)'
                    : isDark
                    ? 'rgba(255,255,255,0.08)'
                    : 'rgba(0,0,0,0.08)',
                },
              ]}
            >
              <Ionicons
                name="search"
                size={16}
                color={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'}
              />
              
              <TextInput
                ref={searchInputRef}
                style={[
                  styles.searchInput,
                  { color: isDark ? '#FFFFFF' : '#1A1A1A' },
                ]}
                placeholder="Search..."
                placeholderTextColor={
                  isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'
                }
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSearchSubmit}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
                editable={showSearchInput}
              />
              
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={handleClearSearch}
                  style={styles.clearButton}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name="close-circle"
                    size={16}
                    color={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
                  />
                </TouchableOpacity>
              )}
              
              <TouchableOpacity
                onPress={handleFilterPress}
                style={styles.filterButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name="options-outline"
                  size={16}
                  color={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'}
                />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>

          {/* Notification Bell */}
          <TouchableOpacity
            onPress={handleBellPress}
            style={styles.bellButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name="notifications-outline"
              size={22}
              color={isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)'}
            />
            {notificationCount > 0 && (
              <View style={[styles.badge, { backgroundColor: '#E50914' }]}>
                <Text style={styles.badgeText}>
                  {notificationCount > 9 ? '9+' : notificationCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
};

// ─── Styles ───
const styles = StyleSheet.create({
  container: {
    paddingTop: Platform.OS === 'android' ? 8 : 12,
    paddingHorizontal: 16,
    paddingBottom: 10,
    minHeight: Platform.OS === 'android' ? 64 : 72,
    zIndex: 100,
  },
  pillContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    position: 'absolute',
    top: Platform.OS === 'android' ? 10 : 14,
    left: 0,
    right: 0,
  },
  pillWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    overflow: 'hidden',
    // Subtle shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  glassGradient: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  frostOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    position: 'relative',
    overflow: 'hidden',
    // Inner glow for glass depth
    shadowColor: '#E50914',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
  },
  glassReflection: {
    position: 'absolute',
    top: -30,
    left: -30,
    right: -30,
    bottom: -30,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 20,
    transform: [{ rotate: '25deg' }],
    pointerEvents: 'none',
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  pillDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginHorizontal: 6,
  },
  pillTextRed: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  searchContainer: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 8 : 12,
    left: 16,
    right: 16,
    height: 42,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  searchBarTouchable: {
    flex: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderWidth: 1,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 8,
    marginLeft: 8,
    fontWeight: '400',
  },
  clearButton: {
    padding: 4,
    marginLeft: 4,
  },
  filterButton: {
    padding: 4,
    marginLeft: 4,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(128,128,128,0.15)',
    paddingLeft: 8,
  },
  bellButton: {
    padding: 6,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 14,
  },
});

export default AnimatedHeader;