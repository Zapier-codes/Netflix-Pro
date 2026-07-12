import { Alert, Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
// NOTE: the legacy submodule is used deliberately — getContentUriAsync()
// (needed to hand the downloaded APK to the system installer) only exists
// on expo-file-system's legacy API, not the newer File/Directory API.
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
// Single source of truth for the app version: read directly from package.json
// at build time (Metro supports JSON imports out of the box) instead of
// expo-constants or a duplicated process.env value.
// Adjust the relative path if updateChecker.tsx doesn't live at src/utils/.
import packageJson from '../../package.json';

const GITHUB_OWNER = 'Zapier-codes';
const GITHUB_REPO = 'Netflix-Pro';
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tags/android-apk-latest`;
const APK_RELEASE_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tag/android-apk-latest`;

const CURRENT_VERSION: string = packageJson.version;
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

// ─── Download an APK and hand it to the system installer (Android only) ───
// iOS has no equivalent — sideloaded APK installs aren't a thing there, so
// callers should fall back to Linking.openURL(releaseUrl) on iOS.
const downloadAndInstallApk = async (
  apkUrl: string,
  onProgress?: (percent: number) => void
): Promise<void> => {
  if (Platform.OS !== 'android') {
    throw new Error('APK install is only supported on Android');
  }

  const destination = `${FileSystem.cacheDirectory}update.apk`;

  // Clean up any partial download from a previous attempt.
  const existing = await FileSystem.getInfoAsync(destination);
  if (existing.exists) {
    await FileSystem.deleteAsync(destination, { idempotent: true });
  }

  const downloadResumable = FileSystem.createDownloadResumable(
    apkUrl,
    destination,
    {},
    (progress) => {
      if (onProgress && progress.totalBytesExpectedToWrite > 0) {
        const percent = Math.round(
          (progress.totalBytesWritten / progress.totalBytesExpectedToWrite) * 100
        );
        onProgress(percent);
      }
    }
  );

  const result = await downloadResumable.downloadAsync();
  if (!result || result.status !== 200) {
    throw new Error(`APK download failed with status ${result?.status ?? 'unknown'}`);
  }

  // Convert the file:// URI to a content:// URI so the system package
  // installer (a different app) is allowed to read it.
  const contentUri = await FileSystem.getContentUriAsync(result.uri);

  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: contentUri,
    type: 'application/vnd.android.package-archive',
    flags: 1, // Intent.FLAG_GRANT_READ_URI_PERMISSION
  });
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
              if (nativeUpdate.apkUrl && Platform.OS === 'android') {
                downloadAndInstallApk(nativeUpdate.apkUrl, (percent) => {
                  console.log(`APK download: ${percent}%`);
                }).catch((err) => {
                  console.error('APK install failed:', err);
                  Alert.alert(
                    'Install Failed',
                    'Could not install the update automatically. Opening the release page instead.',
                    [{ text: 'OK', onPress: () => Linking.openURL(nativeUpdate.releaseUrl) }]
                  );
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