// src/screens/details/DetailsScreen.tsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  FlatList,
  Dimensions,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as FileSystem from 'expo-file-system';

// Zustand Stores
import { useContinueWatching } from '../../store/zustand';
import { useTheme } from '../../contexts/ThemeContext';
import { useAlert } from '../../contexts/AlertContext';

// Components
import MediaCard from '../../components/MediaCard';

// API
import {
  fetchTVShowDetails,
  fetchSeasonDetails,
  fetchMovieDetails,
  getImageUrl,
  fetchMovieRecommendations,
  fetchTVShowRecommendations,
  fetchMovieVideos,
  fetchTVVideos,
} from '../../services/unified/metadata/TMDBMetadata';
import { unifiedSubtitlesService } from '../../services/unified/subtitles/UnifiedSubtitles';
import { consumetApiService } from '../../services/unified/providers/consumet/ConsumetProvider';
import { xyraApiService } from '../../services/unified/providers/xyra/XyraProvider';
import { kuryanaApiService } from '../../services/unified/metadata/KuryanaMetadata';
import { getActiveStreamSources, getStreamingUrl } from '../../services/unified/providers/vidsrc/VidSrcProvider';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── Download Quality Options ───
interface DownloadQuality {
  label: string;
  resolution: string;
  size: string;
  sizeBytes: number;
  url: string;
  provider: string;
}

// ─── Ad Banner Data ───
const AD_BANNERS = [
  { id: '1', title: 'Premium Subscription', color: '#ff0000', icon: 'star' },
  { id: '2', title: 'Watch Offline', color: '#00aa00', icon: 'download' },
  { id: '3', title: '4K Ultra HD', color: '#0044ff', icon: 'tv' },
];

// ─── Max active video players ───
const MAX_ACTIVE_PLAYERS = 1;
let activePlayerCount = 0;

const DetailsScreen: React.FC = () => {
  const { colors } = useTheme();
  const { showToast } = useAlert();
  const { addItem: addToContinueWatching } = useContinueWatching();

  const { mediaId, mediaType, title: routeTitle, poster_path: routePoster } = useLocalSearchParams();

  // ─── State ───
  const [details, setDetails] = useState<any>(null);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [seasonDetails, setSeasonDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [displayedEpisodesCount, setDisplayedEpisodesCount] = useState(25);
  const [recommendations, setRecommendations] = useState([]);
  const [selectedTab, setSelectedTab] = useState('episodes');
  const [trailerVideo, setTrailerVideo] = useState<string | null>(null);
  const [isTrailerReady, setIsTrailerReady] = useState(false);
  const [isTrailerLoading, setIsTrailerLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [selectedQuality, setSelectedQuality] = useState<DownloadQuality | null>(null);
  const [subtitles, setSubtitles] = useState<any[]>([]);
  const [streamSources, setStreamSources] = useState<any[]>([]);
  const [downloadQualities, setDownloadQualities] = useState<DownloadQuality[]>([]);
  const [isLoadingSources, setIsLoadingSources] = useState(false);
  const [downloadTask, setDownloadTask] = useState<any>(null);

  // ─── Refs ───
  const scrollViewRef = useRef<ScrollView>(null);
  const seasonListRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ─── Trailer Player ───
  const trailerPlayer = useVideoPlayer(
    trailerVideo,
    (player) => {
      if (trailerVideo) {
        player.loop = true;
        player.muted = true;
        player.play();
        activePlayerCount++;
      }
    }
  );

  // ─── Trailer playback control ───
  useEffect(() => {
    if (trailerPlayer && trailerVideo) {
      trailerPlayer.loop = true;
      trailerPlayer.muted = true;
      trailerPlayer.play();
    }
  }, [trailerPlayer, trailerVideo]);

  // ─── Trailer ready tracking ───
  useEffect(() => {
    if (trailerPlayer && trailerVideo) {
      const checkReady = setInterval(() => {
        if (trailerPlayer.playing) {
          setIsTrailerReady(true);
          setIsTrailerLoading(false);
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 350,
            useNativeDriver: true,
          }).start();
          clearInterval(checkReady);
        }
      }, 100);

      const timeout = setTimeout(() => {
        clearInterval(checkReady);
        setIsTrailerLoading(false);
      }, 5000);

      return () => {
        clearInterval(checkReady);
        clearTimeout(timeout);
      };
    }
  }, [trailerPlayer, trailerVideo, fadeAnim]);

  // ─── Cleanup player on unmount ───
  useEffect(() => {
    return () => {
      if (trailerPlayer) {
        trailerPlayer.pause();
        activePlayerCount = Math.max(0, activePlayerCount - 1);
      }
    };
  }, [trailerPlayer]);

  // ─── Extract Download Qualities from Sources ───
  const extractDownloadQualities = useCallback((sources: any[]) => {
    const qualities: DownloadQuality[] = [];
    const qualityMap = new Map<string, DownloadQuality>();

    sources.forEach(source => {
      if (source.qualities && Array.isArray(source.qualities)) {
        source.qualities.forEach((q: any) => {
          const key = `${q.quality}-${source.provider}`;
          if (!qualityMap.has(key)) {
            qualityMap.set(key, {
              label: q.quality || '720p',
              resolution: q.resolution || '1280x720',
              size: q.size || '1.2 GB',
              sizeBytes: q.sizeBytes || 1200000000,
              url: q.url || source.url,
              provider: source.provider,
            });
          }
        });
      } else if (source.quality) {
        const key = `${source.quality}-${source.provider}`;
        if (!qualityMap.has(key)) {
          qualityMap.set(key, {
            label: source.quality || '720p',
            resolution: source.resolution || '1280x720',
            size: source.size || '1.2 GB',
            sizeBytes: source.sizeBytes || 1200000000,
            url: source.url,
            provider: source.provider,
          });
        }
      }
    });

    const qualityOrder = ['4K', '1080p', '720p', '480p', '360p', '240p'];
    return Array.from(qualityMap.values()).sort((a, b) => {
      return qualityOrder.indexOf(a.label) - qualityOrder.indexOf(b.label);
    });
  }, []);

  // ─── Fetch Details ───
  useEffect(() => {
    const fetchDetails = async () => {
      try {
        setLoading(true);
        setRecommendations([]);
        setTrailerVideo(null);
        setSubtitles([]);
        setStreamSources([]);
        setDownloadQualities([]);

        let mediaDetails;
        let recs;

        if (mediaType === 'tv') {
          mediaDetails = await fetchTVShowDetails(Number(mediaId));
          const validSeasons = mediaDetails.seasons?.filter(s => s.season_number > 0) || [];
          mediaDetails.seasons = validSeasons;
          setDetails(mediaDetails);

          if (validSeasons.length > 0) {
            setSelectedSeason(validSeasons[0].season_number);
            const seasonData = await fetchSeasonDetails(Number(mediaId), validSeasons[0].season_number);
            setSeasonDetails(seasonData);
          }

          recs = await fetchTVShowRecommendations(Number(mediaId));
          setRecommendations(recs.slice(0, 18));

          const videos = await fetchTVVideos(Number(mediaId));
          const trailer = videos.find(v => v.type === 'Trailer' || v.type === 'Teaser');
          if (trailer) {
            setTrailerVideo(`https://www.youtube.com/watch?v=${trailer.key}`);
          }

          const subs = await unifiedSubtitlesService.searchSubtitles(
            String(mediaId), 'en', selectedSeason, 1
          );
          setSubtitles(subs.slice(0, 10));

        } else {
          mediaDetails = await fetchMovieDetails(Number(mediaId));
          setDetails(mediaDetails);
          recs = await fetchMovieRecommendations(Number(mediaId));
          setRecommendations(recs.slice(0, 18));

          const videos = await fetchMovieVideos(Number(mediaId));
          const trailer = videos.find(v => v.type === 'Trailer' || v.type === 'Teaser');
          if (trailer) {
            setTrailerVideo(`https://www.youtube.com/watch?v=${trailer.key}`);
          }

          const subs = await unifiedSubtitlesService.searchSubtitles(
            String(mediaId), 'en'
          );
          setSubtitles(subs.slice(0, 10));
        }

        // ─── Fetch stream sources ───
        setIsLoadingSources(true);
        const allSources: any[] = [];

        try {
          const vidSrcSources = getActiveStreamSources();
          for (const source of vidSrcSources) {
            const url = getStreamingUrl(
              source.baseUrl,
              String(mediaId),
              mediaType === 'tv' ? 'tv' : 'movie',
              mediaType === 'tv' ? selectedSeason : null,
              mediaType === 'tv' ? 1 : null
            );
            if (url) {
              allSources.push({
                provider: source.name,
                url: url,
                quality: '1080p',
                resolution: '1920x1080',
                size: '2.4 GB',
                sizeBytes: 2400000000,
              });
            }
          }

          try {
            let consumetResults;
            if (mediaType === 'tv') {
              consumetResults = await consumetApiService.getTVSources(String(mediaId), selectedSeason, 1);
            } else {
              consumetResults = await consumetApiService.getMovieSources(String(mediaId));
            }
            
            if (consumetResults && Array.isArray(consumetResults)) {
              consumetResults.forEach((s: any) => {
                allSources.push({
                  provider: 'Consumet',
                  url: s.url,
                  quality: s.quality || '720p',
                  resolution: s.resolution || '1280x720',
                  size: s.size || '1.2 GB',
                  sizeBytes: s.sizeBytes || 1200000000,
                  qualities: s.qualities || null
                });
              });
            }
          } catch (e) {
            console.warn('[Details] Consumet error:', e);
          }

          try {
            const xyraDramas = await xyraApiService.searchDramas(mediaDetails?.title || '');
            if (xyraDramas && xyraDramas.length > 0) {
              const drama = xyraDramas[0];
              if (drama.episodes && drama.episodes.length > 0) {
                drama.episodes.forEach((ep: any) => {
                  if (ep.streamUrl) {
                    allSources.push({
                      provider: 'Xyra',
                      url: ep.streamUrl,
                      quality: ep.quality || '1080p',
                      resolution: ep.resolution || '1920x1080',
                      size: ep.size || '2.4 GB',
                      sizeBytes: ep.sizeBytes || 2400000000,
                      qualities: ep.qualities || null
                    });
                  }
                });
              }
            }
          } catch (e) {
            console.warn('[Details] Xyra error:', e);
          }

          try {
            const kuryanaResults = await kuryanaApiService.searchDramas(mediaDetails?.title || '');
            if (kuryanaResults && kuryanaResults.length > 0) {
              const drama = kuryanaResults[0];
              allSources.push({
                provider: 'Kuryana',
                url: drama.id || drama.slug,
                quality: '720p',
                resolution: '1280x720',
                size: '1.2 GB',
                sizeBytes: 1200000000,
              });
            }
          } catch (e) {
            console.warn('[Details] Kuryana error:', e);
          }

          const extractedQualities = extractDownloadQualities(allSources);
          setDownloadQualities(extractedQualities);

        } catch (sourceError) {
          console.warn('[Details] Source fetch error:', sourceError);
        } finally {
          setIsLoadingSources(false);
        }

        setStreamSources(allSources);

      } catch (error) {
        console.error('[Details] Error:', error);
        showToast('Failed to load details');
      } finally {
        setLoading(false);
        setIsTrailerLoading(false);
      }
    };

    fetchDetails();
  }, [mediaId, mediaType, selectedSeason]);

  // ─── Watch Now Handler ───
  const handleWatchNow = useCallback(() => {
    if (!details) return;

    const displayTitle = mediaType === 'tv' ? details.name : details.title;

    addToContinueWatching({
      id: `${mediaType}_${mediaId}`,
      title: displayTitle,
      mediaType,
      tmdbId: String(mediaId),
      posterPath: details.poster_path || routePoster,
      progress: 0,
      currentTime: 0,
      duration: 0,
    });

    if (mediaType === 'tv') {
      router.push(`/player?title=${displayTitle}&poster_path=${details.poster_path || routePoster}&season=${selectedSeason}&episode=1`);
    } else {
      router.push(`/player?title=${displayTitle}&poster_path=${details.poster_path || routePoster}`);
    }
  }, [details, mediaId, mediaType, selectedSeason, routePoster]);

  // ─── Episode Press Handler ───
  const handleEpisodePress = useCallback((episode: any) => {
    addToContinueWatching({
      id: `${mediaType}_${mediaId}_s${selectedSeason}_e${episode.episode_number}`,
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

    router.push(`/player?title=${details.name}&poster_path=${details.poster_path}&season=${selectedSeason}&episode=${episode.episode_number}`);
  }, [mediaId, mediaType, selectedSeason, details]);

  // ─── Season Change Handler ───
  const handleSeasonChange = async (seasonNumber: number) => {
    try {
      setLoading(true);
      setSelectedSeason(seasonNumber);
      const seasonData = await fetchSeasonDetails(Number(mediaId), seasonNumber);
      setSeasonDetails(seasonData);
      setDisplayedEpisodesCount(25);

      const subs = await unifiedSubtitlesService.searchSubtitles(
        String(mediaId), 'en', seasonNumber, 1
      );
      setSubtitles(subs.slice(0, 10));

    } catch (error) {
      console.error('[Details] Season change error:', error);
    } finally {
      setLoading(false);
    }
  };

  // ─── Download Handler ───
  const handleDownload = useCallback(async (quality: DownloadQuality) => {
    try {
      setSelectedQuality(quality);
      setIsDownloading(true);
      setDownloadProgress(0);

      const downloadResumable = FileSystem.createDownloadResumable(
        quality.url,
        `${FileSystem.documentDirectory}downloads/${details?.title || 'movie'}_${quality.label}.mp4`,
        {
          headers: {
            'Accept': 'video/mp4,video/*',
            'User-Agent': 'NetflixPro/1.0',
          },
        },
        (downloadProgress) => {
          const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite * 100;
          setDownloadProgress(progress);
        }
      );

      setDownloadTask(downloadResumable);
      
      const result = await downloadResumable.downloadAsync();
      
      if (result) {
        setIsDownloading(false);
        setDownloadProgress(100);
        showToast(`Download complete! ${quality.label} quality`);
        
        const downloadInfo = {
          id: `${mediaType}_${mediaId}`,
          title: details?.title || details?.name,
          quality: quality.label,
          size: quality.size,
          provider: quality.provider,
          downloadedAt: new Date().toISOString(),
          filePath: result.uri,
          fileSize: result.headers['content-length'] || quality.sizeBytes,
        };
        
        try {
          const { saveDownloadInfo } = require('../../utils/downloadStorage');
          await saveDownloadInfo(downloadInfo);
        } catch (e) {
          console.warn('[Download] Storage error:', e);
        }
      }

    } catch (error) {
      console.error('[Download] Error:', error);
      showToast('Download failed');
      setIsDownloading(false);
    }
  }, [details, mediaId, mediaType, showToast]);

  // ─── Render Download Quality Grid ───
  const renderDownloadGrid = () => {
    if (downloadQualities.length === 0 && !isLoadingSources) {
      return (
        <View style={styles.downloadSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Download Quality</Text>
          <View style={[styles.noSourcesContainer, { backgroundColor: colors.surfaceRaised }]}>
            <Ionicons name="cloud-offline" size={24} color={colors.textMuted} />
            <Text style={[styles.noSourcesText, { color: colors.textSub }]}>
              No download sources available
            </Text>
          </View>
        </View>
      );
    }

    if (isLoadingSources) {
      return (
        <View style={styles.downloadSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Download Quality</Text>
          <View style={styles.downloadGrid}>
            {[1, 2, 3, 4].map((_, index) => (
              <View key={index} style={[styles.downloadGridItem, { backgroundColor: colors.surfaceRaised }]}>
                <View style={[styles.skeletonBox, { backgroundColor: colors.surface }]} />
                <View style={[styles.skeletonText, { backgroundColor: colors.surface }]} />
              </View>
            ))}
          </View>
        </View>
      );
    }

    return (
      <View style={styles.downloadSection}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Download Quality ({downloadQualities.length} available)
        </Text>
        <View style={styles.downloadGrid}>
          {downloadQualities.map((quality) => (
            <TouchableOpacity
              key={`${quality.provider}-${quality.label}`}
              style={[styles.downloadGridItem, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}
              onPress={() => handleDownload(quality)}
              disabled={isDownloading}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={['rgba(255,255,255,0.05)', 'transparent']}
                style={styles.downloadGridGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <View style={styles.downloadGridContent}>
                <Text style={[styles.downloadGridLabel, { color: colors.text }]}>{quality.label}</Text>
                <Text style={[styles.downloadGridSize, { color: colors.textSub }]}>{quality.size}</Text>
                <Text style={[styles.downloadGridResolution, { color: colors.textMuted }]}>{quality.resolution}</Text>
                <View style={styles.downloadGridBadge}>
                  <Text style={[styles.downloadGridProvider, { color: colors.textMuted }]}>
                    {quality.provider}
                  </Text>
                </View>
              </View>
              {isDownloading && downloadProgress > 0 && selectedQuality?.label === quality.label && (
                <View style={[styles.downloadGridProgress, { backgroundColor: colors.surface }]}>
                  <View 
                    style={[styles.downloadGridProgressFill, { backgroundColor: colors.gold, width: `${downloadProgress}%` }]} 
                  />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  // ─── Render Subtitle Section ───
  const renderSubtitles = () => {
    if (subtitles.length === 0) return null;
    return (
      <View style={styles.subtitleSection}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Available Subtitles</Text>
        <FlatList
          horizontal
          data={subtitles}
          renderItem={({ item }) => (
            <View style={[styles.subtitleItem, { backgroundColor: colors.surfaceRaised }]}>
              <Ionicons name="chatbubble" size={14} color={colors.gold} />
              <Text style={[styles.subtitleText, { color: colors.text }]}>
                {item.language || 'English'}
              </Text>
              <Text style={[styles.subtitleProvider, { color: colors.textMuted }]}>
                {item.provider}
              </Text>
            </View>
          )}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.subtitleScrollContent}
        />
      </View>
    );
  };

  // ─── Render Ad Banner ───
  const renderAdBanner = () => (
    <View style={styles.adBannerContainer}>
      <FlatList
        horizontal
        data={AD_BANNERS}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={[styles.adBannerItem, { backgroundColor: item.color }]} 
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['rgba(255,255,255,0.2)', 'transparent']}
              style={styles.adBannerGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
            <Ionicons name={item.icon as any} size={24} color="#fff" />
            <Text style={styles.adBannerText}>{item.title}</Text>
          </TouchableOpacity>
        )}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        snapToInterval={SCREEN_WIDTH - 32}
        decelerationRate="fast"
        pagingEnabled
      />
    </View>
  );

  // ─── Loading State ───
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
  const backdropUrl = details?.backdrop_path ? getImageUrl(details.backdrop_path) : null;
  const posterUrl = details?.poster_path ? getImageUrl(details.poster_path) : null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView ref={scrollViewRef} showsVerticalScrollIndicator={false}>
        {/* ─── Header with Backdrop ─── */}
        <View style={styles.headerContainer}>
          {backdropUrl ? (
            <Image
              source={{ uri: backdropUrl }}
              style={styles.backdropImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.backdropPlaceholder, { backgroundColor: colors.surface }]} />
          )}
          
          {/* ─── Dark Gradient Overlay ─── */}
          <LinearGradient
            colors={[
              'rgba(0,0,0,0.1)', 
              'rgba(0,0,0,0.5)', 
              'rgba(0,0,0,0.85)', 
              'rgba(0,0,0,0.95)'
            ]}
            style={styles.gradient}
            locations={[0, 0.3, 0.7, 1]}
          />

          {/* ─── Poster Overlay ─── */}
          {posterUrl && (
            <View style={styles.posterOverlay}>
              <Image
                source={{ uri: posterUrl }}
                style={styles.posterImage}
                resizeMode="cover"
              />
            </View>
          )}

          {/* ─── Trailer Player ─── */}
          {trailerVideo && (
            <View style={styles.trailerContainer}>
              <VideoView
                player={trailerPlayer}
                style={styles.trailerPlayer}
                contentFit="cover"
                isMuted={true}
                allowsPictureInPicture={false}
                nativeControls={false}
                surfaceType="textureView"
              />
              {isTrailerLoading && (
                <View style={styles.trailerLoadingOverlay}>
                  <ActivityIndicator size="small" color={colors.gold} />
                </View>
              )}
              {isTrailerReady && (
                <Animated.View style={[styles.trailerBadge, { opacity: fadeAnim }]}>
                  <Ionicons name="play-circle" size={12} color="#fff" />
                  <Text style={styles.trailerBadgeText}>Trailer</Text>
                </Animated.View>
              )}
            </View>
          )}

          {/* ─── Content Overlay on Cover Art ─── */}
          <View style={styles.overlayContent}>
            {/* Genre Badges */}
            <View style={styles.genreBadgeContainer}>
              {genres.slice(0, 4).map((genre, index) => (
                <View key={index} style={[styles.genreBadge, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                  <Text style={[styles.genreBadgeText, { color: '#fff' }]}>{genre}</Text>
                </View>
              ))}
            </View>

            {/* Description - Blended on cover art */}
            {details?.overview && (
              <Text style={styles.overview} numberOfLines={4}>
                {details.overview}
              </Text>
            )}

            {/* Watch Now Button - Prominent */}
            <TouchableOpacity
              style={styles.watchNowButton}
              onPress={handleWatchNow}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#E50914', '#B20710']}
                style={styles.watchNowGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />
              <Ionicons name="play" size={20} color="#fff" />
              <Text style={styles.watchNowButtonText}>Watch Now</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── Download Quality Grid ─── */}
        {renderDownloadGrid()}

        {/* ─── Subtitles ─── */}
        {renderSubtitles()}

        {/* ─── TV Show Content ─── */}
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
                  keyExtractor={(item) => `season-${item.season_number}`}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.seasonsScrollContent}
                />

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
                                <Ionicons name="play" size={14} color={colors.text} />
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
                    key={`rec-${item.id}`}
                    item={item}
                    onPress={() => {
                      router.push(`/movie/${item.id}?mediaType=${item.media_type || (item.title ? 'movie' : 'tv')}&title=${item.title || item.name}`);
                    }}
                  />
                ))}
              </View>
            )}
          </>
        )}

        {/* ─── Movie Recommendations ─── */}
        {mediaType !== 'tv' && (
          <View style={styles.recommendationsSection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>More Like This</Text>
            <View style={styles.recommendationsGrid}>
              {recommendations.slice(0, 9).map((item) => (
                <MediaCard
                  key={`rec-${item.id}`}
                  item={item}
                  onPress={() => {
                    router.push(`/movie/${item.id}?mediaType=movie&title=${item.title}`);
                  }}
                />
              ))}
            </View>
          </View>
        )}

        {/* ─── Ad Banner ─── */}
        {renderAdBanner()}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  // ─── Header ───
  headerContainer: {
    position: 'relative',
    height: SCREEN_HEIGHT * 0.5,
  },
  backdropImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  backdropPlaceholder: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '80%',
  },
  
  // ─── Poster Overlay ───
  posterOverlay: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    width: 100,
    height: 150,
    borderRadius: 8,
    overflow: 'hidden',
    zIndex: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  posterImage: {
    width: '100%',
    height: '100%',
  },
  
  // ─── Trailer Player ───
  trailerContainer: {
    position: 'absolute',
    top: 50,
    right: 12,
    width: SCREEN_WIDTH * 0.35,
    height: SCREEN_WIDTH * 0.2,
    borderRadius: 8,
    overflow: 'hidden',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  trailerPlayer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  trailerLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  trailerBadge: {
    position: 'absolute',
    top: 4,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  trailerBadgeText: {
    color: '#fff',
    fontSize: 9,
    marginLeft: 3,
    fontWeight: '600',
  },
  
  // ─── Overlay Content ───
  overlayContent: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    zIndex: 5,
  },
  
  // ─── Genre Badges ───
  genreBadgeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
    gap: 6,
  },
  genreBadge: {
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  genreBadgeText: { 
    fontSize: 11, 
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  
  // ─── Overview ───
  overview: {
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 12,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    letterSpacing: 0.2,
  },
  
  // ─── Watch Now Button ───
  watchNowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    alignSelf: 'flex-start',
    overflow: 'hidden',
    shadowColor: '#E50914',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  watchNowGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  watchNowButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 8,
    letterSpacing: 0.5,
  },
  
  // ─── Download Section ───
  downloadSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  downloadGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  downloadGridItem: {
    width: (SCREEN_WIDTH - 32 - 30) / 2,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  downloadGridGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  downloadGridContent: {
    alignItems: 'center',
    gap: 2,
  },
  downloadGridLabel: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  downloadGridSize: {
    fontSize: 12,
  },
  downloadGridResolution: {
    fontSize: 10,
  },
  downloadGridBadge: {
    marginTop: 4,
  },
  downloadGridProvider: {
    fontSize: 9,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  downloadGridProgress: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  downloadGridProgressFill: {
    height: '100%',
  },
  noSourcesContainer: {
    padding: 20,
    borderRadius: 8,
    alignItems: 'center',
    gap: 8,
  },
  noSourcesText: {
    fontSize: 14,
  },
  skeletonBox: {
    width: '100%',
    height: 60,
    borderRadius: 4,
  },
  skeletonText: {
    width: '80%',
    height: 12,
    borderRadius: 4,
    marginTop: 8,
  },
  
  // ─── Subtitles ───
  subtitleSection: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  subtitleScrollContent: {
    gap: 8,
  },
  subtitleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 8,
  },
  subtitleText: { fontSize: 13, fontWeight: '500' },
  subtitleProvider: { fontSize: 10 },
  
  // ─── Tabs ───
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 5,
    borderBottomWidth: 1,
  },
  tab: { marginRight: 24, paddingBottom: 8 },
  tabActive: { borderBottomWidth: 3, borderBottomColor: '#E50914' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#888' },
  
  // ─── Episodes ───
  episodesContainer: { padding: 16 },
  seasonsScrollContent: { paddingHorizontal: 16 },
  seasonButton: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginRight: 10,
  },
  seasonButtonText: { fontSize: 13, fontWeight: '500' },
  episodesLoadingContainer: { paddingVertical: 20, alignItems: 'center' },
  episodeItem: {
    marginBottom: 14,
    borderBottomWidth: 1,
    paddingBottom: 14,
  },
  episodeRow: { flexDirection: 'row', alignItems: 'center' },
  episodeThumbnailColumn: { marginRight: 12 },
  episodeImageContainer: {
    width: 100,
    height: 60,
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
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  episodeInfoColumn: { flex: 1, marginRight: 8 },
  episodeTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  episodeOverview: { fontSize: 12, lineHeight: 16 },
  loadMoreButton: {
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 8,
  },
  loadMoreButtonText: { fontSize: 13, fontWeight: '600' },
  
  // ─── Recommendations ───
  recommendationsSection: {
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  recommendationsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 8,
  },
  
  // ─── Ad Banner ───
  adBannerContainer: {
    marginVertical: 12,
    marginHorizontal: 16,
    height: 80,
    borderRadius: 10,
    overflow: 'hidden',
  },
  adBannerItem: {
    width: SCREEN_WIDTH - 32,
    height: 80,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    flexDirection: 'row',
    gap: 12,
  },
  adBannerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  adBannerText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default DetailsScreen;

