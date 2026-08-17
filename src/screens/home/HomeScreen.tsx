// src/screens/home/HomeScreen.tsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  StyleSheet,
  View,
  RefreshControl,
  Text,
  TouchableOpacity,
  Dimensions,
  Platform,
  FlatList,
  ListRenderItem,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  useAnimatedScrollHandler,
  Extrapolation,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';

// Zustand Stores
import {
  useAppStore,
  useContinueWatching,
  useWatchHistory,
} from '../../store/zustand';

// Components
import { AnimatedHeader } from '../../components/header/AnimatedHeader';
import MediaRow from '../../components/MediaRow';
import ContinueWatchingRow from '../../components/content/ContinueWatchingRow';
import ThrillerGrid from '../../components/thriller/ThrillerGrid';
import FeaturedContent from '../../components/FeaturedContent';
import ContinueWatchingPanel from '../../components/ContinueWatchingPanel';

// Hooks
import { useThrillerGrid } from '../../hooks/content/useThrillerGrid';
import { useTheme } from '../../contexts/ThemeContext';
import { useAlert } from '../../contexts/AlertContext';

// Cache
import { cacheManager } from '../../services/cache/CacheManager';

// API
import {
  fetchPopularMovies,
  fetchPopularTVShows,
  fetchNewReleaseMovies,
  fetchNewReleaseTVShows,
  fetchRecommendedMovies,
  fetchRecommendedTVShows,
  fetchMediaByGenre,
  fetchTrending,
  fetchTopRatedMovies,
  fetchTopRatedTVShows,
  fetchUpcomingMovies,
  fetchAiringTodayTV,
  fetchOnTheAirTV,
} from '../../services/unified/metadata/TMDBMetadata';

// Badge tier sorting
import { sortByBadgeTier, BADGE_SORTABLE_ROW_IDS } from '../../utils/badgeHelper';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Animated wrapper for FlatList
const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);

const HEADER_HEIGHT = Platform.OS === 'android' ? 64 : 72;

// ─── Search Screen Card Sizes (4-column grid) ───
const GRID_GAP = 8;
const GRID_CARD_WIDTH = (SCREEN_WIDTH - 16 * 2 - GRID_GAP * 3) / 4;
const GRID_CARD_HEIGHT = GRID_CARD_WIDTH * 1.5;
const GRID_ROW_HEIGHT = GRID_CARD_HEIGHT + 18 + 12 + 24;

// ─── Layout Estimates ───
const FEATURED_ESTIMATED_HEIGHT = SCREEN_WIDTH * 1.4;
const THRILLER_GRID_ESTIMATED_HEIGHT = SCREEN_WIDTH * 0.95;
const CONTINUE_WATCHING_ROW_HEIGHT = SCREEN_WIDTH * 0.45 * 0.5625 + 80;

// ─── Edge-Swipe Width ───
const EDGE_WIDTH = 28;

// ─── CACHE KEYS ───
const CACHE_KEYS = {
  HOME_DATA: 'home_screen_data',
} as const;

// ─── GENRE MAPPING ───
const GENRE_IDS = {
  action: 28,
  adventure: 12,
  comedy: 35,
  sciFi: 878,
  fantasy: 14,
  romance: 10749,
  horror: 27,
  documentary: 99,
  kids: 10751,
  drama: 18,
  thriller: 53,
  animation: 16,
  mystery: 9648,
} as const;

interface RowData {
  id: string;
  title: string;
  type: string;
  data: any[];
}

interface HomeCacheData {
  rows: RowData[];
  featuredContent: any;
  popularMovies: any[];
  timestamp: number;
}

// ─── Unified List Item Type ───
type HomeListItem =
  | { id: 'featured'; kind: 'featured' }
  | { id: 'thriller-grid'; kind: 'thriller-grid' }
  | { id: string; kind: 'skeleton' }
  | { id: string; kind: 'row'; row: RowData };

const CACHE_TTL = 30 * 60 * 1000;

const cleanParams = (obj: Record<string, any>): Record<string, string> => {
  const result: Record<string, string> = {};
  Object.keys(obj).forEach((key) => {
    const value = obj[key];
    if (value !== undefined && value !== null) {
      result[key] = typeof value === 'string' ? value : String(value);
    }
  });
  return result;
};

// ─── Edge-Swipe Zone Component ───
const EdgeSwipeZone = React.memo(
  ({ onTrigger, top }: { onTrigger: () => void; top: number }) => {
    const gesture = useMemo(
      () =>
        Gesture.Pan()
          .hitSlop({ left: -16 })
          .activeOffsetX(-12)
          .failOffsetY([-18, 18])
          .onEnd((event) => {
            const committedByDistance = event.translationX < -70;
            const committedByVelocity =
              event.velocityX < -600 && event.translationX < -30;
            if (committedByDistance || committedByVelocity) {
              runOnJS(onTrigger)();
            }
          }),
      [onTrigger]
    );

    return (
      <GestureDetector gesture={gesture}>
        <View
          pointerEvents="box-only"
          style={[styles.edgeSwipeZone, { top }]}
        />
      </GestureDetector>
    );
  }
);

const HomeScreen = () => {
  const { colors, isDark } = useTheme();
  const { showToast } = useAlert();
  const router = useRouter();
  const { networkStatus, setLoading: setAppLoading } = useAppStore();
  const { items: continueWatchingItems, removeItem: removeContinueWatching } = useContinueWatching();
  const { getRecentlyWatched } = useWatchHistory();

  // ─── Watched IDs ───
  const watchedIds = useMemo(() => {
    const watched = getRecentlyWatched ? getRecentlyWatched() : [];
    return new Set((watched || []).map((w: any) => w.mediaId ?? w.id));
  }, [getRecentlyWatched]);

  // ─── State ───
  const [rows, setRows] = useState<RowData[]>([]);
  const [popularMovies, setPopularMovies] = useState<any[]>([]);
  const [featuredContent, setFeaturedContent] = useState<any>(null);
  const [showContinuePanel, setShowContinuePanel] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [thrillerGridVisible, setThrillerGridVisible] = useState(true);

  // ─── Refs ───
  const listRef = useRef<FlatList<HomeListItem>>(null);
  const isFetchingRef = useRef(false);
  const viewabilityConfigRef = useRef({
    itemVisiblePercentThreshold: 15,
    minimumViewTime: 100,
  });

  // ─── Header Scroll Animation ───
  const scrollY = useSharedValue(0);
  const headerOpacity = useSharedValue(1);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
      headerOpacity.value = interpolate(
        event.contentOffset.y,
        [0, 100],
        [1, 0.85],
        Extrapolation.CLAMP
      );
    },
  });

  const headerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [0, 100],
          [0, -5],
          Extrapolation.CLAMP
        ),
      },
    ],
  }));

  // ─── Thriller Grid ───
  const {
    items: thrillerItems,
    loading: thrillerLoading,
    reload: reloadThrillers,
  } = useThrillerGrid(popularMovies);

  // ─── Viewability Tracking ───
  const handleViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ item: HomeListItem }> }) => {
      const visible = viewableItems.some((v) => v.item.id === 'thriller-grid');
      setTimeout(() => {
        setThrillerGridVisible(visible);
      }, 0);
    }
  ).current;

  // ─── Shuffle Helper ───
  const shuffleArray = useCallback(<T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, []);

  // ─── Build Rows ───
  const buildRows = useCallback((
    data: any,
    continueWatching: any[]
  ): RowData[] => {
    const {
      recommendedMoviesData,
      recommendedTVData,
      trendingData,
      popularMoviesData,
      popularTVData,
      newMoviesData,
      newTVData,
      topRatedMoviesData,
      topRatedTVData,
      upcomingMoviesData,
      airingTodayData,
      onTheAirData,
      actionData,
      adventureData,
      comedyData,
      sciFiData,
      fantasyData,
      romanceData,
      horrorData,
      documentaryData,
      kidsData,
      dramaData,
      animationData,
    } = data;

    const rowData: RowData[] = [];

    if (continueWatching.length > 0) {
      // Newest-first, capped to 8. The store's field for "last watched" isn't
      // visible from this file, so this checks the common candidate names —
      // if your store uses a different field, swap it in here.
      const getWatchTimestamp = (item: any): number =>
        item.lastWatchedAt ?? item.updatedAt ?? item.timestamp ?? item.watchedAt ?? 0;

      const sortedContinueWatching = [...continueWatching]
        .sort((a, b) => getWatchTimestamp(b) - getWatchTimestamp(a))
        .slice(0, 8);

      rowData.push({
        id: 'continue-watching',
        title: 'Continue Watching',
        type: 'continue_watching',
        data: sortedContinueWatching,
      });
    }

    const topPicks = shuffleArray([...recommendedMoviesData, ...recommendedTVData]).slice(0, 20);
    rowData.push({ id: 'top-picks', title: 'Top Picks For You', type: 'recommendations', data: topPicks });
    rowData.push({ id: 'trending', title: 'Trending Now', type: 'trending', data: shuffleArray(trendingData).slice(0, 20) });

    const popularData = shuffleArray([...popularMoviesData, ...popularTVData]).slice(0, 20);
    rowData.push({ id: 'popular', title: 'Popular on Netflix Pro', type: 'popular', data: popularData });

    const newReleases = shuffleArray([...newMoviesData, ...newTVData]).slice(0, 20);
    rowData.push({ id: 'new-releases', title: 'New Releases', type: 'new_releases', data: newReleases });

    const becauseYouWatched = shuffleArray([...recommendedMoviesData, ...recommendedTVData]).slice(0, 20);
    rowData.push({ id: 'because-you-watched', title: 'Because You Watched', type: 'recommendations', data: becauseYouWatched });

    const top10 = shuffleArray([...topRatedMoviesData, ...topRatedTVData]).slice(0, 10);
    rowData.push({ id: 'top-10', title: 'Top 10 Today', type: 'top_10', data: top10 });

    rowData.push({ id: 'blockbuster', title: 'Blockbuster Movies', type: 'blockbuster', data: shuffleArray(topRatedMoviesData).slice(0, 20) });
    rowData.push({ id: 'dramas', title: 'Dramas', type: 'dramas', data: shuffleArray(dramaData).slice(0, 20) });
    rowData.push({ id: 'anime', title: 'Anime', type: 'anime', data: shuffleArray(animationData).slice(0, 20) });

    const actionAdventure = shuffleArray([...actionData, ...adventureData]).slice(0, 20);
    rowData.push({ id: 'action-adventure', title: 'Action & Adventure', type: 'action_adventure', data: actionAdventure });
    rowData.push({ id: 'comedy', title: 'Comedy', type: 'comedy', data: shuffleArray(comedyData).slice(0, 20) });

    const sciFiFantasy = shuffleArray([...sciFiData, ...fantasyData]).slice(0, 20);
    rowData.push({ id: 'sci-fi', title: 'Sci-Fi & Fantasy', type: 'sci_fi', data: sciFiFantasy });
    rowData.push({ id: 'romance', title: 'Romance', type: 'romance', data: shuffleArray(romanceData).slice(0, 20) });
    rowData.push({ id: 'horror', title: 'Horror', type: 'horror', data: shuffleArray(horrorData).slice(0, 20) });
    rowData.push({ id: 'documentaries', title: 'Documentaries', type: 'documentaries', data: shuffleArray(documentaryData).slice(0, 20) });
    rowData.push({ id: 'kids-family', title: 'Kids & Family', type: 'kids_family', data: shuffleArray(kidsData).slice(0, 20) });

    const staffPicks = shuffleArray([
      ...popularMoviesData.slice(0, 5),
      ...popularTVData.slice(0, 5),
      ...topRatedMoviesData.slice(0, 5),
      ...topRatedTVData.slice(0, 5),
    ]).slice(0, 20);
    rowData.push({ id: 'staff-picks', title: 'Staff Picks', type: 'staff_picks', data: staffPicks });

    const recentlyAdded = shuffleArray([...upcomingMoviesData, ...airingTodayData, ...onTheAirData]).slice(0, 20);
    rowData.push({ id: 'recently-added', title: 'Recently Added', type: 'recently_added', data: recentlyAdded });

    const hasWatchedFn = (item: any) => watchedIds.has(item.id);
    return rowData.map((row) =>
      BADGE_SORTABLE_ROW_IDS.has(row.id)
        ? { ...row, data: sortByBadgeTier(row.data, hasWatchedFn) }
        : row
    );
  }, [shuffleArray, watchedIds]);

  // ─── Fetch All Content ───
  const fetchAllContentFromAPI = useCallback(async (): Promise<{
    rows: RowData[];
    featuredContent: any;
    popularMovies: any[];
  }> => {
    const [
      trendingData,
      popularMoviesData,
      popularTVData,
      newMoviesData,
      newTVData,
      topRatedMoviesData,
      topRatedTVData,
      upcomingMoviesData,
      airingTodayData,
      onTheAirData,
      recommendedMoviesData,
      recommendedTVData,
      actionData,
      adventureData,
      comedyData,
      sciFiData,
      fantasyData,
      romanceData,
      horrorData,
      documentaryData,
      kidsData,
      dramaData,
      animationData,
    ] = await Promise.all([
      fetchTrending('day', 'all'),
      fetchPopularMovies(),
      fetchPopularTVShows(),
      fetchNewReleaseMovies(),
      fetchNewReleaseTVShows(),
      fetchTopRatedMovies({ page: 1 }),
      fetchTopRatedTVShows({ page: 1 }),
      fetchUpcomingMovies({ page: 1 }),
      fetchAiringTodayTV({ page: 1 }),
      fetchOnTheAirTV({ page: 1 }),
      fetchRecommendedMovies({ with_genres: '28,12,878' }),
      fetchRecommendedTVShows({ with_genres: '28,12,878' }),
      fetchMediaByGenre('movie', GENRE_IDS.action),
      fetchMediaByGenre('movie', GENRE_IDS.adventure),
      fetchMediaByGenre('movie', GENRE_IDS.comedy),
      fetchMediaByGenre('movie', GENRE_IDS.sciFi),
      fetchMediaByGenre('movie', GENRE_IDS.fantasy),
      fetchMediaByGenre('movie', GENRE_IDS.romance),
      fetchMediaByGenre('movie', GENRE_IDS.horror),
      fetchMediaByGenre('movie', GENRE_IDS.documentary),
      fetchMediaByGenre('movie', GENRE_IDS.kids),
      fetchMediaByGenre('movie', GENRE_IDS.drama),
      fetchMediaByGenre('movie', GENRE_IDS.animation),
    ]);

    const allContent = [...popularMoviesData, ...popularTVData];
    const selectedFeatured = allContent.length > 0
      ? allContent[Math.floor(Math.random() * allContent.length)]
      : null;

    const rowData = buildRows(
      {
        recommendedMoviesData,
        recommendedTVData,
        trendingData,
        popularMoviesData,
        popularTVData,
        newMoviesData,
        newTVData,
        topRatedMoviesData,
        topRatedTVData,
        upcomingMoviesData,
        airingTodayData,
        onTheAirData,
        actionData,
        adventureData,
        comedyData,
        sciFiData,
        fantasyData,
        romanceData,
        horrorData,
        documentaryData,
        kidsData,
        dramaData,
        animationData,
      },
      continueWatchingItems
    );

    return {
      rows: rowData,
      featuredContent: selectedFeatured,
      popularMovies: popularMoviesData,
    };
  }, [buildRows, continueWatchingItems]);

  // ─── Cache-First Load ───
  const loadContent = useCallback(async (forceRefresh: boolean = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      setAppLoading(true);

      if (!forceRefresh) {
        const cached = await cacheManager.get<HomeCacheData>(CACHE_KEYS.HOME_DATA);
        const cacheValid = cached && (Date.now() - cached.timestamp < CACHE_TTL);

        if (cacheValid && cached.rows.length > 0) {
          setRows(cached.rows);
          setFeaturedContent(cached.featuredContent);
          setPopularMovies(cached.popularMovies);
          setIsInitialLoad(false);
          setIsOffline(networkStatus === 'offline');
        }
      }

      const freshData = await fetchAllContentFromAPI();
      setRows(freshData.rows);
      setFeaturedContent(freshData.featuredContent);
      setPopularMovies(freshData.popularMovies);
      setIsOffline(networkStatus === 'offline');

      const cacheData: HomeCacheData = {
        rows: freshData.rows,
        featuredContent: freshData.featuredContent,
        popularMovies: freshData.popularMovies,
        timestamp: Date.now(),
      };
      await cacheManager.set(CACHE_KEYS.HOME_DATA, cacheData);

    } catch (error) {
      console.error('[Home] Fetch error:', error);
      if (rows.length === 0) {
        setIsOffline(true);
      }
      showToast('Failed to refresh content');
    } finally {
      setIsInitialLoad(false);
      setRefreshing(false);
      setAppLoading(false);
      isFetchingRef.current = false;
    }
  }, [fetchAllContentFromAPI, networkStatus, rows.length, setAppLoading, showToast]);

  // ─── Pull to Refresh ───
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    reloadThrillers();
    loadContent(true);
  }, [loadContent, reloadThrillers]);

  // ─── Load on Focus ───
  useFocusEffect(
    useCallback(() => {
      loadContent(false);
      return () => {};
    }, [loadContent])
  );

  // ─── Media Press Handler ───
  const handleMediaPress = useCallback(
    (item: any, directPlay: boolean = false) => {
      const isContinueWatching = item.hasOwnProperty('mediaId');
      const mediaId = isContinueWatching ? item.mediaId : item.id;
      const mediaType = isContinueWatching
        ? item.mediaType
        : item.media_type || (item.title ? 'movie' : 'tv');
      const title = isContinueWatching
        ? item.title
        : mediaType === 'tv'
        ? item.name
        : item.title;

      if (directPlay) {
        router.push({
          pathname: '/video-player',
          params: cleanParams({
            mediaId,
            mediaType,
            title,
            poster_path: item.poster_path,
            season: item.season,
            episode: item.episode,
            episodeTitle: item.episodeTitle,
            progress: item.progress,
          }),
        });
      } else {
        // ─── Enriched params so DetailsScreenNew has real metadata to show,
        // matching the shape SearchScreen's handleItemPress already sends. ───
        router.push({
          pathname: `/movie/${mediaId}`,
          params: cleanParams({
            mediaId,
            mediaType,
            title,
            poster_path: item.poster_path,
            rating: item.rating ?? item.vote_average ?? 0,
            year:
              item.year ||
              item.release_date?.split('-')[0] ||
              item.first_air_date?.split('-')[0] ||
              '',
            overview: item.overview || '',
            genres: JSON.stringify(item.genres || []),
            backdrop: item.backdrop || item.backdrop_path || '',
            vote_count: item.vote_count ?? item.voteCount ?? 0,
            runtime: item.runtime || '',
            certification: item.certification || '',
            tagline: item.tagline || '',
            status: item.status || '',
            release_date: item.releaseDate || item.release_date || item.first_air_date || '',
            popularity: item.popularity ?? 0,
          }),
        });
      }
    },
    [router]
  );

  // ─── Continue Watching Handlers ───
  const handleInfoPress = useCallback(
    (item: any) => {
      const mediaId = item.mediaId;
      router.push({
        pathname: `/movie/${mediaId}`,
        params: cleanParams({
          mediaId: item.mediaId,
          mediaType: item.mediaType,
          title: item.title,
          poster_path: item.posterPath || item.poster_path,
        }),
      });
    },
    [router]
  );

  const handleRemovePress = useCallback(
    (item: any) => {
      removeContinueWatching(item.mediaId);
      showToast('Removed from Continue Watching');
    },
    [removeContinueWatching, showToast]
  );

  // ─── Panel Controls ───
  const openContinuePanel = useCallback(() => {
    setShowContinuePanel(true);
  }, []);

  const closeContinuePanel = useCallback(() => {
    setShowContinuePanel(false);
  }, []);

  // ─── Search Handler ───
  const handleSearchPress = useCallback(() => {
    router.push('/search');
  }, [router]);

  // ─── Render Row ───
  const renderRow = useCallback(
    (row: RowData) => {
      if (row.type === 'continue_watching') {
        return (
          <ContinueWatchingRow
            items={row.data}
            onItemPress={(item) => handleMediaPress(item, true)}
            onRemoveItem={removeContinueWatching}
          />
        );
      }

      return (
        <MediaRow
          title={row.title}
          data={row.data}
          onItemPress={handleMediaPress}
          watchedIds={BADGE_SORTABLE_ROW_IDS.has(row.id) ? watchedIds : undefined}
          // Use search screen card sizes
          cardWidth={GRID_CARD_WIDTH}
          cardHeight={GRID_CARD_HEIGHT}
        />
      );
    },
    [handleMediaPress, removeContinueWatching, watchedIds]
  );

  // ─── Content Opacity ───
  const contentOpacity = useSharedValue(0);
  const contentAnimatedStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  useEffect(() => {
    if (!isInitialLoad) {
      contentOpacity.value = withTiming(1, { duration: 400 });
    }
  }, [isInitialLoad, contentOpacity]);

  // ─── Skeleton Row ───
  const renderSkeletonRow = useCallback(
    (id: string) => (
      <View key={id} style={styles.skeletonRow}>
        <View style={[styles.skeletonTitle, { backgroundColor: isDark ? colors.surfaceRaised : 'rgba(0,0,0,0.06)' }]} />
        <View style={styles.skeletonCards}>
          {[...Array(4)].map((_, i) => (
            <View key={i} style={[styles.skeletonCard, { 
              backgroundColor: isDark ? colors.surfaceRaised : 'rgba(0,0,0,0.04)',
              width: GRID_CARD_WIDTH,
              height: GRID_CARD_HEIGHT,
            }]} />
          ))}
        </View>
      </View>
    ),
    [isDark, colors.surfaceRaised]
  );

  // ─── List Data ───
  const listData = useMemo<HomeListItem[]>(() => {
    const head: HomeListItem[] = [
      ...(featuredContent ? [{ id: 'featured', kind: 'featured' } as const] : []),
      { id: 'thriller-grid', kind: 'thriller-grid' } as const,
    ];

    if (isInitialLoad) {
      return [
        ...head,
        ...Array.from({ length: 6 }, (_, i) => ({
          id: `skeleton-${i}`,
          kind: 'skeleton' as const,
        })),
      ];
    }

    return [
      ...head,
      ...rows.map((row) => ({ id: row.id, kind: 'row' as const, row })),
    ];
  }, [featuredContent, isInitialLoad, rows]);

  const keyExtractor = useCallback((item: HomeListItem) => item.id, []);
  const getItemLayout = useCallback(
    (_data: ArrayLike<HomeListItem> | null | undefined, index: number) => {
      const item = _data?.[index];
      let height = GRID_ROW_HEIGHT;
      if (item) {
        switch (item.kind) {
          case 'featured':
            height = FEATURED_ESTIMATED_HEIGHT;
            break;
          case 'thriller-grid':
            height = THRILLER_GRID_ESTIMATED_HEIGHT;
            break;
          case 'skeleton':
            height = GRID_ROW_HEIGHT;
            break;
          case 'row':
            if (item.row.type === 'continue_watching') {
              height = CONTINUE_WATCHING_ROW_HEIGHT;
            } else {
              height = GRID_ROW_HEIGHT;
            }
            break;
        }
      }
      return { length: height, offset: height * index, index };
    },
    []
  );

  // ─── Render Item ───
  const renderItem = useCallback<ListRenderItem<HomeListItem>>(
    ({ item }) => {
      switch (item.kind) {
        case 'featured':
          return (
            <FeaturedContent
              item={featuredContent}
              onPlay={() => handleMediaPress(featuredContent, true)}
              onInfoPress={() => handleMediaPress(featuredContent, false)}
            />
          );
        case 'thriller-grid':
          return (
            <ThrillerGrid
              items={thrillerItems}
              loading={thrillerLoading}
              isVisible={thrillerGridVisible}
              onItemPress={(movieItem) => handleMediaPress(movieItem, false)}
            />
          );
        case 'skeleton':
          return renderSkeletonRow(item.id);
        case 'row':
          return renderRow(item.row);
        default:
          return null;
      }
    },
    [
      featuredContent,
      thrillerItems,
      thrillerLoading,
      thrillerGridVisible,
      handleMediaPress,
      renderSkeletonRow,
      renderRow,
    ]
  );

  // ─── Main Render ───
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* ─── Background ─── */}
      {!isDark && (
        <LinearGradient
          colors={colors.backgroundGradient}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      )}
      
      {/* ─── Dark Mode Background ─── */}
      {isDark && (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.background }]} />
      )}

      {/* ─── Main Content ─── */}
      <SafeAreaView
        style={[styles.container, { backgroundColor: 'transparent' }]}
        edges={['top']}
      >
        <Animated.View style={[styles.innerContainer, contentAnimatedStyle]}>
          {/* ─── Header ─── */}
          <Animated.View style={[styles.headerContainer, headerAnimatedStyle]}>
            <AnimatedHeader
              onFilterPress={() => router.push('/search-filters')}
              onBellPress={() => router.push('/notifications')}
              onSearchPress={handleSearchPress}
              notificationCount={3}
            />
          </Animated.View>

          {/* ─── Offline Banner ─── */}
          {isOffline && (
            <TouchableOpacity
              style={[
                styles.offlineBanner,
                {
                  backgroundColor: isDark ? colors.surfaceRaised : 'rgba(255,255,255,0.7)',
                  borderWidth: 0.5,
                  borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.3)',
                  shadowColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(66,133,244,0.1)',
                }
              ]}
              onPress={() => router.push('/downloads')}
              activeOpacity={0.8}
            >
              <Ionicons name="cloud-offline-outline" size={18} color={colors.text} />
              <Text style={[styles.offlineBannerText, { color: colors.text }]}>
                You're offline. Tap to view downloads.
              </Text>
              <Ionicons name="chevron-forward" size={18} color={colors.text} />
            </TouchableOpacity>
          )}

          {/* ─── Main Content ─── */}
          <AnimatedFlatList
            ref={listRef}
            data={listData}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            getItemLayout={getItemLayout}
            style={[styles.scrollView, { backgroundColor: 'transparent' }]}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
            decelerationRate="normal"
            overScrollMode="always"
            viewabilityConfig={viewabilityConfigRef.current}
            onViewableItemsChanged={handleViewableItemsChanged}
            removeClippedSubviews={true}
            maxToRenderPerBatch={3}
            updateCellsBatchingPeriod={30}
            windowSize={5}
            initialNumToRender={5}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.gold}
                colors={[colors.gold]}
                progressBackgroundColor={isDark ? colors.surface : 'rgba(255,255,255,0.8)'}
              />
            }
          />

          {/* ─── Edge-Swipe Zone ─── */}
          <EdgeSwipeZone onTrigger={openContinuePanel} top={HEADER_HEIGHT} />

          {/* ─── Continue Watching Panel ─── */}
          <ContinueWatchingPanel
            visible={showContinuePanel}
            onClose={closeContinuePanel}
            onItemPress={(item) => {
              handleMediaPress(item, true);
              closeContinuePanel();
            }}
          />
        </Animated.View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: 'transparent' 
  },
  innerContainer: { 
    flex: 1 
  },
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  scrollView: {
    flex: 1,
    marginTop: HEADER_HEIGHT,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginTop: HEADER_HEIGHT,
    marginBottom: 10,
    borderRadius: 12,
    zIndex: 50,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    ...(Platform.OS === 'ios' && {
      backdropFilter: 'blur(20px)',
    }),
  },
  offlineBannerText: {
    flex: 1,
    fontSize: 14,
    marginHorizontal: 10,
    fontWeight: '500',
  },
  edgeSwipeZone: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: EDGE_WIDTH,
    zIndex: 40,
  },
  skeletonRow: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  skeletonTitle: {
    width: 140,
    height: 18,
    borderRadius: 4,
    marginBottom: 12,
  },
  skeletonCards: {
    flexDirection: 'row',
    gap: GRID_GAP,
  },
  skeletonCard: {
    borderRadius: 8,
  },
});

export default HomeScreen;