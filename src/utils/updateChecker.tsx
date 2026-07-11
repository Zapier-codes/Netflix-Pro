import { Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import ApkUpdate from 'rn-apk-update';

const GITHUB_OWNER = 'Zapier-codes';
const GITHUB_REPO = 'Netflix-Pro';
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tags/android-apk-latest`;
const APK_RELEASE_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tag/android-apk-latest`;

const CURRENT_VERSION = Constants.expoConfig?.version;
const CHECK_FOR_UPDATES_KEY = '@check_for_updates_enabled';
const LAST_NATIVE_CHECK_KEY = '@last_native_check';

// ─── TIER 1: Check JS bundle update via expo-updates ───
const checkJsUpdate = async () => {
  try {
    const update = await Updates.checkForUpdateAsync();
    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();
      // Optionally reload immediately or on next launch
      // await Updates.reloadAsync();
      return true;
    }
    return false;
  } catch (error) {
    console.error('expo-updates check failed:', error);
    return false;
  }
};

// ─── TIER 2: Check native APK update via GitHub Release ───
const checkNativeUpdate = async () => {
  try {
    const response = await fetch(GITHUB_API_URL);
    const release = await response.json();
    
    if (!release.tag_name) return null;
    
    // Extract version from release body or tag
    const body = release.body || '';
    const versionMatch = body.match(/version[:\s]*([0-9.]+)/i) || release.tag_name.match(/([0-9.]+)/);
    const latestVersion = versionMatch ? versionMatch[1] : release.tag_name;
    
    // Compare with current native version (stored in AsyncStorage or app config)
    const currentNativeVersion = await AsyncStorage.getItem('@native_version') || CURRENT_VERSION;
    
    if (latestVersion !== currentNativeVersion) {
      return {
        version: latestVersion,
        apkUrl: release.assets?.find((a: any) => a.name.endsWith('.apk'))?.browser_download_url,
        releaseUrl: APK_RELEASE_URL
      };
    }
    return null;
  } catch (error) {
    console.error('Native update check failed:', error);
    return null;
  }
};

// ─── MAIN: Orchestrate both tiers ───
export const checkForUpdates = async (showAlert = true) => {
  // 1. Always check JS updates first (silent)
  const jsUpdated = await checkJsUpdate();
  
  // 2. Check native updates (only once per day to avoid spam)
  const lastCheck = await AsyncStorage.getItem(LAST_NATIVE_CHECK_KEY);
  const today = new Date().toDateString();
  
  if (lastCheck !== today) {
    await AsyncStorage.setItem(LAST_NATIVE_CHECK_KEY, today);
    
    const nativeUpdate = await checkNativeUpdate();
    if (nativeUpdate) {
      Alert.alert(
        'Major Update Available',
        `A new version (${nativeUpdate.version}) is ready. This requires a full app update.`,
        [
          {
            text: 'Download & Install',
            onPress: () => {
              if (nativeUpdate.apkUrl) {
                // Use rn-apk-update for full APK install
                ApkUpdate.downloadAndInstallApk(nativeUpdate.apkUrl, {
                  onProgress: (progress: number) => {
                    console.log(`APK download: ${progress}%`);
                  },
                  onProgressComplete: () => {
                    console.log('APK download complete');
                  }
                });
              } else {
                Linking.openURL(nativeUpdate.releaseUrl);
              }
            }
          },
          { text: 'Later', style: 'cancel' }
        ]
      );
      return; // Don't show "up to date" if native update is pending
    }
  }
  
  // 3. Show status if requested
  if (showAlert) {
    if (jsUpdated) {
      Alert.alert('Updated', 'New content has been downloaded. Restart to apply.', [{ text: 'OK' }]);
    } else {
      Alert.alert('Up to Date', `You are on the latest version (${CURRENT_VERSION}).`, [{ text: 'OK' }]);
    }
  }
};

// ─── Settings helpers (unchanged) ───
export const getCheckForUpdatesSetting = async () => {
  try {
    const value = await AsyncStorage.getItem(CHECK_FOR_UPDATES_KEY);
    return value !== null ? JSON.parse(value) : true;
  } catch {
    return true;
  }
};

export const setCheckForUpdatesSetting = async (isEnabled: boolean) => {
  try {
    await AsyncStorage.setItem(CHECK_FOR_UPDATES_KEY, JSON.stringify(isEnabled));
  } catch (error) {
    console.error('Error setting check for updates:', error);
  }
};