// src/components/glass/BlurHeader.tsx
//
// Phase 5 — Glassmorphism component primitives.
//
// A full-width blurred header bar, safe-area aware (uses
// react-native-safe-area-context's SafeAreaView with edges=['top'],
// the same pattern already used in the Phase 2 player controls'
// SafeAreaView usage in VideoControlsOverlay.tsx). Intended for
// screen-top headers in later phases (search, library, settings,
// etc.) — not the tab bar itself (Phase 15's job, and it may want a
// different tint/border treatment for the bottom-of-screen position).
//
// Props:
//   left / center / right - optional content slots, laid out in a row
//                            (e.g. back button / title / action icons)
//   bordered               - draw a translucent bottom border, default true
//   elevationLevel         - 0 disables shadow, default 1 (headers should
//                             sit subtly above content, not float loudly)
//
// Usage:
//   <BlurHeader
//     left={<BackButton />}
//     center={<Text style={{ ...TYPOGRAPHY.h2, color: colors.text }}>Search</Text>}
//     right={<FilterButton />}
//   />

import React from 'react';
import { View, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../contexts/ThemeContext';
import { SPACING, getElevation, getGlassTokens } from '../../theme/tokens';

interface BlurHeaderProps {
  left?: React.ReactNode;
  center?: React.ReactNode;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  bordered?: boolean;
  elevationLevel?: 0 | 1 | 2 | 3 | 4;
}

const BlurHeader: React.FC<BlurHeaderProps> = ({
  left,
  center,
  right,
  style,
  bordered = true,
  elevationLevel = 1,
}) => {
  const { colors, isDark } = useTheme();
  const glass = getGlassTokens(colors, isDark);
  const elevation = elevationLevel > 0 ? getElevation(colors, elevationLevel as 1 | 2 | 3 | 4) : null;

  return (
    <View
      style={[
        {
          borderBottomWidth: bordered ? 1 : 0,
          borderBottomColor: glass.surfaceBorder,
        },
        elevation,
        style,
      ]}
    >
      <BlurView intensity={glass.blurIntensity.medium} tint={glass.tint} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: glass.surface }]} />
      <SafeAreaView edges={['top']}>
        <View style={styles.row}>
          <View style={styles.side}>{left}</View>
          <View style={styles.center}>{center}</View>
          <View style={[styles.side, styles.sideRight]}>{right}</View>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: SPACING.md,
  },
  side: {
    minWidth: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  sideRight: {
    alignItems: 'flex-end',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm,
  },
});

export default BlurHeader;
