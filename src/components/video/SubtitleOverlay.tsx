import React, { memo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';

interface SubtitleOverlayProps {
  subtitlesEnabled: boolean;
  currentSubtitleText: string;
  fontScale?: number;
  backgroundOpacity?: number;
}

const BASE_FONT_SIZE = Platform.OS === 'android' ? 16 : 18;

const SubtitleOverlay = memo(({
  subtitlesEnabled,
  currentSubtitleText,
  fontScale = 1.0,
  backgroundOpacity = 0.65,
}: SubtitleOverlayProps) => {
  if (!subtitlesEnabled || !currentSubtitleText) return null;

  // backgroundOpacity === 0 means "no background" — skip the blur
  // entirely and just render text with a shadow for legibility, since a
  // 0-intensity BlurView would still draw a faint tinted pill.
  if (backgroundOpacity <= 0.02) {
    return (
      <View style={styles.subtitleTextContainer} pointerEvents="none">
        <Text style={[styles.subtitleText, { fontSize: BASE_FONT_SIZE * fontScale, backgroundColor: 'transparent' }]}>
          {currentSubtitleText}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.subtitleTextContainer} pointerEvents="none">
      <BlurView
        intensity={30 * backgroundOpacity}
        tint="dark"
        style={styles.subtitleBlurPill}
      >
        <Text style={[styles.subtitleText, { fontSize: BASE_FONT_SIZE * fontScale }]}>
          {currentSubtitleText}
        </Text>
      </BlurView>
    </View>
  );
});

const styles = StyleSheet.create({
  subtitleTextContainer: {
    position: 'absolute',
    bottom: 30,
    left: '5%',
    right: '5%',
    alignItems: 'center',
    zIndex: 7,
    pointerEvents: 'none',
  },
  subtitleBlurPill: {
    borderRadius: 8,
    overflow: 'hidden',
    paddingHorizontal: 4,
  },
  subtitleText: {
    color: 'white',
    textAlign: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 1, height: 1.5 },
    textShadowRadius: 2,
    elevation: 1,
    overflow: 'hidden',
  },
});

export default SubtitleOverlay;
