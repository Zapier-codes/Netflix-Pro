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
  // No longer rendered as a separate button — info now lives inside the
  // gradient panel itself. Kept optional so existing callers don't break;
  // wire it to the card tap yourself if you still want an info route.
  onInfoPress?: () => void;
}

const FeaturedContent: React.FC<FeaturedContentProps> = ({
  item,
  onPlay,
  onInfoPress,
}) => {
  const { colors, isDark } = useTheme();

  const title = item.title || item.name || 'Untitled';
  const imagePath = item.backdrop_path || item.poster_path;
  const imageUrl = imagePath ? getImageUrl(imagePath, 'w780') : null;
  const rating = item.vote_average ? item.vote_average.toFixed(1) : null;

  return (
    <TouchableOpacity
      activeOpacity={0.95}
      onPress={onPlay}
      style={[styles.container, { backgroundColor: colors.surface }]}
    >
      {/* Background: autoplaying trailer if available, otherwise backdrop image */}
      <View style={styles.imageContainer}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.placeholder, { backgroundColor: colors.surfaceRaised }]}>
            <Text style={[styles.placeholderText, { color: colors.textMuted }]}>
              🎬
            </Text>
          </View>
        )}

        {/* Dynamic gradient fill — carries the info surface for the card.
            Wider spread + more stops than a flat bottom fade so title,
            overview, and badge all sit on readable, graduated darkness
            instead of needing a separate info panel/button. */}
        <LinearGradient
          colors={[
            'transparent',
            'transparent',
            'rgba(0,0,0,0.15)',
            'rgba(0,0,0,0.55)',
            'rgba(0,0,0,0.85)',
          ]}
          locations={[0, 0.35, 0.55, 0.78, 1]}
          style={styles.gradient}
        />
      </View>

      {/* Content Overlay */}
      <View style={styles.contentOverlay}>
        {/* Brand Badge */}
        <View style={[styles.badge, { backgroundColor: 'rgba(229, 9, 20, 0.9)' }]}>
          <Text style={styles.badgeText}>NETFLIX</Text>
          {rating && (
            <>
              <View style={styles.badgeDivider} />
              <Text style={styles.badgeText}>⭐ {rating}</Text>
            </>
          )}
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: '#FFFFFF' }]} numberOfLines={2}>
          {title}
        </Text>

        {/* Info now lives in the gradient panel itself */}
        {item.overview ? (
          <Text style={styles.overview} numberOfLines={2}>
            {item.overview}
          </Text>
        ) : null}

        {/* Play — sits inside the gradient rather than floating on top of it:
            same near-black tone as the gradient's base, so the fill reads as
            part of the card, with a hairline gold edge and a small notch
            accent on each side for a compact, faceted, HUD-like mark. */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.playButton}
            onPress={onPlay}
            activeOpacity={0.7}
          >
            <View style={[styles.playButtonNotch, { backgroundColor: colors.gold }]} />
            <Ionicons name="play" size={11} color={colors.gold} style={styles.playIcon} />
            <Text style={[styles.playButtonText, { color: colors.gold }]}>PLAY</Text>
            <View style={[styles.playButtonNotch, { backgroundColor: colors.gold }]} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 12,
    marginVertical: 8,
    borderRadius: 12,
    overflow: 'hidden',
    height: BANNER_HEIGHT,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
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
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  overview: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 16,
    marginBottom: 10,
    textShadowColor: 'rgba(0,0,0,0.6)',
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
    borderRadius: 6,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
    gap: 6,
  },
  playButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
});

export default FeaturedContent;
