// src/screens/library/LibraryScreen.tsx
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';

import { useTheme } from '../../contexts/ThemeContext';
import { useContinueWatching } from '../../store/zustand';
import { useAlert } from '../../contexts/AlertContext';
import downloadManager from '../../services/downloadManager';
import {
  getDownloadStorageUsage,
  formatFileSize,
  DOWNLOAD_STATUS,
} from '../../utils/downloadStorage';
import { getImageUrl } from '../../services/unified/metadata/TMDBMetadata';

type DownloadsSubTab = 'movies' | 'seasonal';

interface DownloadItem {
  id: string;
  title: string;
  mediaType: 'movie' | 'tv';
  tmdbId: string;
  season?: number;
  episode?: number;
  episodeTitle?: string;
  posterPath: string;
  filePath: string;
  fileSize: number;
  progress: number;
  status: string;
  completedAt?: string;
}

// ─── Movie Item Component ───
const MovieItem: React.FC<{
  item: DownloadItem;
  onPress: (item: DownloadItem) => void;
  onDelete: (id: string) => void;
}> = ({ item, onPress, onDelete }) => {
  const { colors } = useTheme();
  const imageUrl = item.posterPath ? getImageUrl(item.posterPath) : null;

  return (
    <TouchableOpacity
      style={[styles.movieItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.movieItemContent}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.movieThumbnail} resizeMode="cover" />
        ) : (
          <View style={[styles.moviePlaceholder, { backgroundColor: colors.surfaceRaised }]}>
            <Ionicons name="film-outline" size={24} color={colors.textMuted} />
          </View>
        )}
        <View style={styles.movieInfo}>
          <Text style={[styles.movieTitle, { color: colors.text }]} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={[styles.movieSize, { color: colors.textSub }]}>
            {formatFileSize(item.fileSize || 0)}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => onDelete(item.id)}
          style={styles.movieDeleteButton}
        >
          <Ionicons name="close-circle" size={22} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

// ─── Seasonal Show Component ───
const SeasonalShow: React.FC<{
  item: DownloadItem;
  episodes: DownloadItem[];
  onPress: (item: DownloadItem) => void;
  onDelete: (id: string) => void;
  onToggleExpand: (id: string) => void;
  isExpanded: boolean;
}> = ({ item, episodes, onPress, onDelete, onToggleExpand, isExpanded }) => {
  const { colors } = useTheme();
  const imageUrl = item.posterPath ? getImageUrl(item.posterPath) : null;

  // Group episodes by season
  const episodesBySeason = useMemo(() => {
    const grouped: Record<number, DownloadItem[]> = {};
    episodes.forEach((ep) => {
      const season = ep.season || 1;
      if (!grouped[season]) grouped[season] = [];
      grouped[season].push(ep);
    });
    return Object.keys(grouped)
      .map(Number)
      .sort((a, b) => a - b);
  }, [episodes]);

  return (
    <View style={[styles.seasonalContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* ─── Show Header ─── */}
      <TouchableOpacity
        style={styles.seasonalHeader}
        onPress={() => onToggleExpand(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.seasonalHeaderContent}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.seasonalThumbnail} resizeMode="cover" />
          ) : (
            <View style={[styles.seasonalPlaceholder, { backgroundColor: colors.surfaceRaised }]}>
              <Ionicons name="tv-outline" size={24} color={colors.textMuted} />
            </View>
          )}
          <View style={styles.seasonalInfo}>
            <Text style={[styles.seasonalTitle, { color: colors.text }]} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={[styles.seasonalSubtitle, { color: colors.textSub }]}>
              {episodes.length} episodes • {formatFileSize(episodes.reduce((sum, e) => sum + (e.fileSize || 0), 0))}
            </Text>
          </View>
          <View style={styles.seasonalActions}>
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={colors.textMuted}
            />
            <TouchableOpacity
              onPress={() => onDelete(item.id)}
              style={styles.seasonalDeleteButton}
            >
              <Ionicons name="close-circle" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>

      {/* ─── Episodes by Season ─── */}
      {isExpanded && (
        <View style={styles.episodesContainer}>
          {episodesBySeason.map((seasonNum) => {
            const seasonEpisodes = episodes.filter((e) => (e.season || 1) === seasonNum);
            return (
              <View key={`season-${seasonNum}`} style={styles.seasonGroup}>
                <Text style={[styles.seasonTitle, { color: colors.gold }]}>
                  Season {seasonNum}
                </Text>
                {seasonEpisodes.map((episode) => (
                  <TouchableOpacity
                    key={episode.id}
                    style={[styles.episodeItem, { borderBottomColor: colors.border }]}
                    onPress={() => onPress(episode)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.episodeContent}>
                      <Text style={[styles.episodeNumber, { color: colors.textSub }]}>
                        E{String(episode.episode || 1).padStart(2, '0')}
                      </Text>
                      <Text style={[styles.episodeTitle, { color: colors.text }]} numberOfLines={1}>
                        {episode.episodeTitle || `Episode ${episode.episode || 1}`}
                      </Text>
                      <Text style={[styles.episodeSize, { color: colors.textMuted }]}>
                        {formatFileSize(episode.fileSize || 0)}
                      </Text>
                      <Ionicons name="play-circle" size={20} color={colors.gold} />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

// ─── Main Library Screen ───
const LibraryScreen = () => {
  const { colors } = useTheme();
  const { showToast } = useAlert();
  const { items: continueWatchingItems } = useContinueWatching();
  const [activeTab, setActiveTab] = useState<'continue' | 'downloads'>('continue');
  const [downloadsSubTab, setDownloadsSubTab] = useState<DownloadsSubTab>('movies');
  const [completedDownloads, setCompletedDownloads] = useState<DownloadItem[]>([]);
  const [storageUsed, setStorageUsed] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedShows, setExpandedShows] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const completed = await downloadManager.getCompletedDownloads();
      const usage = await getDownloadStorageUsage();
      setCompletedDownloads(completed);
      setStorageUsed(usage);
    } catch (error) {
      console.error('[Library] Load error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
      return () => {};
    }, [loadData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handlePlay = useCallback(async (item: DownloadItem) => {
    const basePath = item.filePath.endsWith('.m3u8') || item.filePath.endsWith('.mp4')
      ? item.filePath
      : `${item.filePath}video.mp4`;

    const cleanPath = basePath.replace('file://', '');

    try {
      const { getInfoAsync } = require('expo-file-system/legacy');
      const fileInfo = await getInfoAsync(cleanPath);
      if (!fileInfo.exists) {
        await downloadManager.cancelDownload(item.id);
        loadData();
        showToast('File not found, removed from downloads');
        return;
      }

      const offlinePath = basePath.startsWith('file://') ? basePath : `file://${cleanPath}`;
      router.push({
        pathname: '/player',
        params: {
          mediaId: item.tmdbId,
          mediaType: item.mediaType,
          title: item.title,
          season: item.season,
          episode: item.episode,
          episodeTitle: item.episodeTitle,
          poster_path: item.posterPath,
          isOffline: true,
          offlineFilePath: offlinePath,
        },
      });
    } catch (error) {
      console.error('[Library] Play error:', error);
      showToast('Failed to play downloaded content');
    }
  }, [loadData, showToast]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await downloadManager.cancelDownload(id);
      await loadData();
      showToast('Download deleted');
    } catch (error) {
      console.error('[Library] Delete error:', error);
      showToast('Failed to delete download');
    }
  }, [loadData, showToast]);

  const handleContinuePress = useCallback((item: any) => {
    router.push({
      pathname: '/player',
      params: {
        mediaId: item.tmdbId,
        mediaType: item.mediaType,
        title: item.title,
        season: item.season,
        episode: item.episode,
        episodeTitle: item.episodeTitle,
        poster_path: item.posterPath,
        progress: item.progress,
      },
    });
  }, []);

  const toggleShowExpand = useCallback((id: string) => {
    setExpandedShows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  // ─── Group downloads by type ───
  const { movies, seasonalShows, seasonalEpisodesMap } = useMemo(() => {
    const movies: DownloadItem[] = [];
    const seasonalShows: DownloadItem[] = [];
    const seasonalEpisodesMap: Record<string, DownloadItem[]> = {};

    // First pass: identify shows with episodes
    const tvItems = completedDownloads.filter((d) => d.mediaType === 'tv' && d.status === DOWNLOAD_STATUS.COMPLETED);
    const movieItems = completedDownloads.filter((d) => d.mediaType === 'movie' && d.status === DOWNLOAD_STATUS.COMPLETED);

    // Group TV episodes by show (tmdbId)
    const tvByShow: Record<string, DownloadItem[]> = {};
    tvItems.forEach((item) => {
      const key = `${item.tmdbId}`;
      if (!tvByShow[key]) tvByShow[key] = [];
      tvByShow[key].push(item);
    });

    // Separate seasonal shows (multiple episodes) from single-episode items
    Object.entries(tvByShow).forEach(([key, episodes]) => {
      // Get the show title from the first episode
      const showItem = { ...episodes[0] };
      // If it has multiple episodes, it's a seasonal show
      if (episodes.length > 1 || episodes.some(e => e.season && e.season > 1)) {
        seasonalShows.push(showItem);
        seasonalEpisodesMap[key] = episodes;
      } else {
        // Single episode, treat as movie
        movies.push(episodes[0]);
      }
    });

    return {
      movies: movieItems,
      seasonalShows,
      seasonalEpisodesMap,
    };
  }, [completedDownloads]);

  // ─── Render Downloads Content ───
  const renderDownloadsContent = () => {
    if (downloadsSubTab === 'movies') {
      if (movies.length === 0) {
        return (
          <View style={styles.emptyContainer}>
            <Ionicons name="film-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.text }]}>No Movie Downloads</Text>
            <Text style={[styles.emptySubtext, { color: colors.textSub }]}>
              Download movies to watch offline
            </Text>
          </View>
        );
      }
      return (
        <View style={styles.moviesGrid}>
          {movies.map((item) => (
            <MovieItem
              key={item.id}
              item={item}
              onPress={handlePlay}
              onDelete={handleDelete}
            />
          ))}
        </View>
      );
    }

    // Seasonal tab
    if (seasonalShows.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="tv-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.text }]}>No Seasonal Downloads</Text>
          <Text style={[styles.emptySubtext, { color: colors.textSub }]}>
            Download TV shows to see them organized by season
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.seasonalGrid}>
        {seasonalShows.map((show) => {
          const key = `${show.tmdbId}`;
          const episodes = seasonalEpisodesMap[key] || [];
          const isExpanded = expandedShows.has(show.id);
          return (
            <SeasonalShow
              key={show.id}
              item={show}
              episodes={episodes}
              onPress={handlePlay}
              onDelete={handleDelete}
              onToggleExpand={toggleShowExpand}
              isExpanded={isExpanded}
            />
          );
        })}
      </View>
    );
  };

  // ─── Render Continue Watching ───
  const renderContinueWatching = () => {
    if (continueWatchingItems.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="play-circle-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.text }]}>No Continue Watching</Text>
          <Text style={[styles.emptySubtext, { color: colors.textSub }]}>
            Start watching something to see it here
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.continueGrid}>
        {continueWatchingItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.continueCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => handleContinuePress(item)}
            activeOpacity={0.7}
          >
            <View style={styles.continueProgress}>
              <View style={[styles.progressBar, { backgroundColor: colors.surfaceRaised }]}>
                <View style={[styles.progressFill, { backgroundColor: colors.gold, width: `${item.progress || 0}%` }]} />
              </View>
              <Text style={[styles.progressText, { color: colors.textMuted }]}>
                {Math.round(item.progress || 0)}%
              </Text>
            </View>
            <Text style={[styles.continueTitle, { color: colors.text }]} numberOfLines={2}>
              {item.title}
            </Text>
            {item.episodeTitle && (
              <Text style={[styles.continueEpisode, { color: colors.textSub }]}>
                {item.episodeTitle}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* ─── Main Tabs ─── */}
      <View style={[styles.tabContainer, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'continue' && styles.tabActive]}
          onPress={() => setActiveTab('continue')}
          activeOpacity={0.7}
        >
          <Ionicons name="play-circle" size={20} color={activeTab === 'continue' ? colors.gold : colors.textMuted} />
          <Text style={[styles.tabText, activeTab === 'continue' && { color: colors.gold }, { color: colors.textMuted }]}>
            Continue
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'downloads' && styles.tabActive]}
          onPress={() => setActiveTab('downloads')}
          activeOpacity={0.7}
        >
          <Ionicons name="download" size={20} color={activeTab === 'downloads' ? colors.gold : colors.textMuted} />
          <Text style={[styles.tabText, activeTab === 'downloads' && { color: colors.gold }, { color: colors.textMuted }]}>
            Downloads
          </Text>
        </TouchableOpacity>
      </View>

      {/* ─── Content ─── */}
      {activeTab === 'continue' ? (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />
          }
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {renderContinueWatching()}
        </ScrollView>
      ) : (
        <View style={styles.content}>
          {/* ─── Downloads Sub-tabs ─── */}
          <View style={[styles.subTabContainer, { borderBottomColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.subTab, downloadsSubTab === 'movies' && styles.subTabActive]}
              onPress={() => setDownloadsSubTab('movies')}
              activeOpacity={0.7}
            >
              <Ionicons name="film" size={16} color={downloadsSubTab === 'movies' ? colors.gold : colors.textMuted} />
              <Text style={[styles.subTabText, downloadsSubTab === 'movies' && { color: colors.gold }, { color: colors.textMuted }]}>
                Movies
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.subTab, downloadsSubTab === 'seasonal' && styles.subTabActive]}
              onPress={() => setDownloadsSubTab('seasonal')}
              activeOpacity={0.7}
            >
              <Ionicons name="tv" size={16} color={downloadsSubTab === 'seasonal' ? colors.gold : colors.textMuted} />
              <Text style={[styles.subTabText, downloadsSubTab === 'seasonal' && { color: colors.gold }, { color: colors.textMuted }]}>
                Seasonal
              </Text>
            </TouchableOpacity>
          </View>

          {/* ─── Storage Info ─── */}
          <View style={[styles.storageInfo, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.storageLabel, { color: colors.textSub }]}>Storage Used</Text>
            <Text style={[styles.storageValue, { color: colors.text }]}>{formatFileSize(storageUsed)}</Text>
          </View>

          {/* ─── Downloads Content ─── */}
          <ScrollView
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />
            }
            style={styles.downloadsScrollView}
            contentContainerStyle={styles.downloadsContentContainer}
            showsVerticalScrollIndicator={false}
          >
            {renderDownloadsContent()}
          </ScrollView>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 8,
  },
  tabActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
  },
  tabText: { fontSize: 14, fontWeight: '500' },
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 80 },

  // ─── Sub-tabs ───
  subTabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
  },
  subTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    marginRight: 6,
  },
  subTabActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
  },
  subTabText: { fontSize: 13, fontWeight: '500' },

  // ─── Storage Info ───
  storageInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 10,
    borderWidth: 0.5,
  },
  storageLabel: { fontSize: 14 },
  storageValue: { fontSize: 14, fontWeight: '600' },

  // ─── Downloads Scroll ───
  downloadsScrollView: { flex: 1 },
  downloadsContentContainer: { padding: 16, paddingBottom: 80 },

  // ─── Empty State ───
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptySubtext: { fontSize: 14, marginTop: 8, textAlign: 'center' },

  // ─── Continue Watching ───
  continueGrid: { gap: 12 },
  continueCard: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 0.5,
  },
  continueProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  progressBar: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  progressText: { fontSize: 11, minWidth: 32 },
  continueTitle: { fontSize: 15, fontWeight: '600' },
  continueEpisode: { fontSize: 13, marginTop: 2 },

  // ─── Movies Grid ───
  moviesGrid: { gap: 10 },
  movieItem: {
    borderRadius: 10,
    borderWidth: 0.5,
    overflow: 'hidden',
  },
  movieItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  movieThumbnail: {
    width: 50,
    height: 70,
    borderRadius: 6,
  },
  moviePlaceholder: {
    width: 50,
    height: 70,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  movieInfo: { flex: 1, marginLeft: 12 },
  movieTitle: { fontSize: 14, fontWeight: '500' },
  movieSize: { fontSize: 12, marginTop: 2 },
  movieDeleteButton: { padding: 6 },

  // ─── Seasonal Shows ───
  seasonalGrid: { gap: 12 },
  seasonalContainer: {
    borderRadius: 10,
    borderWidth: 0.5,
    overflow: 'hidden',
  },
  seasonalHeader: {
    padding: 12,
  },
  seasonalHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seasonalThumbnail: {
    width: 50,
    height: 70,
    borderRadius: 6,
  },
  seasonalPlaceholder: {
    width: 50,
    height: 70,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  seasonalInfo: { flex: 1, marginLeft: 12 },
  seasonalTitle: { fontSize: 14, fontWeight: '500' },
  seasonalSubtitle: { fontSize: 12, marginTop: 2 },
  seasonalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  seasonalDeleteButton: { padding: 4 },
  episodesContainer: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  seasonGroup: { marginTop: 8 },
  seasonTitle: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  episodeItem: {
    paddingVertical: 8,
    borderBottomWidth: 0.5,
  },
  episodeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  episodeNumber: { fontSize: 12, fontWeight: '500', width: 30 },
  episodeTitle: { flex: 1, fontSize: 13 },
  episodeSize: { fontSize: 11, marginRight: 6 },
});

export default LibraryScreen;
