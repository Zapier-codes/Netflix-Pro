// src/hooks/usePlaybackSpeed.ts
import { useState, useCallback, useEffect, useRef } from 'react';
import { savePlaybackSpeedPreference, getPlaybackSpeedPreference } from '../utils/storage';

export const PLAYBACK_SPEEDS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

export const usePlaybackSpeed = (player: any) => {
  const [playbackSpeed, setPlaybackSpeedState] = useState(1.0);
  const [speedModalVisible, setSpeedModalVisible] = useState(false);
  const loadedRef = useRef(false);

  // Load saved preference once on mount, and apply it once the player is ready.
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    getPlaybackSpeedPreference().then((saved) => {
      setPlaybackSpeedState(saved);
    });
  }, []);

  useEffect(() => {
    if (!player) return;
    try {
      player.playbackRate = playbackSpeed;
      // expo-video pitch-corrects by default when available; keep audio
      // pitch natural rather than "chipmunk" at higher speeds.
      if ('preservesPitch' in player) {
        player.preservesPitch = true;
      }
    } catch (e) {
      // Player may not be ready yet — the effect re-runs when it is.
    }
  }, [player, playbackSpeed]);

  const setPlaybackSpeed = useCallback((speed: number) => {
    setPlaybackSpeedState(speed);
    savePlaybackSpeedPreference(speed);
  }, []);

  const cyclePlaybackSpeed = useCallback(() => {
    const idx = PLAYBACK_SPEEDS.indexOf(playbackSpeed);
    const next = PLAYBACK_SPEEDS[(idx + 1) % PLAYBACK_SPEEDS.length];
    setPlaybackSpeed(next);
  }, [playbackSpeed, setPlaybackSpeed]);

  const openSpeedModal = useCallback(() => setSpeedModalVisible(true), []);
  const closeSpeedModal = useCallback(() => setSpeedModalVisible(false), []);

  return {
    playbackSpeed,
    setPlaybackSpeed,
    cyclePlaybackSpeed,
    speedModalVisible,
    openSpeedModal,
    closeSpeedModal,
  };
};
