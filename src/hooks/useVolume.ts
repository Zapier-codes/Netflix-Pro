import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { AppState, PanResponder } from 'react-native';
import { VolumeManager } from 'react-native-volume-manager';

export const useVolume = (showControls) => {
  const [volumeLevel, setVolumeLevel] = useState(1);
  const [hasVolumePermission, setHasVolumePermission] = useState(true);
  const volumeSliderRef = useRef(null);

  useEffect(() => {
    let volumeListener = null;

    (async () => {
      try {
        VolumeManager.showNativeVolumeUI({ enabled: false });
        const { volume } = await VolumeManager.getVolume();
        setVolumeLevel(volume);
        setHasVolumePermission(true);

        volumeListener = VolumeManager.addVolumeListener((result) => {
          setVolumeLevel(result.volume);
        });
      } catch (e) {
        // Some platforms/emulators don't expose a system volume API — degrade
        // gracefully rather than crash the player.
        console.error('Error initializing volume manager:', e);
        setHasVolumePermission(false);
      }
    })();

    const handleAppStateChange = async (nextAppState) => {
      if (nextAppState === 'active') {
        try {
          const { volume } = await VolumeManager.getVolume();
          setVolumeLevel(volume);
        } catch (e) {
          console.error('Error fetching volume on resume:', e);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
      if (volumeListener) volumeListener.remove();
    };
  }, []);

  const handleVolumeChange = useCallback(async (value) => {
    const clamped = Math.max(0, Math.min(1, value));
    setVolumeLevel(clamped);
    try {
      await VolumeManager.setVolume(clamped, { showUI: false });
    } catch (e) {
      console.error('Error setting volume:', e);
    }
  }, []);

  const volumePanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onStartShouldSetPanResponderCapture: () => false,
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      return Math.abs(gestureState.dx) > 3 || Math.abs(gestureState.dy) > 3;
    },
    onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
      return Math.abs(gestureState.dx) > 3 || Math.abs(gestureState.dy) > 3;
    },
    onPanResponderGrant: (evt) => {
      if (!volumeSliderRef.current || !hasVolumePermission) return;
      volumeSliderRef.current.measure((x, y, width, height, pageX, pageY) => {
        const touchY = evt.nativeEvent.pageY - pageY;
        const newValue = 1 - Math.max(0, Math.min(1, touchY / height));
        handleVolumeChange(newValue);
      });
    },
    onPanResponderMove: (evt) => {
      if (!volumeSliderRef.current || !hasVolumePermission) return;
      volumeSliderRef.current.measure((x, y, width, height, pageX, pageY) => {
        const touchY = evt.nativeEvent.pageY - pageY;
        const newValue = 1 - Math.max(0, Math.min(1, touchY / height));
        handleVolumeChange(newValue);
      });
    },
    onPanResponderRelease: () => {},
  }), [hasVolumePermission, handleVolumeChange]);

  return {
    volumeLevel,
    hasVolumePermission,
    volumeSliderRef,
    volumePanResponder,
    handleVolumeChange,
  };
};
