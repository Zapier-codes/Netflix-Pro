// src/hooks/useScreenLock.ts
//
// MX-Player-style "lock screen" for the video player: while locked, all
// gestures (seek, brightness, volume, tap-to-toggle-controls, pinch-zoom)
// are disabled and only a small unlock button remains visible, so
// accidental touches (e.g. video in a pocket, kids poking the screen)
// can't pause/seek/exit playback.

import { useState, useCallback, useRef, useEffect } from 'react';
import { Animated } from 'react-native';

export const useScreenLock = (onLockChange?: (locked: boolean) => void) => {
  const [isLocked, setIsLocked] = useState(false);
  const [showUnlockHint, setShowUnlockHint] = useState(false);
  const hintOpacity = useRef(new Animated.Value(0)).current;
  const hintTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashUnlockHint = useCallback(() => {
    setShowUnlockHint(true);
    Animated.timing(hintOpacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);
    hintTimeoutRef.current = setTimeout(() => {
      Animated.timing(hintOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setShowUnlockHint(false);
      });
    }, 2000);
  }, [hintOpacity]);

  const lock = useCallback(() => {
    setIsLocked(true);
    onLockChange?.(true);
  }, [onLockChange]);

  const unlock = useCallback(() => {
    setIsLocked(false);
    onLockChange?.(false);
  }, [onLockChange]);

  const toggleLock = useCallback(() => {
    if (isLocked) {
      unlock();
    } else {
      lock();
    }
  }, [isLocked, lock, unlock]);

  // Tapping anywhere while locked should reveal the unlock button briefly
  // rather than doing nothing at all — mirrors MX Player's lock UX.
  const handleLockedScreenTap = useCallback(() => {
    flashUnlockHint();
  }, [flashUnlockHint]);

  useEffect(() => {
    return () => {
      if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);
    };
  }, []);

  return {
    isLocked,
    lock,
    unlock,
    toggleLock,
    showUnlockHint,
    hintOpacity,
    handleLockedScreenTap,
  };
};
