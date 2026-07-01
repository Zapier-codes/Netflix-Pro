// src/screens/details/DetailsScreen.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

// Zustand Stores
import { useContinueWatching } from '../../store/zustand';
import { useTheme } from '../../contexts/ThemeContext';
import { useAlert } from '../../contexts/AlertContext';

// Components
import MediaCard from '../../components/MediaCard';
import DownloadButton from '../../components/DownloadButton';
import { SkeletonLoader } from '../../components/skeleton/SkeletonLoader';

// API
import {
  fetchTVShowDetails,
  fetchSeasonDetails,
  fetchMovieDetails,
  getImageUrl,
  fetchMovieRecommendations,
  fetchTVShowRecommendations,
} from '../../api/tmdbApi';

const DetailsScreen = ({ route, navigation }) => {
  const { colors } = useTheme();
  const { showToast } = useAlert();
  const { addItem: addToContinueWatching } = useContinueWatching();

  const { mediaId, mediaType, title: routeTitle, poster_path: routePoster } = route.params;

  const [details, setDetails] = useState<any>(null);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [seasonDetails, setSeasonDetails] = useState<any>(null);
  const [episodeProgress, setEpisodeProgress] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [displayedEpisodesCount, setDisplayedEpisodesCount] = useState(25);
  const [recommendations, setRecommendations] = useState([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [selectedTab, setSelectedTab] = useState('episodes');

  const scrollViewRef = useRef<ScrollView>(null);
  const seasonListRef = useRef<FlatList>(null);

  useFocusEffect(
    useCallback(() => {
      // Lock orientation
      return () => {};
    }, [])
  );

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        setLoading(true);
        setRecommendations([]);

        if (mediaType === 'tv') {
          const mediaDetails = await fetchTVShowDetails(mediaId);
          const validSeasons = mediaDetails.seasons?.filter(s => s.season_number > 0) || [];
          mediaDetails.seasons = validSeasons;
          setDetails(mediaDetails);

          if (validSeasons.length > 0) {
            setSelectedSeason(validSeasons[0].season_number);
            const seasonData = await fetchSeasonDetails(mediaId, validSeasons[0].season_number);
            setSeasonDetails(seasonData);
          }

          const recs = await fetchTVShowRecommendations(mediaId);
          setRecommendations(recs.slice(0, 18));
        } else {
          const mediaDetails = await fetchMovieDetails(mediaId);
          setDetails(mediaDetails);
          const recs = await fetchMovieRecommendations(mediaId);
          setRecommendations(recs.slice(0, 18));
        }
      } catch (error) {
        console.error('[Details] Error:', error);
        showToast('Failed to load details');
      } finally {
        setLoading(false);
        setLoadingRecommendations(false);
      }
    };

    fetchDetails();
  }, [mediaId, mediaType]);

  const handlePlay = useCallback(() => {
    if (!details) return;

    const displayTitle = mediaType === 'tv' ? details.name : details.title;

    // Add to continue watching
    addToContinueWatching({
      id: ${mediaType}_,
      title: displayTitle,
      mediaType,
      tmdbId: String(mediaId),
      posterPath: details.poster_path || routePoster,
      progress: 0,
      currentTime: 0,
      duration: 0,
    });

    navigation.navigate('VideoPlayer', {
      mediaId,
      mediaType,
      title: displayTitle,
      poster_path: details.poster_path || routePoster,
      season: selectedSeason,
      episode: 1,
    });
  }, [details, mediaId, mediaType, selectedSeason]);

  const handleEpisodePress = useCallback((episode: any) => {
    addToContinueWatching({
      id: ${mediaType}__s_e,
      title: details.name,
      mediaType,
      tmdbId: String(mediaId),
      posterPath: details.poster_path,
      season: selectedSeason,
      episode: episode.episode_number,
      episodeTitle: episode.name,
      progress: 0,
      currentTime: 0,
      duration: 0,
    });

    navigation.replace('VideoPlayer', {
      mediaId,
      mediaType: 'tv',
      season: selectedSeason,
      episode: episode.episode_number,
      title: details.name,
      episodeTitle: episode.name,
      poster_path: details.poster_path,
    });
  }, [mediaId, mediaType, selectedSeason, details]);

  const handleSeasonChange = async (seasonNumber: number) => {
    try {
      setLoading(true);
      setSelectedSeason(seasonNumber);
      const seasonData = await fetchSeasonDetails(mediaId, seasonNumber);
      setSeasonDetails(seasonData);
      setDisplayedEpisodesCount(25);
    } catch (error) {
      console.error('[Details] Season change error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !details) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  const displayTitle = mediaType === 'tv' ? details?.name : details?.title;
  const releaseDate = mediaType === 'tv' ? details?.first_air_date : details?.release_date;
  const releaseYear = releaseDate ? releaseDate.split('-')[0] : 'Unknown';
  const genres = details?.genres?.map(g => g.name) || [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView ref={scrollViewRef} showsVerticalScrollIndicator={false}>
        {/* Header with Backdrop */}
        <View style={styles.headerContainer}>
          {details?.backdrop_path ? (
            <Image
              source={{ uri: getImageUrl(details.backdrop_path, 'w780') }}
              style={styles.backdropImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.backdropPlaceholder, { backgroundColor: colors.surface }]} />
          )}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.6)', colors.background]}
            style={styles.gradient}
          />
          <View style={styles.headerContent}>
            <Text style={[styles.title, { color: colors.text }]}>{displayTitle}</Text>
            <View style={styles.infoRow}>
              <Text style={[styles.rating, { color: colors.gold }]}>
                {details?.vote_average?.toFixed(1) || 'N/A'} ⭐
              </Text>
              <Text style={[styles.year, { color: colors.textSub }]}>{releaseYear}</Text>
              {mediaType === 'tv' && details?.number_of_seasons && (
                <Text style={[styles.seasons, { color: colors.textSub }]}>
                  {details.number_of_seasons} Seasons
                </Text>
              )}
            </View>

            {/* Genre Badges */}
            <View style={styles.genreBadgeContainer}>
              {genres.slice(0, 4).map((genre, index) => (
                <View key={index} style={[styles.genreBadge, { backgroundColor: colors.surfaceRaised }]}>
                  <Text style={[styles.genreBadgeText, { color: colors.textSub }]}>{genre}</Text>
                </View>
              ))}
            </View>

            {/* Play Button */}
            <TouchableOpacity style={[styles.playButton, { backgroundColor: colors.gold }]} onPress={handlePlay}>
              <Ionicons name="play" size={18} color="#000" />
              <Text style={[styles.playButtonText, { color: '#000' }]}>Play</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Overview */}
        <View style={styles.overviewContainer}>
          <Text style={[styles.overview, { color: colors.text }]}>{details?.overview}</Text>
        </View>

        {/* TV Show Content */}
        {mediaType === 'tv' && (
          <>
            <View style={[styles.tabContainer, { borderBottomColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.tab, selectedTab === 'episodes' && styles.tabActive]}
                onPress={() => setSelectedTab('episodes')}
              >
                <Text style={[styles.tabText, selectedTab === 'episodes' && { color: colors.text }]}>
                  Episodes
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, selectedTab === 'moreLikeThis' && styles.tabActive]}
                onPress={() => setSelectedTab('moreLikeThis')}
              >
                <Text style={[styles.tabText, selectedTab === 'moreLikeThis' && { color: colors.text }]}>
                  More Like This
                </Text>
              </TouchableOpacity>
            </View>

            {selectedTab === 'episodes' && (
              <View style={styles.episodesContainer}>
                {/* Season Selector */}
                <FlatList
                  ref={seasonListRef}
                  horizontal
                  data={details?.seasons || []}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.seasonButton,
                        selectedSeason === item.season_number && { backgroundColor: colors.gold },
                        { backgroundColor: colors.surfaceRaised }
                      ]}
                      onPress={() => handleSeasonChange(item.season_number)}
                    >
                      <Text
                        style={[
                          styles.seasonButtonText,
                          selectedSeason === item.season_number && { color: '#000' },
                          { color: colors.text }
                        ]}
                      >
                        Season {item.season_number}
                      </Text>
                    </TouchableOpacity>
                  )}
                  keyExtractor={(item) => season-}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.seasonsScrollContent}
                />

                {/* Episodes List */}
                {loading ? (
                  <View style={styles.episodesLoadingContainer}>
                    <ActivityIndicator size="small" color={colors.gold} />
                  </View>
                ) : (
                  seasonDetails?.episodes?.slice(0, displayedEpisodesCount).map((episode: any) => (
                    <TouchableOpacity
                      key={episode.id}
                      style={[styles.episodeItem, { borderBottomColor: colors.border }]}
                      onPress={() => handleEpisodePress(episode)}
                    >
                      <View style={styles.episodeRow}>
                        <View style={styles.episodeThumbnailColumn}>
                          <View style={[styles.episodeImageContainer, { backgroundColor: colors.surface }]}>
                            {episode.still_path ? (
                              <Image
                                source={{ uri: getImageUrl(episode.still_path) }}
                                style={styles.episodeImage}
                              />
                            ) : (
                              <View style={[styles.episodeImagePlaceholder, { backgroundColor: colors.surfaceRaised }]} />
                            )}
                            <View style={styles.playButtonOverlay}>
                              <View style={[styles.playButtonCircle, { borderColor: colors.text }]}>
                                <Ionicons name="play" size={16} color={colors.text} />
                              </View>
                            </View>
                          </View>
                        </View>
                        <View style={styles.episodeInfoColumn}>
                          <Text style={[styles.episodeTitle, { color: colors.text }]}>
                            {episode.episode_number}. {episode.name}
                          </Text>
                          <Text style={[styles.episodeOverview, { color: colors.textSub }]} numberOfLines={2}>
                            {episode.overview || 'No description available.'}
                          </Text>
                        </View>
                        <DownloadButton
                          variant="icon"
                          size="medium"
                          mediaId={mediaId}
                          mediaType="tv"
                          season={selectedSeason}
                          episode={episode.episode_number}
                          title={details.name}
                          episodeTitle={episode.name}
                          posterPath={details.poster_path}
                        />
                      </View>
                    </TouchableOpacity>
                  ))
                )}

                {seasonDetails?.episodes?.length > displayedEpisodesCount && (
                  <TouchableOpacity
                    style={[styles.loadMoreButton, { backgroundColor: colors.surfaceRaised }]}
                    onPress={() => setDisplayedEpisodesCount(prev => Math.min(prev + 50, seasonDetails.episodes.length))}
                  >
                    <Text style={[styles.loadMoreButtonText, { color: colors.text }]}>Load More Episodes</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {selectedTab === 'moreLikeThis' && (
              <View style={styles.recommendationsGrid}>
                {recommendations.map((item) => (
                  <MediaCard
                    key={ec-}
                    item={item}
                    onPress={() => navigation.push('DetailScreen', {
                      mediaId: item.id,
                      mediaType: item.media_type || (item.title ? 'movie' : 'tv'),
                      title: item.title || item.name,
                    })}
                  />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerContainer: {
    position: 'relative',
    height: 400,
  },
  backdropImage: {
    width: '100%',
    height: 400,
    position: 'absolute',
  },
  backdropPlaceholder: {
    width: '100%',
    height: 400,
    position: 'absolute',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 500,
  },
  headerContent: {
    padding: 16,
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  rating: { marginRight: 12, fontWeight: 'bold' },
  year: { marginRight: 12, fontSize: 14 },
  seasons: { fontSize: 14 },
  genreBadgeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  genreBadge: {
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginRight: 8,
    marginBottom: 8,
  },
  genreBadgeText: { fontSize: 12 },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  playButtonText: { fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
  overviewContainer: { padding: 16 },
  overview: { fontSize: 14, lineHeight: 22 },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 5,
    borderBottomWidth: 1,
  },
  tab: { marginRight: 24, paddingBottom: 10 },
  tabActive: { borderBottomWidth: 3, borderBottomColor: '#E50914' },
  tabText: { fontSize: 15, fontWeight: '600', color: '#888' },
  episodesContainer: { padding: 16 },
  seasonsScrollContent: { paddingHorizontal: 16 },
  seasonButton: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginRight: 10,
  },
  seasonButtonText: { fontSize: 14, fontWeight: '500' },
  episodesLoadingContainer: { paddingVertical: 20, alignItems: 'center' },
  episodeItem: {
    marginBottom: 16,
    borderBottomWidth: 1,
    paddingBottom: 16,
  },
  episodeRow: { flexDirection: 'row', alignItems: 'center' },
  episodeThumbnailColumn: { marginRight: 12 },
  episodeImageContainer: {
    width: 120,
    height: 70,
    borderRadius: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  episodeImage: { width: '100%', height: '100%' },
  episodeImagePlaceholder: { width: '100%', height: '100%' },
  playButtonOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  episodeInfoColumn: { flex: 1, marginRight: 8 },
  episodeTitle: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  episodeOverview: { fontSize: 13, lineHeight: 18 },
  loadMoreButton: {
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 10,
  },
  loadMoreButtonText: { fontSize: 14, fontWeight: '600' },
  recommendationsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    paddingVertical: 16,
  },
});

export default DetailsScreen;
