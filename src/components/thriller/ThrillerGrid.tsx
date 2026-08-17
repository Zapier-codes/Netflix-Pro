// src/components/thriller/ThrillerGrid.tsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  Animated,
  Image,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { ThrillerItem } from '../../services/preloader/ThrillerPreloader';
import { getImageUrl } from '../../services/unified/metadata/TMDBMetadata';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Grid Config ───
const GRID_COLUMNS = 3;
const GRID_ROWS = 2;
const MAX_GRID_ITEMS = GRID_COLUMNS * GRID_ROWS;
const GRID_HORIZONTAL_PADDING = 16;
const GRID_GAP = 8;
const CELL_WIDTH =
  (SCREEN_WIDTH - GRID_HORIZONTAL_PADDING * 2 - GRID_GAP * (GRID_COLUMNS - 1)) /
  GRID_COLUMNS;
const CELL_HEIGHT = CELL_WIDTH * 1.2;

interface ThrillerGridProps {
  items: ThrillerItem[];
  loading?: boolean;
  isVisible?: boolean;
  onItemPress: (item: any) => void;
}

// (Removed: previously used a module-level `activePlayerCount` shared across
// every ThrillerGrid mount for the app's lifetime, gated by a
// MAX_ACTIVE_PLAYERS cap equal to the grid's own size (6). If a cell's
// cleanup ever failed to run — Fast Refresh, a fast remount when `loading`
// flips and the FlatList's key changes, navigating away mid-preload — the
// counter could get stuck above zero and permanently cap future grids below
// 6 playing videos. Since the cap already matched the full grid size, it
// wasn't preventing anything real, so staggering is now purely local
// per-cell timing with no shared/leakable state.)

// ─── Shuffle helper ───
const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// ─── Individual Grid Cell ───
const ThrillerCell: React.FC<{
  item: ThrillerItem;
  index: number;
  isVisible: boolean;
  onPress: (item: any) => void;
}> = ({ item, index, isVisible, onPress }) => {
  const { colors } = useTheme();
  const isLastInRow = index % GRID_COLUMNS === GRID_COLUMNS - 1;

  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ─── Fade poster in on mount ───
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 350,
      delay: index * 60,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim, index]);

  const handlePress = () => {
    onPress({
      id: item.tmdbId,
      title: item.title,
      poster_path: item.posterPath,
      backdrop_path: item.backdropPath,
      overview: item.overview,
      vote_average: item.voteAverage,
      media_type: 'movie',
    });
  };

  const thumbnailUrl = item.posterPath ? getImageUrl(item.posterPath) : null;
  const hasTrailer = !!(item.isLoaded && item.youtubeKey);

  return (
    <TouchableOpacity
      style={[
        styles.cell,
        { backgroundColor: colors.surface },
        !isLastInRow && styles.cellSpacing,
      ]}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <Animated.View style={[styles.thumbnailContainer, { opacity: fadeAnim }]}>
        {/* Cover art */}
        {thumbnailUrl ? (
          <Image source={{ uri: thumbnailUrl }} style={styles.poster} resizeMode="cover" />
        ) : (
          <View style={[styles.posterContainer, { backgroundColor: colors.surfaceRaised }]}>
            <Ionicons name="film-outline" size={24} color={colors.textMuted} />
          </View>
        )}

        {/* Play badge — indicates an official trailer is available (opens details/trailer on press) */}
        {hasTrailer && (
          <View style={styles.playBadgeWrapper}>
            <View style={styles.playBadge}>
              <Ionicons name="play" size={14} color="#fff" />
            </View>
          </View>
        )}
      </Animated.View>

      <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>
        {item.title}
      </Text>
    </TouchableOpacity>
  );
};

// ─── Skeleton Cell ───
const SkeletonCell: React.FC<{ colors: any; index: number }> = ({ colors, index }) => {
  const isLastInRow = index % GRID_COLUMNS === GRID_COLUMNS - 1;
  return (
    <View
      style={[
        styles.cell,
        { backgroundColor: colors.surface },
        !isLastInRow && styles.cellSpacing,
      ]}
    >
      <View style={styles.thumbnailContainer}>
        <View style={[styles.poster, { backgroundColor: colors.surfaceRaised }]} />
      </View>
      <View style={[styles.skeletonTitle, { backgroundColor: colors.surfaceRaised }]} />
    </View>
  );
};

// ─── Main Component ───
export const ThrillerGrid: React.FC<ThrillerGridProps> = ({
  items,
  loading = false,
  isVisible = true,
  onItemPress,
}) => {
  const { colors } = useTheme();

  const flatListKey = loading ? 'skeleton-grid' : 'content-grid';

  // ─── Shuffle the entire pool and pick 6 fresh items ───
  // This runs on every render, giving a fresh batch each time
  const displayItems = useMemo(() => {
    if (loading || !items || items.length === 0) {
      return [];
    }

    // Separate loaded trailers from fallbacks
    const loadedItems = items.filter((item) => item.isLoaded && item.youtubeKey);
    const fallbackItems = items.filter((item) => !(item.isLoaded && item.youtubeKey));

    // Shuffle both pools independently
    const shuffledLoaded = shuffleArray(loadedItems);
    const shuffledFallback = shuffleArray(fallbackItems);

    // Combine: loaded first, then fallbacks
    const combined = [...shuffledLoaded, ...shuffledFallback];

    // Pick 6 from the shuffled combined pool
    return combined.slice(0, MAX_GRID_ITEMS);
  }, [items, loading]);

  if (loading) {
    return (
      <View style={styles.container}>
        <FlatList
          key={flatListKey}
          data={Array.from({ length: MAX_GRID_ITEMS }, (_, i) => i)}
          renderItem={({ index }) => <SkeletonCell colors={colors} index={index} />}
          keyExtractor={(item) => `skeleton-${item}`}
          numColumns={GRID_COLUMNS}
          contentContainerStyle={styles.gridContent}
          scrollEnabled={false}
          columnWrapperStyle={styles.columnWrapper}
        />
      </View>
    );
  }

  if (!items || items.length === 0 || displayItems.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <FlatList
        key={flatListKey}
        data={displayItems}
        renderItem={({ item, index }) => (
          <ThrillerCell
            item={item}
            index={index}
            isVisible={isVisible}
            onPress={onItemPress}
          />
        )}
        keyExtractor={(item) => item.id || `item-${Math.random()}`}
        numColumns={GRID_COLUMNS}
        contentContainerStyle={styles.gridContent}
        scrollEnabled={false}
        columnWrapperStyle={styles.columnWrapper}
        removeClippedSubviews={true}
        initialNumToRender={MAX_GRID_ITEMS}
        maxToRenderPerBatch={MAX_GRID_ITEMS}
      />
    </View>
  );
};

// ─── Styles ───
const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    paddingHorizontal: GRID_HORIZONTAL_PADDING,
  },
  gridContent: {},
  columnWrapper: {
    marginBottom: GRID_GAP,
  },
  cell: {
    width: CELL_WIDTH,
    borderRadius: 6,
    overflow: 'hidden',
  },
  cellSpacing: {
    marginRight: GRID_GAP,
  },
  thumbnailContainer: {
    width: CELL_WIDTH,
    height: CELL_HEIGHT,
    position: 'relative',
    borderRadius: 6,
    overflow: 'hidden',
  },
  posterContainer: {
    width: CELL_WIDTH,
    height: CELL_HEIGHT,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  poster: {
    width: CELL_WIDTH,
    height: CELL_HEIGHT,
    borderRadius: 6,
    backgroundColor: '#1a1a1a',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playBadgeWrapper: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    zIndex: 10,
  },
  playBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTitle: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 4,
    paddingHorizontal: 2,
    textAlign: 'center',
  },
  skeletonTitle: {
    height: 10,
    borderRadius: 3,
    marginTop: 4,
    width: '80%',
    alignSelf: 'center',
  },
});

export default ThrillerGrid;