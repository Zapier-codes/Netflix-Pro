// src/components/thriller/ThrillerGrid.tsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Image,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useTheme } from '../../contexts/ThemeContext';
import { useMavinTrending } from '../../hooks/useMavin';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_COLUMNS = 3;
const CELL_WIDTH = (SCREEN_WIDTH - 32) / GRID_COLUMNS;
const CELL_HEIGHT = CELL_WIDTH * 1.5;

interface ThrillerGridProps {
  onItemPress?: (item: any) => void;
  category?: string;
  limit?: number;
  muted?: boolean;
}

interface ThrillerItem {
  id: string;
  title: string;
  thumbnail: string;
  videoUrl?: string;
  duration?: number;
  uploaderName: string;
  viewCount: number;
}

export const ThrillerGrid: React.FC<ThrillerGridProps> = ({
  onItemPress,
  category = 'movies',
  limit = 12,
  muted = true,
}) => {
  const { colors } = useTheme();
  const { data, loading, error, refresh } = useMavinTrending(category);
  const [items, setItems] = useState<ThrillerItem[]>([]);
  const videoRefs = useRef<Map<string, any>>(new Map());
  const [isMounted, setIsMounted] = useState(true);
  const [visibleItems, setVisibleItems] = useState<Set<string>>(new Set());

  // Process Mavin items into thriller grid items
  useEffect(() => {
    if (data.length > 0) {
      const processed = data.slice(0, limit).map((item: any) => ({
        id: item.id || item.url || String(Math.random()),
        title: item.name || item.title || 'Untitled',
        thumbnail: item.thumbnails?.[0]?.url || '',
        videoUrl: item.url,
        duration: item.duration || 0,
        uploaderName: item.uploaderName || 'Unknown',
        viewCount: item.viewCount || 0,
      }));
      setItems(processed);
    }
  }, [data, limit]);

  // Auto-play all visible videos when items are loaded
  useEffect(() => {
    if (items.length > 0) {
      // Start playing all videos after a small delay
      const timer = setTimeout(() => {
        playAllVideos();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [items]);

  // Play all videos
  const playAllVideos = useCallback(() => {
    videoRefs.current.forEach((player) => {
      if (player && !player.isPlaying) {
        try {
          player.play();
        } catch (e) {
          // Ignore playback errors
        }
      }
    });
  }, []);

  // Pause all videos
  const pauseAllVideos = useCallback(() => {
    videoRefs.current.forEach((player) => {
      if (player && player.isPlaying) {
        try {
          player.pause();
        } catch (e) {
          // Ignore errors
        }
      }
    });
  }, []);

  // Handle visibility change - play/pause based on visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      // When screen is active, play all; when background, pause all
      // This handles app state changes
    };

    // Pause all when component unmounts
    return () => {
      pauseAllVideos();
      videoRefs.current.clear();
    };
  }, []);

  // Handle item press - navigate to details or play
  const handleItemPress = useCallback((item: ThrillerItem, index: number) => {
    // Toggle mute/unmute on tap, or navigate
    if (onItemPress) {
      onItemPress(item);
    }
  }, [onItemPress]);

  // Render each grid cell - all videos auto-play simultaneously
  const renderItem = useCallback(({ item, index }: { item: ThrillerItem; index: number }) => {
    // Create a unique key for this video
    const videoKey = ${item.id}_;
    
    // Create player for this cell - auto-plays when loaded
    const player = useVideoPlayer(null, (playerInstance) => {
      // This callback runs when the player instance is created
      if (item.videoUrl) {
        playerInstance.replace(item.videoUrl);
        // Auto-play immediately (muted by default)
        playerInstance.play();
        // Store reference
        videoRefs.current.set(videoKey, playerInstance);
      }
    });

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        if (videoRefs.current.has(videoKey)) {
          const p = videoRefs.current.get(videoKey);
          if (p) {
            try {
              p.pause();
              p.replace(null);
            } catch (e) {}
          }
          videoRefs.current.delete(videoKey);
        }
      };
    }, [videoKey]);

    // Update video when item changes
    useEffect(() => {
      if (item.videoUrl) {
        const p = videoRefs.current.get(videoKey);
        if (p) {
          try {
            // Only replace if different to avoid flicker
            const currentUrl = p.source?.uri || '';
            if (currentUrl !== item.videoUrl) {
              p.replace(item.videoUrl);
              p.play();
            }
          } catch (e) {
            // Ignore errors
          }
        }
      }
    }, [item.videoUrl, videoKey]);

    // Toggle mute on demand
    useEffect(() => {
      const p = videoRefs.current.get(videoKey);
      if (p) {
        p.muted = muted;
      }
    }, [muted, videoKey]);

    return (
      <TouchableOpacity
        style={[styles.cell, { backgroundColor: colors.surface }]}
        onPress={() => handleItemPress(item, index)}
        activeOpacity={0.8}
      >
        <View style={styles.thumbnailContainer}>
          <VideoView
            player={player}
            style={styles.video}
            contentFit="cover"
            isMuted={muted}
            allowsPictureInPicture={false}
            nativeControls={false}
          />
          
          {/* Duration Badge */}
          {item.duration > 0 && (
            <View style={[styles.durationBadge, { backgroundColor: 'rgba(0,0,0,0.8)' }]}>
              <Text style={styles.durationText}>
                {formatDuration(item.duration)}
              </Text>
            </View>
          )}
          
          {/* Play/Pause Overlay - appears on hover/tap */}
          <View style={styles.overlay}>
            <View style={[styles.playCircle, { backgroundColor: 'rgba(0,0,0,0.4)' }]}>
              <Ionicons name="play" size={20} color="#FFFFFF" />
            </View>
          </View>
        </View>

        <View style={styles.itemInfo}>
          <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={[styles.itemSubtitle, { color: colors.textMuted }]} numberOfLines={1}>
            {item.uploaderName} • {formatViewCount(item.viewCount)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }, [colors, muted, handleItemPress]);

  // Loading state
  if (loading && items.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.gold} />
        <Text style={[styles.loadingText, { color: colors.textSub }]}>
          Loading thriller content...
        </Text>
      </View>
    );
  }

  // Error state
  if (error && items.length === 0) {
    return (
      <View style={styles.errorContainer}>
        <Text style={[styles.errorText, { color: colors.error }]}>⚠️ {error}</Text>
        <TouchableOpacity onPress={refresh}>
          <Text style={[styles.retryText, { color: colors.gold }]}>Tap to Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Empty state
  if (items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          No thriller content available
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>🔥 Thriller Picks</Text>
        <View style={styles.headerBadge}>
          <View style={styles.liveDot} />
          <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
            Auto-playing
          </Text>
        </View>
      </View>
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item, index) => ${item.id}_}
        numColumns={GRID_COLUMNS}
        contentContainerStyle={styles.gridContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
        columnWrapperStyle={styles.columnWrapper}
        removeClippedSubviews={false}
        windowSize={21}
        initialNumToRender={limit}
        maxToRenderPerBatch={limit}
        updateCellsBatchingPeriod={50}
      />
    </View>
  );
};

// Helper functions
const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return ${mins}:;
};

const formatViewCount = (count: number): string => {
  if (count >= 1_000_000) return ${(count / 1_000_000).toFixed(1)}M;
  if (count >= 1_000) return ${(count / 1_000).toFixed(1)}K;
  return String(count);
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E50914',
    marginRight: 6,
  },
  headerSubtitle: {
    fontSize: 12,
  },
  gridContent: {
    paddingHorizontal: 8,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cell: {
    width: CELL_WIDTH,
    borderRadius: 8,
    overflow: 'hidden',
  },
  thumbnailContainer: {
    width: CELL_WIDTH,
    height: CELL_HEIGHT,
    position: 'relative',
  },
  video: {
    width: CELL_WIDTH,
    height: CELL_HEIGHT,
    backgroundColor: '#000',
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
  playCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  itemInfo: {
    padding: 8,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  itemSubtitle: {
    fontSize: 11,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorContainer: {
    padding: 40,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  retryText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
  },
});

export default ThrillerGrid;
