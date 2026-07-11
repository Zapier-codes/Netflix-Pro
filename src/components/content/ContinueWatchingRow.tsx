/**
 * ContinueWatchingRow - Continue watching horizontal scroll row
 * Features: Progress bar overlay, tap to resume, long press to remove
 * Shows poster with progress indicator
 */

import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Dimensions,
  Animated,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../contexts/ThemeContext';
import { ContinueWatchingItem } from '../../../utils/continueWatching';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = 120;
const CARD_HEIGHT = 170;

interface ContinueWatchingRowProps {
  items: ContinueWatchingItem[];
  onItemPress: (item: ContinueWatchingItem) => void;
  onRemoveItem?: (id: string) => void;
  loading?: boolean;
  title?: string;
  maxItems?: number;
}

export function ContinueWatchingRow({
  items,
  onItemPress,
  onRemoveItem,
  loading = false,
  title = 'Continue Watching',
  maxItems = 10,
}: ContinueWatchingRowProps) {
  const { colors, isDark } = useTheme();
  const [longPressed, setLongPressed] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {[1, 2, 3, 4].map((_, index) => (
            <View
              key={`skeleton-${index}`}
              style={[styles.skeletonCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]}
            >
              <View style={[styles.skeletonPoster, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]} />
              <View style={[styles.skeletonTitle, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]} />
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }

  if (items.length === 0) {
    return null;
  }

  const displayItems = items.slice(0, maxItems);

  const handleLongPress = (item: ContinueWatchingItem) => {
    if (onRemoveItem) {
      Alert.alert(
        'Remove from Continue Watching',
        `Remove "${item.title}" from your continue watching list?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => onRemoveItem(item.id),
          },
        ]
      );
    }
  };

  const handlePressIn = () => {
    longPressTimer.current = setTimeout(() => {
      setLongPressed(true);
    }, 500);
  };

  const handlePressOut = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setLongPressed(false);
  };

  const renderItem = (item: ContinueWatchingItem) => {
    const progressPercent = Math.min(item.progress * 100, 100);

    return (
      <TouchableOpacity
        key={item.id}
        style={styles.card}
        onPress={() => onItemPress(item)}
        onLongPress={() => handleLongPress(item)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.7}
        delayLongPress={500}
      >
        <View style={styles.posterContainer}>
          <Image
            source={item.poster ? { uri: item.poster } : require('../../../assets/icon.png')}
            style={styles.poster}
            resizeMode="cover"
          />
          
          {/* Play icon overlay on hover/long press */}
          {longPressed && (
            <View style={styles.overlay}>
              <Ionicons name="play-circle" size={40} color="white" />
            </View>
          )}

          {/* Progress bar at bottom */}
          <View style={styles.progressContainer}>
            <View
              style={[
                styles.progressBar,
                {
                  width: `${progressPercent}%`,
                  backgroundColor: colors.gold,
                },
              ]}
            />
          </View>

          {/* Episode/Season badge for TV shows */}
          {item.type === 'tv' && item.season !== undefined && item.episode !== undefined && (
            <View style={[styles.episodeBadge, { backgroundColor: 'rgba(0,0,0,0.75)' }]}>
              <Text style={styles.episodeBadgeText}>
                S{item.season}:E{item.episode}
              </Text>
            </View>
          )}

          {/* Progress percentage text */}
          <View style={[styles.progressBadge, { backgroundColor: 'rgba(0,0,0,0.75)' }]}>
            <Text style={styles.progressBadgeText}>
              {Math.round(progressPercent)}%
            </Text>
          </View>
        </View>

        <Text style={[styles.titleText, { color: colors.text }]} numberOfLines={1}>
          {item.title}
        </Text>
        {item.episodeTitle && (
          <Text style={[styles.episodeText, { color: colors.textMuted }]} numberOfLines={1}>
            {item.episodeTitle}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        {items.length > maxItems && (
          <TouchableOpacity onPress={() => {}}>
            <Text style={[styles.seeAll, { color: colors.textMuted }]}>
              See All
            </Text>
          </TouchableOpacity>
        )}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {displayItems.map(renderItem)}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  seeAll: {
    fontSize: 13,
    fontWeight: '500',
  },
  scrollContent: {
    gap: 10,
    paddingRight: 16,
  },
  card: {
    width: CARD_WIDTH,
  },
  posterContainer: {
    position: 'relative',
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 8,
    overflow: 'hidden',
  },
  poster: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 8,
  },
  progressContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  episodeBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  episodeBadgeText: {
    color: 'white',
    fontSize: 9,
    fontWeight: '600',
  },
  progressBadge: {
    position: 'absolute',
    bottom: 8,
    right: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  progressBadgeText: {
    color: 'white',
    fontSize: 9,
    fontWeight: '600',
  },
  titleText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
  },
  episodeText: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 1,
  },
  skeletonCard: {
    width: CARD_WIDTH,
    borderRadius: 8,
    overflow: 'hidden',
  },
  skeletonPoster: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 8,
  },
  skeletonTitle: {
    height: 10,
    borderRadius: 4,
    marginTop: 6,
    width: '70%',
    alignSelf: 'center',
  },
});

export default ContinueWatchingRow;