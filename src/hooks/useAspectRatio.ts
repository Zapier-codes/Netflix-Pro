// src/hooks/useAspectRatio.ts
//
// MX-Player-style aspect ratio cycle button: Fit -> Fill -> Stretch -> Fit...
// Independent of the existing pinch-to-zoom gesture in useGestures.ts
// (which toggles a simpler contain/cover boolean) — once the user picks a
// mode explicitly via this button, that choice wins over the pinch
// gesture's boolean until they pinch again. See VideoPlayerScreen's
// `contentFit` resolution for how the two combine.

import { useState, useCallback, useRef } from 'react';
import { Animated } from 'react-native';

export type AspectRatioMode = 'auto' | 'contain' | 'cover' | 'fill';

const CYCLE_ORDER: AspectRatioMode[] = ['contain', 'cover', 'fill'];

export const ASPECT_RATIO_LABELS: Record<AspectRatioMode, string> = {
  auto: 'Fit',
  contain: 'Fit',
  cover: 'Fill',
  fill: 'Stretch',
};

export const useAspectRatio = () => {
  const [mode, setMode] = useState<AspectRatioMode>('auto');
  const [labelVisible, setLabelVisible] = useState(false);
  const labelOpacity = useRef(new Animated.Value(0)).current;
  const labelTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashLabel = useCallback(() => {
    setLabelVisible(true);
    Animated.timing(labelOpacity, { toValue: 1, duration: 120, useNativeDriver: true }).start();
    if (labelTimeoutRef.current) clearTimeout(labelTimeoutRef.current);
    labelTimeoutRef.current = setTimeout(() => {
      Animated.timing(labelOpacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
        setLabelVisible(false);
      });
    }, 1000);
  }, [labelOpacity]);

  const cycleAspectRatio = useCallback(() => {
    setMode((prev) => {
      const currentIndex = CYCLE_ORDER.indexOf(prev === 'auto' ? 'contain' : prev);
      const next = CYCLE_ORDER[(currentIndex + 1) % CYCLE_ORDER.length];
      return next;
    });
    flashLabel();
  }, [flashLabel]);

  return {
    aspectRatioMode: mode,
    cycleAspectRatio,
    aspectRatioLabel: ASPECT_RATIO_LABELS[mode],
    labelVisible,
    labelOpacity,
  };
};
