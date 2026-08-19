// src/screens/details/DetailsScreenNew.tsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Dimensions,
  Animated, Easing, Platform, RefreshControl, Linking, FlatList, LayoutAnimation, UIManager,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { FFmpegKit, FFmpegKitConfig, FFprobeKit, ReturnCode, Level } from 'palash-ffmpeg-kit-react-native-sf';
import { useQuery } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useContinueWatching, usePreloadedMediaStore } from '../../store/zustand';
import { useDownloads } from '../../store/downloadsStore';
import { useNotifications } from '../../store/notificationsStore';
import { useTheme } from '../../contexts/ThemeContext';
import { useAlert } from '../../contexts/AlertContext';
import {
  fetchSeasonDetails, getImageUrl, fetchMovieRecommendations,
  fetchTVShowRecommendations, fetchMovieReviews, fetchTVShowReviews,
} from '../../services/unified/metadata/TMDBMetadata';
import { getDownloadSettings } from '../../utils/downloadStorage';
import { buildFFmpegHeaders } from '../../utils/streamHeaders';
import { getPlaybackSource, LicensedPlaybackSource } from '../../services/licensedPlayback/LicensedPlaybackService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const GRID_GAP = 6;
const GRID_CARD_WIDTH = (SCREEN_WIDTH - 16 * 2 - GRID_GAP * 3) / 4;
const GRID_CARD_HEIGHT = GRID_CARD_WIDTH * 1.5;

const EPISODE_GRID_COLUMNS = 3;
const EPISODE_GRID_ROWS = 3;
const EPISODES_PER_GRID_PAGE = 9;
const EPISODE_GRID_GAP = 6;
const EPISODE_GRID_SIDE_INSET = 56;
const EPISODE_GRID_PAGE_WIDTH = SCREEN_WIDTH - EPISODE_GRID_SIDE_INSET;
const EPISODE_GRID_H_PADDING = 4;
const EPISODE_GRID_AVAILABLE_WIDTH = EPISODE_GRID_PAGE_WIDTH - EPISODE_GRID_H_PADDING * 2 - EPISODE_GRID_GAP * (EPISODE_GRID_COLUMNS - 1);
const EPISODE_CARD_WIDTH = Math.floor(EPISODE_GRID_AVAILABLE_WIDTH / EPISODE_GRID_COLUMNS);
const EPISODE_CARD_HEIGHT = Math.round(EPISODE_CARD_WIDTH * 0.62);
const EPISODE_CARD_TITLE_HEIGHT = 16;
const EPISODE_CARD_ROW_HEIGHT = EPISODE_CARD_HEIGHT + EPISODE_CARD_TITLE_HEIGHT + EPISODE_GRID_GAP;
const EPISODE_GRID_CONTAINER_HEIGHT = EPISODE_CARD_ROW_HEIGHT * EPISODE_GRID_ROWS + EPISODE_GRID_GAP * 2;

const TMDB_POSTER_PREFIX = 'https://image.tmdb.org/t/p/w500';

const toRawPosterPath = (fullPosterUrl?: string): string => {
  if (!fullPosterUrl) return '';
  return fullPosterUrl.startsWith(TMDB_POSTER_PREFIX) ? fullPosterUrl.slice(TMDB_POSTER_PREFIX.length) : fullPosterUrl;
};

const getPosterUrl = (item: any): string => {
  if (!item) return 'https://via.placeholder.com/300x450/1a1a2e/ffffff?text=No+Image';
  if (item.poster_path) return item.poster_path.startsWith('http') ? item.poster_path : `${TMDB_POSTER_PREFIX}${item.poster_path}`;
  if (item.poster) return item.poster.startsWith('http') ? item.poster : `${TMDB_POSTER_PREFIX}${item.poster}`;
  const fallback = item.cover || item.image || item.thumbnail || item.backdrop;
  if (fallback) return fallback.startsWith('http') ? fallback : `${TMDB_POSTER_PREFIX}${fallback}`;
  return 'https://via.placeholder.com/300x450/1a1a2e/ffffff?text=No+Image';
};

const TMDB_GENRE_MAP: Record<number, string> = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy',
  80: 'Crime', 99: 'Documentary', 18: 'Drama', 10751: 'Family',
  14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music',
  9648: 'Mystery', 10749: 'Romance', 878: 'Science Fiction',
  10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western',
  10759: 'Action & Adventure', 10762: 'Kids', 10763: 'News',
  10764: 'Reality', 10765: 'Sci-Fi & Fantasy', 10766: 'Soap',
  10767: 'Talk', 10768: 'War & Politics',
};

const mapGenreIdsToNames = (genreIds: number[]): string[] => {
  return genreIds.map(id => TMDB_GENRE_MAP[id] || String(id)).filter(Boolean);
};

interface DownloadQuality {
  label: string; resolution: string; size: string; sizeBytes: number;
  url: string; provider: string; bitrate?: string; format?: string; isRecommended?: boolean;
}
interface EpisodeSelection {
  seasonNumber: number; episodeNumber: number; title: string; selected: boolean;
  stillPath?: string; overview?: string;
}
interface Comment {
  id: string; username: string; text: string; timestamp: string; likes: number; rating?: number;
}
type EpisodeViewMode = 'grid' | 'list';

const MAX_RECOMMENDATIONS = 12;
const WATCHLIST_KEY = 'search_screen_watchlist_ids';

const getWatchlistIds = async (): Promise<Set<string>> => {
  try { const raw = await AsyncStorage.getItem(WATCHLIST_KEY); return new Set(raw ? JSON.parse(raw) : []); }
  catch { return new Set(); }
};
const saveWatchlistIds = async (ids: Set<string>) => {
  try { await AsyncStorage.setItem(WATCHLIST_KEY, JSON.stringify(Array.from(ids))); } catch {}
};

const COMMENT_CARD_HEIGHT = 84;
const COMMENT_CARD_MARGIN = 6;
const COMMENT_ITEM_UNIT = COMMENT_CARD_HEIGHT + COMMENT_CARD_MARGIN;
const COMMENT_SCROLL_MS_PER_ITEM = 4800;
const COMMENTS_VIEWPORT_HEIGHT = SCREEN_HEIGHT * 0.35;
const WATCHER_TICK_MS = 5000;
const LIKE_TICK_MS = 9000;

const mapTMDBReviewsToComments = (reviews: any[]): Comment[] => {
  return reviews.filter(r => !!r?.content).map((r) => ({
    id: String(r.id),
    username: r.author_details?.username || r.author || 'anonymous',
    text: r.content.replace(/\s+/g, ' ').trim(),
    timestamp: 'just now',
    likes: r.author_details?.rating ? Math.round(r.author_details?.rating * 10) : 0,
    rating: r.author_details?.rating ?? undefined,
  }));
};

const chunkEpisodesIntoPages = <T,>(items: T[], pageSize: number): T[][] => {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += pageSize) pages.push(items.slice(i, i + pageSize));
  return pages;
};

const isTorrentUrl = (url: string): boolean => {
  if (!url) return false;
  const lower = url.toLowerCase();
  return lower.includes('webtor.io') || lower.includes('.torrent') || lower.startsWith('magnet:');
};

const DetailsScreenNew: React.FC = () => {
  const { colors, isDark } = useTheme();
  const { showToast } = useAlert();
  const { addItem: addToContinueWatching } = useContinueWatching();
  const { addDownload } = useDownloads();
  const { addNotification } = useNotifications();

  const params = useLocalSearchParams();
  const {
    id: mediaId, mediaType, title: routeTitle, poster_path: routePoster, rating: routeRating,
    year: routeYear, overview: routeOverview, genres: routeGenres, backdrop: routeBackdrop,
    vote_count: routeVoteCount, runtime: routeRuntime, certification: routeCertification,
    tagline: routeTagline, status: routeStatus, release_date: routeReleaseDate,
    popularity: routePopularity, original_language: routeOriginalLanguage,
    origin_country: routeOriginCountry, number_of_seasons: routeNumberOfSeasons,
    number_of_episodes: routeNumberOfEpisodes, last_air_date: routeLastAirDate,
    in_production: routeInProduction, networks: routeNetworks, budget: routeBudget,
    revenue: routeRevenue, production_companies: routeProductionCompanies,
    production_countries: routeProductionCountries, spoken_languages: routeSpokenLanguages,
    watch_providers: routeWatchProviders, keywords: routeKeywords,
    belongs_to_collection: routeBelongsToCollection, cast: routeCast,
    display_seasons: routeDisplaySeasons,
  } = params;

  const parsedGenresRaw = routeGenres ? JSON.parse(String(routeGenres)) : [];
  const parsedGenres = mapGenreIdsToNames(parsedGenresRaw);
  const parsedOriginCountry = routeOriginCountry ? JSON.parse(String(routeOriginCountry)) : [];
  const parsedNetworks = routeNetworks ? JSON.parse(String(routeNetworks)) : [];
  const parsedProductionCompanies = routeProductionCompanies ? JSON.parse(String(routeProductionCompanies)) : [];
  const parsedProductionCountries = routeProductionCountries ? JSON.parse(String(routeProductionCountries)) : [];
  const parsedSpokenLanguages = routeSpokenLanguages ? JSON.parse(String(routeSpokenLanguages)) : [];
  const parsedWatchProviders = routeWatchProviders ? JSON.parse(String(routeWatchProviders)) : [];
  const parsedKeywords = routeKeywords ? JSON.parse(String(routeKeywords)) : [];
  const parsedBelongsToCollection = routeBelongsToCollection ? JSON.parse(String(routeBelongsToCollection)) : null;
  const parsedCast = routeCast ? JSON.parse(String(routeCast)) : [];
  const parsedDisplaySeasons = routeDisplaySeasons ? JSON.parse(String(routeDisplaySeasons)) : [];

  const displayTitle = String(routeTitle || 'Untitled');
  const displayRating = parseFloat(String(routeRating || '0'));
  const displayYear = String(routeYear || '');
  const displayOverview = String(routeOverview || '');
  const displayBackdrop = String(routeBackdrop || '');
  const displayPoster = String(routePoster || '');
  const displayVoteCount = parseInt(String(routeVoteCount || '0'));
  const displayRuntime = String(routeRuntime || '');
  const displayCertification = String(routeCertification || '');
  const displayTagline = String(routeTagline || '');
  const displayStatus = String(routeStatus || '');
  const displayReleaseDate = String(routeReleaseDate || '');
  const displayPopularity = parseFloat(String(routePopularity || '0'));
  const displayOriginalLanguage = String(routeOriginalLanguage || '');
  const displayNumberOfSeasons = parseInt(String(routeNumberOfSeasons || '0'));
  const displayNumberOfEpisodes = parseInt(String(routeNumberOfEpisodes || '0'));
  const displayLastAirDate = String(routeLastAirDate || '');
  const displayInProduction = routeInProduction === 'true';
  const displayBudget = parseInt(String(routeBudget || '0'));
  const displayRevenue = parseInt(String(routeRevenue || '0'));
  const isTVShow = mediaType === 'tv';
  const tmdbId = parseInt(String(mediaId || '0'));

  const { getItemById } = usePreloadedMediaStore();
  const preloadedItem = useMemo(() => { return mediaId ? getItemById(String(mediaId)) : undefined; }, [mediaId, getItemById]);

  const handleGoBack = useCallback(() => {
    if (router.canGoBack()) router.back(); else router.replace('/');
  }, []);

  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [seasonDetails, setSeasonDetails] = useState<any>(null);
  const [downloadQualities, setDownloadQualities] = useState<DownloadQuality[]>([]);
  const [isLoadingSources, setIsLoadingSources] = useState(false);
  const [selectedStreamUrl, setSelectedStreamUrl] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [episodePages, setEpisodePages] = useState<any[][]>([]);
  const [currentEpisodePage, setCurrentEpisodePage] = useState(0);
  const [isDownloadDropdownOpen, setIsDownloadDropdownOpen] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState<DownloadQuality | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const ffmpegSessionIdRef = useRef<number | null>(null);
  const episodeFfmpegSessionIdsRef = useRef<Map<string, number>>(new Map());
  const [downloadStatusText, setDownloadStatusText] = useState('Download Now');
  const [episodeSelections, setEpisodeSelections] = useState<EpisodeSelection[]>([]);
  const [selectedAllEpisodes, setSelectedAllEpisodes] = useState(false);
  const [selectedEpisodesForDownload, setSelectedEpisodesForDownload] = useState<EpisodeSelection[]>([]);
  const [episodeViewMode, setEpisodeViewMode] = useState<EpisodeViewMode>('grid');
  const [qualityViewMode, setQualityViewMode] = useState<EpisodeViewMode>('grid');
  const [pendingQuality, setPendingQuality] = useState<DownloadQuality | null>(null);
  const [allComments, setAllComments] = useState<Comment[]>([]);
  const commentScrollY = useRef(new Animated.Value(0)).current;
  const commentLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const [showFullSynopsis, setShowFullSynopsis] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [isExtractingStream, setIsExtractingStream] = useState(false);
  const [watcherCount, setWatcherCount] = useState(0);
  const [likeCount, setLikeCount] = useState(0);
  const [watchlistAdds, setWatchlistAdds] = useState(0);
  const [saveCount, setSaveCount] = useState(0);
  const episodePagerRef = useRef<FlatList<any>>(null);
  const skeletonPulse = useRef(new Animated.Value(0.45)).current;
  const [streamData, setStreamData] = useState<{ url: string; quality: string; isTorrent: boolean; allSources: any[]; provider: string; } | null>(null);
  const [isTorrentStream, setIsTorrentStream] = useState(false);

  // ─── TanStack Query: Season Details ───
  const { data: seasonData, isLoading: isLoadingSeason } = useQuery({
    queryKey: ['seasonDetails', mediaId, selectedSeason],
    queryFn: async () => {
      if (isTVShow && mediaId) {
        console.log(`[Details] 📡 Fetching season ${selectedSeason} for ${mediaId}`);
        return await fetchSeasonDetails(Number(mediaId), selectedSeason);
      }
      return null;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: isTVShow && !!mediaId && !!selectedSeason,
  });

  // ─── TanStack Query: Recommendations ───
  const { data: recommendationsData } = useQuery({
    queryKey: ['recommendations', mediaId, mediaType],
    queryFn: async () => {
      console.log(`[Details] 📡 Fetching recommendations for ${mediaId}`);
      let recs = isTVShow ? await fetchTVShowRecommendations(Number(mediaId)) : await fetchMovieRecommendations(Number(mediaId));
      return (recs?.slice(0, MAX_RECOMMENDATIONS) || []).map((item: any) => ({
        ...item, poster_path: item.poster_path || item.poster, type: item.type || (item.title ? 'movie' : 'tv'),
      }));
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: !!mediaId,
  });

  // ─── TanStack Query: Reviews ───
  const { data: reviewsData } = useQuery({
    queryKey: ['reviews', mediaId, mediaType],
    queryFn: async () => {
      console.log(`[Details] 📡 Fetching reviews for ${mediaId}`);
      const rawReviews = isTVShow ? await fetchTVShowReviews(Number(mediaId)) : await fetchMovieReviews(Number(mediaId));
      return mapTMDBReviewsToComments(rawReviews || []);
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: !!mediaId,
  });

  useEffect(() => {
    if (reviewsData && reviewsData.length > 0) {
      setAllComments(reviewsData);
    } else {
      const dummyComments: Comment[] = [
        { id: '1', username: 'movie_buff_99', text: 'Absolutely incredible! The cinematography is breathtaking.', timestamp: 'just now', likes: 89 },
        { id: '2', username: 'critic_master', text: 'One of the best films I have ever seen.', timestamp: 'just now', likes: 67 },
        { id: '3', username: 'film_lover_42', text: 'The performances are outstanding. I was completely immersed.', timestamp: 'just now', likes: 54 },
        { id: '4', username: 'cinema_guru', text: 'A must-watch for any movie enthusiast.', timestamp: 'just now', likes: 41 },
        { id: '5', username: 'review_king', text: 'Visually stunning and emotionally resonant.', timestamp: 'just now', likes: 38 },
        { id: '6', username: 'movie_mania', text: 'I have watched this 3 times already.', timestamp: 'just now', likes: 35 },
        { id: '7', username: 'silver_screen', text: 'The director has outdone themselves.', timestamp: 'just now', likes: 29 },
        { id: '8', username: 'film_fanatic', text: 'This is why I love movies.', timestamp: 'just now', likes: 27 },
      ];
      setAllComments(dummyComments);
    }
  }, [reviewsData]);

  useEffect(() => {
    if (allComments.length === 0) return;
    commentScrollY.setValue(0);
    const totalCommentsHeight = allComments.length * COMMENT_ITEM_UNIT;
    const duration = allComments.length * COMMENT_SCROLL_MS_PER_ITEM;
    const loop = Animated.loop(
      Animated.timing(commentScrollY, { toValue: -totalCommentsHeight, duration, easing: Easing.linear, useNativeDriver: true })
    );
    commentLoopRef.current = loop;
    loop.start();
    return () => { loop.stop(); };
  }, [allComments]);

  useEffect(() => {
    if (seasonData && seasonData.episodes) {
      setSeasonDetails(seasonData);
      const episodes = seasonData.episodes.map((ep: any) => ({
        id: ep.id, episode_number: ep.episode_number, name: ep.name || `Episode ${ep.episode_number}`,
        still_path: ep.still_path, overview: ep.overview || '', air_date: ep.air_date,
        runtime: ep.runtime, vote_average: ep.vote_average, vote_count: ep.vote_count,
      }));
      const pages = chunkEpisodesIntoPages(episodes, EPISODES_PER_GRID_PAGE);
      setEpisodePages(pages);
      setCurrentEpisodePage(0);
      const selections = episodes.map((ep: any) => ({
        seasonNumber: selectedSeason, episodeNumber: ep.episode_number,
        title: ep.name || `Episode ${ep.episode_number}`, selected: false,
        stillPath: ep.still_path, overview: ep.overview,
      }));
      setEpisodeSelections(selections);
    }
  }, [seasonData, selectedSeason]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(skeletonPulse, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(skeletonPulse, { toValue: 0.45, duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  useEffect(() => { const unsub = NetInfo.addEventListener((s) => setIsOffline(s.isConnected === false || s.isInternetReachable === false)); return () => unsub(); }, []);
  useEffect(() => {
    let c = false;
    if (!mediaId) return;
    getWatchlistIds().then((ids) => { if (!c) setIsInWatchlist(ids.has(String(mediaId))); });
    return () => { c = true; };
  }, [mediaId]);

  useEffect(() => {
    const popularitySeed = Math.max(1, Math.round(displayPopularity || 10));
    const voteSeed = Math.max(1, displayVoteCount || 50);
    setWatcherCount(Math.round(popularitySeed * (2 + Math.random() * 3)));
    setLikeCount(Math.round(voteSeed * (0.6 + Math.random() * 0.4)));
    setWatchlistAdds(Math.round(voteSeed * (0.8 + Math.random() * 0.6)));
    setSaveCount(Math.round(voteSeed * (0.2 + Math.random() * 0.3)));
  }, [mediaId, displayPopularity, displayVoteCount]);

  useEffect(() => {
    const interval = setInterval(() => {
      setWatcherCount((prev) => {
        const roll = Math.random();
        let next = prev;
        if (roll < 0.08) next = Math.max(1, Math.round(prev / (1.05 + Math.random() * 0.1)));
        else next = Math.max(1, prev + Math.floor(Math.random() * 9) - 4);
        return next;
      });
    }, WATCHER_TICK_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setLikeCount((prev) => {
        const delta = Math.random() < 0.85 ? Math.floor(Math.random() * 3) : -1;
        return Math.max(0, prev + delta);
      });
    }, LIKE_TICK_MS);
    return () => clearInterval(interval);
  }, []);

  // ─── Unified API Stream Extraction ───
  const extractStreamFromAPI = useCallback(async (seasonNum?: number, episodeNum?: number) => {
    if (!tmdbId || tmdbId === 0) return null;
    setIsExtractingStream(true);
    try {
      const seasonToUse = seasonNum || selectedSeason || 1;
      const episodeToUse = episodeNum || 1;
      console.log(`[Details] 🔍 Fetching licensed playback source for TMDB ID: ${tmdbId}, S${seasonToUse}E${episodeToUse}`);

      const source: LicensedPlaybackSource = await getPlaybackSource({
        tmdbId,
        mediaType: isTVShow ? 'tv' : 'movie',
        season: isTVShow ? seasonToUse : undefined,
        episode: isTVShow ? episodeToUse : undefined,
      });

      console.log(`[Details] ✅ Playback source: ${source.url} (${source.type})`);

      const result = { url: source.url, quality: 'HD', isTorrent: false, allSources: [source], provider: 'licensed' };
      setStreamData(result);
      setSelectedStreamUrl(result.url);
      setSelectedProvider('licensed');
      setIsTorrentStream(false);

      const qualities: DownloadQuality[] = [
        { label: 'HD', resolution: 'HD', size: 'Unknown', sizeBytes: 0, url: result.url, provider: 'licensed', isRecommended: true },
      ];
      setDownloadQualities(qualities);
      if (!isTVShow) setPendingQuality(qualities[0]);
      setIsExtractingStream(false);
      return result;
    } catch (error) {
      console.warn('[Details] Licensed playback source unavailable:', error);
      setIsExtractingStream(false);
      return null;
    }
  }, [tmdbId, isTVShow, selectedSeason]);

  useEffect(() => { extractStreamFromAPI(); }, [extractStreamFromAPI]);

  const loadStreamsForDownload = useCallback(async () => {
    if (isLoadingSources) return;
    if (streamData) { console.log('[Details] ⚡ Using already extracted stream data'); return; }
    setIsLoadingSources(true);
    try {
      const result = await extractStreamFromAPI();
      if (!result) showToast('No stream available for download');
    } catch (error) {
      console.error('[Details] Failed to load streams:', error);
      showToast('Failed to load download sources');
    } finally { setIsLoadingSources(false); }
  }, [extractStreamFromAPI, isLoadingSources, showToast, streamData]);

  // ─── Navigate to Player ───
  // Passes the RAW stream URL. Expo Router handles param encoding internally;
  // we do NOT call encodeURIComponent here to avoid double-encoding tokens.
  const navigateToPlayer = useCallback((url: string, seasonNum?: number, episodeNum?: number, epTitle?: string) => {
    const posterPath = displayPoster || '';
    addToContinueWatching({
      id: `${mediaType}_${mediaId}`, title: displayTitle, mediaType: mediaType as 'movie' | 'tv',
      tmdbId: String(mediaId), posterPath: posterPath, progress: 0, currentTime: 0, duration: 0,
    });
    const torrentFlag = isTorrentUrl(url) ? 'true' : 'false';
    if (isTVShow && seasonNum) {
      router.push({ pathname: '/player', params: {
        mediaId: String(mediaId), mediaType: 'tv', title: displayTitle, poster_path: posterPath,
        season: seasonNum, episode: episodeNum || 1, episodeTitle: epTitle || `Episode ${episodeNum || 1}`,
        streamUrl: url, isTorrent: torrentFlag,
      }});
    } else {
      router.push({ pathname: '/player', params: {
        mediaId: String(mediaId), mediaType: 'movie', title: displayTitle, poster_path: posterPath,
        streamUrl: url, isTorrent: torrentFlag,
      }});
    }
  }, [displayTitle, mediaId, mediaType, displayPoster, addToContinueWatching, isTVShow]);

  // ─── Play a specific episode ───
  const handlePlayEpisode = useCallback(async (seasonNum: number, episodeNum: number, epTitle?: string) => {
    if (isOffline) { showToast("You're offline — connect to the internet to watch"); return; }
    // Use cached stream if it matches S01E01 (or current season ep 1)
    if (streamData?.url && selectedSeason === seasonNum && episodeNum === 1) {
      navigateToPlayer(streamData.url, seasonNum, episodeNum, epTitle);
      return;
    }
    setIsExtractingStream(true);
    try {
      const result = await extractStreamFromAPI(seasonNum, episodeNum);
      if (result?.url) navigateToPlayer(result.url, seasonNum, episodeNum, epTitle);
      else showToast('No stream available for this episode');
    } catch (err) {
      console.error('[Details] Episode stream error:', err);
      showToast('Failed to load episode stream');
    } finally { setIsExtractingStream(false); }
  }, [isOffline, streamData, selectedSeason, extractStreamFromAPI, showToast, navigateToPlayer]);

  // ─── Watch Now Handler ───
  const handleWatchNow = useCallback(() => {
    if (isOffline) { showToast("You're offline — connect to the internet to watch"); return; }
    if (!streamData) { showToast('Stream is loading, please wait...'); return; }
    if (!streamData.url) { showToast('No stream available'); return; }
    if (isTVShow) {
      // Industry standard: Watch Now starts from Season 1, Episode 1
      handlePlayEpisode(1, 1, seasonData?.episodes?.[0]?.name);
    } else {
      navigateToPlayer(streamData.url);
    }
  }, [isOffline, streamData, isTVShow, showToast, handlePlayEpisode, navigateToPlayer, seasonData]);

  const handleToggleWatchlist = useCallback(() => {
    if (!mediaId) return;
    const idKey = String(mediaId);
    setIsInWatchlist(prev => {
      const newState = !prev;
      showToast(newState ? `Added "${displayTitle}" to watchlist` : `Removed "${displayTitle}" from watchlist`);
      getWatchlistIds().then((ids) => {
        const next = new Set(ids);
        if (newState) next.add(idKey); else next.delete(idKey);
        saveWatchlistIds(next);
      });
      return newState;
    });
  }, [mediaId, displayTitle, showToast]);

  const handleEpisodeToggle = useCallback((episodeNumber: number) => {
    setEpisodeSelections(prev => prev.map(ep => ep.episodeNumber === episodeNumber ? { ...ep, selected: !ep.selected } : ep));
  }, []);

  const handleSelectAllEpisodes = useCallback(() => {
    const newSelected = !selectedAllEpisodes;
    setSelectedAllEpisodes(newSelected);
    setEpisodeSelections(prev => prev.map(ep => ({ ...ep, selected: newSelected })));
  }, [selectedAllEpisodes]);

  const startFFmpegDownload = useCallback(async (
    streamUrl: string, outputPath: string, onProgress?: (percent: number) => void, referer?: string
  ): Promise<{ sessionId: number; result: Promise<{ success: boolean; cancelled?: boolean; failLog?: string }> }> => {
    let totalDurationMs = 0;
    try {
      const probeSession = await FFprobeKit.getMediaInformation(streamUrl);
      const mediaInfo = await probeSession.getMediaInformation();
      const durationVal = mediaInfo ? mediaInfo.getDuration() : NaN;
      const durationSec = typeof durationVal === 'number' ? durationVal : parseFloat(String(durationVal));
      if (!Number.isNaN(durationSec) && durationSec > 0) totalDurationMs = durationSec * 1000;
    } catch (probeError) {
      console.warn('[Download] Could not probe duration, falling back to indeterminate progress:', probeError);
    }
    try { FFmpegKitConfig.setLogLevel(Level.AV_LOG_INFO); } catch {}
    const liveLogLines: string[] = [];
    const ffmpegHeaders = buildFFmpegHeaders(streamUrl, referer || streamUrl);
    const commandArguments = ['-y', '-user_agent', 'NetflixPro/1.0', ...ffmpegHeaders, '-i', streamUrl, '-c', 'copy', '-bsf:a', 'aac_adtstoasc', outputPath];
    let resolveResult!: (value: { success: boolean; cancelled?: boolean; failLog?: string }) => void;
    const result = new Promise<{ success: boolean; cancelled?: boolean; failLog?: string }>((resolve) => { resolveResult = resolve; });
    const session = await FFmpegKit.executeWithArgumentsAsync(
      commandArguments,
      async (completedSession) => {
        const returnCode = await completedSession.getReturnCode();
        if (ReturnCode.isSuccess(returnCode)) resolveResult({ success: true });
        else if (ReturnCode.isCancel(returnCode)) resolveResult({ success: false, cancelled: true });
        else {
          const returnCodeValue = returnCode?.getValue?.();
          let logOutput = '';
          try { logOutput = await completedSession.getAllLogsAsString(); } catch {}
          const stackTrace = await completedSession.getFailStackTrace();
          const failLog = (logOutput && logOutput.trim()) || (liveLogLines.length > 0 ? liveLogLines.join('\n') : '') || stackTrace || `ffmpeg exited with code ${returnCodeValue ?? 'unknown'}`;
          console.error(`[Download] FFmpegKit failed (returnCode=${returnCodeValue}):`, failLog);
          resolveResult({ success: false, failLog });
        }
      },
      (log) => { try { const message = log?.getMessage?.(); if (message) liveLogLines.push(String(message)); } catch {} },
      (statistics) => { if (totalDurationMs > 0 && onProgress) onProgress(Math.min((statistics.getTime() / totalDurationMs) * 100, 100)); }
    );
    return { sessionId: session.getSessionId(), result };
  }, []);

  const handleDownload = useCallback(async (quality: DownloadQuality) => {
    try {
      if (streamData?.isTorrent) { showToast('Torrent streams cannot be downloaded'); return; }
      if (!streamData?.url) { showToast('No stream URL available'); return; }
      setSelectedQuality(quality);
      setIsDownloading(true);
      setDownloadProgress(0);
      setDownloadStatusText(`Downloading ${quality.label}`);
      const settings = await getDownloadSettings();
      const concurrentLimit = settings.concurrentDownloads || 3;
      const episodesToDownload = isTVShow ? selectedEpisodesForDownload : [];
      const downloadsDir = `${FileSystem.documentDirectory}downloads`;
      const dirInfo = await FileSystem.getInfoAsync(downloadsDir);
      if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(downloadsDir, { intermediates: true });

      if (isTVShow && episodesToDownload.length > 0) {
        const total = episodesToDownload.length;
        let completedCount = 0;
        const downloadEpisode = async (ep: EpisodeSelection) => {
          const id = `${mediaType}_${mediaId}_s${ep.seasonNumber}_e${ep.episodeNumber}`;
          const title = `${displayTitle} - S${ep.seasonNumber}E${ep.episodeNumber}`;
          const outputPath = `${downloadsDir}/${id}_${quality.label}.mp4`;
          try {
            let epStreamUrl = streamData.url;
            let epReferer: string | undefined;
            try {
              const epSource = await getPlaybackSource({
                tmdbId,
                mediaType: 'tv',
                season: ep.seasonNumber,
                episode: ep.episodeNumber,
              });
              if (epSource.url) {
                epStreamUrl = epSource.url;
                epReferer = epSource.headers?.Referer;
              }
            } catch (extractError) {
              console.warn(`[Download] Per-episode licensed source lookup failed for S${ep.seasonNumber}E${ep.episodeNumber}:`, extractError);
              throw new Error('Failed to fetch episode stream');
            }
            if (!epStreamUrl) throw new Error('No stream URL available for this episode');
            addDownload({ id, title, mediaType: 'tv', tmdbId: String(mediaId), posterPath: displayPoster, quality: quality.label, size: quality.size, sizeBytes: quality.sizeBytes, provider: quality.provider || 'licensed', season: ep.seasonNumber, episode: ep.episodeNumber, episodeTitle: ep.title, filePath: outputPath });
            const { sessionId, result } = await startFFmpegDownload(epStreamUrl, outputPath, (percent) => {
              const totalProgress = ((completedCount + percent / 100) / total) * 100;
              setDownloadProgress(totalProgress);
              setDownloadStatusText(`Downloading ${completedCount + 1}/${total} episodes`);
            }, epReferer);
            episodeFfmpegSessionIdsRef.current.set(id, sessionId);
            const outcome = await result;
            episodeFfmpegSessionIdsRef.current.delete(id);
            if (!outcome.success && !outcome.cancelled) throw new Error(outcome.failLog || 'FFmpeg conversion failed');
          } catch (error: any) {
            addNotification({ id: `download_fail_${Date.now()}_${ep.seasonNumber}_${ep.episodeNumber}`, title: 'Download Failed', message: `Failed to download ${title}: ${error?.message || 'Unknown error'}`, type: 'error' });
          } finally {
            completedCount += 1;
            setDownloadProgress((completedCount / total) * 100);
            setDownloadStatusText(completedCount < total ? `Downloading ${completedCount + 1}/${total} episodes` : 'Download Now');
          }
        };
        for (let i = 0; i < episodesToDownload.length; i += concurrentLimit) {
          const batch = episodesToDownload.slice(i, i + concurrentLimit);
          await Promise.all(batch.map(downloadEpisode));
        }
        setIsDownloading(false);
        setDownloadProgress(0);
        setDownloadStatusText('Download Now');
        setPendingQuality(null);
        setIsDownloadDropdownOpen(false);
        setSelectedEpisodesForDownload([]);
        return;
      }

      const outputPath = `${downloadsDir}/${mediaType}_${mediaId}_${quality.label}.mp4`;
      ffmpegSessionIdRef.current = null;
      const referer = (streamData.allSources?.[0] as LicensedPlaybackSource | undefined)?.headers?.Referer;
      const { sessionId, result } = await startFFmpegDownload(streamData.url, outputPath, (percent) => setDownloadProgress(percent), referer);
      ffmpegSessionIdRef.current = sessionId;
      const outcome = await result;
      ffmpegSessionIdRef.current = null;
      if (outcome.success) {
        setIsDownloading(false); setDownloadProgress(0); setDownloadStatusText('Download Now'); setPendingQuality(null); setIsDownloadDropdownOpen(false);
        addDownload({ id: `${mediaType}_${mediaId}`, title: displayTitle, mediaType: mediaType as 'movie' | 'tv', tmdbId: String(mediaId), posterPath: displayPoster, quality: quality.label, size: quality.size, sizeBytes: quality.sizeBytes, provider: quality.provider || 'licensed', filePath: outputPath });
      } else if (outcome.cancelled) {
        setIsDownloading(false); setDownloadProgress(0); setDownloadStatusText('Download Now');
      } else {
        setIsDownloading(false); setDownloadStatusText('Download Failed');
        addNotification({ id: `download_fail_${Date.now()}`, title: 'Download Failed', message: `Failed to download ${displayTitle}`, type: 'error' });
        showToast('Download failed');
      }
    } catch (error) {
      console.error('[Download] Error:', error);
      setIsDownloading(false); setDownloadStatusText('Download Failed');
      addNotification({ id: `download_fail_${Date.now()}`, title: 'Download Failed', message: `Failed to download ${displayTitle}`, type: 'error' });
      showToast('Download failed');
    }
  }, [mediaId, mediaType, tmdbId, selectedEpisodesForDownload, displayTitle, displayPoster, showToast, addNotification, addDownload, isTVShow, streamData, startFFmpegDownload]);

  const allSeasonNumbers = useMemo(() => {
    if (!isTVShow) return [];
    if (parsedDisplaySeasons && Array.isArray(parsedDisplaySeasons) && parsedDisplaySeasons.length > 0) return parsedDisplaySeasons;
    if (displayNumberOfSeasons > 0) return Array.from({ length: displayNumberOfSeasons }, (_, i) => i + 1);
    if (seasonData) { const count = seasonData.season_number || 1; return Array.from({ length: count }, (_, i) => i + 1); }
    return [1];
  }, [isTVShow, parsedDisplaySeasons, displayNumberOfSeasons, seasonData]);

  const handleSeasonChange = useCallback((seasonNum: number) => {
    console.log(`[Details] 🔄 Switching to season ${seasonNum}`);
    setSelectedSeason(seasonNum);
    setEpisodeSelections([]);
    setSelectedAllEpisodes(false);
    setPendingQuality(null);
    setDownloadQualities([]);
    setCurrentEpisodePage(0);
    setSelectedEpisodesForDownload([]);
    setStreamData(null);
    setSelectedStreamUrl(null);
    setSelectedProvider(null);
    setIsTorrentStream(false);
    extractStreamFromAPI(seasonNum, 1);
  }, [extractStreamFromAPI]);

  const handleEpisodeScrollEnd = useCallback((event: any) => {
    const pageWidth = EPISODE_GRID_PAGE_WIDTH;
    const page = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
    setCurrentEpisodePage(page);
    const totalPages = episodePages.length;
    if (page >= totalPages - 1 && allSeasonNumbers.length > selectedSeason) {
      const nextSeason = selectedSeason + 1;
      if (allSeasonNumbers.includes(nextSeason)) {
        console.log(`[Details] 🔄 Auto-transitioning to season ${nextSeason}`);
        handleSeasonChange(nextSeason);
        setCurrentEpisodePage(0);
        if (episodePagerRef.current) episodePagerRef.current.scrollToOffset({ offset: 0, animated: true });
      }
    }
  }, [episodePages.length, allSeasonNumbers, selectedSeason, handleSeasonChange]);

  const renderViewToggle = (mode: EpisodeViewMode, onChange: (m: EpisodeViewMode) => void) => (
    <View style={styles.viewToggleRow}>
      {(['grid', 'list'] as EpisodeViewMode[]).map((m) => (
        <TouchableOpacity key={m} style={[styles.viewToggleButton, { borderColor: mode === m ? colors.gold : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'), borderWidth: 1.5 }]}
          onPress={() => onChange(m)} activeOpacity={0.7}>
          <Ionicons name={m === 'grid' ? 'grid-outline' : 'list-outline'} size={14} color={mode === m ? colors.gold : colors.textMuted} />
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderQualityPicker = () => {
    if (isTorrentStream) return (
      <View style={[styles.dropdownEmpty, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', paddingVertical: 6 }]}>
        <Ionicons name="cloud-offline-outline" size={16} color={colors.textMuted} />
        <Text style={[styles.dropdownEmptyText, { color: colors.textMuted, fontSize: 11 }]}>Torrent streams cannot be downloaded</Text>
      </View>
    );
    if (downloadQualities.length === 0 && !isLoadingSources && !isExtractingStream) return (
      <View style={[styles.dropdownEmpty, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', paddingVertical: 6 }]}>
        <Ionicons name="cloud-offline-outline" size={16} color={colors.textMuted} />
        <Text style={[styles.dropdownEmptyText, { color: colors.textMuted, fontSize: 11 }]}>{isExtractingStream ? 'Extracting stream...' : 'No sources'}</Text>
      </View>
    );
    if (isLoadingSources || isExtractingStream) return (
      <View style={styles.qualityPillWrap}>
        {[1,2,3].map((_, i) => (
          <View key={i} style={[styles.qualityPill, { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }]}>
            <View style={[styles.skeletonBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', height: 12, width: 30 }]} />
          </View>
        ))}
      </View>
    );
    return (
      <>
        <View style={styles.qualityPillWrap}>
          {downloadQualities.map((quality) => {
            const isSelected = pendingQuality?.label === quality.label && pendingQuality?.provider === quality.provider;
            return (
              <TouchableOpacity key={`${quality.provider}-${quality.label}`} style={[styles.qualityPill, { borderColor: isSelected ? colors.gold : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'), borderWidth: 1.5 }]}
                onPress={() => setPendingQuality(quality)} disabled={isDownloading} activeOpacity={0.7}>
                <Text style={[styles.qualityPillLabel, { color: isSelected ? colors.gold : colors.text }]}>{quality.label}</Text>
                {quality.isRecommended && <Text style={[styles.qualityPillRecommended, { color: colors.textMuted }]}>Rec</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
        {isDownloading && <View style={styles.qualityProgress}><View style={[styles.qualityProgressFill, { backgroundColor: colors.gold, width: `${downloadProgress}%` }]} /></View>}
      </>
    );
  };

  const renderEpisodePicker = () => {
    if (episodeViewMode === 'list') {
      return (
        <ScrollView style={styles.episodePager} nestedScrollEnabled>
          {episodeSelections.map((ep) => (
            <TouchableOpacity key={ep.episodeNumber} style={[styles.episodeItem, { borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]} onPress={() => handleEpisodeToggle(ep.episodeNumber)}>
              <View style={styles.checkboxRow}>
                <View style={[styles.checkbox, { borderColor: colors.gold, backgroundColor: ep.selected ? colors.gold : 'transparent', width: 14, height: 14 }]}>
                  {ep.selected && <Ionicons name="checkmark" size={10} color="#000" />}
                </View>
                <Text style={[styles.episodeItemText, { color: colors.text }]} numberOfLines={1}>E{ep.episodeNumber}. {ep.title}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      );
    }
    return (
      <>
        <View style={{ height: EPISODE_GRID_CONTAINER_HEIGHT, width: EPISODE_GRID_PAGE_WIDTH }}>
          <FlatList ref={episodePagerRef} data={episodePages} horizontal pagingEnabled
            style={{ height: EPISODE_GRID_CONTAINER_HEIGHT, width: EPISODE_GRID_PAGE_WIDTH }}
            showsHorizontalScrollIndicator={false} keyExtractor={(_, i) => `episode-page-${i}`} onMomentumScrollEnd={handleEpisodeScrollEnd}
            renderItem={({ item: pageEpisodes }: { item: any[] }) => (
              <View style={{ width: EPISODE_GRID_PAGE_WIDTH, height: EPISODE_GRID_CONTAINER_HEIGHT }}>
                <View style={[styles.episodeGrid, { gap: EPISODE_GRID_GAP }]}>
                  {pageEpisodes.map((episode) => {
                    const selection = episodeSelections.find((e) => e.episodeNumber === episode.episode_number);
                    const isSelected = !!selection?.selected;
                    const episodeImageUri = episode.still_path ? getImageUrl(episode.still_path) : displayPoster ? (displayPoster.startsWith('http') ? displayPoster : `${TMDB_POSTER_PREFIX}${displayPoster}`) : null;
                    return (
                      <TouchableOpacity key={`ep-${episode.id || episode.episode_number}`} style={[styles.episodeGridCard, { width: EPISODE_CARD_WIDTH, marginBottom: EPISODE_GRID_GAP }]}
                        onPress={() => handleEpisodeToggle(episode.episode_number)} activeOpacity={0.7}>
                        <View style={[styles.episodeGridImageContainer, { width: EPISODE_CARD_WIDTH, height: EPISODE_CARD_HEIGHT, borderWidth: isSelected ? 1.5 : 0, borderColor: isSelected ? colors.gold : 'transparent', borderRadius: 4 }]}>
                          {episodeImageUri ? <Image source={{ uri: episodeImageUri }} style={styles.episodeGridImage} resizeMode="cover" /> : (
                            <View style={[styles.episodeGridPlaceholder, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
                              <Ionicons name="tv-outline" size={14} color={colors.textMuted} />
                            </View>
                          )}
                          <View style={[styles.checkbox, styles.episodeGridCheckbox, { borderColor: '#fff', backgroundColor: isSelected ? colors.gold : 'rgba(0,0,0,0.5)', width: 12, height: 12, borderRadius: 2, borderWidth: 1 }]}>
                            {isSelected && <Ionicons name="checkmark" size={8} color="#000" />}
                          </View>
                          <View style={styles.episodeGridNumber}><Text style={styles.episodeGridNumberText}>E{episode.episode_number}</Text></View>
                        </View>
                        <Text style={[styles.episodeGridTitle, { color: colors.text }]} numberOfLines={1}>{episode.name || `E${episode.episode_number}`}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          />
        </View>
        {episodePages.length > 1 && (
          <View style={styles.pageIndicatorContainer}>
            <Text style={[styles.pageIndicatorText, { color: colors.textMuted }]}>{currentEpisodePage + 1}/{episodePages.length}</Text>
          </View>
        )}
      </>
    );
  };

  const canDownload = useMemo(() => {
    if (isTorrentStream) return false;
    if (!pendingQuality) return false;
    if (isTVShow) return episodeSelections.some(ep => ep.selected);
    return true;
  }, [pendingQuality, isTVShow, episodeSelections, isTorrentStream]);

  const renderDownloadDropdown = () => {
    if (isTorrentStream) return null;
    if (!isDownloadDropdownOpen) return null;
    return (
      <View style={[styles.dropdownContainer, { backgroundColor: isDark ? 'rgba(20,20,20,0.95)' : 'rgba(255,255,255,0.95)', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)', zIndex: 999 }]}>
        {isTVShow && (
          <>
            <View style={styles.seasonPinnedBar}>
              <View style={styles.dropdownHeader}>
                <Text style={[styles.dropdownTitle, { color: colors.text }]}>Season</Text>
                <TouchableOpacity onPress={() => setIsDownloadDropdownOpen(false)}><Ionicons name="close" size={18} color={colors.textMuted} /></TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.seasonScroll}>
                {allSeasonNumbers.map((num) => (
                  <TouchableOpacity key={num} style={[styles.seasonChip, { borderColor: selectedSeason === num ? colors.gold : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'), borderWidth: 1.5 }]} onPress={() => handleSeasonChange(num)}>
                    <Text style={[styles.seasonChipText, { color: selectedSeason === num ? colors.gold : colors.text }]}>S{num}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <View style={styles.qualitySection}>
              <Text style={[styles.qualitySectionTitle, { color: colors.textMuted }]}>Quality</Text>
              {renderQualityPicker()}
            </View>
            {isLoadingSeason ? (
              <View style={[styles.dropdownEmpty, { paddingVertical: 6 }]}><Text style={{ color: colors.textMuted, fontSize: 11 }}>Loading episodes…</Text></View>
            ) : episodeSelections.length > 0 ? (
              <>
                <View style={styles.selectAllContainer}>
                  <TouchableOpacity onPress={handleSelectAllEpisodes}>
                    <View style={styles.checkboxRow}>
                      <View style={[styles.checkbox, { borderColor: colors.gold, backgroundColor: selectedAllEpisodes ? colors.gold : 'transparent', width: 14, height: 14 }]}>
                        {selectedAllEpisodes && <Ionicons name="checkmark" size={10} color="#000" />}
                      </View>
                      <Text style={[styles.selectAllText, { color: colors.text }]}>All</Text>
                    </View>
                  </TouchableOpacity>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={[styles.episodeCount, { color: colors.textMuted }]}>{episodeSelections.filter(e => e.selected).length}</Text>
                    {renderViewToggle(episodeViewMode, setEpisodeViewMode)}
                  </View>
                </View>
                {renderEpisodePicker()}
                <TouchableOpacity style={[styles.downloadProcessButton, { borderColor: canDownload ? colors.gold : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'), borderWidth: 1.5, opacity: canDownload ? 1 : 0.5, marginTop: 4 }]}
                  onPress={() => { if (canDownload && pendingQuality) { const selected = episodeSelections.filter(ep => ep.selected); setSelectedEpisodesForDownload(selected); handleDownload(pendingQuality); } }} disabled={!canDownload}>
                  <Ionicons name="download-outline" size={14} color={canDownload ? colors.gold : colors.textMuted} />
                  <Text style={[styles.downloadProcessButtonText, { color: canDownload ? colors.gold : colors.textMuted }]}>Download</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={[styles.dropdownEmpty, { paddingVertical: 6 }]}><Text style={{ color: colors.textMuted, fontSize: 11 }}>No episodes</Text></View>
            )}
          </>
        )}
        {!isTVShow && (
          <>
            <View style={styles.dropdownHeader}>
              <Text style={[styles.dropdownTitle, { color: colors.text }]}>Quality</Text>
              <TouchableOpacity onPress={() => { setIsDownloadDropdownOpen(false); setPendingQuality(null); }}><Ionicons name="close" size={18} color={colors.textMuted} /></TouchableOpacity>
            </View>
            {renderQualityPicker()}
            <TouchableOpacity style={[styles.downloadProcessButton, { borderColor: pendingQuality ? colors.gold : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'), borderWidth: 1.5, opacity: pendingQuality ? 1 : 0.5, marginTop: 8 }]}
              onPress={() => { if (pendingQuality && !isDownloading) handleDownload(pendingQuality); }} disabled={!pendingQuality || isDownloading}>
              <Ionicons name="download-outline" size={14} color={pendingQuality ? colors.gold : colors.textMuted} />
              <Text style={[styles.downloadProcessButtonText, { color: pendingQuality ? colors.gold : colors.textMuted }]}>Download</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  };

  // ─── NEW: Playable Episodes Section ───
  const renderEpisodesSection = () => {
    if (!isTVShow || !seasonData?.episodes || seasonData.episodes.length === 0) return null;
    return (
      <View style={styles.episodesSection}>
        <View style={styles.episodesSectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Episodes</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.seasonChipsRow}>
            {allSeasonNumbers.map((num) => (
              <TouchableOpacity key={num} style={[styles.seasonChipLarge, { borderColor: selectedSeason === num ? colors.gold : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'), borderWidth: 1.5 }]} onPress={() => handleSeasonChange(num)}>
                <Text style={[styles.seasonChipText, { color: selectedSeason === num ? colors.gold : colors.text }]}>Season {num}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        <FlatList
          data={seasonData.episodes}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => `ep-play-${item.id}`}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
          renderItem={({ item: ep }) => {
            const episodeImageUri = ep.still_path ? getImageUrl(ep.still_path) : displayPoster ? (displayPoster.startsWith('http') ? displayPoster : `${TMDB_POSTER_PREFIX}${displayPoster}`) : null;
            return (
              <TouchableOpacity style={styles.episodePlayCard} onPress={() => handlePlayEpisode(selectedSeason, ep.episode_number, ep.name)} activeOpacity={0.7}>
                <View style={styles.episodePlayImageWrap}>
                  {episodeImageUri ? (
                    <Image source={{ uri: episodeImageUri }} style={styles.episodePlayImage} resizeMode="cover" />
                  ) : (
                    <View style={[styles.episodePlayPlaceholder, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
                      <Ionicons name="tv-outline" size={24} color={colors.textMuted} />
                    </View>
                  )}
                  <View style={styles.episodePlayOverlay}>
                    <Ionicons name="play-circle" size={32} color="#fff" />
                  </View>
                  <View style={styles.episodePlayNumberBadge}>
                    <Text style={styles.episodePlayNumberBadgeText}>{ep.episode_number}</Text>
                  </View>
                </View>
                <Text style={[styles.episodePlayTitle, { color: colors.text }]} numberOfLines={1}>{ep.name || `Episode ${ep.episode_number}`}</Text>
                <Text style={[styles.episodePlayOverview, { color: colors.textMuted }]} numberOfLines={2}>{ep.overview || ''}</Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>
    );
  };

  const renderCommentCard = (comment: Comment, key: string) => (
    <View key={key} style={[styles.commentCard, { backgroundColor: isDark ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.55)', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }]}>
      <View style={styles.commentHeader}>
        <View style={styles.commentUserRow}>
          <View style={[styles.avatarDot, { backgroundColor: colors.gold }]} />
          <Text style={[styles.commentUsername, { color: colors.text }]}>@{comment.username}</Text>
        </View>
        <Text style={[styles.commentTimestamp, { color: colors.textMuted }]}>{comment.timestamp}</Text>
      </View>
      <Text style={[styles.commentText, { color: colors.textSub }]} numberOfLines={2}>{comment.text}</Text>
      <View style={styles.commentFooter}>
        <Ionicons name="heart-outline" size={12} color={colors.textMuted} />
        <Text style={[styles.commentLikes, { color: colors.textMuted }]}>{comment.likes}</Text>
      </View>
    </View>
  );

  const renderCommentsOverlay = () => {
    if (allComments.length === 0) return null;
    return (
      <View style={[styles.commentsContainer, { zIndex: 50 }]} pointerEvents="none">
        <View style={[styles.commentsViewport, { height: COMMENTS_VIEWPORT_HEIGHT }]}>
          <Animated.View style={{ transform: [{ translateY: commentScrollY }] }}>
            {allComments.map((comment, index) => renderCommentCard(comment, `a-${comment.id}-${index}`))}
            {allComments.map((comment, index) => renderCommentCard(comment, `b-${comment.id}-${index}`))}
          </Animated.View>
        </View>
      </View>
    );
  };

  const formatCompactCount = (count: number): string => {
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return String(count);
  };

  const releaseYear = displayReleaseDate ? displayReleaseDate.split('-')[0] : displayYear || 'Unknown';
  const genres = parsedGenres || [];

  const renderRecommendations = () => {
    if (!recommendationsData || recommendationsData.length === 0) return null;
    return (
      <View style={styles.recommendationsSection}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>More Like This</Text>
        <View style={styles.trendingGrid}>
          {recommendationsData.map((item: any, index: number) => {
            const posterUrl = getPosterUrl(item);
            const itemType = item.type || (item.title ? 'movie' : 'tv');
            const displayRecTitle = item.title || item.name || 'Untitled';
            const rating = item.rating || item.vote_average || 0;
            const year = item.year || (item.release_date ? item.release_date.split('-')[0] : null);
            const isBookmarked = false;
            return (
              <TouchableOpacity key={`rec-${item.id}-${index}`} style={styles.trendingCard}
                onPress={() => { const rawPosterPath = toRawPosterPath(posterUrl); router.push(`/movie/${item.id}?mediaType=${itemType}&title=${encodeURIComponent(displayRecTitle)}&poster_path=${encodeURIComponent(rawPosterPath)}`); }} activeOpacity={0.7}>
                <View style={styles.posterWrap}>
                  <Image source={posterUrl ? { uri: posterUrl } : require('../../../assets/icon.png')} style={styles.trendingPoster} resizeMode="cover" />
                  {!!rating && <View style={styles.ratingBadge}><Ionicons name="star" size={9} color="#000" /><Text style={styles.ratingBadgeText}>{rating.toFixed(1)}</Text></View>}
                  <View style={styles.hdBadge}><Text style={styles.hdBadgeText}>HD</Text></View>
                  <TouchableOpacity style={styles.bookmarkButton} onPress={(e) => { e.stopPropagation?.(); showToast(`${isBookmarked ? 'Removed from' : 'Added to'} watchlist`); }} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <Ionicons name={isBookmarked ? 'bookmark' : 'bookmark-outline'} size={15} color={isBookmarked ? colors.gold : '#fff'} />
                  </TouchableOpacity>
                </View>
                <Text style={[styles.trendingTitle, { color: colors.text }]} numberOfLines={1}>{displayRecTitle}</Text>
                {year && <Text style={[styles.trendingMeta, { color: colors.textMuted }]} numberOfLines={1}>{year}</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  const renderMetadata = () => {
    const hasSynopsis = displayOverview && displayOverview.length > 0;
    return (
      <View style={styles.metadataSection}>
        <View style={styles.metadataRow}>
          <View style={styles.ratingContainer}><Ionicons name="star" size={16} color={colors.gold} /><Text style={[styles.ratingText, { color: colors.text }]}>{displayRating.toFixed(1)}</Text></View>
          <View style={styles.metadataDot} />
          <Text style={[styles.metadataText, { color: colors.textSub }]}>{releaseYear}</Text>
          {displayRuntime && (<><View style={styles.metadataDot} /><Text style={[styles.metadataText, { color: colors.textSub }]}>{displayRuntime}</Text></>)}
          {displayCertification && (<><View style={styles.metadataDot} /><Text style={[styles.metadataText, { color: colors.textSub }]}>{displayCertification}</Text></>)}
        </View>
        <View style={styles.liveStatsRow}>
          <View style={styles.statItem}><Ionicons name="eye-outline" size={13} color={colors.textMuted} /><Text style={[styles.liveStatText, { color: colors.textMuted }]}>{formatCompactCount(watcherCount)} watching</Text></View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}><Ionicons name="heart" size={13} color={colors.gold} /><Text style={[styles.liveStatText, { color: colors.textMuted }]}>{formatCompactCount(likeCount)} likes</Text></View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}><Ionicons name="bookmark-outline" size={13} color={colors.textMuted} /><Text style={[styles.liveStatText, { color: colors.textMuted }]}>{formatCompactCount(watchlistAdds)} in watchlists</Text></View>
        </View>
        {isTVShow && displayNumberOfSeasons > 0 && (
          <View style={styles.statsRow}>
            <View style={styles.statItem}><Ionicons name="tv-outline" size={14} color={colors.textMuted} /><Text style={[styles.statText, { color: colors.textMuted }]}>{displayNumberOfSeasons} Season{displayNumberOfSeasons > 1 ? 's' : ''}</Text></View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}><Ionicons name="film-outline" size={14} color={colors.textMuted} /><Text style={[styles.statText, { color: colors.textMuted }]}>{displayNumberOfEpisodes} Episodes</Text></View>
            {displayStatus && (<><View style={styles.statDivider} /><View style={styles.statItem}><Ionicons name="time-outline" size={14} color={colors.textMuted} /><Text style={[styles.statText, { color: colors.textMuted }]}>{displayStatus}</Text></View></>)}
          </View>
        )}
        {hasSynopsis && (
          <TouchableOpacity style={styles.readMoreButton} onPress={() => setShowFullSynopsis(!showFullSynopsis)} activeOpacity={0.7}>
            <Text style={[styles.readMoreText, { color: colors.gold }]}>{showFullSynopsis ? 'Read Less' : 'Read More'}</Text>
          </TouchableOpacity>
        )}
        {showFullSynopsis && displayOverview && <Text style={[styles.synopsisText, { color: colors.textSub }]}>{displayOverview}</Text>}
        {displayTagline && <Text style={[styles.taglineText, { color: colors.textMuted, fontStyle: 'italic', marginTop: 8 }]}>&quot;{displayTagline}&quot;</Text>}
      </View>
    );
  };

  const onRefresh = useCallback(() => {}, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#000' : '#F5F7FA' }]} edges={['top']}>
      <TouchableOpacity style={styles.backButton} onPress={handleGoBack} activeOpacity={0.8} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="arrow-back" size={20} color="#fff" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.watchlistButton} onPress={handleToggleWatchlist} activeOpacity={0.8} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name={isInWatchlist ? 'bookmark' : 'bookmark-outline'} size={20} color={isInWatchlist ? colors.gold : '#fff'} />
      </TouchableOpacity>

      {isOffline && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={13} color="#fff" />
          <Text style={styles.offlineBannerText}>You're offline — showing cached info</Text>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={colors.gold} />}>
        <View style={styles.headerContainer}>
          {displayBackdrop ? (
            <Image source={{ uri: displayBackdrop }} style={styles.backdropImage} resizeMode="cover" />
          ) : (
            <View style={[styles.backdropPlaceholder, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]} />
          )}
          <LinearGradient colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.4)', isDark ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.7)', isDark ? 'rgba(0,0,0,0.95)' : 'rgba(0,0,0,0.85)']} style={styles.gradient} locations={[0, 0.3, 0.6, 1]} />
          {displayPoster && (
            <View style={styles.posterOverlay}>
              <Image source={{ uri: displayPoster.startsWith('http') ? displayPoster : `https://image.tmdb.org/t/p/w500${displayPoster}` }} style={styles.posterImage} resizeMode="cover" />
              <View style={styles.posterShadow} />
            </View>
          )}
          <View style={styles.headerContent}>
            <Text style={styles.titleText} numberOfLines={2}>{displayTitle}</Text>
            {displayTagline && <Text style={styles.taglineHeader} numberOfLines={1}>{displayTagline}</Text>}
          </View>
          <View style={styles.headerGenres}>
            {genres.slice(0, 3).map((genre: string, index: number) => (
              <View key={index} style={[styles.headerGenreChip, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.2)' }]}>
                <Text style={styles.headerGenreText}>{genre}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity style={[styles.watchNowButton, { backgroundColor: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.5)', borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.2)' }]} onPress={handleWatchNow} activeOpacity={0.8}>
            <LinearGradient colors={['rgba(232,168,56,0.3)', 'rgba(232,168,56,0.1)']} style={styles.watchNowGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
            <Ionicons name="play" size={14} color="#fff" />
            <Text style={styles.watchNowText}>Watch Now</Text>
          </TouchableOpacity>
        </View>

        {/* ─── DOWNLOAD SECTION - HIDDEN FOR TORRENT STREAMS ─── */}
        {!isTorrentStream && (
          <View style={styles.downloadSection}>
            <TouchableOpacity style={[styles.downloadButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)', borderWidth: 1 }]}
              onPress={() => {
                if (isOffline) { showToast("You're offline — downloads need an internet connection"); return; }
                if (!isDownloading) {
                  const newState = !isDownloadDropdownOpen;
                  setIsDownloadDropdownOpen(newState);
                  if (newState && downloadQualities.length === 0 && !streamData) loadStreamsForDownload();
                  if (!isTVShow && downloadQualities.length > 0 && !pendingQuality) setPendingQuality(downloadQualities[0]);
                }
              }} activeOpacity={0.7}>
              <Ionicons name={isDownloading ? 'download' : 'download-outline'} size={20} color={isDownloading ? colors.gold : colors.text} />
              <Text style={[styles.downloadButtonText, { color: isDownloading ? colors.gold : colors.text }]}>{isDownloading ? downloadStatusText : 'Download Now'}</Text>
              {isDownloading && <View style={styles.downloadProgressBar}><View style={[styles.downloadProgressFill, { backgroundColor: colors.gold, width: `${downloadProgress}%` }]} /></View>}
              <Ionicons name={isDownloadDropdownOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
            </TouchableOpacity>
            {renderDownloadDropdown()}
          </View>
        )}

        {renderMetadata()}

        {/* ─── NEW: PLAYABLE EPISODES SECTION ─── */}
        {renderEpisodesSection()}

        {renderRecommendations()}
        <View style={styles.bottomSpacer} />
      </ScrollView>
      {renderCommentsOverlay()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  backButton: { position: 'absolute', top: 12, left: 16, zIndex: 200, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  watchlistButton: { position: 'absolute', top: 12, right: 16, zIndex: 200, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  offlineBanner: { position: 'absolute', top: 12, left: 60, right: 60, zIndex: 200, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.6)' },
  offlineBannerText: { fontSize: 11, fontWeight: '600', color: '#fff' },
  scrollContent: { paddingBottom: 20 },
  bottomSpacer: { height: 40 },

  headerContainer: { position: 'relative', height: SCREEN_HEIGHT * 0.5, overflow: 'hidden', justifyContent: 'flex-end', paddingBottom: 20 },
  backdropImage: { width: '100%', height: '100%', position: 'absolute' },
  backdropPlaceholder: { width: '100%', height: '100%', position: 'absolute' },
  gradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '80%' },

  headerContent: { position: 'absolute', bottom: 80, left: 110, right: 16, zIndex: 5 },
  titleText: { fontSize: 22, fontWeight: 'bold', color: '#fff', textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
  taglineHeader: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontStyle: 'italic', marginTop: 2, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },

  headerGenres: { position: 'absolute', bottom: 55, right: 16, left: 110, zIndex: 5, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 4 },
  headerGenreChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  headerGenreText: { fontSize: 9, color: '#fff', fontWeight: '500' },

  posterOverlay: { position: 'absolute', bottom: 70, left: 16, width: 80, height: 120, borderRadius: 8, overflow: 'hidden', zIndex: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 8 },
  posterImage: { width: '100%', height: '100%' },
  posterShadow: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '30%', backgroundColor: 'rgba(0,0,0,0.3)' },

  watchNowButton: { position: 'absolute', bottom: 20, right: 16, flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, zIndex: 10, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  watchNowGradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  watchNowText: { fontSize: 12, fontWeight: '600', color: '#fff', marginLeft: 6 },

  downloadSection: { paddingHorizontal: 16, paddingVertical: 12, position: 'relative', zIndex: 100 },
  downloadButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, position: 'relative', overflow: 'hidden' },
  downloadButtonText: { fontSize: 14, fontWeight: '600', marginLeft: 8, flex: 1 },
  downloadProgressBar: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, backgroundColor: 'rgba(255,255,255,0.1)' },
  downloadProgressFill: { height: '100%', borderRadius: 2 },

  dropdownContainer: { marginTop: 6, borderRadius: 10, borderWidth: 1, padding: 8, maxHeight: SCREEN_HEIGHT * 0.6, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 8, zIndex: 999 },
  dropdownHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  dropdownTitle: { fontSize: 13, fontWeight: 'bold' },
  dropdownEmpty: { padding: 6, borderRadius: 6, alignItems: 'center', gap: 4 },
  dropdownEmptyText: { fontSize: 11 },
  qualityProgress: { height: 2, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden', marginTop: 4 },
  qualityProgressFill: { height: '100%' },
  skeletonBox: { width: 40, height: 12, borderRadius: 4 },

  qualitySection: { marginBottom: 4 },
  qualitySectionTitle: { fontSize: 10, fontWeight: '500', marginBottom: 2 },
  qualityPillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  qualityPill: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', minWidth: 40 },
  qualityPillLabel: { fontSize: 10, fontWeight: '700' },
  qualityPillRecommended: { fontSize: 6, marginTop: 0 },

  viewToggleRow: { flexDirection: 'row', gap: 3 },
  viewToggleButton: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },

  seasonPinnedBar: { position: 'relative', zIndex: 50, elevation: 50, paddingBottom: 2 },
  seasonScroll: { marginBottom: 4 },
  seasonChip: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 10, marginRight: 4, borderWidth: 1.5, minWidth: 34, alignItems: 'center' },
  seasonChipText: { fontSize: 10, fontWeight: '700' },

  selectAllContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  checkbox: { width: 12, height: 12, borderRadius: 2, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  selectAllText: { fontSize: 10, fontWeight: '500' },
  episodeCount: { fontSize: 9 },
  episodePager: { maxHeight: EPISODE_GRID_CONTAINER_HEIGHT },
  episodeItem: { paddingVertical: 2, borderBottomWidth: 1 },
  episodeItemText: { fontSize: 10, flex: 1 },
  pageIndicatorContainer: { alignItems: 'center', marginTop: 1 },
  pageIndicatorText: { fontSize: 9, fontWeight: '600' },

  downloadProcessButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 6, borderRadius: 6, backgroundColor: 'transparent', borderWidth: 1.5 },
  downloadProcessButtonText: { fontSize: 11, fontWeight: 'bold' },

  episodeGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', alignItems: 'flex-start', paddingHorizontal: EPISODE_GRID_H_PADDING },
  episodeGridCard: { alignItems: 'center' },
  episodeGridImageContainer: { position: 'relative', borderRadius: 4, overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.3)' },
  episodeGridImage: { width: '100%', height: '100%' },
  episodeGridPlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  episodeGridCheckbox: { position: 'absolute', top: 2, right: 2, justifyContent: 'center', alignItems: 'center' },
  episodeGridNumber: { position: 'absolute', bottom: 2, left: 2, paddingHorizontal: 3, paddingVertical: 1, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.7)' },
  episodeGridNumberText: { fontSize: 6, fontWeight: '700', color: '#fff' },
  episodeGridTitle: { fontSize: 9, fontWeight: '500', marginTop: 3, textAlign: 'center', height: EPISODE_CARD_TITLE_HEIGHT, width: EPISODE_CARD_WIDTH },

  // ─── NEW: Playable Episodes Section Styles ───
  episodesSection: { marginTop: 8, marginBottom: 8 },
  episodesSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 8 },
  seasonChipsRow: { gap: 6, paddingRight: 16 },
  seasonChipLarge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1.5 },
  episodePlayCard: { width: 160, marginRight: 10 },
  episodePlayImageWrap: { width: 160, height: 90, borderRadius: 8, overflow: 'hidden', backgroundColor: '#222', position: 'relative' },
  episodePlayImage: { width: '100%', height: '100%' },
  episodePlayPlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  episodePlayOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.35)' },
  episodePlayNumberBadge: { position: 'absolute', bottom: 4, left: 4, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.75)' },
  episodePlayNumberBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff' },
  episodePlayTitle: { fontSize: 12, fontWeight: '600', marginTop: 6 },
  episodePlayOverview: { fontSize: 10, marginTop: 2, lineHeight: 14 },

  metadataSection: { paddingHorizontal: 16, paddingVertical: 8 },
  metadataRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  ratingContainer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 14, fontWeight: '600' },
  metadataDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 6 },
  metadataText: { fontSize: 13 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', rowGap: 6, marginTop: 6, marginBottom: 10 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 11 },
  statDivider: { width: 1, height: 10, backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 6 },
  liveStatsRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', rowGap: 6, marginTop: 6 },
  liveStatText: { fontSize: 11, fontWeight: '500' },

  readMoreButton: { marginTop: 6, paddingVertical: 2 },
  readMoreText: { fontSize: 12, fontWeight: '600' },
  synopsisText: { fontSize: 13, lineHeight: 20, paddingBottom: 4, marginTop: 2 },
  taglineText: { fontSize: 13, fontStyle: 'italic' },

  commentsContainer: { position: 'absolute', bottom: 80, right: 12, width: SCREEN_WIDTH * 0.4, pointerEvents: 'none', alignItems: 'flex-end' },
  commentsViewport: { width: '100%', overflow: 'hidden' },
  commentCard: { height: COMMENT_CARD_HEIGHT, padding: 10, borderRadius: 10, borderWidth: 0.5, marginBottom: COMMENT_CARD_MARGIN, width: '100%', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  commentUserRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  avatarDot: { width: 6, height: 6, borderRadius: 3 },
  commentUsername: { fontSize: 10, fontWeight: '600' },
  commentTimestamp: { fontSize: 8 },
  commentText: { fontSize: 11, lineHeight: 15, marginBottom: 4 },
  commentFooter: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  commentLikes: { fontSize: 9 },

  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 10 },

  recommendationsSection: { paddingHorizontal: 16, paddingVertical: 8 },
  trendingGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  trendingCard: { width: GRID_CARD_WIDTH, marginBottom: GRID_GAP + 4 },
  posterWrap: { position: 'relative' },
  trendingPoster: { width: GRID_CARD_WIDTH, height: GRID_CARD_HEIGHT, borderRadius: 8, backgroundColor: '#333' },
  trendingTitle: { fontSize: 12, fontWeight: '600', marginTop: 6 },
  trendingMeta: { fontSize: 10, marginTop: 2 },
  ratingBadge: { position: 'absolute', top: 4, right: 4, flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2 },
  ratingBadgeText: { fontSize: 9, fontWeight: '700', color: '#000' },
  hdBadge: { position: 'absolute', top: 4, left: 4, backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1 },
  hdBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff' },
  bookmarkButton: { position: 'absolute', bottom: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center' },

});

export default DetailsScreenNew;
