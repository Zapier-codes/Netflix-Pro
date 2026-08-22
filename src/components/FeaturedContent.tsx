// src/components/FeaturedContent.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import Animated, { useAnimatedStyle, interpolate, Extrapolation, SharedValue } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { getImageUrl } from '../services/unified/metadata/TMDBMetadata';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BANNER_HEIGHT = 200; // Compact height (reduced from 300-400px)
const BANNER_ASPECT_RATIO = 16 / 9;

interface FeaturedContentProps {
  item: {
    id: number;
    title?: string;
    name?: string;
    poster_path?: string;
    backdrop_path?: string;
    overview?: string;
    vote_average?: number;
    media_type?: 'movie' | 'tv';
  };
  onPlay: () => void;
  onInfoPress?: () => void;
  // Optional — pass the parent list's Reanimated scroll shared value (in
  // px) to get a subtle parallax/zoom effect on the hero image: the image
  // drifts slightly slower than the scroll while scrolling down, and
  // scales up slightly on iOS-style rubber-band overscroll at the top.
  // Omit entirely for a static hero (e.g. if used somewhere without a
  // Reanimated-driven scroll container).
  scrollY?: SharedValue<number>;
}

const FeaturedContent: React.FC<FeaturedContentProps> = ({
  item,
  onPlay,
  onInfoPress,
  scrollY,
}) => {
  const { colors, isDark } = useTheme();

  const title = item.title || item.name || 'Untitled';
  const imagePath = item.backdrop_path || item.poster_path;
  const imageUrl = imagePath ? getImageUrl(imagePath, 'w780') : null;
  const rating = item.vote_average ? item.vote_average.toFixed(1) : null;

  // ─── Glass gradient colors based on theme ───
  const glassGradientColors = isDark
    ? ['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.85)']
    : ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.3)', 'rgba(255,255,255,0.6)'];

  // ─── Play button glass effect ───
  const playButtonGlass = isDark
    ? 'rgba(255,255,255,0.05)'
    : 'rgba(255,255,255,0.2)';
  
  const playButtonBorder = isDark
    ? 'rgba(255,255,255,0.1)'
    : 'rgba(255,255,255,0.3)';

  const infoButtonGlass = isDark
    ? 'rgba(255,255,255,0.08)'
    : 'rgba(255,255,255,0.25)';

  // ─── Parallax: only active when the parent hands us its scroll shared
  //     value. FeaturedContent is a normal scrolling item inside
  //     HomeScreen's FlatList (not a pinned/sticky hero), so a
  //     scroll-past drift effect would fight the list's own motion and
  //     risk revealing gaps at the image's edges (it's sized exactly to
  //     its container, with no overflow buffer for that). The one
  //     effect that's both safe and correct here is a gentle zoom on
  //     iOS-style overscroll bounce at the very top of the list
  //     (scrollY goes negative) — scaling up only ever grows the image
  //     beyond its frame, never reveals empty space, and reads as a
  //     nice "elastic" touch other Netflix-style heroes use. ───
  const parallaxStyle = useAnimatedStyle(() => {
    if (!scrollY) return {};
    return {
      transform: [
        { scale: interpolate(scrollY.value, [-BANNER_HEIGHT, 0], [1.15, 1], Extrapolation.CLAMP) },
      ],
    };
  }, [scrollY]);

  return (
    <TouchableOpacity
      activeOpacity={0.95}
      onPress={onPlay}
      style={[
        styles.container,
        {
          // Glass effect background
          backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.2)',
          borderWidth: 0.5,
          borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.3)',
          // Shadow for depth
          shadowColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(66,133,244,0.15)',
        }
      ]}
    >
      {/* ─── Background Image ─── */}
      <View style={styles.imageContainer}>
        {imageUrl ? (
          <Animated.Image
            source={{ uri: imageUrl }}
            style={[styles.image, parallaxStyle]}
            resizeMode="cover"
          />
        ) : (
          <View style={[
            styles.placeholder,
            { 
              backgroundColor: isDark ? colors.surfaceRaised : 'rgba(0,0,0,0.03)' 
            }
          ]}>
            <Text style={[styles.placeholderText, { color: colors.textMuted }]}>
              🎬
            </Text>
          </View>
        )}

        {/* ─── Glass Gradient Overlay ─── */}
        <LinearGradient
          colors={[
            'transparent',
            'transparent',
            glassGradientColors[0],
            glassGradientColors[1],
            glassGradientColors[2],
          ]}
          locations={[0, 0.35, 0.55, 0.78, 1]}
          style={styles.gradient}
        />
      </View>

      {/* ─── Content Overlay ─── */}
      <View style={styles.contentOverlay}>
        {/* ─── Brand Badge ─── */}
        <View style={[
          styles.badge,
          { 
            backgroundColor: isDark ? 'rgba(229, 9, 20, 0.9)' : 'rgba(229, 9, 20, 0.85)',
          }
        ]}>
          <Text style={styles.badgeText}>NETFLIX</Text>
          {rating && (
            <>
              <View style={styles.badgeDivider} />
              <Text style={styles.badgeText}>⭐ {rating}</Text>
            </>
          )}
        </View>

        {/* ─── Title ─── */}
        <Text 
          style={[
            styles.title, 
            { 
              color: isDark ? '#FFFFFF' : '#1A2A3A',
              textShadowColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.3)',
            }
          ]} 
          numberOfLines={2}
        >
          {title}
        </Text>

        {/* ─── Overview ─── */}
        {item.overview && (
          <Text 
            style={[
              styles.overview,
              { 
                color: isDark ? 'rgba(255,255,255,0.85)' : 'rgba(26,42,58,0.85)',
                textShadowColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.4)',
              }
            ]} 
            numberOfLines={2}
          >
            {item.overview}
          </Text>
        )}

        {/* ─── Play + Info Buttons ─── */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[
              styles.playButton,
              {
                backgroundColor: playButtonGlass,
                borderColor: playButtonBorder,
              }
            ]}
            onPress={onPlay}
            activeOpacity={0.7}
          >
            {/* Glass reflection */}
            <View style={[
              styles.glassReflection,
              { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.15)' }
            ]} />
            
            <View style={[styles.playButtonNotch, { backgroundColor: colors.gold }]} />
            <Ionicons name="play" size={11} color={colors.gold} style={styles.playIcon} />
            <Text style={[styles.playButtonText, { color: colors.gold }]}>PLAY</Text>
            <View style={[styles.playButtonNotch, { backgroundColor: colors.gold }]} />
          </TouchableOpacity>

          {onInfoPress && (
            <TouchableOpacity
              style={[
                styles.infoButton,
                {
                  backgroundColor: infoButtonGlass,
                  borderColor: playButtonBorder,
                }
              ]}
              onPress={onInfoPress}
              activeOpacity={0.7}
            >
              <Ionicons
                name="information-circle-outline"
                size={15}
                color={isDark ? '#FFFFFF' : '#1A2A3A'}
                style={styles.infoIcon}
              />
              <Text style={[styles.infoButtonText, { color: isDark ? '#FFFFFF' : '#1A2A3A' }]}>
                INFO
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 12,
    marginVertical: 8,
    borderRadius: 16,
    overflow: 'hidden',
    height: BANNER_HEIGHT,
    elevation: 6,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  imageContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 40,
  },
  gradient: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  contentOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 6,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  badgeDivider: {
    width: 1,
    height: 12,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  overview: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 10,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    gap: 6,
    position: 'relative',
    overflow: 'hidden',
  },
  glassReflection: {
    position: 'absolute',
    top: -20,
    left: -20,
    right: -20,
    bottom: -20,
    borderRadius: 8,
    transform: [{ rotate: '25deg' }],
    pointerEvents: 'none',
  },
  playButtonText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
  },
  playIcon: {
    marginLeft: -2,
  },
  playButtonNotch: {
    width: 2,
    height: 16,
    borderRadius: 1,
    opacity: 0.6,
  },
  infoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    gap: 5,
  },
  infoButtonText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  infoIcon: {
    marginLeft: -1,
  },
});

export default FeaturedContent;