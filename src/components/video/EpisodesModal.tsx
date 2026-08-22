import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { formatRuntime, isFutureDate } from '../../utils/timeUtils';
import { useTheme } from '../../contexts/ThemeContext';
import { SPACING, RADIUS, TYPOGRAPHY, getGlassTokens } from '../../theme/tokens';
import { GlassPanel, GlassButton } from '../glass';

const EpisodesModal = ({
  visible,
  onClose,
  title,
  allSeasonsData,
  selectedSeasonForModal,
  episodesForModal,
  isLoadingModalEpisodes,
  currentSeason,
  currentEpisode,
  onSelectSeason,
  onSelectEpisode,
  seasonListRef,
  episodeListRef,
  mediaId,
  poster_path,
}) => {
  const { colors, isDark } = useTheme();
  const glass = getGlassTokens(colors, isDark);

  const renderEpisodeItem = ({ item: episodeData }) => {
    const progress = episodeData.watchProgress;
    let progressPercent = 0;
    if (progress && progress.duration > 0 && progress.position > 0) {
      progressPercent = (progress.position / progress.duration);
    }

    const episodePoster = episodeData.still_path
      ? `https://image.tmdb.org/t/p/w300${episodeData.still_path}`
      : null;

    const isCurrentEpisode = currentSeason === episodeData.season_number && currentEpisode === episodeData.episode_number;
    const isEpisodeUnreleased = isFutureDate(episodeData.air_date);

    return (
      <TouchableOpacity
        style={[
          styles.episodeItemHorizontal,
          { borderColor: glass.surfaceBorder },
          isCurrentEpisode && { borderColor: 'rgba(229, 9, 20, 0.5)', borderWidth: 1.5 },
        ]}
        onPress={() => {
          if (isCurrentEpisode) {
            onClose();
            return;
          }
          onSelectEpisode({
            mediaId: mediaId,
            mediaType: 'tv',
            season: episodeData.season_number,
            episode: episodeData.episode_number,
            title: title,
            episodeTitle: episodeData.name,
            poster_path: poster_path,
            air_date: episodeData.air_date,
          });
        }}
        activeOpacity={0.85}
      >
        <BlurView intensity={glass.blurIntensity.light} tint={glass.tint} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: glass.surface }]} />
        <View style={styles.episodeThumbnailContainerHorizontal}>
          {episodePoster ? (
            <Image source={{ uri: episodePoster }} style={styles.episodeThumbnailHorizontal} />
          ) : (
            <View style={[styles.episodeThumbnailHorizontal, styles.placeholderThumbnailHorizontal]}>
              <Ionicons name="image-outline" size={40} color="#555" />
            </View>
          )}
          {isEpisodeUnreleased && (
            <View style={styles.unreleasedBadgeContainer}>
              <View style={styles.unreleasedBadge}>
                <Text style={styles.unreleasedBadgeText}>UNRELEASED</Text>
              </View>
            </View>
          )}
          {progressPercent > 0 && progressPercent < 1 && !isEpisodeUnreleased && (
            <View style={styles.episodeProgressOverlayHorizontal}>
              <View style={[styles.episodeProgressBarHorizontal, { width: `${progressPercent * 100}%` }]} />
            </View>
          )}
          {progressPercent >= 1 && !isEpisodeUnreleased && (
            <View style={styles.watchedOverlayHorizontal}>
              <Ionicons name="checkmark-circle" size={30} color="rgba(255, 255, 255, 0.9)" />
            </View>
          )}
        </View>
        <View style={styles.episodeDetailsHorizontal}>
          <Text style={[TYPOGRAPHY.bodyStrong, { color: colors.text }]} numberOfLines={2}>
            {`E${episodeData.episode_number}: ${episodeData.name || `Episode ${episodeData.episode_number}`}`}
          </Text>
          <Text style={[TYPOGRAPHY.caption, { color: colors.textSub, marginTop: 4 }]} numberOfLines={3}>
            {episodeData.overview || 'No overview available.'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      presentationStyle="overFullScreen"
      supportedOrientations={['landscape', 'landscape-left', 'landscape-right']}
      onShow={async () => {
        try {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        } catch (e) {
          console.error("Episodes Modal onShow: Failed to lock orientation:", e);
        }
      }}
      onRequestClose={() => {
        onClose();
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE)
          .catch(e => console.error("Failed to re-lock orientation on episodes modal close:", e));
      }}
    >
      <View style={styles.episodesModalOverlay}>
        <GlassPanel style={styles.episodesModalContent} elevationLevel={4} radius={RADIUS.lg} bordered={false}>
          <View style={[styles.episodesModalHeader, { borderBottomColor: glass.surfaceBorder }]}>
            <Text style={[TYPOGRAPHY.h2, { color: colors.text }]}>{title} - Episodes</Text>
            <GlassButton
              icon={<Ionicons name="close" size={22} color={colors.text} />}
              onPress={onClose}
              size={40}
            />
          </View>

          {isLoadingModalEpisodes && !allSeasonsData.length ? (
            <ActivityIndicator size="large" color="#E50914" style={{ flex: 1 }} />
          ) : (
            <>
              {allSeasonsData.length > 1 && (
                <View style={[styles.seasonSelectorContainer, { borderBottomColor: glass.surfaceBorder }]}>
                  <FlatList
                    ref={seasonListRef}
                    horizontal
                    data={allSeasonsData.sort((a, b) => a.season_number - b.season_number)}
                    renderItem={({ item: seasonItem }) => {
                      const isSelected = selectedSeasonForModal === seasonItem.season_number;
                      return (
                        <TouchableOpacity
                          style={[
                            styles.seasonTab,
                            { backgroundColor: glass.surface, borderColor: glass.surfaceBorder },
                            isSelected && styles.seasonTabSelected,
                          ]}
                          onPress={() => onSelectSeason(seasonItem.season_number)}
                          activeOpacity={0.8}
                        >
                          <Text style={[TYPOGRAPHY.bodyStrong, { color: colors.text }]}>
                            {seasonItem.name || `Season ${seasonItem.season_number}`}
                          </Text>
                        </TouchableOpacity>
                      );
                    }}
                    keyExtractor={(item) => `season-tab-${item.id || item.season_number}`}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.seasonTabContentContainer}
                    getItemLayout={(data, index) => ({
                      length: 130,
                      offset: 130 * index,
                      index,
                    })}
                    onScrollToIndexFailed={(info) => {
                      const wait = new Promise(resolve => setTimeout(resolve, 200));
                      wait.then(() => {
                        seasonListRef.current?.scrollToOffset({
                          offset: info.averageItemLength * info.index,
                          animated: true,
                        });
                      });
                    }}
                  />
                </View>
              )}
              {isLoadingModalEpisodes && episodesForModal.length === 0 ? (
                <View style={styles.centeredLoader}>
                  <ActivityIndicator size="large" color="#E50914" />
                </View>
              ) : episodesForModal.length > 0 ? (
                <FlatList
                  ref={episodeListRef}
                  horizontal
                  data={episodesForModal.sort((a, b) => a.episode_number - b.episode_number)}
                  renderItem={renderEpisodeItem}
                  keyExtractor={(item) => `ep-${item.id || (item.season_number + '_' + item.episode_number)}`}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.episodesListContentHorizontal}
                  initialNumToRender={3}
                  maxToRenderPerBatch={5}
                  windowSize={7}
                  getItemLayout={(data, index) => ({
                    length: 195,
                    offset: 195 * index,
                    index,
                  })}
                  onScrollToIndexFailed={(info) => {
                    const wait = new Promise(resolve => setTimeout(resolve, 200));
                    wait.then(() => {
                      episodeListRef.current?.scrollToOffset({
                        offset: info.averageItemLength * info.index,
                        animated: true,
                      });
                    });
                  }}
                />
              ) : (
                <View style={styles.centeredMessage}>
                  <Text style={[TYPOGRAPHY.body, { color: colors.textMuted }]}>
                    No episodes found for this season.
                  </Text>
                </View>
              )}
            </>
          )}
        </GlassPanel>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  episodesModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  episodesModalContent: {
    width: '95%',
    height: '90%',
    maxHeight: 380,
    paddingTop: 0,
  },
  episodesModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md + 3,
    borderBottomWidth: 1,
  },
  seasonSelectorContainer: {
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.sm + 2,
    borderBottomWidth: 1,
  },
  seasonTabContentContainer: {
    paddingHorizontal: SPACING.sm + 2,
  },
  seasonTab: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg - 1,
    borderRadius: RADIUS.sm,
    marginRight: SPACING.sm + 2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  seasonTabSelected: {
    backgroundColor: 'rgba(229, 9, 20, 0.85)',
    borderColor: '#E50914',
  },
  episodesListContentHorizontal: {
    paddingVertical: SPACING.md + 3,
    paddingLeft: SPACING.xl,
    paddingRight: SPACING.sm,
  },
  episodeItemHorizontal: {
    flexDirection: 'column',
    borderRadius: RADIUS.sm,
    marginRight: SPACING.lg - 1,
    padding: SPACING.sm + 2,
    width: 180,
    height: 220,
    justifyContent: 'flex-start',
    overflow: 'hidden',
    borderWidth: 1,
  },
  episodeThumbnailContainerHorizontal: {
    width: '100%',
    height: 100,
    borderRadius: RADIUS.xs,
    overflow: 'hidden',
    backgroundColor: '#333',
    position: 'relative',
    marginBottom: SPACING.sm,
  },
  episodeThumbnailHorizontal: {
    width: '100%',
    height: '100%',
  },
  placeholderThumbnailHorizontal: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#282828',
  },
  episodeProgressOverlayHorizontal: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 5,
    backgroundColor: 'rgb(75, 75, 75)',
  },
  episodeProgressBarHorizontal: {
    height: '100%',
    backgroundColor: '#E50914',
  },
  watchedOverlayHorizontal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: RADIUS.xs,
  },
  episodeDetailsHorizontal: {
    paddingTop: 5,
  },
  unreleasedBadgeContainer: {
    position: 'absolute',
    top: 5,
    right: 5,
    zIndex: 1,
  },
  unreleasedBadge: {
    backgroundColor: '#000',
    borderColor: '#fff',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  unreleasedBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  centeredLoader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centeredMessage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
});

export default EpisodesModal;
