// src/components/glass/GlassPanel.tsx
//
// Phase 5 — Glassmorphism component primitives.
//
// The base glass surface every other component in this folder builds
// on: a BlurView background + translucent border + optional elevation
// shadow, sized/positioned by whatever `style` the caller passes.
// Tint/blur amount come from src/theme/tokens.ts's getGlassTokens, so
// it automatically matches the current light/dark theme (see that
// file's doc comment for why `overrideTint` exists — pass
// `overrideTint="dark"` for glass sitting over video/media content
// specifically, leave it unset for everything else).
//
// Props:
//   children       - content rendered on top of the blur (required)
//   style          - outer container style (size/position/margin —
//                    NOT background/border, those are handled here)
//   blurLevel      - 'light' | 'medium' | 'heavy', default 'medium'
//   radius         - corner radius in px, default RADIUS.lg (16)
//   elevationLevel - 0 disables shadow, 1-4 per getElevation(), default 2
//   overrideTint   - 'light' | 'dark' | undefined (see above)
//   bordered       - whether to draw the translucent border, default true
//
// Usage:
//   <GlassPanel style={{ padding: SPACING.lg }}>
//     <Text>Content</Text>
//   </GlassPanel>

import React from 'react';
import { View, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../contexts/ThemeContext';
import { RADIUS, getElevation, getGlassTokens } from '../../theme/tokens';

interface GlassPanelProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  blurLevel?: 'light' | 'medium' | 'heavy';
  radius?: number;
  elevationLevel?: 0 | 1 | 2 | 3 | 4;
  overrideTint?: 'light' | 'dark';
  bordered?: boolean;
}

const GlassPanel: React.FC<GlassPanelProps> = ({
  children,
  style,
  blurLevel = 'medium',
  radius = RADIUS.lg,
  elevationLevel = 2,
  overrideTint,
  bordered = true,
}) => {
  const { colors, isDark } = useTheme();
  const glass = getGlassTokens(colors, isDark, overrideTint);
  const elevation = elevationLevel > 0 ? getElevation(colors, elevationLevel as 1 | 2 | 3 | 4) : null;

  return (
    <View
      style={[
        {
          borderRadius: radius,
          overflow: 'hidden',
          borderWidth: bordered ? 1 : 0,
          borderColor: glass.surfaceBorder,
        },
        elevation,
        style,
      ]}
    >
      <BlurView
        intensity={glass.blurIntensity[blurLevel]}
        tint={glass.tint}
        style={StyleSheet.absoluteFill}
      />
      {/* A faint tinted layer under the content, on top of the blur —
          BlurView alone can look washed-out/grey on some Android
          versions where the native blur is weaker; this keeps the
          surface reading as "glass" even where blur support is thin. */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: glass.surface }]} />
      {children}
    </View>
  );
};

export default GlassPanel;
