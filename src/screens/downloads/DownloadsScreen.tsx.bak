// src/screens/downloads/DownloadsScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

// Zustand Stores
import { useAppStore } from '../../store/zustand';
import { useTheme } from '../../contexts/ThemeContext';
import { useAlert } from '../../contexts/AlertContext';

// Components
import DownloadProgressCard from '../../components/DownloadProgressCard';
import DownloadedMediaCard from '../../components/DownloadedMediaCard';
import { RefreshableScrollView } from '../../components/RefreshableScrollView';

// Services
import downloadManager from '../../services/downloadManager';
import { getDownloadStorageUsage, formatFileSize } from '../../utils/downloadStorage';

const DownloadsScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const { showToast } = useAlert();
  const { networkStatus } = useAppStore();

  const [activeDownloads, setActiveDownloads] = useState<any[]>([]);
  const [completedDownloads, setCompletedDownloads] = useState<any[]>([]);
  const [storageUsed, setStorageUsed] = useState(0);
  const [availableStorage, setAvailableStorage] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const active = await downloadManager.getActiveDownloads();
      const completed = await downloadManager.getCompletedDownloads();
      const used = await getDownloadStorageUsage();

      // Get available storage
      const { getFreeDiskStorageAsync } = require('expo-file-system/legacy');
      const available = await getFreeDiskStorageAsync();

      setActiveDownloads(active);
      setCompletedDownloads(completed);
      setStorageUsed(used);
      setAvailableStorage(available);
    } catch (error) {
      console.error('[Downloads] Load error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();

      const unsubscribe = downloadManager.subscribe(() => {
        loadData();
      });

      return () => unsubscribe();
    }, [loadData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleCancel = useCallback(async (downloadId: string) => {
    Alert.alert(
      'Cancel Download',
      'Are you sure you want to cancel this download?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: async () => {
            await downloadManager.cancelDownload(downloadId);
            loadData();
            showToast('Download cancelled');
          },
        },
      ]
    );
  }, [loadData, showToast]);

  const handleRetry = useCallback(async (downloadId: string) => {
    await downloadManager.retryDownload(downloadId);
    loadData();
    showToast('Retrying download...');
  }, [loadData, showToast]);

  const handleCancelAll = useCallback(() => {
    Alert.alert(
      'Cancel All Downloads',
      'Are you sure you want to cancel all downloads?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: async () => {
            await downloadManager.cancelAllDownloads();
            loadData();
            showToast('All downloads cancelled');
          },
        },
      ]
    );
  }, [loadData, showToast]);

  const handleCancelAllAndRetry = useCallback(() => {
    Alert.alert(
      'Restart All Downloads',
      'Cancel all and restart from beginning?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Restart All',
          onPress: async () => {
            await downloadManager.cancelAllAndRetry();
            loadData();
            showToast('Restarting all downloads...');
          },
        },
      ]
    );
  }, [loadData, showToast]);

  const handlePlay = useCallback(async (item: any) => {
    const basePath = item.filePath.endsWith('.m3u8') || item.filePath.endsWith('.mp4')
      ? item.filePath
      : ${item.filePath}video.mp4;

    const cleanPath = basePath.replace('file://', '');

    try {
      const { getInfoAsync } = require('expo-file-system/legacy');
      const fileInfo = await getInfoAsync(cleanPath);

      if (!fileInfo.exists) {
        Alert.alert(
          'File Not Found',
          'The downloaded file is missing. Remove entry?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Remove',
              style: 'destructive',
              onPress: async () => {
                await downloadManager.cancelDownload(item.id);
                loadData();
              },
            },
          ]
        );
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
      Alert.alert('Error', 'Failed to access downloaded file');
    }
  }, [navigation, loadData]);

  const handleDelete = useCallback((downloadId: string) => {
    Alert.alert(
      'Delete Download',
      'Are you sure you want to delete this download?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await downloadManager.cancelDownload(downloadId);
            loadData();
            showToast('Download deleted');
          },
        },
      ]
    );
  }, [loadData, showToast]);

  const filteredDownloads = () => {
    if (selectedFilter === 'all') return completedDownloads;
    if (selectedFilter === 'movie') return completedDownloads.filter(d => d.mediaType === 'movie');
    if (selectedFilter === 'tv') return completedDownloads.filter(d => d.mediaType === 'tv');
    return completedDownloads;
  };

  const hasDownloads = activeDownloads.length > 0 || completedDownloads.length > 0;
  const storagePercentage = availableStorage > 0
    ? (storageUsed / (storageUsed + availableStorage)) * 100
    : 0;

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>📥 Downloads</Text>
        {activeDownloads.length > 0 && (
          <View style={styles.headerActions}>
            <TouchableOpacity style={[styles.headerButton, { backgroundColor: colors.surfaceRaised }]} onPress={handleCancelAll}>
              <Ionicons name="close" size={16} color={colors.text} />
              <Text style={[styles.headerButtonText, { color: colors.text }]}>Cancel All</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.headerButton, { backgroundColor: colors.surfaceRaised }]} onPress={handleCancelAllAndRetry}>
              <Ionicons name="refresh" size={16} color={colors.text} />
              <Text style={[styles.headerButtonText, { color: colors.text }]}>Restart All</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <RefreshableScrollView
        refreshing={refreshing}
        onRefresh={onRefresh}
        style={styles.scrollView}
      >
        {hasDownloads && (
          <View style={styles.storageSection}>
            <View style={[styles.storageBar, { backgroundColor: colors.surface }]}>
              <View style={[styles.storageBarFill, { width: ${Math.min(100, storagePercentage)}%, backgroundColor: colors.gold }]} />
            </View>
            <Text style={[styles.storageText, { color: colors.textSub }]}>
              {formatFileSize(storageUsed)} used • {formatFileSize(availableStorage)} available
            </Text>
          </View>
        )}

        {/* Active Downloads */}
        {activeDownloads.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.gold }]}>Downloading</Text>
            {activeDownloads.map(item => (
              <DownloadProgressCard
                key={item.id}
                item={item}
                onCancel={handleCancel}
                onRetry={handleRetry}
              />
            ))}
          </View>
        )}

        {/* Completed Downloads */}
        {completedDownloads.length > 0 && (
          <>
            <View style={[styles.tabContainer, { borderBottomColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.tab, selectedFilter === 'all' && { borderBottomColor: colors.gold }]}
                onPress={() => setSelectedFilter('all')}
              >
                <Text style={[styles.tabText, selectedFilter === 'all' && { color: colors.text }]}>All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, selectedFilter === 'movie' && { borderBottomColor: colors.gold }]}
                onPress={() => setSelectedFilter('movie')}
              >
                <Text style={[styles.tabText, selectedFilter === 'movie' && { color: colors.text }]}>Movies</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, selectedFilter === 'tv' && { borderBottomColor: colors.gold }]}
                onPress={() => setSelectedFilter('tv')}
              >
                <Text style={[styles.tabText, selectedFilter === 'tv' && { color: colors.text }]}>TV Shows</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.downloadedGrid}>
              {filteredDownloads().map(item => (
                <DownloadedMediaCard
                  key={item.id}
                  item={item}
                  onPlay={handlePlay}
                  onDelete={handleDelete}
                />
              ))}
            </View>
          </>
        )}

        {/* Empty State */}
        {!hasDownloads && (
          <View style={styles.emptyContainer}>
            <Ionicons name="cloud-download-outline" size={64} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.text }]}>No downloads yet</Text>
            <Text style={[styles.emptySubtext, { color: colors.textSub }]}>
              Download movies and shows to watch offline
            </Text>
          </View>
        )}
      </RefreshableScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  headerTitle: { fontSize: 22, fontWeight: 'bold' },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  headerButtonText: { fontSize: 12, fontWeight: '600', marginLeft: 4 },
  scrollView: { flex: 1 },
  storageSection: { padding: 16 },
  storageBar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  storageBarFill: { height: '100%', borderRadius: 3 },
  storageText: { fontSize: 12, marginTop: 8 },
  section: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#222' },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  tab: { marginRight: 24, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontSize: 14, fontWeight: '500', color: '#888' },
  downloadedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyText: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptySubtext: { fontSize: 14, marginTop: 8 },
});

export default DownloadsScreen;
