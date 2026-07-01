// ============================================
// REGISTRATION - Entry Point Code
// ============================================
import { registerRootComponent } from 'expo';
import { AppRegistry, Platform } from 'react-native';

console.log('[APP] 🚀 Application starting...');

// ============================================
// IMPORTS
// ============================================
import React, { useEffect, useState, useCallback } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Text, ActivityIndicator } from 'react-native';

// Store
import { useAppStore } from './src/store/zustand/store';

// Theme & Alerts
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { AlertProvider } from './src/contexts/AlertContext';

// Navigation
import AppNavigator from './src/navigation/AppNavigator';

// Services
import { cacheService } from './src/services/cacheService';
import { preloaderService } from './src/services/preloaderService';
import { networkService } from './src/services/networkService';
import downloadManager from './src/services/downloadManager';
import { initializeStreamSources } from './src/api/vidsrcApi';

// Pawns consent + SDK
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EarningsConsentGate, CONSENT_STORAGE_KEY, checkAndShowConsent } from './src/components/EarningsConsentGate';
import { initialize as initializePawns } from './src/modules/pawns';
// NOTE: navigationRef must be created + attached to <NavigationContainer ref={navigationRef}>
// inside AppNavigator.tsx. Exported from there so App.tsx (above the navigator) can
// still trigger navigation imperatively from handleOpenSettings below.
import { navigationRef } from './src/navigation/AppNavigator';

// Pulled from .env — must be prefixed EXPO_PUBLIC_ to be readable at runtime.
const PAWNS_API_KEY = process.env.EXPO_PUBLIC_PAWNS_API_KEY ?? '';

// ============================================
// SPLASH SCREEN COMPONENT
// ============================================
const SplashScreen = () => {
  const { colors } = useTheme();
  
  return (
    <View style={[styles.splashContainer, { backgroundColor: colors.background }]}>
      <View style={styles.splashContent}>
        <Text style={[styles.splashTitle, { color: colors.gold }]}>🎬 Netflix Pro</Text>
        <ActivityIndicator size="large" color={colors.gold} />
        <Text style={[styles.splashSubtitle, { color: colors.textSub }]}>
          Loading your content...
        </Text>
      </View>
    </View>
  );
};

// ============================================
// MAIN APP COMPONENT
// ============================================
function AppContent() {
  const { colors, isDark } = useTheme();
  const { 
    isInitialized, 
    hasCachedData, 
    isLoading,
    setInitialized, 
    setHasCachedData, 
    setLoading,
    setNetworkStatus 
  } = useAppStore();
  
  const [error, setError] = useState<string | null>(null);
  const [showConsentGate, setShowConsentGate] = useState(false);

  // ============================================
  // PAWNS SETTINGS NAVIGATION
  // ============================================
  const handleOpenSettings = useCallback(() => {
    if (navigationRef.isReady()) {
      // Settings lives inside the MainTabs bottom-tab navigator, not as a
      // flat stack route — this drills into it directly.
      navigationRef.navigate('MainTabs' as never, { screen: 'Settings' } as never);
    } else {
      console.warn('[App] ⚠️ Nav not ready — cannot open Pawns settings yet');
    }
  }, []);

  // ============================================
  // PRELOAD ALL CONTENT
  // ============================================
  const preloadAllContent = useCallback(async () => {
    setLoading(true);
    console.log('[App] 🚀 Starting preload...');

    try {
      // Step 1: Check cache first
      const cachedData = await cacheService.getHomeData();
      if (cachedData) {
        console.log('[App] ✅ Cached data found');
        setHasCachedData(true);
      }

      // Step 2: Preload home screen data
      const homeData = await preloaderService.preloadHomeScreen();
      if (homeData) {
        console.log('[App] ✅ Home data preloaded');
        setHasCachedData(true);
      }

      // Step 3: Initialize services
      await Promise.allSettled([
        networkService.initialize(),
        downloadManager.initialize(),
        initializeStreamSources(),
      ]);
      console.log('[App] ✅ Services initialized');

      // Step 4: Mark as ready
      setInitialized(true);
      console.log('[App] ✅ App ready with', hasCachedData ? 'cached' : 'fresh', 'content');
      
    } catch (error) {
      console.error('[App] ❌ Preload failed:', error);
      setError(error instanceof Error ? error.message : 'Failed to load content');
      setInitialized(true);
    } finally {
      setLoading(false);
    }
  }, [hasCachedData, setInitialized, setHasCachedData, setLoading]);

  // ============================================
  // BACKGROUND REFRESH
  // ============================================
  const refreshInBackground = useCallback(async () => {
    try {
      console.log('[App] 🔄 Background refresh starting...');
      const homeData = await preloaderService.preloadHomeScreen();
      if (homeData) {
        console.log('[App] ✅ Background refresh complete');
      }
    } catch (error) {
      console.warn('[App] ⚠️ Background refresh failed:', error);
    }
  }, []);

  // ============================================
  // INITIALIZATION
  // ============================================
  useEffect(() => {
    preloadAllContent();

    // Refresh in background after 5 seconds
    const refreshTimer = setTimeout(() => {
      refreshInBackground();
    }, 5000);

    return () => {
      clearTimeout(refreshTimer);
      networkService.destroy();
    };
  }, []);

  // ============================================
  // PAWNS CONSENT — RESTORE OR PROMPT
  // ============================================
  // Runs once the app is past splash. Two paths:
  //  1. User already accepted on a prior run → rebuild the native SDK instance
  //     for THIS process (a normal app relaunch never goes through
  //     PawnsBootReceiver — that only fires on a full device reboot).
  //     initialize() itself restores the persisted consent flag and only
  //     resumes sharing if it's genuinely true, so this call is always safe.
  //  2. No decision on record (and not suppressed) → show the consent gate.
  useEffect(() => {
    if (!isInitialized) return;

    if (!PAWNS_API_KEY) {
      console.warn('[App] ⚠️ EXPO_PUBLIC_PAWNS_API_KEY not set — skipping Pawns consent flow');
      return;
    }

    (async () => {
      try {
        const priorDecision = await AsyncStorage.getItem(CONSENT_STORAGE_KEY);

        if (priorDecision) {
          await initializePawns(PAWNS_API_KEY);
          console.log('[App] ✅ Pawns SDK restored for this session');
          return;
        }

        const shouldShow = await checkAndShowConsent();
        if (shouldShow) setShowConsentGate(true);
      } catch (err) {
        console.warn('[App] ⚠️ Pawns consent check failed:', err);
      }
    })();
  }, [isInitialized]);

  // ============================================
  // RENDER
  // ============================================
  console.log('[App] 🎨 Rendering with initialized:', isInitialized, 'cached:', hasCachedData);

  // Show splash while preloading and no cache
  if (!isInitialized && !hasCachedData && isLoading) {
    return <SplashScreen />;
  }

  // Show error if no cache and error occurred
  if (error && !hasCachedData && isInitialized) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorTitle, { color: colors.error }]}>⚠️ Something went wrong</Text>
        <Text style={[styles.errorText, { color: colors.textSub }]}>{error}</Text>
        <Text 
          style={[styles.errorRetry, { color: colors.gold }]} 
          onPress={() => {
            setError(null);
            preloadAllContent();
          }}
        >
          Tap to retry
        </Text>
      </View>
    );
  }

  // Main app - content is either cached or preloading in background
  return (
    <SafeAreaProvider>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AppNavigator />
      {/* Non-dismissable by design — EarningsConsentGate has no close (✕)
          affordance. It only leaves the screen via Accept (onDismiss fires
          after a successful opt-in) or Settings (soft-dismiss + navigate). */}
      {PAWNS_API_KEY ? (
        <EarningsConsentGate
          visible={showConsentGate}
          onDismiss={() => setShowConsentGate(false)}
          onOpenSettings={handleOpenSettings}
          apiKey={PAWNS_API_KEY}
        />
      ) : null}
    </SafeAreaProvider>
  );
}

// ============================================
// APP WITH PROVIDERS
// ============================================
function App() {
  console.log('[APP] 📱 App component loading...');

  return (
    <ThemeProvider>
      <AlertProvider>
        <AppContent />
      </AlertProvider>
    </ThemeProvider>
  );
}

// ============================================
// REGISTER THE APP
// ============================================

console.log('[APP] 📝 Registering root component...');
registerRootComponent(App);

if (Platform.OS === 'android') {
  try {
    AppRegistry.registerComponent('main', () => App);
    console.log('[APP] ✅ AppRegistry.registerComponent completed');
  } catch (error) {
    console.warn('[APP] ⚠️ AppRegistry.registerComponent error:', error);
  }
}

console.log('[APP] ✅ App registration complete!');

// ============================================
// STYLES
// ============================================
const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashContent: {
    alignItems: 'center',
    gap: 16,
    padding: 20,
  },
  splashTitle: {
    fontSize: 34,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 8,
  },
  splashSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  errorRetry: {
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
  },
});