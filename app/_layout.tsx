// app/_layout.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Provider as ReduxProvider } from 'react-redux';

// Store
import { store } from '../src/store/store';
import { useAppStore } from '../src/store/zustand/store';

// Theme & Alerts
import { ThemeProvider, useTheme } from '../src/contexts/ThemeContext';
import { AlertProvider } from '../src/contexts/AlertContext';

// Services
import { cacheService } from '../src/services/cacheService';
import { preloaderService } from '../src/services/preloaderService';
import { networkService } from '../src/services/networkService';
import { downloadManager } from '../src/services/downloadManager/DownloadManager';
import { initializeStreamSources } from '../src/services/unified/providers/vidsrc/VidSrcProvider';

// ─── THRILLER PRELOADER ───
import { thrillerPreloader } from '../src/services/preloader/ThrillerPreloader';

// Pawns consent + SDK
import { EarningsConsentGate, CONSENT_STORAGE_KEY, checkAndShowConsent } from '../src/components/EarningsConsentGate';
import { initialize as initializePawns } from '../modules/pawns';

// ─── BOXOFFICE ENGINE ───
import { boxOffice } from '../modules/boxoffice';

// Pulled from .env — must be prefixed EXPO_PUBLIC_ to be readable at runtime.
const PAWNS_API_KEY = process.env.EXPO_PUBLIC_PAWNS_API_KEY ?? '';

// ============================================
// MAIN APP CONTENT
// ============================================
function AppContent() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const {
    isInitialized,
    hasCachedData,
    isLoading,
    setInitialized,
    setHasCachedData,
    setLoading,
  } = useAppStore();

  const [error, setError] = useState<string | null>(null);
  const [showConsentGate, setShowConsentGate] = useState(false);
  const [boxOfficeReady, setBoxOfficeReady] = useState(false);

  // ============================================
  // PAWNS SETTINGS NAVIGATION
  // ============================================
  const handleOpenSettings = useCallback(() => {
    router.push('/(tabs)/settings');
  }, [router]);

  // ============================================
  // BOXOFFICE ENGINE INIT
  // ============================================
  const initializeBoxOffice = useCallback(async () => {
    try {
      console.log('[BoxOffice] 🚀 Initializing engine...');
      const configResult = await boxOffice.configure({
        apiVersion: 'v2',
        downloadDir: '',
        captionLanguage: 'English',
        quality: 'best',
      });
      if (!configResult.success) {
        console.warn('[BoxOffice] ⚠️ Config warning:', configResult.error);
      }
      const startResult = await boxOffice.start();
      if (startResult.success) {
        console.log('[BoxOffice] ✅ Engine running');
        setBoxOfficeReady(true);
      } else {
        console.warn('[BoxOffice] ⚠️ Start failed:', startResult.error);
      }
    } catch (err) {
      console.error('[BoxOffice] ❌ Init error:', err);
      // Non-fatal: app works without boxoffice
    }
  }, []);

  // ============================================
  // PRELOAD ALL CONTENT
  // ============================================
  const preloadAllContent = useCallback(async () => {
    setLoading(true);
    console.log('[App] 🚀 Starting preload...');

    try {
      // ─── STEP 1: Check cache first ───
      const cachedData = await cacheService.getHomeData();
      if (cachedData) {
        console.log('[App] ✅ Cached data found with', cachedData.trending?.length || 0, 'trending items');
        setHasCachedData(true);
      } else {
        console.log('[App] ℹ️ No cached data found, will fetch fresh');
      }

      // ─── STEP 2: Preload home screen data ───
      const homeData = await preloaderService.preloadHomeScreen();
      if (homeData) {
        console.log('[App] ✅ Home data preloaded with', homeData.trending?.length || 0, 'trending items');
        setHasCachedData(true);
      }

      // ─── STEP 3: EAGER PRELOAD THRILLER TRAILERS ───
      if (homeData?.popular && homeData.popular.length > 0) {
        const thrillerMovies = homeData.popular.slice(0, 6);
        console.log('[App] 🎬 Starting eager thriller preload for', thrillerMovies.length, 'movies');
        await thrillerPreloader.eagerPreload(thrillerMovies);
        console.log('[App] ✅ Thriller trailers preloaded');
      } else {
        try {
          const { fetchPopularMovies } = await import('../src/api/tmdbApi');
          const popularMovies = await fetchPopularMovies();
          if (popularMovies.length > 0) {
            const thrillerMovies = popularMovies.slice(0, 6);
            console.log('[App] 🎬 Starting eager thriller preload (fallback) for', thrillerMovies.length, 'movies');
            await thrillerPreloader.eagerPreload(thrillerMovies);
            console.log('[App] ✅ Thriller trailers preloaded (fallback)');
          }
        } catch (thrillerErr) {
          console.warn('[App] ⚠️ Thriller preload fallback failed:', thrillerErr);
        }
      }

      // ─── STEP 4: Initialize services ───
      await Promise.allSettled([
        networkService.initialize(),
        downloadManager.initialize(),
        initializeStreamSources(),
      ]);
      console.log('[App] ✅ Services initialized');

      // ─── STEP 5: Mark as ready ───
      setInitialized(true);
      console.log('[App] ✅ App ready');
    } catch (err) {
      console.error('[App] ❌ Preload failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to load content');
      setInitialized(true);
    } finally {
      setLoading(false);
    }
  }, [setInitialized, setHasCachedData, setLoading]);

  // ============================================
  // BACKGROUND REFRESH
  // ============================================
  const refreshInBackground = useCallback(async () => {
    try {
      console.log('[App] 🔄 Background refresh starting...');
      const homeData = await preloaderService.preloadHomeScreen();
      if (homeData) {
        console.log('[App] ✅ Background refresh complete with', homeData.trending?.length || 0, 'trending items');
      }

      if (homeData?.popular && homeData.popular.length > 0) {
        const thrillerMovies = homeData.popular.slice(0, 6);
        await thrillerPreloader.eagerPreload(thrillerMovies);
        console.log('[App] ✅ Background thriller refresh complete');
      }
    } catch (err) {
      console.warn('[App] ⚠️ Background refresh failed:', err);
    }
  }, []);

  // ============================================
  // INITIALIZATION
  // ============================================
  useEffect(() => {
    // Start boxoffice engine in parallel with content preload
    // It's non-blocking — the app works fine even if it fails
    initializeBoxOffice();

    preloadAllContent();

    const refreshTimer = setTimeout(() => {
      refreshInBackground();
    }, 5000);

    return () => {
      clearTimeout(refreshTimer);
      networkService.destroy();
      // Stop boxoffice engine on unmount
      if (boxOfficeReady) {
        boxOffice.stop().catch(() => {});
      }
    };
  }, []);

  // ============================================
  // PAWNS CONSENT — RESTORE OR PROMPT
  // ============================================
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

  console.log('[App] 🎨 Rendering with initialized:', isInitialized, 'cached:', hasCachedData, 'boxoffice:', boxOfficeReady);

  // ─── REMOVED CUSTOM SPLASH SCREEN ───
  // The native splash screen (from app.config.ts) handles the initial loading
  // We show nothing while loading, letting the native splash do its job
  if (!isInitialized && !hasCachedData && isLoading) {
    return null; // Native splash is still visible
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
      <StatusBar hidden />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="movie/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="sports" options={{ headerShown: false }} />
        <Stack.Screen name="player/[id]" options={{ headerShown: false }} />
      </Stack>
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
// ROOT LAYOUT — the ONLY root expo-router mounts
// ============================================
export default function RootLayout() {
  return (
    <ReduxProvider store={store}>
      <ThemeProvider>
        <AlertProvider>
          <AppContent />
        </AlertProvider>
      </ThemeProvider>
    </ReduxProvider>
  );
}

// ============================================
// STYLES
// ============================================
const styles = StyleSheet.create({
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