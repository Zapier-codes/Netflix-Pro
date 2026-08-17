import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Animated, Easing, Dimensions } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

export const useGestures = ({
  player,
  isLiveStream,
  isPlaying,
  toggleControls,
  startControlsTimer,
  duration,
  position,
  beginExternalSeek,
  previewExternalSeek,
  commitExternalSeek,
  cancelExternalSeek,
  handleBrightnessChange,
  brightnessLevel,
  handleVolumeChange,
  volumeLevel,
}) => {
  const [isZoomed, setIsZoomed] = useState(false);
  const [screenDimensions, setScreenDimensions] = useState(Dimensions.get('window'));
  const animatedScale = useRef(new Animated.Value(1)).current;

  const [leftSeekAmount, setLeftSeekAmount] = useState(0);
  const [rightSeekAmount, setRightSeekAmount] = useState(0);
  const leftSeekOpacity = useRef(new Animated.Value(0)).current;
  const rightSeekOpacity = useRef(new Animated.Value(0)).current;
  const leftArrowTranslate = useRef(new Animated.Value(0)).current;
  const rightArrowTranslate = useRef(new Animated.Value(0)).current;
  const leftSeekTimeoutRef = useRef(null);
  const rightSeekTimeoutRef = useRef(null);
  const pendingSeekAmount = useRef(0);
  const seekDebounceTimeout = useRef(null);
  const wasPlayingBeforeDoubleTapSeek = useRef(false);
  const pinchScale = useRef(1);

  const onLayoutRootView = useCallback((event) => {
    const { width, height } = event.nativeEvent.layout;
    if (screenDimensions.width !== width || screenDimensions.height !== height) {
      setScreenDimensions({ width, height });
    }
  }, [screenDimensions]);

  useEffect(() => {
    const targetScaleValue = 1.0;
    Animated.timing(animatedScale, {
      toValue: targetScaleValue,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [isZoomed, animatedScale]);

  const handleDoubleTapLeft = useCallback(() => {
    if (player && !isLiveStream) {
      let seekAmount = leftSeekAmount <= -60 ? -30 : -10;

      const newPendingAmount = Math.max(pendingSeekAmount.current + seekAmount, -300);
      pendingSeekAmount.current = newPendingAmount;

      if (leftSeekTimeoutRef.current) {
        clearTimeout(leftSeekTimeoutRef.current);
      }
      if (seekDebounceTimeout.current) {
        clearTimeout(seekDebounceTimeout.current);
      }

      if (pendingSeekAmount.current === seekAmount) {
        wasPlayingBeforeDoubleTapSeek.current = isPlaying;
        if (isPlaying) {
          player.pause();
        }
      }

      setLeftSeekAmount(prev => Math.max(prev + seekAmount, -300));

      leftArrowTranslate.setValue(0);

      Animated.parallel([
        Animated.timing(leftSeekOpacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(leftArrowTranslate, {
          toValue: -10,
          duration: 100,
          useNativeDriver: true,
        })
      ]).start();

      seekDebounceTimeout.current = setTimeout(() => {
        player.seekBy(pendingSeekAmount.current);
        pendingSeekAmount.current = 0;

        //if (wasPlayingBeforeDoubleTapSeek.current) {
          player.play();
        //}
      }, 200);

      leftSeekTimeoutRef.current = setTimeout(() => {
        Animated.timing(leftSeekOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          setLeftSeekAmount(0);
          leftArrowTranslate.setValue(0);
        });
      }, 1000);
    }
  }, [player, isLiveStream, leftSeekOpacity, leftArrowTranslate, leftSeekAmount, isPlaying]);

  const handleDoubleTapRight = useCallback(() => {
    if (player && !isLiveStream) {
      let seekAmount = rightSeekAmount >= 60 ? 30 : 10;

      const newPendingAmount = Math.min(pendingSeekAmount.current + seekAmount, 300);
      pendingSeekAmount.current = newPendingAmount;

      if (rightSeekTimeoutRef.current) {
        clearTimeout(rightSeekTimeoutRef.current);
      }
      if (seekDebounceTimeout.current) {
        clearTimeout(seekDebounceTimeout.current);
      }

      if (pendingSeekAmount.current === seekAmount) {
        wasPlayingBeforeDoubleTapSeek.current = isPlaying;
        if (isPlaying) {
          player.pause();
        }
      }

      setRightSeekAmount(prev => Math.min(prev + seekAmount, 300));

      rightArrowTranslate.setValue(0);

      Animated.parallel([
        Animated.timing(rightSeekOpacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(rightArrowTranslate, {
          toValue: 10,
          duration: 100,
          useNativeDriver: true,
        })
      ]).start();

      seekDebounceTimeout.current = setTimeout(() => {
        player.seekBy(pendingSeekAmount.current);
        pendingSeekAmount.current = 0;

        //if (wasPlayingBeforeDoubleTapSeek.current) {
          player.play();
        //}
      }, 200);

      rightSeekTimeoutRef.current = setTimeout(() => {
        Animated.timing(rightSeekOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          setRightSeekAmount(0);
          rightArrowTranslate.setValue(0);
        });
      }, 1000);
    }
  }, [player, isLiveStream, rightSeekOpacity, rightArrowTranslate, rightSeekAmount, isPlaying]);

  const doubleTapSeek = useMemo(() => Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(250)
    .maxDistance(100)
    .onEnd((event, success) => {
      'worklet';
      if (success) {
        const screenWidth = screenDimensions.width;
        const tapX = event.x;

        if (tapX < screenWidth * 0.3) {
          runOnJS(handleDoubleTapLeft)();
        } else if (tapX > screenWidth * 0.7) {
          runOnJS(handleDoubleTapRight)();
        }
      }
    }), [handleDoubleTapLeft, handleDoubleTapRight, screenDimensions.width]);

  const tapToToggleControls = useMemo(() => Gesture.Tap()
    .numberOfTaps(1)
    .maxDuration(250)
    .onEnd((_event, success) => {
      'worklet';
      if (success) {
        runOnJS(toggleControls)();
      }
    }), [toggleControls]);

  const pinchToZoom = useMemo(() => Gesture.Pinch()
    .onStart(() => {
      'worklet';
      pinchScale.current = 1;
    })
    .onUpdate((event) => {
      'worklet';
      pinchScale.current = event.scale;
    })
    .onEnd(() => {
      'worklet';
      const finalScale = pinchScale.current;

      if (finalScale > 1.1) {
        runOnJS(setIsZoomed)(true);
      } else if (finalScale < 0.9) {
        runOnJS(setIsZoomed)(false);
      }

      runOnJS(startControlsTimer)();
      pinchScale.current = 1;
    }), [startControlsTimer]);

  // --- Unified drag: horizontal = seek, vertical-left = brightness,
  // vertical-right = volume. One responder so the three don't fight over
  // the same touch (per Phase 1 scope in HANDOVER.md).
  const dragModeRef = useRef(null); // 'seek' | 'brightness' | 'volume' | null
  const dragStartPositionRef = useRef(0);
  const dragStartLevelRef = useRef(0);

  const handleDragBegin = useCallback((x, screenWidth) => {
    dragModeRef.current = null;
    dragStartPositionRef.current = position || 0;
    // Snapshot whichever side of the screen the touch started on, since
    // brightness/volume are picked by starting x, not current x.
    dragStartLevelRef.current = x < screenWidth / 2 ? brightnessLevel : volumeLevel;
  }, [position, brightnessLevel, volumeLevel]);

  const handleDragUpdate = useCallback((x, screenWidth, translationX, translationY) => {
    if (dragModeRef.current === null) {
      const absX = Math.abs(translationX);
      const absY = Math.abs(translationY);
      if (Math.max(absX, absY) < 12) return; // ignore jitter before a direction is clear
      dragModeRef.current = absX > absY ? 'seek' : (x < screenWidth / 2 ? 'brightness' : 'volume');
      if (dragModeRef.current === 'seek' && !isLiveStream) {
        beginExternalSeek();
      }
    }

    if (dragModeRef.current === 'seek') {
      if (isLiveStream || !duration) return;
      const secondsPerScreenWidth = Math.max(60, duration * 0.5);
      const deltaSeconds = (translationX / screenWidth) * secondsPerScreenWidth;
      const target = Math.max(0, Math.min(duration, dragStartPositionRef.current + deltaSeconds));
      previewExternalSeek(target);
    } else if (dragModeRef.current === 'brightness') {
      const delta = -translationY / 200; // ~200px drag = full 0-1 sweep
      handleBrightnessChange(Math.max(0, Math.min(1, dragStartLevelRef.current + delta)));
    } else if (dragModeRef.current === 'volume') {
      const delta = -translationY / 200;
      handleVolumeChange(Math.max(0, Math.min(1, dragStartLevelRef.current + delta)));
    }
  }, [isLiveStream, duration, beginExternalSeek, previewExternalSeek, handleBrightnessChange, handleVolumeChange]);

  const handleDragEnd = useCallback(() => {
    if (dragModeRef.current === 'seek') {
      commitExternalSeek();
    }
    dragModeRef.current = null;
  }, [commitExternalSeek]);

  const handleDragCancel = useCallback(() => {
    if (dragModeRef.current === 'seek') {
      cancelExternalSeek();
    }
    dragModeRef.current = null;
  }, [cancelExternalSeek]);

  const videoAreaPan = useMemo(() => Gesture.Pan()
    .minDistance(10)
    .maxPointers(1)
    .onBegin((event) => {
      'worklet';
      runOnJS(handleDragBegin)(event.x, screenDimensions.width);
    })
    .onUpdate((event) => {
      'worklet';
      runOnJS(handleDragUpdate)(event.x, screenDimensions.width, event.translationX, event.translationY);
    })
    .onEnd(() => {
      'worklet';
      runOnJS(handleDragEnd)();
    })
    .onFinalize((_event, success) => {
      'worklet';
      if (!success) {
        runOnJS(handleDragCancel)();
      }
    }), [handleDragBegin, handleDragUpdate, handleDragEnd, handleDragCancel, screenDimensions.width]);

  const videoAreaGestures = useMemo(() =>
    Gesture.Race(
      pinchToZoom,
      doubleTapSeek,
      tapToToggleControls,
      videoAreaPan,
    ),
    [pinchToZoom, doubleTapSeek, tapToToggleControls, videoAreaPan]);

  const cleanup = useCallback(() => {
    if (leftSeekTimeoutRef.current) {
      clearTimeout(leftSeekTimeoutRef.current);
      leftSeekTimeoutRef.current = null;
    }
    if (rightSeekTimeoutRef.current) {
      clearTimeout(rightSeekTimeoutRef.current);
      rightSeekTimeoutRef.current = null;
    }
    if (seekDebounceTimeout.current) {
      clearTimeout(seekDebounceTimeout.current);
      seekDebounceTimeout.current = null;
    }
  }, []);

  return {
    isZoomed,
    screenDimensions,
    animatedScale,
    leftSeekAmount,
    rightSeekAmount,
    leftSeekOpacity,
    rightSeekOpacity,
    leftArrowTranslate,
    rightArrowTranslate,
    videoAreaGestures,
    onLayoutRootView,
    setIsZoomed,
    cleanup,
  };
};
