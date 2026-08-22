// src/components/ContinueWatchingRow.tsx
import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
import { ContinueWatchingItem } from '../../store/zustand/continueWatching';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Slimmer Horizontal/Landscape Card ───
const CARD_WIDTH = SCREEN_WIDTH * 0.45;
const CARD_HEIGHT = CARD_WIDTH * 0.5625;
const CARD_SPACING = 8; // matches MediaCard's marginHorizontal:4 * 2 (gap between cards)
const ITEM_WIDTH = CARD_WIDTH + CARD_SPACING;
const ROW_PADDING = 6; // matches MediaRow's listContainer paddingHorizontal

interface ContinueWatchingRowProps {
  items: ContinueWatchingItem[];
  onItemPress: (item: ContinueWatchingItem) => void;
  onRemoveItem?: (id: string) => void;
  loading?: boolean;
  title?: string;
}

export function ContinueWatchingRow({
  items,
  onItemPress,
  onRemoveItem,
  loading = false,
  title = 'Continue Watching',
}: ContinueWatchingRowProps) {
  const { colors } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  // Pauses the auto-advance interval while the user is actively dragging
  // the list, and for a short grace period after they let go — otherwise
  // the auto-advance would immediately yank the list back to wherever
  // the interval next fires, fighting the user's own scroll gesture.
  const isUserInteractingRef = useRef(false);
  const resumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Safety net: the row is only ever meant to show up to 8 cards, even if a
  // caller passes more. Ordering (latest-first) is the caller's job — this
  // just enforces the cap.
  const displayItems = items.slice(0, 8);

  // ─── Get poster URL ───
  const getPosterUrl = (item: ContinueWatchingItem): string => {
    if (item.posterPath) {
      if (item.posterPath.startsWith('http://') || item.posterPath.startsWith('https://')) {
        return item.posterPath;
      }
      if (item.posterPath.startsWith('/')) {
        return `https://image.tmdb.org/t/p/w500${item.posterPath}`;
      }
      return `https://image.tmdb.org/t/p/w500/${item.posterPath}`;
    }
    return 'https://via.placeholder.com/400x225/1a1a2e/ffffff?text=No+Image';
  };

  // ─── Auto-slideshow ───
  useEffect(() => {
    if (displayItems.length > 1) {
      const interval = setInterval(() => {
        if (isUserInteractingRef.current) return; // paused — see handlers below
        setCurrentIndex((prevIndex) => (prevIndex + 1) % displayItems.length);
      }, 4000);

      return () => clearInterval(interval);
    }
  }, [displayItems.length]);

  // ─── Scroll to current index (smooth slide, not a full-page jump) ───
  useEffect(() => {
    if (flatListRef.current && displayItems.length > 0 && !isUserInteractingRef.current) {
      // Looping back to the first card snaps instantly (a long animated
      // scroll backwards would look like a glitch); every other advance
      // slides smoothly to the next card's offset.
      flatListRef.current.scrollToOffset({
        offset: currentIndex * ITEM_WIDTH,
        animated: currentIndex !== 0,
      });
    }
  }, [currentIndex, displayItems.length]);

  useEffect(() => {
    return () => {
      if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
    };
  }, []);

  if (loading || displayItems.length === 0) {
    return null;
  }

  // ─── User manually scrolling: pause auto-advance, and sync
  //     currentIndex to wherever they land so the next auto-advance
  //     continues from there instead of snapping back. ───
  const handleScrollBeginDrag = () => {
    isUserInteractingRef.current = true;
    if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
  };

  const handleMomentumScrollEnd = (e: any) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / ITEM_WIDTH);
    setCurrentIndex(Math.max(0, Math.min(index, displayItems.length - 1)));
    // Grace period before auto-advance resumes, so a deliberate manual
    // browse isn't immediately overridden.
    resumeTimeoutRef.current = setTimeout(() => {
      isUserInteractingRef.current = false;
    }, 3000);
  };

  const renderItem = ({ item }: { item: ContinueWatchingItem }) => {
    const progressPercent = Math.round(item.progress * 100);
    const posterUrl = getPosterUrl(item);

    return (
      <TouchableOpacity
        style={styles.cardContainer}
        onPress={() => onItemPress(item)}
        onLongPress={() => onRemoveItem?.(item.id)}
        activeOpacity={0.9}
      >
        <View style={[styles.card, { backgroundColor: colors.surfaceRaised }]}>
          {/* ─── Background Image ─── */}
          <Image
            source={{ uri: posterUrl }}
            style={styles.cardThumbnail}
            resizeMode="cover"
          />

          {/* ─── Gradient Overlay ─── */}
          <View style={styles.gradientOverlay} />

          {/* ─── Content Overlay ─── */}
          <View style={styles.cardOverlay}>
            {/* ─── Top Section: Episode Badge (Top Right) & Progress (Top Left, no background) ─── */}
            <View style={styles.topSection}>
              {/* ─── Percentage - Top Left, text only, no circle/background ─── */}
              <Text style={styles.progressText}>
                {progressPercent}%
              </Text>

              {/* ─── Episode Badge - Top Right ─── */}
              {item.season !== undefined && item.episode !== undefined && (
                <View style={[styles.episodeBadge, { backgroundColor: 'rgba(0,0,0,0.75)' }]}>
                  <Text style={styles.episodeBadgeText}>
                    S{item.season}:E{item.episode}
                  </Text>
                </View>
              )}
            </View>

            {/* ─── Bottom Section: Title, low and blended into the poster like a
                   lock-screen "now playing" label sitting over artwork ─── */}
            <View style={styles.bottomTitleSection}>
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.55)']}
                style={styles.bottomTitleGradient}
              >
                <Text style={[styles.cardTitle]} numberOfLines={2}>
                  {item.title}
                </Text>
                {item.episodeTitle && (
                  <Text style={styles.cardEpisode} numberOfLines={1}>
                    {item.episodeTitle}
                  </Text>
                )}
              </LinearGradient>
            </View>

            {/* ─── Transparent Play Icon ─── */}
            <View style={styles.playIconContainer}>
              <Ionicons name="play-circle-outline" size={40} color="rgba(255,255,255,0.7)" />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>

      <View style={styles.carouselContainer}>
        <FlatList
          ref={flatListRef}
          data={displayItems}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEnabled={true}
          onScrollBeginDrag={handleScrollBeginDrag}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          getItemLayout={(data, index) => ({
            length: ITEM_WIDTH,
            offset: ITEM_WIDTH * index,
            index,
          })}
          contentContainerStyle={styles.flatListContent}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    marginLeft: 16,
  },
  carouselContainer: {
    width: SCREEN_WIDTH,
    height: CARD_HEIGHT + 16,
    justifyContent: 'center',
  },
  flatListContent: {
    paddingHorizontal: ROW_PADDING,
  },
  cardContainer: {
    width: ITEM_WIDTH,
    paddingRight: CARD_SPACING,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  cardThumbnail: {
    width: '100%',
    height: '100%',
  },
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  cardOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    padding: 10,
  },
  topSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  // ─── Percentage: plain text, no circle/background, just a soft shadow
  //      so it stays legible against any poster art ───
  progressText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  episodeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  episodeBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  // ─── Bottom Section: title sits low on the poster, blended in via a
  //      dark gradient scrim behind it — dims the text into the artwork
  //      the way a lock-screen "now playing" label sits over album art ───
  bottomTitleSection: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  bottomTitleGradient: {
    paddingHorizontal: 14,
    paddingTop: 20,
    paddingBottom: 10,
    alignItems: 'center',
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    opacity: 0.85,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
    lineHeight: 16,
  },
  cardEpisode: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
    marginTop: 2,
  },
  playIconContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -20 }, { translateY: -20 }],
  },
});

export default ContinueWatchingRow;