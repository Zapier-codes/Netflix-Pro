// src/components/glass/GlassCard.tsx
//
// Phase 5 — Glassmorphism component primitives.
//
// A GlassPanel pre-configured with card-appropriate padding, and
// optionally pressable (pass `onPress` to render as a TouchableOpacity
// instead of a plain View — useful for e.g. a media info card or a
// settings-row card in later screen-redesign phases).
//
// Props: everything GlassPanel accepts, plus:
//   onPress   - if provided, wraps content in a pressable with a
//               subtle opacity feedback (full micro-interaction /
//               scale-press polish is Phase 24's job, not this one —
//               this is just enough feedback that taps feel intentional)
//   padding   - inner padding in px, default SPACING.lg (16)
//
// Usage:
//   <GlassCard onPress={() => router.push('/details/123')}>
//     <Text>Card content</Text>
//   </GlassCard>

import React from 'react';
import { TouchableOpacity, type ViewStyle, type StyleProp } from 'react-native';
import GlassPanel from './GlassPanel';
import { SPACING } from '../../theme/tokens';

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  blurLevel?: 'light' | 'medium' | 'heavy';
  radius?: number;
  elevationLevel?: 0 | 1 | 2 | 3 | 4;
  overrideTint?: 'light' | 'dark';
  bordered?: boolean;
  padding?: number;
  onPress?: () => void;
  activeOpacity?: number;
}

const GlassCard: React.FC<GlassCardProps> = ({
  children,
  style,
  padding = SPACING.lg,
  onPress,
  activeOpacity = 0.85,
  ...glassPanelProps
}) => {
  const content = (
    <GlassPanel style={[{ padding }, style]} {...glassPanelProps}>
      {children}
    </GlassPanel>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={activeOpacity}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

export default GlassCard;
