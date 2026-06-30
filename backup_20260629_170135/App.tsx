// ============================================
// REGISTRATION - Entry Point Code
// ============================================
import { registerRootComponent } from 'expo';
import { AppRegistry, Platform } from 'react-native';

console.log('========================================');
console.log('[APP] 🚀 Application starting...');
console.log('[APP] Platform:', Platform.OS);
console.log('[APP] Time:', new Date().toISOString());
console.log('========================================');

// ============================================
// YOUR ORIGINAL APP CODE
// ============================================
import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AppNavigator from './src/navigation/AppNavigator';
import { checkForUpdates, getCheckForUpdatesSetting } from './src/utils/updateChecker';
import { initializeStreamSources } from './src/api/vidsrcApi';
import downloadManager from './src/services/downloadManager';
import { FLUX_SOURCE_URL } from './src/utils/storage';

console.log('[APP] 📱 App component loading...');

function App() {
  console.log('[APP] 🎨 App component rendering...');

  useEffect(() => {
    console.log('[APP] 🔄 App useEffect running...');
    
    const initializeApp = async () => {
      console.log('[APP] 🚀 Initializing app services...');
      
      try {
        // Initialize stream sources order
        try {
          await initializeStreamSources();
          console.log('[APP] ✅ Stream sources initialized');
        } catch (error) {
          console.warn('[APP] ⚠️ Failed to initialize stream sources:', error);
        }

        // Initialize download manager and cleanup service
        try {
          await downloadManager.initialize();
          console.log('[APP] ✅ Download manager initialized');
        } catch (error) {
          console.warn('[APP] ⚠️ Failed to initialize download services:', error);
        }

        // Wake up endpoint early
        try {
          fetch(FLUX_SOURCE_URL).catch(() => {});
          console.log('[APP] ✅ Endpoint woken up');
        } catch (error) {
          console.warn('[APP] ⚠️ Failed to wake endpoint:', error);
        }

        // Check for updates
        try {
          const updatesEnabled = await getCheckForUpdatesSetting();
          if (updatesEnabled) {
            await checkForUpdates(false);
            console.log('[APP] ✅ Update check completed');
          }
        } catch (error) {
          console.warn('[APP] ⚠️ Failed to check for updates:', error);
        }

        console.log('[APP] ✅ App initialization complete!');
      } catch (error) {
        console.error('[APP] ❌ Initialization failed:', error);
      }
    };

    initializeApp();
  }, []);

  console.log('[APP] ✅ Rendering main app...');
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AppNavigator />
    </SafeAreaProvider>
  );
}

// ============================================
// REGISTER THE APP
// ============================================

console.log('[APP] 📝 Registering root component...');

// Register with Expo
registerRootComponent(App);

// Also register with AppRegistry for Android
if (Platform.OS === 'android') {
  try {
    AppRegistry.registerComponent('main', () => App);
    console.log('[APP] ✅ AppRegistry.registerComponent completed');
  } catch (error) {
    console.warn('[APP] ⚠️ AppRegistry.registerComponent error:', error);
  }
}

console.log('[APP] ✅ App registration complete!');
console.log('========================================');