// src/screens/settings/SettingsScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Constants from 'expo-constants';

// Zustand Stores
import { useAppStore, useSettings } from '../../store/zustand';
import { useTheme } from '../../contexts/ThemeContext';
import { useAlert } from '../../contexts/AlertContext';

// Services
import { getDownloadStorageUsage, formatFileSize, getAllDownloads, clearAllDownloads } from '../../utils/downloadStorage';
import downloadManager from '../../services/downloadManager';

const SettingsScreen = () => {
  const { colors, isDark, toggleTheme } = useTheme();
  const { showToast, showDestructiveAlert } = useAlert();

  // Zustand state
  const {
    wifiOnlyDownload,
    maxConcurrentDownloads,
    autoDeleteWatchedDays,
    autoDeleteUnwatchedDays,
    checkForUpdates,
    defaultPlayerQuality,
    subtitleLanguage,
    subtitleSize,
    skipIntro,
    skipCredits,
    dataSaver,
    autoPlayNext,
    setWifiOnlyDownload,
    setMaxConcurrentDownloads,
    setAutoDeleteWatchedDays,
    setAutoDeleteUnwatchedDays,
    setCheckForUpdates,
    setDefaultPlayerQuality,
    setSubtitleLanguage,
    setSubtitleSize,
    setSkipIntro,
    setSkipCredits,
    setDataSaver,
    setAutoPlayNext,
    resetSettings,
  } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [downloadStorageUsed, setDownloadStorageUsed] = useState(0);
  const [totalDownloadsCount, setTotalDownloadsCount] = useState(0);
  const [storageUsageValue, setStorageUsageValue] = useState('0');
  const [storageUsageUnit, setStorageUsageUnit] = useState('KB');

  // Load data
  const loadData = useCallback(async () => {
    try {
      const usage = await getDownloadStorageUsage();
      setDownloadStorageUsed(usage);

      const allDownloads = await getAllDownloads();
      setTotalDownloadsCount(allDownloads.length);

      // Calculate total storage
      const { getAllKeys, multiGet } = require('@react-native-async-storage/async-storage');
      const keys = await getAllKeys();
      let totalSize = 0;
      if (keys.length > 0) {
        const data = await multiGet(keys);
        data.forEach(([key, value]) => {
          if (value) {
            totalSize += key.length * 2 + value.length * 2;
          }
        });
      }

      if (totalSize < 1024 * 1024) {
        setStorageUsageValue((totalSize / 1024).toFixed(2));
        setStorageUsageUnit('KB');
      } else {
        setStorageUsageValue((totalSize / (1024 * 1024)).toFixed(2));
        setStorageUsageUnit('MB');
      }
    } catch (error) {
      console.error('[Settings] Load error:', error);
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

  // Handlers
  const handleClearAllDownloads = useCallback(() => {
    if (totalDownloadsCount === 0 && downloadStorageUsed === 0) {
      showToast('No downloads to clear');
      return;
    }

    showDestructiveAlert(
      'Clear All Downloads',
      Delete all  downloads? This will free up .,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            await downloadManager.cancelAllDownloads();
            await clearAllDownloads();
            loadData();
            showToast('All downloads cleared');
          },
        },
      ]
    );
  }, [totalDownloadsCount, downloadStorageUsed, loadData, showToast, showDestructiveAlert]);

  const handleResetSettings = useCallback(() => {
    showDestructiveAlert(
      'Reset Settings',
      'Reset all settings to default values?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            resetSettings();
            showToast('Settings reset to default');
          },
        },
      ]
    );
  }, [resetSettings, showToast, showDestructiveAlert]);

  const renderSetting = (icon: string, title: string, rightElement: React.ReactNode, description?: string) => (
    <View style={[styles.settingItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.settingLeft}>
        <View style={[styles.iconContainer, { backgroundColor: colors.surfaceRaised }]}>
          <Ionicons name={icon as any} size={20} color={colors.gold} />
        </View>
        <View style={styles.settingContent}>
          <Text style={[styles.settingTitle, { color: colors.text }]}>{title}</Text>
          {description && <Text style={[styles.settingDescription, { color: colors.textSub }]}>{description}</Text>}
        </View>
      </View>
      {rightElement}
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>⚙️ Settings</Text>
        </View>

        {/* Theme Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.gold }]}>Appearance</Text>
          {renderSetting(
            isDark ? 'moon' : 'sunny',
            isDark ? 'Dark Mode' : 'Light Mode',
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: '#444', true: colors.gold }}
              thumbColor="#fff"
            />
          )}
        </View>

        {/* Playback Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.gold }]}>Playback</Text>
          {renderSetting(
            'play-skip-forward',
            'Auto-play Next Episode',
            <Switch
              value={autoPlayNext}
              onValueChange={setAutoPlayNext}
              trackColor={{ false: '#444', true: colors.gold }}
              thumbColor="#fff"
            />
          )}
          {renderSetting(
            'videocam',
            'Default Quality',
            <TouchableOpacity>
              <Text style={[styles.qualityText, { color: colors.text }]}>
                {defaultPlayerQuality || 'Auto'}
              </Text>
            </TouchableOpacity>
          )}
          {renderSetting(
            'text',
            'Subtitle Language',
            <TouchableOpacity>
              <Text style={[styles.qualityText, { color: colors.text }]}>
                {subtitleLanguage || 'English'}
              </Text>
            </TouchableOpacity>
          )}
          {renderSetting(
            'text-outline',
            'Subtitle Size',
            <View style={styles.qualityButtons}>
              {[75, 100, 125].map(size => (
                <TouchableOpacity
                  key={size}
                  style={[
                    styles.qualityButton,
                    subtitleSize === size && { backgroundColor: colors.gold },
                    { borderColor: colors.border }
                  ]}
                  onPress={() => setSubtitleSize(size)}
                >
                  <Text style={[styles.qualityButtonText, subtitleSize === size && { color: '#000' }, { color: colors.text }]}>
                    {size}%
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {renderSetting(
            'fast-forward',
            'Skip Intro',
            <Switch
              value={skipIntro}
              onValueChange={setSkipIntro}
              trackColor={{ false: '#444', true: colors.gold }}
              thumbColor="#fff"
            />
          )}
          {renderSetting(
            'flag',
            'Skip Credits',
            <Switch
              value={skipCredits}
              onValueChange={setSkipCredits}
              trackColor={{ false: '#444', true: colors.gold }}
              thumbColor="#fff"
            />
          )}
        </View>

        {/* Downloads Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.gold }]}>Downloads</Text>
          {renderSetting(
            'wifi',
            'WiFi-Only Downloads',
            <Switch
              value={wifiOnlyDownload}
              onValueChange={setWifiOnlyDownload}
              trackColor={{ false: '#444', true: colors.gold }}
              thumbColor="#fff"
            />
          )}
          {renderSetting(
            'layers',
            'Concurrent Downloads',
            <View style={styles.qualityButtons}>
              {[1, 2, 3, 5].map(count => (
                <TouchableOpacity
                  key={count}
                  style={[
                    styles.qualityButton,
                    maxConcurrentDownloads === count && { backgroundColor: colors.gold },
                    { borderColor: colors.border }
                  ]}
                  onPress={() => setMaxConcurrentDownloads(count)}
                >
                  <Text style={[styles.qualityButtonText, maxConcurrentDownloads === count && { color: '#000' }, { color: colors.text }]}>
                    {count}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {renderSetting(
            'trash',
            'Delete After Watching',
            <Switch
              value={autoDeleteWatchedDays > 0}
              onValueChange={(val) => setAutoDeleteWatchedDays(val ? 1 : 0)}
              trackColor={{ false: '#444', true: colors.gold }}
              thumbColor="#fff"
            />
          )}
          {renderSetting(
            'timer',
            'Auto-Delete Unwatched',
            <View style={styles.qualityButtons}>
              {[0, 7, 14, 30].map(days => (
                <TouchableOpacity
                  key={days}
                  style={[
                    styles.qualityButton,
                    autoDeleteUnwatchedDays === days && { backgroundColor: colors.gold },
                    { borderColor: colors.border }
                  ]}
                  onPress={() => setAutoDeleteUnwatchedDays(days)}
                >
                  <Text style={[styles.qualityButtonText, autoDeleteUnwatchedDays === days && { color: '#000' }, { color: colors.text }]}>
                    {days === 0 ? 'Never' : ${days}d}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={[styles.storageInfo, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.storageLabel, { color: colors.textSub }]}>Downloaded Content</Text>
            <Text style={[styles.storageValue, { color: colors.text }]}>
              {totalDownloadsCount} items • {formatFileSize(downloadStorageUsed)}
            </Text>
          </View>

          <TouchableOpacity style={[styles.clearButton, { backgroundColor: colors.surfaceRaised }]} onPress={handleClearAllDownloads}>
            <Text style={[styles.clearButtonText, { color: colors.error }]}>Clear All Downloads</Text>
          </TouchableOpacity>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.gold }]}>About</Text>
          <View style={[styles.aboutItem, { borderBottomColor: colors.border }]}>
            <Text style={[styles.aboutLabel, { color: colors.textSub }]}>Version</Text>
            <Text style={[styles.aboutValue, { color: colors.text }]}>{Constants.expoConfig?.version || '1.0.0'}</Text>
          </View>
          <View style={[styles.aboutItem, { borderBottomColor: colors.border }]}>
            <Text style={[styles.aboutLabel, { color: colors.textSub }]}>Storage Used</Text>
            <Text style={[styles.aboutValue, { color: colors.text }]}>{storageUsageValue} {storageUsageUnit}</Text>
          </View>
          <TouchableOpacity style={[styles.resetButton, { backgroundColor: colors.surfaceRaised }]} onPress={handleResetSettings}>
            <Text style={[styles.resetButtonText, { color: colors.error }]}>Reset All Settings</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 16 },
  headerTitle: { fontSize: 28, fontWeight: 'bold' },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 0.5,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingContent: { flex: 1 },
  settingTitle: { fontSize: 15, fontWeight: '500' },
  settingDescription: { fontSize: 12, marginTop: 2 },
  qualityButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  qualityButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    marginHorizontal: 2,
  },
  qualityButtonText: { fontSize: 12, fontWeight: '500' },
  qualityText: { fontSize: 14, fontWeight: '500' },
  storageInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    marginTop: 8,
    borderWidth: 0.5,
  },
  storageLabel: { fontSize: 14 },
  storageValue: { fontSize: 14, fontWeight: '600' },
  clearButton: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  clearButtonText: { fontSize: 15, fontWeight: '600' },
  aboutItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
  },
  aboutLabel: { fontSize: 14 },
  aboutValue: { fontSize: 14, fontWeight: '500' },
  resetButton: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  resetButtonText: { fontSize: 15, fontWeight: '600' },
});

export default SettingsScreen;
