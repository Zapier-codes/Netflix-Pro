// src/components/glass/GlassButton.tsx
//
// Phase 5 — Glassmorphism component primitives.
//
// A pressable glass surface for icon buttons or icon+label buttons —
// the same visual language as the circular icon buttons already
// introduced in the Phase 2 player controls (VideoControlsOverlay's
// `iconGlassButton`/`playGlassButton` styles), generalized here so
// later phases (7, 9, 11-21...) can reuse one component instead of
// each redefining their own glass-button styles inline.
//
// Props:
//   onPress    - required
//   icon       - optional ReactNode (e.g. an <Ionicons .../>) rendered
//                centered
//   label      - optional text rendered next to the icon (omit for a
//                bare circular icon button; provide for a pill-shaped
//                icon+label button)
//   size       - diameter in px for icon-only buttons, default 44
//                (ignored when `label` is provided — pill buttons size
//                to content instead)
//   disabled   - standard disabled state, dims + disables press
//   style      - additional outer style overrides
//
// Usage:
//   <GlassButton icon={<Ionicons name="heart" size={20} color={colors.text} />} onPress={toggleLike} />
//   <GlassButton icon={<Ionicons name="download" size={18} color={colors.text} />} label="Download" onPress={startDownload} />

import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../contexts/ThemeContext';
import { SPACING, RADIUS, TYPOGRAPHY, getGlassTokens } from '../../theme/tokens';

interface GlassButtonProps {
  onPress: () => void;
  icon?: React.ReactNode;
  label?: string;
  size?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  overrideTint?: 'light' | 'dark';
}

const GlassButton: React.FC<GlassButtonProps> = ({
  onPress,
  icon,
  label,
  size = 44,
  disabled = false,
  style,
  overrideTint,
}) => {
  const { colors, isDark } = useTheme();
  const glass = getGlassTokens(colors, isDark, overrideTint);
  const isPill = !!label;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.75}
      style={[
        isPill
          ? { borderRadius: RADIUS.full, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm }
          : { width: size, height: size, borderRadius: size / 2 },
        styles.base,
        { borderColor: glass.surfaceBorder, opacity: disabled ? 0.4 : 1 },
        style,
      ]}
    >
      <BlurView intensity={glass.blurIntensity.medium} tint={glass.tint} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: glass.surface, borderRadius: isPill ? RADIUS.full : size / 2 }]} />
      <View style={styles.content}>
        {icon}
        {label ? (
          <Text style={[TYPOGRAPHY.bodyStrong, { color: colors.text, marginLeft: icon ? SPACING.sm : 0 }]}>
            {label}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default GlassButton;
