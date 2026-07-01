// src/screens/home/HomeScreen.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  ActivityIndicator,
  RefreshControl,
  Text,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

// Zustand Stores
import { useAppStore, useContinueWatching, useWatchHistory, useRecentlyWatched } from '../../store/zustand';
import { AnimatedHeader } from "../../components/header/AnimatedHeader";`nimport { useContent } from "../../hooks/content/useContent";`nimport { useTheme } from '../../contexts/ThemeContext';
import { useAlert } from '../../contexts/AlertContext';

// Components
import { RefreshableScrollView } from '../../components/RefreshableScrollView';
import { SkeletonLoader, SkeletonList } from '../../components/skeleton/SkeletonLoader';
import MediaRow from '../../components/MediaRow';
import ThrillerGrid from "../../components/thriller/ThrillerGrid";`nimport FeaturedContent from '../../components/FeaturedContent';

// API
import {
  fetchPopularMovies,
  fetchPopularTVShows,
  fetchNewReleaseMovies,
  fetchNewReleaseTVShows,
  fetchRecommendedMovies,
  fetchRecommendedTVShows,
  fetchMediaByGenre,
  getImageUrl,
} from '../../api/tmdbApi';

// Types
import { Movie, TVShow } from '../../types';

// Genres
const GENRES_TO_DISPLAY = {
  movie: [
    { id: 28, name: 'Action Movies' },
    { id: 35, name: 'Comedy Movies' },
    { id: 878, name: 'Sci-Fi Movies' },
    { id: 27, name: 'Horror Movies' },
    { id: 16, name: 'Animated Movies' },
  ],
  tv: [
    { id: 10759, name: 'Action & Adventure TV' },
    { id: 35, name: 'Comedy TV' },
    { id: 18, name: 'Drama TV' },
    { id: 9648, name: 'Mystery TV' },
    { id: 16, name: 'Animated TV Shows' },
  ],
};

const HomeScreen = ({ navigation }) => {
  const { colors, isDark } = useTheme();
  const { showToast } = useAlert();
  const { networkStatus, setLoading: setAppLoading } = useAppStore();
  const { items: continueWatchingItems, addItem, updateProgress } = useContinueWatching();
  const { getRecentlyWatched } = useWatchHistory();

  const [popularMovies, setPopularMovies] = useState<Movie[]>([]);
  const [popularTVShows, setPopularTVShows] = useState<TVShow[]>([]);
  const [newReleaseMovies, setNewReleaseMovies] = useState<Movie[]>([]);
  const [newReleaseTVShows, setNewReleaseTVShows] = useState<TVShow[]>([]);
  const [recommendedMovies, setRecommendedMovies] = useState<Movie[]>([]);
  const [recommendedTVShows, setRecommendedTVShows] = useState<TVShow[]>([]);
  const [genreMedia, setGenreMedia] = useState<Record<string, any[]>>({});
  const [featuredContent, setFeaturedContent] = useState<any>(null);
  const { rows, isLoading, refetch } = useContent();
  const [refreshing, setRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  const opacity = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  // Shuffle helper
  const shuffleArray = (array: any[]) => {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  };

  // Fetch content with caching
  const fetchContent = useCallback(async () => {
    try {
      if (!refreshing) setLoading(true);

      // Fetch all content in parallel
      const [
        moviesData,
        tvShowsData,
        newMoviesData,
        newTVShowsData,
      ] = await Promise.all([
        fetchPopularMovies(),
        fetchPopularTVShows(),
        fetchNewReleaseMovies(),
        fetchNewReleaseTVShows(),
      ]);

      // Fetch genre content
      const genrePromises: Promise<void>[] = [];
      const newGenreMedia: Record<string, any[]> = {};

      GENRES_TO_DISPLAY.movie.forEach(genre => {
        genrePromises.push(
          fetchMediaByGenre('movie', genre.id)
            .then(data => { newGenreMedia[movie_] = data || []; })
            .catch(() => { newGenreMedia[movie_] = []; })
        );
      });

      GENRES_TO_DISPLAY.tv.forEach(genre => {
        genrePromises.push(
          fetchMediaByGenre('tv', genre.id)
            .then(data => { newGenreMedia[	v_] = data || []; })
            .catch(() => { newGenreMedia[	v_] = []; })
        );
      });

      await Promise.all(genrePromises);

      // Shuffle genre media
      for (const key in newGenreMedia) {
        if (Array.isArray(newGenreMedia[key])) {
          newGenreMedia[key] = shuffleArray([...newGenreMedia[key]]);
        }
      }
      setGenreMedia(newGenreMedia);

      // Set featured content
      const allPopular = [...moviesData, ...tvShowsData];
      if (allPopular.length > 0) {
        const randomIndex = Math.floor(Math.random() * allPopular.length);
        setFeaturedContent(allPopular[randomIndex]);
      }

      // Get recommendations
      let recMovies: Movie[] = [];
      let recTVShows: TVShow[] = [];

      if (continueWatchingItems.length > 0) {
        const mostRecent = continueWatchingItems[0];
        try {
          // Fetch recommendations based on watch history
          const params = { with_genres: '28,12,878' }; // Action, Adventure, Sci-Fi
          recMovies = await fetchRecommendedMovies(params);
          recTVShows = await fetchRecommendedTVShows(params);
          recMovies = recMovies.filter(m => m.id !== mostRecent.tmdbId);
          recTVShows = recTVShows.filter(tv => tv.id !== mostRecent.tmdbId);
        } catch (error) {
          console.warn('[Home] Recommendation error:', error);
        }
      }

      // Update state with shuffled data
      setPopularMovies(shuffleArray([...moviesData]));
      setPopularTVShows(shuffleArray([...tvShowsData]));
      setNewReleaseMovies(shuffleArray([...newMoviesData]));
      setNewReleaseTVShows(shuffleArray([...newTVShowsData]));
      setRecommendedMovies(recMovies);
      setRecommendedTVShows(recTVShows);

      // Update network status
      setIsOffline(networkStatus === 'offline');

    } catch (error) {
      console.error('[Home] Fetch error:', error);
      showToast('Failed to load content');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setAppLoading(false);
    }
  }, [refreshing, continueWatchingItems, networkStatus]);

  // Load on focus
  useFocusEffect(
    useCallback(() => {
      opacity.value = 0;
      opacity.value = withTiming(1, { duration: 300 });
      fetchContent();
      return () => {};
    }, [])
  );

  // Pull to refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchContent();
  }, [fetchContent]);

  // Media press handler
  const handleMediaPress = useCallback((item: any, directPlay: boolean = false) => {
    const isContinueWatching = item.hasOwnProperty('mediaId');
    const mediaId = isContinueWatching ? item.mediaId : item.id;
    const mediaType = isContinueWatching ? item.mediaType : (item.media_type || (item.title ? 'movie' : 'tv'));
    const title = isContinueWatching ? item.title : (mediaType === 'tv' ? item.name : item.title);

    if (directPlay) {
      navigation.navigate('VideoPlayer', {
        mediaId,
        mediaType,
        title,
        poster_path: item.poster_path,
        season: item.season,
        episode: item.episode,
        episodeTitle: item.episodeTitle,
      });
    } else {
      navigation.navigate('DetailScreen', {
        mediaId,
        mediaType,
        title,
        poster_path: item.poster_path,
      });
    }
  }, [navigation]);

  // Continue Watching handlers
  const handleInfoPress = useCallback((item: any) => {
    navigation.navigate('DetailScreen', {
      mediaId: item.mediaId,
      mediaType: item.mediaType,
      title: item.title,
    });
  }, [navigation]);

  const handleRemovePress = useCallback((contentId: string) => {
    // Remove from continue watching
    // The store handles this
  }, []);

  // Loading state
  if (loading && !refreshing) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.gold} />
        <Text style={[styles.loadingText, { color: colors.textSub }]}>Loading content...</Text>
      </View>
    );
  }

  // Get recent watch history
  const recentWatched = getRecentlyWatched(5);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <Animated.View style={[styles.animatedContainer, animatedStyle]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.gold }]}>🎬 Netflix Pro</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Search')}>
            <Ionicons name="search" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Offline Banner */}
        {isOffline && (
          <TouchableOpacity
            style={[styles.offlineBanner, { backgroundColor: colors.surfaceRaised }]}
            onPress={() => navigation.navigate('Downloads')}
          >
            <Ionicons name="cloud-offline-outline" size={18} color={colors.text} />
            <Text style={[styles.offlineBannerText, { color: colors.text }]}>
              You're offline. Tap to view downloads.
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.text} />
          </TouchableOpacity>
        )}

        <RefreshableScrollView
          refreshing={refreshing}
          onRefresh={onRefresh}
          style={styles.scrollView}
        >
          {/* Featured Content */}
          {featuredContent && (
            <FeaturedContent
              item={featuredContent}
              onPlay={() => handleMediaPress(featuredContent, true)}
              onInfoPress={() => handleMediaPress(featuredContent, false)}
            />
          )}

          {/* Continue Watching Row (Swipe left for more) */}
          {continueWatchingItems.length > 0 && (
            <MediaRow
              title="Continue Watching"
              data={continueWatchingItems}
              onItemPress={(item) => handleMediaPress(item, true)}
              isContinueWatching={true}
              onInfoPress={handleInfoPress}
              onRemovePress={handleRemovePress}
            />
          )}

          {/* Recently Watched */}
          {recentWatched.length > 0 && (
            <MediaRow
              title="Recently Watched"
              data={recentWatched}
              onItemPress={(item) => handleMediaPress(item, false)}
            />
          )}

          {/* New Releases */}
          {newReleaseMovies.length > 0 && (
            <MediaRow
              title="New Release Movies"
              data={newReleaseMovies}
              onItemPress={handleMediaPress}
            />
          )}

          {newReleaseTVShows.length > 0 && (
            <MediaRow
              title="New Release TV Shows"
              data={newReleaseTVShows}
              onItemPress={handleMediaPress}
            />
          )}

          {/* Recommendations */}
          {recommendedMovies.length > 0 && (
            <MediaRow
              title="Movies You Might Like"
              data={recommendedMovies}
              onItemPress={handleMediaPress}
            />
          )}

          {recommendedTVShows.length > 0 && (
            <MediaRow
              title="TV Shows You Might Like"
              data={recommendedTVShows}
              onItemPress={handleMediaPress}
            />
          )}

          {/* Popular */}
          {popularMovies.length > 0 && (
            <MediaRow
              title="Popular Movies"
              data={popularMovies}
              onItemPress={handleMediaPress}
            />
          )}

          {popularTVShows.length > 0 && (
            <MediaRow
              title="Popular TV Shows"
              data={popularTVShows}
              onItemPress={handleMediaPress}
            />
          )}

          {/* Genre Rows */}
          {GENRES_TO_DISPLAY.movie.map(genre => (
            genreMedia[movie_]?.length > 0 && (
              <MediaRow
                key={movie-}
                title={genre.name}
                data={genreMedia[movie_]}
                onItemPress={handleMediaPress}
              />
            )
          ))}

          {GENRES_TO_DISPLAY.tv.map(genre => (
            genreMedia[	v_]?.length > 0 && (
              <MediaRow
                key={	v-}
                title={genre.name}
                data={genreMedia[	v_]}
                onItemPress={handleMediaPress}
              />
            )
          ))}
        </RefreshableScrollView>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  animatedContainer: { flex: 1 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: { marginTop: 16, fontSize: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 22, fontWeight: 'bold' },
  scrollView: { flex: 1 },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 8,
  },
  offlineBannerText: {
    flex: 1,
    fontSize: 14,
    marginHorizontal: 10,
  },
});

export default HomeScreen;



