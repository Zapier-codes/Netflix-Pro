// src/screens/library/LibraryScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { useTheme } from '../../contexts/ThemeContext';
import { useContinueWatching } from '../../store/zustand';
import { useWatchHistory } from '../../store/zustand';
import downloadManager from '../../services/downloadManager';
import { getDownloadStorageUsage, formatFileSize } from '../../utils/downloadStorage';
import DownloadedMediaCard from '../../components/DownloadedMediaCard';
import { RefreshableScrollView } from '../../components/RefreshableScrollView';

type LibraryTab = 'continue' | 'downloads' | 'history';

const LibraryScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const { items: continueWatchingItems } = useContinueWatching();
  const { getRecentlyWatched } = useWatchHistory();
  const [activeTab, setActiveTab] = useState<LibraryTab>('continue');
  const [completedDownloads, setCompletedDownloads] = useState([]);
  const [storageUsed, setStorageUsed] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const recentlyWatched = getRecentlyWatched(20);

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

  const handlePlay = useCallback(async (item: any) => {
    const basePath = item.filePath.endsWith('.m3u8') || item.filePath.endsWith('.mp4')
      ? item.filePath
      : ${item.filePath}video.mp4;

    const cleanPath = basePath.replace('file://', '');

    try {
      const { getInfoAsync } = require('expo-file-system/legacy');
      const fileInfo = await getInfoAsync(cleanPath);
      if (!fileInfo.exists) {
        await downloadManager.cancelDownload(item.id);
        loadData();
        return;
      }

      const offlinePath = basePath.startsWith('file://') ? basePath : ile://;
      navigation.navigate('VideoPlayer', {
        mediaId: item.tmdbId,
        mediaType: item.mediaType,
        title: item.title,
        season: item.season,
        episode: item.episode,
        episodeTitle: item.episodeTitle,
        poster_path: item.posterPath,
        isOffline: true,
        offlineFilePath: offlinePath,
      });
    } catch (error) {
      console.error('[Library] Play error:', error);
    }
  }, [navigation, loadData]);

  const handleDelete = useCallback((downloadId: string) => {
    downloadManager.cancelDownload(downloadId).then(() => loadData());
  }, [loadData]);

  const renderTabContent = () => {
    if (activeTab === 'continue') {
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
              onPress={() => navigation.navigate('VideoPlayer', {
                mediaId: item.tmdbId,
                mediaType: item.mediaType,
                title: item.title,
                season: item.season,
                episode: item.episode,
                episodeTitle: item.episodeTitle,
                poster_path: item.posterPath,
              })}
            >
              <View style={styles.continueProgress}>
                <View style={[styles.progressBar, { backgroundColor: colors.surfaceRaised }]}>
                  <View style={[styles.progressFill, { backgroundColor: colors.gold, width: ${item.progress || 0}% }]} />
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
    }

    if (activeTab === 'downloads') {
      if (completedDownloads.length === 0) {
        return (
          <View style={styles.emptyContainer}>
            <Ionicons name="download-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.text }]}>No Downloads</Text>
            <Text style={[styles.emptySubtext, { color: colors.textSub }]}>
              Download content to watch offline
            </Text>
          </View>
        );
      }
      return (
        <View style={styles.downloadsGrid}>
          <View style={[styles.storageInfo, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.storageLabel, { color: colors.textSub }]}>Storage Used</Text>
            <Text style={[styles.storageValue, { color: colors.text }]}>{formatFileSize(storageUsed)}</Text>
          </View>
          <FlatList
            data={completedDownloads}
            renderItem={({ item }) => (
              <DownloadedMediaCard
                item={item}
                onPlay={handlePlay}
                onDelete={handleDelete}
              />
            )}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={styles.columnWrapper}
            scrollEnabled={false}
          />
        </View>
      );
    }

    if (activeTab === 'history') {
      if (recentlyWatched.length === 0) {
        return (
          <View style={styles.emptyContainer}>
            <Ionicons name="time-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.text }]}>No Watch History</Text>
            <Text style={[styles.emptySubtext, { color: colors.textSub }]}>
              Content you watch will appear here
            </Text>
          </View>
        );
      }
      return (
        <View style={styles.historyList}>
          {recentlyWatched.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.historyItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => navigation.navigate('DetailScreen', {
                mediaId: item.tmdbId,
                mediaType: item.mediaType,
                title: item.title,
                poster_path: item.posterPath,
              })}
            >
              <View style={styles.historyInfo}>
                <Text style={[styles.historyTitle, { color: colors.text }]} numberOfLines={1}>
                  {item.title}
                </Text>
                {item.episodeTitle && (
                  <Text style={[styles.historyEpisode, { color: colors.textSub }]}>
                    {item.episodeTitle}
                  </Text>
                )}
                <Text style={[styles.historyDate, { color: colors.textMuted }]}>
                  {new Date(item.watchedAt).toLocaleDateString()}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
      );
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>📚 Library</Text>
      </View>

      <View style={[styles.tabContainer, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'continue' && styles.tabActive]}
          onPress={() => setActiveTab('continue')}
        >
          <Ionicons name="play-circle" size={20} color={activeTab === 'continue' ? colors.gold : colors.textMuted} />
          <Text style={[styles.tabText, activeTab === 'continue' && { color: colors.gold }, { color: colors.textMuted }]}>
            Continue
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'downloads' && styles.tabActive]}
          onPress={() => setActiveTab('downloads')}
        >
          <Ionicons name="download" size={20} color={activeTab === 'downloads' ? colors.gold : colors.textMuted} />
          <Text style={[styles.tabText, activeTab === 'downloads' && { color: colors.gold }, { color: colors.textMuted }]}>
            Downloads
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'history' && styles.tabActive]}
          onPress={() => setActiveTab('history')}
        >
          <Ionicons name="time" size={20} color={activeTab === 'history' ? colors.gold : colors.textMuted} />
          <Text style={[styles.tabText, activeTab === 'history' && { color: colors.gold }, { color: colors.textMuted }]}>
            History
          </Text>
        </TouchableOpacity>
      </View>

      <RefreshableScrollView
        refreshing={refreshing}
        onRefresh={onRefresh}
        style={styles.content}
      >
        {renderTabContent()}
      </RefreshableScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16 },
  headerTitle: { fontSize: 24, fontWeight: 'bold' },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 8,
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
  content: { flex: 1, padding: 16 },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptySubtext: { fontSize: 14, marginTop: 8, textAlign: 'center' },
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
  downloadsGrid: { gap: 12 },
  storageInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    borderWidth: 0.5,
  },
  storageLabel: { fontSize: 14 },
  storageValue: { fontSize: 14, fontWeight: '600' },
  columnWrapper: { justifyContent: 'space-between', marginBottom: 12 },
  historyList: { gap: 8 },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 0.5,
  },
  historyInfo: { flex: 1 },
  historyTitle: { fontSize: 14, fontWeight: '500' },
  historyEpisode: { fontSize: 12, marginTop: 2 },
  historyDate: { fontSize: 11, marginTop: 2 },
});

export default LibraryScreen;
