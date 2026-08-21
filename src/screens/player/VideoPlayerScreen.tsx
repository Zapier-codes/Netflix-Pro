// src/screens/player/VideoPlayerScreen.tsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, Alert, StyleSheet, ActivityIndicator, BackHandler,
  Animated, TouchableOpacity, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { VideoView, useVideoPlayer } from 'expo-video';
import { StatusBar } from 'expo-status-bar';
import { useEventListener } from 'expo';
import { GestureHandlerRootView, GestureDetector } from 'react-native-gesture-handler';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { getLanguageName } from '../../utils/languageUtils';
import { formatTime } from '../../utils/timeUtils';

import { useVideoControls } from '../../hooks/useVideoControls';
import { useBrightness } from '../../hooks/useBrightness';
import { useVolume } from '../../hooks/useVolume';
import { useBuffering } from '../../hooks/useBuffering';
import { useSeekBar } from '../../hooks/useSeekBar';
import { useGestures } from '../../hooks/useGestures';
import { useWatchProgress } from '../../hooks/useWatchProgress';
import { useSubtitles } from '../../hooks/useSubtitles';
import { useAutoPlay } from '../../hooks/useAutoPlay';
import { useEpisodeNavigation } from '../../hooks/useEpisodeNavigation';
import { useLicensedPlaybackSource } from '../../hooks/useLicensedPlaybackSource';

import SubtitlesModal from '../../components/SubtitlesModal';
import {
  SubtitleOverlay, SeekIndicators, LoadingOverlay, ErrorOverlay,
  BufferingAlertModal, NextEpisodeButton, EpisodesModal, VideoControlsOverlay,
} from '../../components/video';

const LOG_TAG = '[VideoPlayerScreen]';

const logError = (message: string, error?: any, context?: any) => {
  console.error(`${LOG_TAG} ❌ ${message}`);
  if (error) console.error(`${LOG_TAG} Error details:`, error);
  if (context) console.error(`${LOG_TAG} Context:`, context);
};
const logWarn = (message: string, data?: any) => { console.warn(`${LOG_TAG} ⚠️ ${message}`, data || ''); };
const logInfo = (message: string, data?: any) => { console.log(`${LOG_TAG} ℹ️ ${message}`, data || ''); };
const logDebug = (message: string, data?: any) => { console.log(`${LOG_TAG} 🐞 ${message}`, data || ''); };

// Licensed sources are either played natively (HLS/DASH/MP4 via expo-video)
// or, for downloaded content, from a local file. There's no embed/iframe
// or torrent mode anymore — those only existed to route around piracy
// sources that returned an embed page or a magnet/webtor.io link instead
// of a direct file.
type PlayerMode = 'native' | 'offline';

const classifyPlayerMode = (
  isOfflineParam: string, offlinePath: string
): PlayerMode => {
  if (isOfflineParam === 'true' && offlinePath) return 'offline';
  return 'native';
};

// ───────────────────────────────────────────────────────────────────────
// STREAM HEADERS — copied from VLC's real, verified behavior
//
// Source: modules/access/http.c (videolan/vlc) — the request builder only
// ever writes Host, User-Agent, an optional Referer (NULL unless the user
// passes --http-referrer — VLC sends NO Referer by default), Authorization
// (only with credentials), and Icy-MetaData: 1. There is no code path that
// emits Accept-Encoding, Origin, or Connection.
//
// Confirmed independently by a Wireshark capture of a real VLC 3.0.2
// request (VideoLAN bug #20394):
//   GET / HTTP/1.1
//   Host: <host>
//   Accept: */*
//   Accept-Language: <system locale>
//   User-Agent: VLC/3.0.2 LibVLC/3.0.2
//   Range: bytes=0-
//
// So VLC's real default identifies itself AS VLC — it does not pretend to
// be a browser. Range is added automatically by ExoPlayer for seeking; we
// don't set it by hand.
//
// HARD RULES, true for every strategy below (verified — no code path in
// VLC ever emits these):
//  - NEVER send Accept-Encoding. ExoPlayer cannot decompress gzip, so a
//    gzip HLS manifest fails with "does not start with #EXTM3U".
//  - NEVER send Origin. Browser-only CORS concept; VLC never sends it.
// ───────────────────────────────────────────────────────────────────────

const VLC_UA = 'VLC/3.0.20 LibVLC/3.0.20';
const BROWSER_UA =
  'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

type HeaderStrategy = (url: string) => Record<string, string>;

const HEADER_STRATEGIES: HeaderStrategy[] = [
  // 0: VLC's actual, verified default. No Referer, no Origin, no
  //    Accept-Encoding, real VLC User-Agent. This is what VLC itself sends.
  () => ({
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'User-Agent': VLC_UA,
  }),

  // 1: Documented real-world fallback. Some CDNs specifically block VLC's
  //    own UA string to stop stream-ripping/ad-skipping — this is why VLC
  //    users manually override it with --http-user-agent to a browser
  //    string in practice (see VideoLAN forum threads on this exact
  //    problem). Still no Referer, no Origin — only the UA changes.
  (url) => ({
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'User-Agent': BROWSER_UA,
  }),

  // 2: Browser UA + Referer/Origin derived from the stream's OWN domain.
  //    What a real browser playing this stream in its native page would
  //    send. Not something VLC does, but the most common thing CDNs
  //    actually gate on when strategy 1 alone isn't enough.
  (url) => {
    const headers: Record<string, string> = {
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent': BROWSER_UA,
    };
    try {
      const u = new URL(url);
      headers['Referer'] = `${u.protocol}//${u.hostname}/`;
      headers['Origin'] = `${u.protocol}//${u.hostname}`;
    } catch (e) {
      logWarn('Could not parse stream URL for Referer/Origin', e);
    }
    return headers;
  },

  // 3: Last resort — original app-domain Referer. Kept because some
  //    sources are configured to expect traffic proxied via the API host.
  () => ({
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'User-Agent': BROWSER_UA,
    'Referer': 'https://netflix-tf79.onrender.com/',
  }),
];

const getStreamHeaders = (url: string, strategyIndex: number = 0): Record<string, string> => {
  const strategy = HEADER_STRATEGIES[strategyIndex] || HEADER_STRATEGIES[0];
  const headers = strategy(url);
  // Only delete things a strategy might accidentally include. Origin is
  // intentionally set by strategy 2 to mimic a real browser — do NOT
  // delete it here, or strategy 2 collapses into strategy 1 + Referer.
  delete (headers as any)['Accept-Encoding'];
  delete (headers as any)['Content-Type'];
  logDebug(`📡 Stream headers built (strategy ${strategyIndex}/${HEADER_STRATEGIES.length - 1})`, {
    keys: Object.keys(headers).join(', ') || '(none)',
  });
  return headers;
};

const VideoPlayerScreen = () => {
  const router = useRouter();
  const navigation = useNavigation();
  const navigationRef = useRef(navigation);
  const routerRef = useRef(router);

  const params = useLocalSearchParams();

  const {
    mediaId, mediaType, title, episodeTitle, poster_path, season, episode,
    isLive, isOffline, offlineFilePath, streamUrl, subtitles: subtitlesParam,
  } = params;

  const directStreamUrl = useMemo(() => {
    if (!streamUrl) return null;
    const url = String(streamUrl).trim();
    return url || null;
  }, [streamUrl]);

  const playerMode = useMemo(() => {
    const mode = classifyPlayerMode(String(isOffline || 'false'), String(offlineFilePath || ''));
    logInfo('Player mode determined', { mode, hasUrl: !!directStreamUrl });
    return mode;
  }, [directStreamUrl, isOffline, offlineFilePath]);

  const isNativeMode = playerMode === 'native';
  const isOfflineMode = playerMode === 'offline';

  const isMountedRef = useRef(true);
  const pendingPlayRef = useRef(false);
  const resumeTimeRef = useRef(0);
  const lastSetSourceRef = useRef<string | null>(null);
  const hasConfiguredPlayerRef = useRef(false);
  const playerModeRef = useRef(playerMode);
  const playerReadyRef = useRef(false);
  const trackEndHandledRef = useRef(false);

  // ── NEW: race-condition guard + remembered working header strategy ──
  const isLoadingStreamRef = useRef(false);
  const headerStrategyIndexRef = useRef(0);
  // While true, the strategy loop owns error handling — statusChange/error
  // listeners must NOT surface an error screen mid-loop, or the user sees
  // a failure flash while the loop is still trying strategies 1, 2, 3.
  const isStrategyLoopActiveRef = useRef(false);

  useEffect(() => { playerModeRef.current = playerMode; }, [playerMode]);

  const player = useMemo(() => {
    const p = (global as any).__VideoPlayer__;
    if (!p) logWarn('Video player not found in global scope');
    return p;
  }, []);

  const fallbackPlayer = useVideoPlayer(null);
  const activePlayer = player || fallbackPlayer;

  const contentId = mediaType === 'tv' ? `tv-${mediaId}-s${season}-e${episode}` : `movie-${mediaId}`;

  const [loading, setLoading] = useState(true);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [isUnmounting, setIsUnmounting] = useState(false);
  const [videoNaturalSize, setVideoNaturalSize] = useState(null);
  const [isAtLiveEdge, setIsAtLiveEdge] = useState(true);
  const [showSubtitlesModal, setShowSubtitlesModal] = useState(false);
  const [retryAttempts, setRetryAttempts] = useState(0);
  const [playerReady, setPlayerReady] = useState(false);
  const [isLoadingStream, setIsLoadingStream] = useState(false);
  const [subtitleTracks, setSubtitleTracks] = useState<any[]>([]);
  const [selectedSubtitleTrack, setSelectedSubtitleTrack] = useState<any>(null);

  useEffect(() => {
    const lockLandscape = async () => {
      try { await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE); logDebug('🔒 Locked to landscape'); }
      catch (e) { logWarn('Failed to lock orientation:', e); }
    };
    lockLandscape();
    return () => {
      const restore = async () => {
        try { await ScreenOrientation.unlockAsync(); logDebug('🔓 Unlocked orientation'); }
        catch (e) { logWarn('Failed to unlock orientation:', e); }
      };
      restore();
    };
  }, []);

  useEffect(() => {
    if (!activePlayer) return;
    try {
      activePlayer.muted = false;
      activePlayer.loop = false;
      activePlayer.staysActiveInBackground = true;
      activePlayer.volume = 1.0;
      logDebug('Player configured');
    } catch (e) { logError('Player config error', e); }
  }, [activePlayer]);

  useEffect(() => {
    if (subtitlesParam) {
      try {
        const parsed = typeof subtitlesParam === 'string' ? JSON.parse(subtitlesParam) : subtitlesParam;
        if (Array.isArray(parsed) && parsed.length > 0) {
          logInfo('📝 Found subtitles:', parsed.length);
          setSubtitleTracks(parsed);
          const autoSelect = parsed.find((s: any) => s.lang === 'en') || parsed[0];
          setSelectedSubtitleTrack(autoSelect);
          logInfo('📝 Auto-selected subtitle:', autoSelect?.lang || 'en');
        }
      } catch (e) { logWarn('Failed to parse subtitles', e); }
    }
  }, [subtitlesParam]);

  const videoControls = useVideoControls(activePlayer);
  const {
    showControls, isPlaying, isMuted, opacityAnim, setShowControls, setIsPlaying,
    setIsSeeking: setIsSeekingForControls, toggleControls, togglePlayPause, toggleMute,
    seekBackward, seekForward, startControlsTimer, cleanup: cleanupControls,
  } = videoControls;

  const brightness = useBrightness(showControls);
  const { brightnessLevel, hasBrightnessPermission, brightnessSliderRef, brightnessPanResponder, handleBrightnessChange } = brightness;

  const volume = useVolume(showControls);
  const { volumeLevel, hasVolumePermission, volumeSliderRef, volumePanResponder, handleVolumeChange } = volume;

  const watchProgress = useWatchProgress({
    mediaId: String(mediaId || ''), mediaType: String(mediaType || 'movie'),
    season: season ? Number(season) : undefined, episode: episode ? Number(episode) : undefined,
    title: String(title || ''), episodeTitle: String(episodeTitle || ''),
    poster_path: String(poster_path || ''), isLiveStream: false, isUnmounting,
  });
  const {
    resumeTime, position, duration, lastPositionRef, lastPositionTimeRef,
    manualFinishTriggeredRef, setResumeTime, setPosition, setDuration,
    checkSavedProgress, saveProgress, handleDurationChange, lastSaveTimeRef,
  } = watchProgress;

  const subtitles = useSubtitles(
    String(mediaId || ''), String(mediaType || 'movie'),
    season ? Number(season) : undefined, episode ? Number(episode) : undefined
  );
  const {
    availableLanguages, selectedLanguage, loadingSubtitles, setSubtitlesEnabled,
    loadSubtitlePreference, findSubtitles, selectSubtitle,
    subtitlesEnabled, currentSubtitleText: hookSubtitleText,
    updateCurrentSubtitle, loadTrackSubtitle, loadLocalSubtitle, localSubtitleName,
  } = subtitles;

  // Loads a licensed-backend-supplied subtitle track (from subtitlesParam,
  // parsed into subtitleTracks above) through the same real parsing/timing
  // pipeline useSubtitles already drives for OpenSubtitles/local files —
  // this previously just fetched the file and set a permanent placeholder
  // string instead of ever showing real timed subtitle text.
  const loadSubtitleContent = useCallback(async (subtitle: any) => {
    if (!subtitle?.file) return;
    const result = await loadTrackSubtitle(subtitle.file, subtitle.label || subtitle.lang);
    if (!result.success) {
      logError('Failed to load subtitle track', result.error);
    }
  }, [loadTrackSubtitle]);

  useEffect(() => {
    if (selectedSubtitleTrack) loadSubtitleContent(selectedSubtitleTrack);
  }, [selectedSubtitleTrack, loadSubtitleContent]);

  // Lets the user pick a .srt file already on their device (their own
  // downloaded subtitles) instead of relying only on OpenSubtitles search
  // or whatever the licensed backend happens to supply.
  const handleImportLocalSubtitle = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/plain', 'application/x-subrip', '*/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const outcome = await loadLocalSubtitle(asset.uri, asset.name);
      if (!outcome.success) {
        Alert.alert('Subtitle import failed', outcome.error || 'Could not read that file.');
      }
    } catch (e) {
      logError('Subtitle import failed', e);
      Alert.alert('Subtitle import failed', 'Something went wrong picking that file.');
    }
  }, [loadLocalSubtitle]);

  const handleReload = useCallback(async () => {
    logInfo('handleReload called', { retryAttempts: retryAttempts + 1 });
    if (buffering.bufferingTimeoutRef.current) {
      clearTimeout(buffering.bufferingTimeoutRef.current);
      buffering.bufferingTimeoutRef.current = null;
    }
    if (activePlayer) {
      try { if (activePlayer.isPlaying) await activePlayer.pause(); }
      catch (e) { logWarn('Error pausing player on reload', e); }
    }
    buffering.setShowBufferingAlert(false);
    autoPlay.reset();
    setError(null);
    setLoading(true);
    setIsInitialLoading(true);
    setResumeTime(0); setPosition(0); setDuration(0);
    lastPositionRef.current = 0; lastPositionTimeRef.current = 0;
    manualFinishTriggeredRef.current = false; pendingPlayRef.current = false;
    resumeTimeRef.current = 0; lastSetSourceRef.current = null;
    hasConfiguredPlayerRef.current = false; playerReadyRef.current = false;
    trackEndHandledRef.current = false; setPlayerReady(false);
    // ── NEW: release the load guard and re-probe header strategies fresh
    isLoadingStreamRef.current = false;
    isStrategyLoopActiveRef.current = false;
    headerStrategyIndexRef.current = 0;
    setRetryAttempts((prev) => prev + 1);
  }, [activePlayer, retryAttempts]);

  const buffering = useBuffering(handleReload, contentId);
  const {
    isBufferingVideo, showBufferingAlert, setIsBufferingVideo, setShowBufferingAlert,
    startBufferingTimer, clearBufferingTimer, handleKeepBuffering, handleRetryExtraction,
  } = buffering;

  const handleGoBack = useCallback((isEndOfSeries = false) => {
    logInfo('handleGoBack called', { isEndOfSeries, isUnmounting });
    if (isUnmounting) return;
    setIsUnmounting(true);
    try {
      if (isNativeMode && !isEndOfSeries) {
        try { saveProgress(lastPositionRef.current); }
        catch (saveErr) { logWarn('Save progress error on go back', saveErr); }
      }
      if (activePlayer) { try { activePlayer.pause(); } catch (e) {} }
      ScreenOrientation.unlockAsync()
        .catch((e) => logWarn('Failed to unlock orientation', e))
        .finally(() => {
          const r = routerRef.current;
          if (!r) return;
          setTimeout(() => {
            try {
              if (isLive === 'true') r.replace('/(tabs)');
              else r.replace({ pathname: `/movie/${mediaId}`, params: { mediaType: String(mediaType || 'movie'), title: String(title || ''), poster_path: String(poster_path || '') } });
            } catch (e) {
              logError('Navigation error', e);
              try { if (r.canGoBack()) r.back(); else r.replace('/(tabs)'); } catch (e2) {}
            }
          }, 100);
        });
    } catch (e) {
      logError('Error in handleGoBack', e);
      try { if (routerRef.current?.canGoBack()) routerRef.current.back(); else routerRef.current?.replace('/(tabs)'); } catch (e2) {}
    }
  }, [isUnmounting, activePlayer, mediaId, mediaType, title, poster_path, saveProgress, isNativeMode, isLive]);

  const autoPlay = useAutoPlay({
    mediaId: String(mediaId || ''), mediaType: String(mediaType || 'movie'),
    season: season ? Number(season) : undefined, episode: episode ? Number(episode) : undefined,
    title: String(title || ''), poster_path: String(poster_path || ''),
    position, duration, isLiveStream: false, player: activePlayer, navigation,
    handleGoBack, setIsUnmounting,
  });
  const {
    autoPlayEnabled, showNextEpisodeButton, nextEpisodeDetailsRef, setAutoPlayEnabled,
    loadAutoPlaySetting, findNextEpisode, playNextEpisode,
  } = autoPlay;

  const playback = useLicensedPlaybackSource({
    mediaId: String(mediaId || ''), mediaType: String(mediaType || 'movie'),
    season: season ? Number(season) : undefined, episode: episode ? Number(episode) : undefined,
    isOffline: isOffline === 'true', offlineFilePath: String(offlineFilePath || ''),
    directStreamUrl: isNativeMode ? directStreamUrl : null,
  });
  const { videoUrl, isResolved: streamExtractionComplete, isLoading: isChangingSource, error: playbackError } = playback;
  const currentPlayingSourceName = 'licensed';
  const isLiveStream = false;

  useEffect(() => {
    if (playbackError) setError({ message: playbackError });
  }, [playbackError]);

  const seekBar = useSeekBar({
    player: activePlayer, duration, position, isPlaying, showControls,
    setPosition, setShowControls, setIsSeekingForControls, manualFinishTriggeredRef,
    lastPositionRef, lastPositionTimeRef,
  });
  const {
    isSeeking, seekPreviewPosition, seekPreviewXPosition, progressBarRef, progressPanResponder,
    beginExternalSeek, previewExternalSeek, commitExternalSeek, cancelExternalSeek,
  } = seekBar;

  const gestures = useGestures({
    player: activePlayer, isLiveStream, isPlaying, toggleControls, startControlsTimer,
    duration, position,
    beginExternalSeek, previewExternalSeek, commitExternalSeek, cancelExternalSeek,
    handleBrightnessChange, brightnessLevel,
    handleVolumeChange, volumeLevel,
  });
  const {
    isZoomed, screenDimensions, animatedScale, leftSeekAmount, rightSeekAmount,
    leftSeekOpacity, rightSeekOpacity, leftArrowTranslate, rightArrowTranslate,
    videoAreaGestures, onLayoutRootView, cleanup: cleanupGestures,
  } = gestures;

  const episodeNav = useEpisodeNavigation({
    mediaId: String(mediaId || ''), mediaType: String(mediaType || 'movie'),
    season: season ? Number(season) : undefined, episode: episode ? Number(episode) : undefined,
    player: activePlayer, isPlaying, setShowControls,
  });
  const {
    showEpisodesModal, allSeasonsData, selectedSeasonForModal, episodesForModal,
    isLoadingModalEpisodes, seasonListModalRef, episodeListModalRef,
    setShowEpisodesModal, toggleEpisodesModal, handleSelectSeasonForModal,
  } = episodeNav;

  useEffect(() => {
    if (!activePlayer) return;
    let statusListener: any = null;
    try {
      statusListener = activePlayer.addListener('statusChange', ({ status, error }: any) => {
        logDebug('Player statusChange', { status, error: error?.message });
        if (status === 'readyToPlay') {
          setPlayerReady(true); playerReadyRef.current = true;
          setLoading(false); setIsInitialLoading(false);
          logInfo('🎬 Player ready - decoding movie');
        } else if (status === 'error') {
          // If the strategy loop is running, let IT handle this — it will
          // try the next header strategy instead of surfacing a failure.
          if (isStrategyLoopActiveRef.current) {
            logWarn('Player error during strategy loop — suppressing, loop will try next strategy');
            return;
          }
          const errorMsg = error?.message || '';
          logError('Player error', errorMsg);
          if (errorMsg.includes('#EXTM3U') || errorMsg.includes('Source error') || errorMsg.includes('does not start with')) {
            logError('HLS stream invalid - server returned HTML or binary instead of playlist');
            setError({
              message: 'The video stream is not accessible.\n\nThis may be because:\n• The stream URL has expired\n• The server is blocking the request\n• The video is not available in your region\n\nPlease try again or use a different source.',
              isStreamError: true, details: errorMsg,
            });
          } else {
            setError({ message: 'Playback error: ' + (errorMsg || 'Unknown error'), details: errorMsg });
          }
          setLoading(false); setIsInitialLoading(false);
        }
      });
    } catch (e) { logError('Failed to add player listener', e); }
    return () => { try { statusListener?.remove?.(); } catch {} };
  }, [activePlayer]);

  useEffect(() => {
    if (!activePlayer) return;
    let playingListener: any = null;
    try {
      playingListener = activePlayer.addListener('playingChange', ({ isPlaying: isPlayingEvent }: any) => {
        logDebug('Player playingChange', { isPlaying: isPlayingEvent });
        if (!isPlayingEvent && !trackEndHandledRef.current) {
          const pos = activePlayer.currentTime || 0;
          const dur = activePlayer.duration || 0;
          if (pos >= dur - 1 && dur > 0) {
            logInfo('Player reached end, skipping to next');
            trackEndHandledRef.current = true;
            handleSkipToNext();
          }
        }
      });
    } catch (e) { logError('Failed to add playingChange listener', e); }
    return () => { try { playingListener?.remove?.(); } catch {} };
  }, [activePlayer]);

  const handleSkipToNext = useCallback(() => {
    if (showNextEpisodeButton && autoPlayEnabled) playNextEpisode();
    else if (!showNextEpisodeButton && autoPlayEnabled && mediaType === 'tv') {
      findNextEpisode().then(() => {
        setTimeout(() => {
          if (nextEpisodeDetailsRef.current) playNextEpisode();
          else handleGoBack(true);
        }, 100);
      });
    } else if (autoPlayEnabled && mediaType === 'movie') handleGoBack(true);
  }, [showNextEpisodeButton, autoPlayEnabled, mediaType, playNextEpisode, findNextEpisode, nextEpisodeDetailsRef, handleGoBack]);

  // ─────────────────────────────────────────────────────────────────────
  // NATIVE STREAM LOADING — VLC-style: guarded against re-entry, and
  // escalates through header strategies until one actually plays.
  // ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const activeStreamUrl = directStreamUrl || videoUrl;
    if (!isNativeMode || !activeStreamUrl) return;
    if (!activePlayer) { logWarn('Player not available for stream loading'); return; }

    const loadStream = async () => {
      // Synchronous ref guard — closes the race window that React state
      // (isLoadingStream) can't close because state updates are async.
      if (isLoadingStreamRef.current) {
        logDebug('⏭️ Load already in progress, ignoring duplicate trigger');
        return;
      }
      isLoadingStreamRef.current = true;
      isStrategyLoopActiveRef.current = true;
      setIsLoadingStream(true);

      let lastErrorMessage: string | null = null;
      let succeeded = false;

      // Start from whichever strategy last worked (0 by default / after reload).
      for (let attempt = headerStrategyIndexRef.current; attempt < HEADER_STRATEGIES.length; attempt++) {
        if (!isMountedRef.current) break;

        try {
          logInfo(`🎬 Loading stream — header strategy ${attempt}/${HEADER_STRATEGIES.length - 1}`);
          setPlayerReady(false);
          playerReadyRef.current = false;

          const headers = getStreamHeaders(activeStreamUrl, attempt);
          await activePlayer.replaceAsync({
            uri: activeStreamUrl,
            headers: Object.keys(headers).length > 0 ? headers : undefined,
          });

          const ready = await new Promise<boolean>((resolve) => {
            const pollStart = Date.now();
            const poll = () => {
              if (!isMountedRef.current) { resolve(false); return; }
              if (activePlayer.status === 'readyToPlay') { resolve(true); return; }
              if (activePlayer.status === 'error') { resolve(false); return; }
              if (Date.now() - pollStart >= 8000) { resolve(false); return; }
              setTimeout(poll, 200);
            };
            poll();
          });

          if (!isMountedRef.current) break;

          if (!ready) {
            logWarn(`Header strategy ${attempt} did not reach readyToPlay in time, trying next`);
            continue;
          }

          // This strategy worked — remember it and start playback.
          headerStrategyIndexRef.current = attempt;
          setPlayerReady(true); playerReadyRef.current = true;
          logInfo(`✅ Stream loaded with header strategy ${attempt} — movie decoded`);

          await activePlayer.play();
          pendingPlayRef.current = false;
          setLoading(false); setIsInitialLoading(false);
          logInfo('▶️ Playback started');

          succeeded = true;
          lastErrorMessage = null;
          break;
        } catch (e: any) {
          lastErrorMessage = e?.message || 'Unknown error';
          logWarn(`Header strategy ${attempt} threw`, lastErrorMessage);
          continue;
        }
      }

      if (isMountedRef.current && !succeeded) {
        logError('All header strategies exhausted — stream could not be loaded', lastErrorMessage);
        setError({
          message: 'Failed to load stream after trying multiple connection methods.\n\nThis may be because:\n• The stream URL has expired\n• The server is blocking every request pattern we tried\n• The video is not available in your region\n\nPlease try again or use a different source.',
          details: lastErrorMessage, isStreamError: true,
        });
        setLoading(false); setIsInitialLoading(false);
      }

      isLoadingStreamRef.current = false;
      isStrategyLoopActiveRef.current = false;
      setIsLoadingStream(false);
    };

    loadStream();
  }, [isNativeMode, directStreamUrl, videoUrl, activePlayer]);

  useEffect(() => {
    if (!isNativeMode || !playerReadyRef.current) return;
    let interval: ReturnType<typeof setInterval> | null = null;
    if (playerReadyRef.current && activePlayer) {
      interval = setInterval(() => {
        try {
          const pos = activePlayer.currentTime || 0;
          const dur = activePlayer.duration || 0;
          setPosition(pos);
          if (dur > 0) setDuration(dur);
          updateCurrentSubtitle(pos);
        } catch {}
      }, 250);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isNativeMode, playerReadyRef.current, updateCurrentSubtitle]);

  useEffect(() => {
    if (!isNativeMode) return;
    if (activePlayer && (directStreamUrl || videoUrl || offlineFilePath)) {
      activePlayer.timeUpdateEventInterval = 1;
    }
  }, [activePlayer, videoUrl, directStreamUrl, isNativeMode, offlineFilePath]);

  useEffect(() => { resumeTimeRef.current = resumeTime; }, [resumeTime]);

  useEffect(() => {
    if (!activePlayer || !isNativeMode || isUnmounting) return;
    if (!directStreamUrl && !videoUrl && !offlineFilePath) return;
    pendingPlayRef.current = true; setLoading(true); logDebug('Pending play set');
  }, [activePlayer, videoUrl, directStreamUrl, isNativeMode, isUnmounting, offlineFilePath]);

  useEffect(() => {
    logInfo('🔄 Mounting VideoPlayerScreen', {
      mediaId, mediaType, mode: playerMode, hasUrl: !!directStreamUrl, platform: Platform.OS,
    });
    isMountedRef.current = true; setIsUnmounting(false);
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch((e) => logError('Failed to lock orientation', e));

    if (isNativeMode) {
      if (directStreamUrl || offlineFilePath) {
        logDebug('Using direct stream, skipping extraction');
        setLoading(false); setIsInitialLoading(false);
      } else {
        logDebug('Resolving licensed playback source...');
      }
    } else {
      if (directStreamUrl || videoUrl) { logDebug('Offline mode, setting loading false'); setLoading(false); setIsInitialLoading(false); }
    }
    setShowControls(true);

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      logDebug('Hardware back press'); handleGoBack(); return true;
    });

    return () => {
      logInfo('🔄 Unmounting VideoPlayerScreen');
      isMountedRef.current = false; setIsUnmounting(true);
      try {
        if (isNativeMode) { try { saveProgress(lastPositionRef.current); } catch (e) {} }
        if (activePlayer && typeof activePlayer.pause === 'function') { try { activePlayer.pause(); } catch (e) {} }
        backHandler.remove(); cleanupControls(); cleanupGestures(); clearBufferingTimer();
      } catch (e) { logError('Cleanup error', e); }
    };
  }, []);

  useEffect(() => {
    if (error && error.isLiveStreamError) {
      logWarn('Live stream ended error', error);
      Alert.alert('Live Stream Ended', 'The live stream has ended or is no longer available.', [
        { text: 'OK', onPress: () => handleGoBack() },
      ]);
    }
  }, [error, handleGoBack]);

  useEffect(() => {
    const loadPref = async () => { try { await loadSubtitlePreference(); } catch (e) {} };
    loadPref();
  }, [loadSubtitlePreference]);

  useEffect(() => {
    // findSubtitles was previously imported but never called, so the
    // OpenSubtitles language list was always empty. Only run it if the
    // licensed backend hasn't already supplied its own subtitle track(s)
    // for this title (subtitleTracks, populated below from subtitlesParam).
    if (mediaId && subtitleTracks.length === 0) {
      findSubtitles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaId]);

  useEffect(() => {
    if (isPlaying && isBufferingVideo) {
      setIsBufferingVideo(false);
      if (loading && !isInitialLoading) setLoading(false);
    }
  }, [isPlaying, isBufferingVideo, loading, isInitialLoading]);

  useEventListener(activePlayer, 'playToEnd', () => {
    logDebug('📢 playToEnd event');
    if (!isNativeMode) return;
    handleSkipToNext();
  });

  useEventListener(activePlayer, 'error', (playerError) => {
    if (!isNativeMode || isUnmounting) return;

    // Same guard as statusChange — the strategy loop handles its own
    // errors by moving to the next header strategy.
    if (isStrategyLoopActiveRef.current) {
      logWarn('Error event during strategy loop — suppressing');
      return;
    }

    const errorMsg = playerError?.message || 'Unknown error';
    logError('❌ Video playback error event', null, { message: errorMsg, platform: Platform.OS });

    const isMkvError = errorMsg.toLowerCase().includes('mkv') || errorMsg.toLowerCase().includes('matroska') ||
                       errorMsg.toLowerCase().includes('container') || errorMsg.toLowerCase().includes('unsupported format');
    if (isMkvError && Platform.OS === 'android') {
      logError('🚫 MKV format may not be supported');
      setError({ message: 'MKV format may not be fully supported on this device.\n\nSome Android devices have limited Matroska (.mkv) support.\n\nPlease try a different source or download the video.', isFormatError: true, details: errorMsg });
      setLoading(false); setIsInitialLoading(false); return;
    }

    if (errorMsg.toLowerCase().includes('network') || errorMsg.toLowerCase().includes('connection') || errorMsg.toLowerCase().includes('timeout')) {
      logError('Network error detected');
      setError({ message: 'Network error while loading the video.\n\nPlease check your internet connection and try again.', isNetworkError: true, details: errorMsg });
      setLoading(false); setIsInitialLoading(false); return;
    }

    try {
      setError({ message: `Video playback error: ${errorMsg}`, details: errorMsg });
      setLoading(false); setIsInitialLoading(false);
    } catch (e) { logError('Failed to set error state', e); }
  });

  const toggleSubtitlesModal = async () => {
    if (!isNativeMode) return;
    if (!showSubtitlesModal) {
      if (activePlayer && isPlaying) { try { activePlayer.pause(); } catch (e) {} }
      try {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (e) {}
      setShowSubtitlesModal(true);
    } else {
      setShowSubtitlesModal(false);
      try { await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE); } catch (e) {}
    }
    setShowControls(true);
  };

  const renderNativePlayer = () => {
    const hasSource = !!(videoUrl || directStreamUrl || offlineFilePath);
    logDebug('Rendering Native Player', { hasSource, playerReady: playerReadyRef.current, url: directStreamUrl?.substring(0, 80), isPlaying });
    if (!hasSource) {
      return (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#ff4444" />
          <Text style={styles.errorText}>No video stream available</Text>
          <TouchableOpacity style={styles.backButtonTorrent} onPress={() => handleGoBack()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <>
        <GestureDetector gesture={videoAreaGestures}>
          <Animated.View style={[styles.video, { transform: [{ scale: animatedScale }] }]}>
            <VideoView
              player={activePlayer} style={StyleSheet.absoluteFill}
              nativeControls={false} allowsPictureInPicture={true}
              startsPictureInPictureAutomatically={true}
              contentFit={isZoomed ? 'cover' : 'contain'}
              pointerEvents="none"
            />
          </Animated.View>
        </GestureDetector>
        {(!playerReadyRef.current || isLoadingStream) && (
          <View style={styles.videoLoadingOverlay}>
            <ActivityIndicator size="large" color="#e8a838" />
            <Text style={styles.videoLoadingText}>Decoding movie...</Text>
          </View>
        )}
      </>
    );
  };

  return (
    <GestureHandlerRootView style={styles.gestureHandlerRoot}>
      <View style={styles.container} onLayout={onLayoutRootView}>
        <StatusBar hidden />

        {isNativeMode && (
          <LoadingOverlay
            isInitialLoading={isInitialLoading || isLoadingStream}
            manualWebViewVisible={false}
            streamExtractionComplete={streamExtractionComplete && playerReadyRef.current}
            currentAttemptingSource={currentPlayingSourceName}
            onGoBack={() => handleGoBack()}
            onCaptchaDone={() => {}}
          />
        )}

        <ErrorOverlay error={error} onRetry={handleReload} onGoBack={() => handleGoBack()} />

        {isNativeMode && renderNativePlayer()}
        {isOfflineMode && renderNativePlayer()}

        {isNativeMode && (
          <>
            <SeekIndicators
              isLiveStream={isLiveStream} leftSeekAmount={leftSeekAmount} rightSeekAmount={rightSeekAmount}
              leftSeekOpacity={leftSeekOpacity} rightSeekOpacity={rightSeekOpacity}
              leftArrowTranslate={leftArrowTranslate} rightArrowTranslate={rightArrowTranslate}
            />
            <SubtitleOverlay subtitlesEnabled={subtitlesEnabled} currentSubtitleText={hookSubtitleText} />
            {isBufferingVideo && !isInitialLoading && (
              <View style={styles.bufferingIndicatorContainer}>
                <ActivityIndicator size="large" color="#FFF" />
              </View>
            )}
            <VideoControlsOverlay
              showControls={showControls} opacityAnim={opacityAnim} isPlaying={isPlaying}
              isMuted={isMuted} isLiveStream={isLiveStream} title={String(title || '')}
              episodeTitle={String(episodeTitle || '')} mediaType={String(mediaType || 'movie')}
              season={season ? Number(season) : undefined} episode={episode ? Number(episode) : undefined}
              position={position} duration={duration} isSeeking={isSeeking}
              seekPreviewPosition={seekPreviewPosition} isAtLiveEdge={isAtLiveEdge}
              progressBarRef={progressBarRef} progressPanResponder={progressPanResponder}
              onGoBack={() => handleGoBack()}
              onTogglePlayPause={() => { if (isPlaying) activePlayer.pause(); else activePlayer.play(); }}
              onToggleMute={toggleMute} onSeekBackward={seekBackward} onSeekForward={seekForward}
              onToggleEpisodes={toggleEpisodesModal} onToggleSubtitles={toggleSubtitlesModal}
              subtitlesEnabled={subtitlesEnabled} selectedLanguage={selectedLanguage || 'en'}
              isChangingSource={isChangingSource} isInitialLoading={isInitialLoading}
              videoUrl={directStreamUrl || videoUrl || ''} player={activePlayer}
              brightnessLevel={brightnessLevel} hasBrightnessPermission={hasBrightnessPermission}
              brightnessSliderRef={brightnessSliderRef} brightnessPanResponder={brightnessPanResponder}
              volumeLevel={volumeLevel} hasVolumePermission={hasVolumePermission}
              volumeSliderRef={volumeSliderRef} volumePanResponder={volumePanResponder}
            />
            {!isLiveStream && isSeeking && seekPreviewPosition !== null && seekPreviewXPosition > 0 && (
              <View style={[styles.seekPreviewBox, { left: Math.max(10, Math.min(seekPreviewXPosition - 40, screenDimensions.width - 90)) }]}>
                <Text style={styles.seekPreviewText}>{formatTime(seekPreviewPosition)}</Text>
              </View>
            )}
            <NextEpisodeButton
              showNextEpisodeButton={showNextEpisodeButton}
              nextEpisodeDetails={nextEpisodeDetailsRef.current}
              position={position} duration={duration} opacityAnim={opacityAnim}
              onPress={() => { trackEndHandledRef.current = false; handleSkipToNext(); }}
            />
            {mediaType === 'tv' && (
              <EpisodesModal
                visible={showEpisodesModal} onClose={() => setShowEpisodesModal(false)}
                title={String(title || '')} allSeasonsData={allSeasonsData}
                selectedSeasonForModal={selectedSeasonForModal} episodesForModal={episodesForModal}
                isLoadingModalEpisodes={isLoadingModalEpisodes}
                currentSeason={season ? Number(season) : undefined}
                currentEpisode={episode ? Number(episode) : undefined}
                onSelectSeason={handleSelectSeasonForModal}
                onSelectEpisode={(episodeDetails) => {
                  setIsUnmounting(true);
                  if (activePlayer) activePlayer.pause();
                  const queryParams = new URLSearchParams({
                    mediaType: 'tv', title: encodeURIComponent(String(title || '')),
                    poster_path: encodeURIComponent(String(poster_path || '')),
                    season: String(episodeDetails.season || season || 1),
                    episode: String(episodeDetails.episode || episode || 1),
                    episodeTitle: encodeURIComponent(episodeDetails.episodeTitle || `Episode ${episodeDetails.episode || episode || 1}`),
                    subtitles: encodeURIComponent(JSON.stringify(subtitleTracks)),
                  });
                  routerRef.current?.push(`/player?${queryParams.toString()}`);
                }}
                seasonListRef={seasonListModalRef} episodeListRef={episodeListModalRef}
                mediaId={String(mediaId || '')} poster_path={String(poster_path || '')}
              />
            )}
            <BufferingAlertModal
              visible={showBufferingAlert} onKeepBuffering={handleKeepBuffering}
              onRetryExtraction={handleRetryExtraction}
            />
            <SubtitlesModal
              visible={showSubtitlesModal}
              onClose={() => {
                setShowSubtitlesModal(false);
                ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch((e) =>
                  logError('Failed to re-lock to LANDSCAPE on SubtitlesModal direct close', e)
                );
              }}
              availableLanguages={[
                ...Object.values(availableLanguages || {}).map((langInfo: any) => ({ code: langInfo.language, name: getLanguageName(langInfo.language) })),
                ...subtitleTracks.map((track) => ({ code: track.lang || 'en', name: track.label || track.lang || 'English' })),
                ...(localSubtitleName ? [{ code: selectedLanguage, name: `📁 ${localSubtitleName}` }] : []),
                { code: '__import_local__', name: '📁 Import subtitle from device…' },
              ]}
              selectedLanguage={selectedLanguage || 'en'}
              onSelectLanguage={(langCode) => {
                if (langCode === '__import_local__') {
                  handleImportLocalSubtitle();
                  return;
                }
                const track = subtitleTracks.find((t: any) => (t.lang || 'en') === langCode);
                if (track) {
                  setSelectedSubtitleTrack(track);
                  loadSubtitleContent(track);
                } else if (!langCode.startsWith('local:')) {
                  selectSubtitle(langCode);
                }
                setShowSubtitlesModal(false);
              }}
              loading={loadingSubtitles}
            />
          </>
        )}
      </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  gestureHandlerRoot: { flex: 1 },
  container: { flex: 1, backgroundColor: '#000' },
  video: { flex: 1, backgroundColor: '#000' },
  videoLoadingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)',
  },
  videoLoadingText: { color: '#fff', fontSize: 14, marginTop: 12, opacity: 0.8 },
  hiddenWebView: {
    position: 'absolute', width: 1, height: 1, opacity: 0, zIndex: -1, top: -1000, left: -1000,
  },
  visibleWebViewForCaptcha: {
    position: 'absolute', bottom: 20, left: 20, right: 20, height: '40%',
    backgroundColor: 'white', zIndex: 100, borderWidth: 1, borderColor: '#ccc',
  },
  bufferingIndicatorContainer: {
    position: 'absolute', top: '50%', left: '50%',
    transform: [{ translateX: -18 }, { translateY: -18 }], zIndex: 4,
  },
  seekPreviewBox: {
    position: 'absolute', bottom: 70, backgroundColor: 'rgba(0, 0, 0, 0.85)',
    paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, zIndex: 100,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5, shadowRadius: 4, elevation: 5,
  },
  seekPreviewText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  torrentContainer: { flex: 1, backgroundColor: '#000', position: 'relative' },
  embedContainer: { flex: 1, backgroundColor: '#000', position: 'relative' },
  webview: { flex: 1, backgroundColor: '#000' },
  torrentBackButton: {
    position: 'absolute', top: 40, left: 20, zIndex: 100,
    width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  embedBackButton: {
    position: 'absolute', top: 40, left: 20, zIndex: 100,
    width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  loadingContainer: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center', backgroundColor: '#000',
  },
  loadingText: { color: '#fff', fontSize: 14, marginTop: 12, opacity: 0.8 },
  errorContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#000', padding: 20,
  },
  errorText: { color: '#fff', fontSize: 16, marginBottom: 10, marginTop: 10 },
  backButtonTorrent: {
    paddingVertical: 12, paddingHorizontal: 30,
    backgroundColor: '#e8a838', borderRadius: 8,
  },
  backButtonText: { color: '#000', fontSize: 14, fontWeight: 'bold' },
});

export default VideoPlayerScreen;