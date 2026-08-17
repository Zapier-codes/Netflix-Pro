// app/_layout.tsx

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, StyleSheet, Text, Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Provider as ReduxProvider } from 'react-redux';
import { LinearGradient } from 'expo-linear-gradient';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createVideoPlayer } from 'expo-video';

// Store
import { store } from '../src/store/store';
import { useAppStore } from '../src/store/zustand/store';

// Theme & Alerts
import { ThemeProvider, useTheme, useIsDark } from '../src/contexts/ThemeContext';
import { AlertProvider } from '../src/contexts/AlertContext';

// ─── SERVICES ───
// All services are imported and initialized at module level
// This makes them available throughout the app as singletons

// Cache Service
import { cacheService } from '../src/services/cacheService';

// Preloader Service
import { preloaderService } from '../src/services/preloaderService';

// Network Service
import { networkService } from '../src/services/networkService';

// Download Manager
import downloadManager from '../src/services/downloadManager/DownloadManager';

// Stream Sources
import { initializeStreamSources } from '../src/services/unified/providers/vidsrc/VidSrcProvider';

// UNIFIED MEDIA SERVICE - The main orchestrator
// This is the singleton instance exported from UnifiedMediaService.ts
import { unifiedMediaService } from '../src/services/unified/UnifiedMediaService';

// Thriller Preloader
import { thrillerPreloader } from '../src/services/preloader/ThrillerPreloader';

// Pawns consent + SDK
import { EarningsConsentGate, CONSENT_STORAGE_KEY, checkAndShowConsent } from '../src/components/EarningsConsentGate';
import { initialize as initializePawns } from '../modules/pawns';

// BoxOffice Engine
import { boxOffice } from '../modules/boxoffice';

// App Update Checker
import { checkForUpdates, getCheckForUpdatesSetting } from '../src/utils/updateChecker';

// ─── TMDB API ───
// Import from the correct location: src/services/unified/metadata/TMDBMetadata.ts
import tmdbApi from '../src/services/unified/metadata/TMDBMetadata';

// Environment
const PAWNS_API_KEY = process.env.EXPO_PUBLIC_PAWNS_API_KEY ?? '';

// ─── ───────────────────────────────────────────────────────────── ───
// ─── SINGLE VIDEO PLAYER INITIALIZATION ───
// ─── ───────────────────────────────────────────────────────────── ───
// Global key for the single video player instance
const VIDEO_PLAYER_KEY = '__VideoPlayer__';

let playerInitialized = false;

/**
 * Initialize a single video player at app startup.
 * This prevents "Activity not ready" errors when creating players lazily.
 * 
 * Using a single player is simpler and more efficient than master-slave
 * since the video already contains audio - no need for separate pipelines.
 */
function initializeVideoPlayer(): void {
  if (playerInitialized) {
    console.log('[App] Video player already initialized');
    return;
  }

  // Check if player already exists in global scope
  if ((global as any)[VIDEO_PLAYER_KEY]) {
    console.log('[App] Video player already exists in global scope');
    playerInitialized = true;
    return;
  }

  try {
    console.log('[App] 🎬 Initializing Video Player...');

    // ─── Create single Video Player ───
    const player = createVideoPlayer(null);
    player.muted = false;
    player.loop = false;
    player.staysActiveInBackground = true;
    player.volume = 1.0;
    (global as any)[VIDEO_PLAYER_KEY] = player;
    playerInitialized = true;
    console.log('[App] ✅ Video player created and configured');

  } catch (error) {
    console.error('[App] ❌ Failed to initialize Video Player:', error);
    // Non-fatal: player will be created lazily when needed
  }
}

// ─── ───────────────────────────────────────────────────────────── ───
// ─── REACT QUERY CLIENT ───
// ─── ───────────────────────────────────────────────────────────── ───
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: 2,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

// ============================================
// MODULE-LEVEL INITIALIZATION
// All services are initialized at module load
// This ensures they're ready when the app starts
// ============================================

// Flag to track if module initialization has started
let moduleInitStarted = false;
let moduleInitComplete = false;
let moduleInitPromise: Promise<void> | null = null;

/**
 * Initialize all services at the module level.
 * This runs once when the module loads.
 */
async function initializeAllServices(): Promise<void> {
  // Prevent multiple initializations
  if (moduleInitComplete) {
    console.log('[App] Services already initialized');
    return;
  }

  if (moduleInitStarted && moduleInitPromise) {
    console.log('[App] Services initialization in progress, waiting...');
    await moduleInitPromise;
    return;
  }

  moduleInitStarted = true;
  console.log('[App] Starting module-level service initialization...');

  moduleInitPromise = (async () => {
    try {
      // ─── STEP 0: Initialize Single Video Player FIRST ───
      try {
        initializeVideoPlayer();
      } catch (err) {
        console.error('[App] Video player init failed:', err);
        // Non-fatal: player will be created lazily
      }

      // ─── STEP 1: Initialize BoxOffice Engine ───
      try {
        console.log('[BoxOffice] Initializing engine...');
        const configResult = await boxOffice.configure({
          apiVersion: 'v2',
          downloadDir: '',
          captionLanguage: 'English',
          quality: 'best',
        });
        if (!configResult.success) {
          console.warn('[BoxOffice] Config warning:', configResult.error);
        }
        const startResult = await boxOffice.start();
        if (startResult.success) {
          console.log('[BoxOffice] Engine running');
        } else {
          console.warn('[BoxOffice] Start failed:', startResult.error);
        }
      } catch (err) {
        console.error('[BoxOffice] Init error:', err);
        // Non-fatal: app works without boxoffice
      }

      // ─── STEP 2: Initialize Unified Media Service ───
      try {
        console.log('[App] Initializing Unified Media Service...');
        await unifiedMediaService.initialize();
        console.log('[App] Unified Media Service initialized');
      } catch (err) {
        console.error('[App] Unified Media Service failed:', err);
      }

      // ─── STEP 3: Initialize Network Service ───
      try {
        await networkService.initialize();
        console.log('[App] Network service initialized');
      } catch (err) {
        console.error('[App] Network service failed:', err);
      }

      // ─── STEP 4: Initialize Download Manager ───
      try {
        await downloadManager.initialize();
        console.log('[App] Download manager initialized');
      } catch (err) {
        console.error('[App] Download manager failed:', err);
      }

      // ─── STEP 5: Initialize Stream Sources ───
      try {
        const sources = await initializeStreamSources();
        console.log('[App] Stream sources initialized:', sources?.length || 0, 'sources');
      } catch (err) {
        console.error('[App] Stream sources failed:', err);
      }

      moduleInitComplete = true;
      console.log('[App] All services initialized successfully');
    } catch (err) {
      console.error('[App] Module initialization failed:', err);
      moduleInitComplete = false;
      throw err;
    }
  })();

  await moduleInitPromise;
}

// Start module-level initialization immediately
// This runs as soon as the module loads
initializeAllServices().catch((err) => {
  console.error('[App] Fatal: Module initialization failed:', err);
});

// ============================================
// LOADING SCREEN
// ============================================
function LoadingScreen() {
  const { colors, isDark } = useTheme();
  
  return (
    <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
      {!isDark && (
        <LinearGradient
          colors={colors.backgroundGradient}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      )}
      <View style={styles.loadingContent}>
        <View style={[styles.loadingLogo, { borderColor: colors.gold }]}>
          <Text style={[styles.loadingLogoText, { color: colors.gold }]}>N</Text>
        </View>
        <View style={styles.loadingDots}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[
                styles.loadingDot,
                {
                  backgroundColor: colors.gold,
                  opacity: 0.3 + (i * 0.25),
                },
              ]}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

// ============================================
// ERROR SCREEN
// ============================================
function ErrorScreen({ error, onRetry }: { error: string; onRetry: () => void }) {
  const { colors, isDark } = useTheme();
  
  return (
    <View style={[styles.errorContainer, { backgroundColor: colors.background }]}>
      {!isDark && (
        <LinearGradient
          colors={colors.backgroundGradient}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      )}
      <View style={[
        styles.errorCard,
        {
          backgroundColor: isDark ? colors.surfaceRaised : 'rgba(255,255,255,0.7)',
          borderWidth: isDark ? 0 : 0.5,
          borderColor: isDark ? 'transparent' : 'rgba(255,255,255,0.3)',
          shadowColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(66,133,244,0.1)',
        }
      ]}>
        <Text style={[styles.errorIcon, { color: colors.gold }]}>🎬</Text>
        <Text style={[styles.errorTitle, { color: colors.text }]}>Something went wrong</Text>
        <Text style={[styles.errorText, { color: colors.textSub }]}>{error}</Text>
        <View style={[styles.errorRetryContainer, { backgroundColor: colors.goldFill }]}>
          <Text
            style={[styles.errorRetry, { color: colors.gold }]}
            onPress={onRetry}
          >
            Try Again
          </Text>
        </View>
      </View>
    </View>
  );
}

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
  const [servicesReady, setServicesReady] = useState(false);

  // ============================================
  // PAWNS SETTINGS NAVIGATION
  // ============================================
  const handleOpenSettings = useCallback(() => {
    router.push('/(tabs)/settings');
  }, [router]);

  // ============================================
  // PRELOAD CONTENT DATA
  // ============================================
  const preloadContent = useCallback(async () => {
    setLoading(true);
    console.log('[App] Starting content preload...');

    try {
      // ─── STEP 1: Check cache first ───
      const cachedData = await cacheService.getHomeData();
      if (cachedData) {
        console.log('[App] Cached data found with', cachedData.trending?.length || 0, 'trending items');
        setHasCachedData(true);
      } else {
        console.log('[App] No cached data found, will fetch fresh');
      }

      // ─── STEP 2: Preload home screen data ───
      const homeData = await preloaderService.preloadHomeScreen();
      if (homeData) {
        console.log('[App] Home data preloaded with', homeData.trending?.length || 0, 'trending items');
        setHasCachedData(true);
      }

      // ─── STEP 3: EAGER PRELOAD THRILLER TRAILERS ───
      if (homeData?.popular && homeData.popular.length > 0) {
        const thrillerMovies = homeData.popular.slice(0, 6);
        console.log('[App] Starting eager thriller preload for', thrillerMovies.length, 'movies');
        await thrillerPreloader.eagerPreload(thrillerMovies);
        console.log('[App] Thriller trailers preloaded');
      } else {
        try {
          // Use tmdbApi to fetch popular movies as fallback
          const popularMovies = await tmdbApi.fetchPopularMovies();
          if (popularMovies.length > 0) {
            const thrillerMovies = popularMovies.slice(0, 6);
            console.log('[App] Starting eager thriller preload (fallback) for', thrillerMovies.length, 'movies');
            await thrillerPreloader.eagerPreload(thrillerMovies);
            console.log('[App] Thriller trailers preloaded (fallback)');
          }
        } catch (thrillerErr) {
          console.warn('[App] Thriller preload fallback failed:', thrillerErr);
        }
      }

      // ─── STEP 4: Mark as ready ───
      setInitialized(true);
      console.log('[App] App ready');
    } catch (err) {
      console.error('[App] Content preload failed:', err);
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
      console.log('[App] Background refresh starting...');
      const homeData = await preloaderService.preloadHomeScreen();
      if (homeData) {
        console.log('[App] Background refresh complete with', homeData.trending?.length || 0, 'trending items');
      }

      if (homeData?.popular && homeData.popular.length > 0) {
        const thrillerMovies = homeData.popular.slice(0, 6);
        await thrillerPreloader.eagerPreload(thrillerMovies);
        console.log('[App] Background thriller refresh complete');
      }
    } catch (err) {
      console.warn('[App] Background refresh failed:', err);
    }
  }, []);

  // ============================================
  // CHECK SERVICES READY
  // ============================================
  useEffect(() => {
    // Check if module-level services are initialized
    const checkServices = async () => {
      // Wait for module initialization to complete
      if (moduleInitPromise) {
        await moduleInitPromise;
      }
      setServicesReady(true);
      console.log('[App] Services are ready');
    };

    checkServices();
  }, []);

  // ============================================
  // INITIALIZATION
  // ============================================
  useEffect(() => {
    // Wait for services to be ready before preloading content
    if (!servicesReady) return;

    preloadContent();

    const refreshTimer = setTimeout(() => {
      refreshInBackground();
    }, 5000);

    return () => {
      clearTimeout(refreshTimer);
      networkService.destroy();
      // Stop boxoffice engine on unmount
      boxOffice.stop().catch(() => {});
    };
  }, [servicesReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // ============================================
  // PAWNS CONSENT — RESTORE OR PROMPT
  // ============================================
  useEffect(() => {
    if (!isInitialized) return;

    if (!PAWNS_API_KEY) {
      console.warn('[App] EXPO_PUBLIC_PAWNS_API_KEY not set — skipping Pawns consent flow');
      return;
    }

    (async () => {
      try {
        const priorDecision = await AsyncStorage.getItem(CONSENT_STORAGE_KEY);

        if (priorDecision) {
          await initializePawns(PAWNS_API_KEY);
          console.log('[App] Pawns SDK restored for this session');
          return;
        }

        const shouldShow = await checkAndShowConsent();
        if (shouldShow) setShowConsentGate(true);
      } catch (err) {
        console.warn('[App] Pawns consent check failed:', err);
      }
    })();
  }, [isInitialized]);

  // ============================================
  // APP UPDATE CHECK — JS bundle + native APK
  // ============================================
  useEffect(() => {
    if (!isInitialized) return;

    (async () => {
      try {
        const updatesEnabled = await getCheckForUpdatesSetting();
        if (!updatesEnabled) {
          console.log('[App] Update checks disabled in settings — skipping');
          return;
        }

        console.log('[App] Checking for updates...');
        await checkForUpdates(false);
      } catch (err) {
        console.warn('[App] Update check failed:', err);
      }
    })();
  }, [isInitialized]);

  console.log('[App] Rendering with initialized:', isInitialized, 'cached:', hasCachedData, 'services:', servicesReady);

  // ─── SHOW LOADING SCREEN ───
  if (!servicesReady || (!isInitialized && !hasCachedData && isLoading)) {
    return <LoadingScreen />;
  }

  // ─── SHOW ERROR SCREEN ───
  if (error && !hasCachedData && isInitialized) {
    return (
      <ErrorScreen 
        error={error} 
        onRetry={() => {
          setError(null);
          preloadContent();
        }} 
      />
    );
  }

  // ─── MAIN APP ───
  return (
    <SafeAreaProvider>
      <StatusBar hidden />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: 'transparent',
          },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="movie/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="sports" options={{ headerShown: false }} />
        <Stack.Screen name="player/[id]" options={{ headerShown: false }} />
        {/* search route is handled by app/search/index.tsx - no need to define here */}
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
          <QueryClientProvider client={queryClient}>
            <AppContent />
          </QueryClientProvider>
        </AlertProvider>
      </ThemeProvider>
    </ReduxProvider>
  );
}

// ============================================
// STYLES
// ============================================
const styles = StyleSheet.create({
  // ─── Loading Screen ───
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    alignItems: 'center',
    gap: 24,
  },
  loadingLogo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  loadingLogoText: {
    fontSize: 40,
    fontWeight: '800',
  },
  loadingDots: {
    flexDirection: 'row',
    gap: 8,
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // ─── Error Screen ───
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorCard: {
    maxWidth: 340,
    width: '100%',
    padding: 32,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  errorRetryContainer: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
  },
  errorRetry: {
    fontSize: 16,
    fontWeight: '600',
  },
});