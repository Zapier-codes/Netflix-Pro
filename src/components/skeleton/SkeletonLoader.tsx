// src/components/skeleton/SkeletonLoader.tsx
import React from 'react';
import { View, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SkeletonLoaderProps {
  type: 'trending' | 'album' | 'mix' | 'channel' | 'podcast' | 'radio' | 'grid' | 'card';
  count?: number;
  showIcon?: boolean;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({ type, count = 1, showIcon = true }) => {
  const { colors, isDark } = useTheme();
  const pulseAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, []);

  const backgroundColor = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      isDark ? '#1A1A1A' : '#E0E0E0',
      isDark ? '#2A2A2A' : '#F0F0F0',
    ],
  });

  if (type === 'trending') {
    return (
      <View style={styles.trendingRow}>
        <View style={styles.trendingLeft}>
          <Animated.View style={[styles.trendingThumbnail, { backgroundColor }]} />
          <View style={styles.trendingInfo}>
            <Animated.View style={[styles.titleSkeleton, { backgroundColor, width: 150 }]} />
            <Animated.View style={[styles.artistSkeleton, { backgroundColor, width: 100 }]} />
          </View>
        </View>
      </View>
    );
  }

  if (type === 'album' || type === 'mix' || type === 'grid') {
    return (
      <View style={styles.albumCard}>
        <Animated.View style={[styles.albumImage, { backgroundColor }]} />
        <View style={styles.albumOverlay}>
          <Animated.View style={[styles.titleSkeleton, { backgroundColor, width: 80 }]} />
          <Animated.View style={[styles.artistSkeleton, { backgroundColor, width: 60 }]} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Animated.View style={[styles.cardImage, { backgroundColor }]} />
      <Animated.View style={[styles.cardTitle, { backgroundColor, width: '70%' }]} />
      <Animated.View style={[styles.cardSubtitle, { backgroundColor, width: '50%' }]} />
    </View>
  );
};

export const SkeletonList: React.FC<{ type: SkeletonLoaderProps['type']; count: number }> = ({ type, count }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonLoader key={index} type={type} />
      ))}
    </>
  );
};

const styles = StyleSheet.create({
  trendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    padding: 10,
  },
  trendingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  trendingThumbnail: {
    width: 46,
    height: 46,
    borderRadius: 6,
  },
  trendingInfo: {
    flex: 1,
    marginLeft: 10,
    gap: 4,
  },
  albumCard: {
    width: 130,
    height: 170,
    borderRadius: 10,
    overflow: 'hidden',
    marginRight: 10,
  },
  albumImage: {
    width: '100%',
    height: '100%',
  },
  albumOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    gap: 4,
  },
  card: {
    width: 160,
    marginRight: 12,
  },
  cardImage: {
    width: '100%',
    height: 100,
    borderRadius: 8,
  },
  cardTitle: {
    height: 14,
    borderRadius: 4,
    marginTop: 8,
  },
  cardSubtitle: {
    height: 11,
    borderRadius: 3,
    marginTop: 4,
  },
  titleSkeleton: {
    height: 14,
    borderRadius: 4,
  },
  artistSkeleton: {
    height: 12,
    borderRadius: 4,
  },
});
