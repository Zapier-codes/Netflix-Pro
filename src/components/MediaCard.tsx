import React, { useState } from 'react';
import {
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  View,
  Text,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { getImageUrl } from '../services/unified/metadata/TMDBMetadata';
import ImagePlaceholder from './ImagePlaceholder';
import Badge from './Badge';
import { SPORT_LOGO_MAP } from '../api/streameastApi';

const { width } = Dimensions.get('window');
const FOOTER_HEIGHT = 45;

const formatStartTime = (timestamp) => {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  let timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  if (dateOnly.getTime() === today.getTime()) {
    return `Today at ${timeStr}`;
  } else if (dateOnly.getTime() === tomorrow.getTime()) {
    return `Tomorrow at ${timeStr}`;
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }
};

const MediaCard = ({
  item,
  onPress,
  onInfoPress,
  onRemovePress,
  width: customWidth,
  height: customImageHeight,
  isContinueWatching = false,
  isLiveStream = false,
  hasWatched = false,
}) => {
  const { colors, isDark } = useTheme();
  const [imageError, setImageError] = useState(false);

  // ─── Get display title ───
  const getDisplayTitle = () => {
    if (isLiveStream) return item.title || 'Live Event';
    if (isContinueWatching) return item.title || 'Untitled';
    return item.title || item.name || 'Untitled';
  };

  // ─── Get poster path ───
  const getPosterPath = () => {
    if (isContinueWatching) return item.posterPath || item.poster_path || null;
    return item.poster_path || item.posterPath || null;
  };

  // ─── Get rating ───
  const getRating = () => {
    if (isContinueWatching) return item.voteAverage || item.vote_average || null;
    return item.vote_average || item.voteAverage || null;
  };

  // ─── Get progress ───
  const getProgress = () => {
    if (isContinueWatching) {
      if (item.progress !== undefined) return item.progress;
      if (item.position && item.duration) return item.position / item.duration;
    }
    return 0;
  };

  // ─── Get episode info ───
  const getEpisodeInfo = () => {
    if (item.mediaType === 'tv' && item.season && item.episode) {
      return `S${item.season}:E${item.episode}`;
    }
    return null;
  };

  // ─── Get media type ───
  const getMediaType = () => {
    if (isContinueWatching) return item.mediaType || 'movie';
    if (isLiveStream) return 'live';
    return item.media_type || (item.title ? 'movie' : 'tv');
  };

  const displayTitle = getDisplayTitle();
  const posterPath = getPosterPath();
  const rating = getRating();
  const progress = getProgress();
  const episodeInfo = getEpisodeInfo();
  const mediaType = getMediaType();

  const cardWidth = isLiveStream
    ? 240
    : customWidth || defaultWidth;
  const imageContainerHeight = isLiveStream
    ? 135
    : customImageHeight || defaultHeight;

  let imageSource = null;

  if (isLiveStream) {
    const sportToken = item.sportToken || 'DEFAULT';
    const logoUrl = SPORT_LOGO_MAP[sportToken] || SPORT_LOGO_MAP['DEFAULT'];
    imageSource = { uri: logoUrl };
  } else {
    imageSource = posterPath && !imageError
      ? { uri: getImageUrl(posterPath) }
      : null;
  }

  const handleRemove = () => {
    Alert.alert(
      'Remove from Continue Watching',
      `Are you sure you want to remove "${displayTitle}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => onRemovePress?.(item.id || item.mediaId),
        },
      ]
    );
  };

  const handleInfo = () => {
    onInfoPress?.(item);
  };

  const handlePlay = () => {
    if (isContinueWatching && onPress) {
      onPress(item, true);
    } else if (onPress) {
      onPress(item);
    }
  };

  // ─── Live Stream Card ───
  if (isLiveStream) {
    return (
      <View style={[styles.outerContainer, { width: cardWidth }, styles.liveStreamContainer]}>
        <TouchableOpacity
          style={styles.touchableContainer}
          onPress={handlePlay}
          activeOpacity={0.8}
        >
          <View style={[styles.imageContainer, { height: imageContainerHeight }]}>
            {imageSource ? (
              <Image
                source={imageSource}
                style={[styles.image, styles.liveStreamImage]}
                resizeMode="contain"
                onError={() => setImageError(true)}
              />
            ) : (
              <ImagePlaceholder width={cardWidth} height={imageContainerHeight} />
            )}
            <Badge isLive={true} isUpcoming={!item.isLive} />
          </View>
        </TouchableOpacity>
        <View style={[styles.liveStreamFooterContainer, { backgroundColor: colors.surface }]}>
          <Text style={[styles.liveStreamTitle, { color: colors.text }]} numberOfLines={2}>
            {displayTitle}
          </Text>
          {!item.isLive && item.matchTime && (
            <Text style={[styles.startTimeText, { color: colors.textSub }]}>
              {formatStartTime(item.matchTime)}
            </Text>
          )}
        </View>
      </View>
    );
  }

  // ─── Continue Watching Card ───
  if (isContinueWatching) {
    return (
      <View style={[styles.outerContainer, { width: cardWidth }]}>
        <TouchableOpacity
          style={styles.touchableContainer}
          onPress={handlePlay}
          activeOpacity={0.8}
        >
          <View style={[styles.imageContainer, { height: imageContainerHeight }]}>
            {imageSource ? (
              <Image
                source={imageSource}
                style={styles.image}
                resizeMode="cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <ImagePlaceholder width={cardWidth} height={imageContainerHeight} />
            )}
            <View style={styles.playOverlay}>
              <View style={[styles.playButtonBackground, { backgroundColor: 'rgba(0,0,0,0.7)' }]} />
              <Ionicons name="play-circle-outline" size={90} color="#FFFFFF" style={styles.playIcon} />
            </View>
          </View>
        </TouchableOpacity>

        <View style={[styles.footerContainer, { backgroundColor: colors.surface }]}>
          {episodeInfo && (
            <Text style={[styles.episodeText, { color: colors.textSub }]} numberOfLines={1}>
              {episodeInfo}
            </Text>
          )}
          {!episodeInfo && (
            <Text style={[styles.episodeText, { color: colors.textSub }]} numberOfLines={1}>
              {displayTitle}
            </Text>
          )}
          {progress > 0 && progress < 1 && (
            <View style={[styles.progressBarContainer, { backgroundColor: colors.surfaceRaised }]}>
              <View style={[styles.progressBarFill, { backgroundColor: colors.gold, width: `${progress * 100}%` }]} />
            </View>
          )}
          <View style={styles.footerActions}>
            <TouchableOpacity onPress={handleInfo} style={styles.iconButton}>
              <Ionicons name="information-circle-outline" size={22} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleRemove} style={styles.iconButton}>
              <Ionicons name="close-circle-outline" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // ─── Regular Media Card ───
  return (
    <View style={[styles.outerContainer, { width: cardWidth }]}>
      <TouchableOpacity
        style={styles.touchableContainer}
        onPress={handlePlay}
        activeOpacity={0.8}
      >
        <View style={[styles.imageContainer, { height: imageContainerHeight }]}>
          {imageSource ? (
            <Image
              source={imageSource}
              style={styles.image}
              resizeMode="cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <ImagePlaceholder width={cardWidth} height={imageContainerHeight} />
          )}
          <Badge
            mediaType={mediaType}
            releaseDate={item.release_date}
            firstAirDate={item.first_air_date}
            lastAirDate={item.last_air_date}
            hasWatched={hasWatched}
          />
          {rating && rating > 0 && (
            <View style={[styles.ratingBadge, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
              <Ionicons name="star" size={10} color="#FFD700" />
              <Text style={styles.ratingBadgeText}>{rating.toFixed(1)}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
      <View style={[styles.footerContainer, { backgroundColor: colors.surface }]}>
        <Text style={[styles.episodeText, { color: colors.text }]} numberOfLines={2}>
          {displayTitle}
        </Text>
      </View>
    </View>
  );
};

const defaultWidth = width / 3 - 16;
const defaultHeight = defaultWidth * 1.5;

const styles = StyleSheet.create({
  outerContainer: {
    marginHorizontal: 4,
    marginBottom: 5,
    backgroundColor: '#111',
    borderRadius: 4,
    overflow: 'hidden',
  },
  liveStreamContainer: {
    backgroundColor: '#1a0000',
    shadowColor: '#FF0000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
  },
  touchableContainer: {},
  imageContainer: {
    width: '100%',
    backgroundColor: '#222',
    position: 'relative',
    overflow: 'hidden',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  liveStreamImage: {
    backgroundColor: '#000',
  },
  ratingBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 3,
    zIndex: 5,
  },
  ratingBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonBackground: {
    width: 48 * 1.5,
    height: 48 * 1.5,
    borderRadius: 24 * 1.5,
    position: 'absolute',
  },
  playIcon: {},
  footerContainer: {
    paddingHorizontal: 8,
    paddingTop: 5,
    paddingBottom: 5,
    minHeight: FOOTER_HEIGHT,
    justifyContent: 'center',
  },
  episodeText: {
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'left',
    marginBottom: 4,
  },
  progressBarContainer: {
    height: 3,
    borderRadius: 1.5,
    marginBottom: 6,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 1.5,
  },
  footerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconButton: {
    padding: 3,
  },
  liveStreamFooterContainer: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
    minHeight: 50,
  },
  liveStreamTitle: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },
  startTimeText: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '500',
  },
});

export default MediaCard;
