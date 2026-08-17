// src/components/ContinueWatchingPanel.tsx
import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  Animated,
  TouchableOpacity,
  Dimensions,
  Image,
  FlatList,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useContinueWatching } from '../store/zustand';
import { Ionicons } from '@expo/vector-icons';
import { liveViewerEngine } from '../utils/contentUtils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PANEL_WIDTH = SCREEN_WIDTH * 0.85;
const PANEL_OFFSET = SCREEN_WIDTH - 80;

// Card dimensions - rectangular (16:9 aspect ratio)
const CARD_WIDTH = PANEL_WIDTH - 48;
const CARD_HEIGHT = CARD_WIDTH * 0.5625; // 16:9 ratio

interface ContinueWatchingPanelProps {
  onItemPress?: (item: any) => void;
  visible: boolean;
  onClose: () => void;
}

export const ContinueWatchingPanel: React.FC<ContinueWatchingPanelProps> = ({
  onItemPress,
  visible,
  onClose,
}) => {
  const { colors } = useTheme();
  const { items } = useContinueWatching();
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const translateX = useRef(new Animated.Value(PANEL_OFFSET)).current;
  const flatListRef = useRef<FlatList>(null);

  // ─── Auto-slideshow (needs more than 2 cards to bother sliding) ───
  useEffect(() => {
    if (items.length > 2 && isOpen) {
      const interval = setInterval(() => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % items.length);
      }, 4000); // Change card every 4 seconds

      return () => clearInterval(interval);
    }
  }, [items.length, isOpen]);

  // ─── Scroll to current index ───
  useEffect(() => {
    if (flatListRef.current && items.length > 0) {
      flatListRef.current.scrollToIndex({
        index: currentIndex,
        animated: true,
      });
    }
  }, [currentIndex, items.length]);

  // ─── Live viewer counts for each item ───
  const getViewerCount = (contentId: string): number => {
    return liveViewerEngine.getViewerCount(contentId) || Math.floor(Math.random() * 100) + 10;
  };

  const getViewerTrend = (contentId: string): 'up' | 'down' | 'stable' => {
    return liveViewerEngine.getTrend(contentId) || 'stable';
  };

  const getPeakViewers = (contentId: string): number => {
    return liveViewerEngine.getPeakViewers(contentId) || 0;
  };

  // ─── Pan Responder ───
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        const newX = PANEL_OFFSET + gestureState.dx;
        if (newX >= 0 && newX <= PANEL_OFFSET) {
          translateX.setValue(newX);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const shouldOpen = gestureState.dx < -50;
        const shouldClose = gestureState.dx > 50;
        
        if (shouldOpen) {
          openPanel();
        } else if (shouldClose) {
          closePanel();
        } else if (isOpen) {
          openPanel();
        } else {
          closePanel();
        }
      },
    })
  ).current;

  // ─── Panel Controls ───
  const openPanel = () => {
    setIsOpen(true);
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();
  };

  const closePanel = () => {
    setIsOpen(false);
    Animated.spring(translateX, {
      toValue: PANEL_OFFSET,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();
    onClose();
  };

  const handleItemPress = (item: any) => {
    if (onItemPress) {
      onItemPress(item);
    }
    closePanel();
  };

  // ─── Format viewer count ───
  const formatViewerCount = (count: number): string => {
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return String(count);
  };

  // ─── Render Card Item ───
  const renderItem = ({ item }: { item: any }) => {
    const viewerCount = getViewerCount(item.id);
    const trend = getViewerTrend(item.id);
    const peak = getPeakViewers(item.id);
    const progressPercent = Math.round(item.progress || 0);

    return (
      <TouchableOpacity
        style={styles.cardContainer}
        onPress={() => handleItemPress(item)}
        activeOpacity={0.9}
      >
        <View style={[styles.card, { backgroundColor: colors.surfaceRaised }]}>
          {/* ─── Thumbnail ─── */}
          <Image
            source={{ uri: item.posterPath || 'https://via.placeholder.com/400x225' }}
            style={styles.cardThumbnail}
            resizeMode="cover"
          />

          {/* ─── Overlay Content ─── */}
          <View style={styles.cardOverlay}>
            {/* ─── Progress Bar ─── */}
            <View style={styles.progressContainer}>
              <View style={[styles.progressBar, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: colors.gold || '#E50914',
                      width: `${progressPercent}%`,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.progressText, { color: '#FFFFFF' }]}>
                {progressPercent}%
              </Text>
            </View>

            {/* ─── Title and Episode ─── */}
            <View style={styles.infoContainer}>
              <Text style={[styles.cardTitle, { color: '#FFFFFF' }]} numberOfLines={1}>
                {item.title}
              </Text>
              {item.episodeTitle && (
                <Text style={[styles.cardEpisode, { color: 'rgba(255,255,255,0.8)' }]} numberOfLines={1}>
                  {item.episodeTitle}
                </Text>
              )}
            </View>

            {/* ─── Live Viewer Count ─── */}
            <View style={styles.viewerContainer}>
              <View style={[styles.liveDotSmall, { backgroundColor: '#E50914' }]} />
              <Text style={[styles.viewerText, { color: 'rgba(255,255,255,0.8)' }]}>
                {formatViewerCount(viewerCount)} watching
                {trend === 'up' && ' ↑'}
                {trend === 'down' && ' ↓'}
                {peak > viewerCount && ` (peak ${formatViewerCount(peak)})`}
              </Text>
            </View>

            {/* ─── Play Icon ─── */}
            <View style={styles.playIconContainer}>
              <Ionicons name="play-circle" size={48} color="rgba(255,255,255,0.9)" />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ─── Render Pagination Dots ───
  const renderPagination = () => {
    if (items.length <= 1) return null;

    return (
      <View style={styles.paginationContainer}>
        {items.map((_, index) => (
          <View
            key={index}
            style={[
              styles.paginationDot,
              {
                backgroundColor: index === currentIndex ? colors.gold || '#E50914' : 'rgba(255,255,255,0.3)',
                width: index === currentIndex ? 24 : 8,
              },
            ]}
          />
        ))}
      </View>
    );
  };

  // ─── Render ───
  if (!visible || items.length === 0) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateX }],
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
      {...panResponder.panHandlers}
    >
      {/* ─── Handle ─── */}
      <View style={[styles.handle, { backgroundColor: colors.border }]} />

      {/* ─── Header ─── */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Continue Watching
        </Text>
        <TouchableOpacity onPress={closePanel} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* ─── Live Counter ─── */}
      <View style={[styles.liveCounter, { backgroundColor: colors.surfaceRaised }]}>
        <View style={styles.liveDot} />
        <Text style={[styles.liveText, { color: colors.textSub }]}>
          {items.length} {items.length === 1 ? 'item' : 'items'} • 
          {items.reduce((acc, item) => acc + getViewerCount(item.id), 0)} viewers
        </Text>
      </View>

      {/* ─── Cards Carousel ─── */}
      <View style={styles.carouselContainer}>
        <FlatList
          ref={flatListRef}
          data={items}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEnabled={false} // Disable manual scrolling for auto-slideshow
          getItemLayout={(data, index) => ({
            length: PANEL_WIDTH - 32,
            offset: (PANEL_WIDTH - 32) * index,
            index,
          })}
          contentContainerStyle={styles.flatListContent}
        />
      </View>

      {/* ─── Pagination ─── */}
      {renderPagination()}

      {/* ─── Footer ─── */}
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <Text style={[styles.footerText, { color: colors.textMuted }]}>
          Tap to resume • Swipe right to close
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: PANEL_WIDTH,
    height: '100%',
    paddingTop: 48,
    paddingHorizontal: 16,
    borderLeftWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 16,
    zIndex: 100,
  },
  handle: {
    position: 'absolute',
    top: 16,
    left: '50%',
    transform: [{ translateX: -20 }],
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  liveCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 16,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E50914',
    marginRight: 8,
  },
  liveText: {
    fontSize: 13,
  },
  carouselContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  flatListContent: {
    alignItems: 'flex-start',
  },
  cardContainer: {
    width: PANEL_WIDTH - 32,
    paddingHorizontal: 2,
    alignItems: 'flex-start',
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  cardThumbnail: {
    width: '100%',
    height: '100%',
  },
  cardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginRight: 10,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '700',
    minWidth: 36,
    textAlign: 'right',
  },
  infoContainer: {
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  cardEpisode: {
    fontSize: 13,
    fontWeight: '500',
  },
  viewerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  viewerText: {
    fontSize: 12,
    fontWeight: '500',
  },
  playIconContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -24 }, { translateY: -24 }],
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  paginationDot: {
    height: 6,
    borderRadius: 3,
    transitionDuration: '300ms',
  },
  footer: {
    paddingTop: 12,
    borderTopWidth: 0.5,
    paddingBottom: 20,
  },
  footerText: {
    fontSize: 12,
    textAlign: 'center',
  },
});

export default ContinueWatchingPanel;