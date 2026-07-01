// src/components/header/AnimatedHeader.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  TextInput,
  Easing,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useNavigation } from '@react-navigation/native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface AnimatedHeaderProps {
  onSearchPress?: () => void;
  onBellPress?: () => void;
  onFilterPress?: () => void;
}

export const AnimatedHeader: React.FC<AnimatedHeaderProps> = ({
  onSearchPress,
  onBellPress,
  onFilterPress,
}) => {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const logoTranslateY = useRef(new Animated.Value(20)).current;
  const searchOpacity = useRef(new Animated.Value(0)).current;
  const searchTranslateY = useRef(new Animated.Value(30)).current;
  const lineWidth = useRef(new Animated.Value(0)).current;
  const lineOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animateLogo = () => {
      logoOpacity.setValue(0);
      logoScale.setValue(0.8);
      logoTranslateY.setValue(20);
      searchOpacity.setValue(0);
      searchTranslateY.setValue(30);
      lineWidth.setValue(0);
      lineOpacity.setValue(1);
      setShowSearch(false);

      Animated.sequence([
        Animated.timing(lineWidth, {
          toValue: SCREEN_WIDTH * 0.6,
          duration: 600,
          easing: Easing.out(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.delay(100),
        Animated.timing(lineOpacity, {
          toValue: 0.8,
          duration: 300,
          useNativeDriver: false,
        }),
        Animated.parallel([
          Animated.timing(logoOpacity, {
            toValue: 1,
            duration: 500,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.spring(logoScale, {
            toValue: 1,
            tension: 80,
            friction: 12,
            useNativeDriver: true,
          }),
          Animated.timing(logoTranslateY, {
            toValue: 0,
            duration: 500,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(lineOpacity, {
            toValue: 0.3,
            duration: 500,
            useNativeDriver: false,
          }),
        ]),
        Animated.delay(30000),
        Animated.parallel([
          Animated.timing(logoOpacity, {
            toValue: 0.6,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(searchOpacity, {
            toValue: 1,
            duration: 500,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(searchTranslateY, {
            toValue: 0,
            duration: 500,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(lineOpacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: false,
          }),
        ]),
      ]).start(() => {
        setShowSearch(true);
        setTimeout(() => {
          animateLogo();
        }, 5000);
      });
    };

    animateLogo();

    return () => {
      logoOpacity.stopAnimation();
      logoScale.stopAnimation();
      logoTranslateY.stopAnimation();
      searchOpacity.stopAnimation();
      searchTranslateY.stopAnimation();
      lineWidth.stopAnimation();
      lineOpacity.stopAnimation();
    };
  }, []);

  const handleSearchSubmit = () => {
    if (searchQuery.trim()) {
      navigation.navigate('Search', { query: searchQuery.trim() });
      setSearchQuery('');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Animated.View
        style={[
          styles.redLineContainer,
          {
            opacity: lineOpacity,
            width: lineWidth,
            alignSelf: 'center',
          },
        ]}
      >
        <View style={[styles.redLine, { backgroundColor: colors.gold }]} />
        <View style={[styles.redLineGlow, { backgroundColor: colors.gold }]} />
      </Animated.View>

      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: logoOpacity,
            transform: [{ scale: logoScale }, { translateY: logoTranslateY }],
          },
        ]}
      >
        <Text style={[styles.logoText, { color: colors.gold }]}>Netflix Pro</Text>
      </Animated.View>

      <Animated.View
        style={[
          styles.searchContainer,
          {
            opacity: searchOpacity,
            transform: [{ translateY: searchTranslateY }],
          },
        ]}
      >
        {showSearch ? (
          <View style={styles.searchBarContainer}>
            <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="search" size={20} color={colors.textMuted} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Search movies, TV shows..."
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSearchSubmit}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
              />
              <TouchableOpacity onPress={onFilterPress} style={styles.filterButton}>
                <Ionicons name="options" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={onBellPress} style={styles.bellButton}>
              <Ionicons name="notifications-outline" size={24} color={colors.text} />
              <View style={[styles.badge, { backgroundColor: colors.error }]} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.placeholderContainer} />
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
    minHeight: 70,
  },
  redLineContainer: {
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: 20,
    left: 0,
    right: 0,
  },
  redLine: {
    height: 3,
    width: '100%',
    borderRadius: 2,
  },
  redLineGlow: {
    position: 'absolute',
    top: -10,
    bottom: -10,
    left: -20,
    right: -20,
    opacity: 0.2,
    borderRadius: 20,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 60,
  },
  logoText: {
    fontSize: 28,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  searchContainer: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    height: 50,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 8,
    marginLeft: 8,
  },
  filterButton: {
    padding: 4,
    marginLeft: 4,
  },
  bellButton: {
    padding: 4,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  placeholderContainer: {
    height: 50,
  },
});

export default AnimatedHeader;
