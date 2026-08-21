// src/theme/tokens.ts
//
// Phase 4 — Design system foundation.
//
// These tokens are theme-agnostic scales (spacing, radius, typography)
// plus a couple of helpers that combine them with the per-mode colors
// already defined in ThemeContext.tsx (DARK_THEME / LIGHT_THEME) to
// produce ready-to-spread style objects for elevation and glass
// surfaces. This file does NOT change ThemeContext.tsx's colors or
// any screen's visuals — it's additive, tokens-and-docs-only, per the
// Phase 4 scope in HANDOVER.md. Later phases (5+) should import from
// here instead of hardcoding spacing/radius/font values.
//
// See src/theme/README.md for usage guidance.

import type { ThemeColors } from '../contexts/ThemeContext';

/** 4pt base spacing scale. Use SPACING.md for "normal" gaps/padding. */
export const SPACING = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

/** Corner radius scale. Use RADIUS.md for cards, RADIUS.full for pills/capsules. */
export const RADIUS = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  full: 999,
} as const;

/**
 * Type scale. Each entry is a ready-to-spread RN Text style fragment
 * (fontSize/fontWeight/letterSpacing/lineHeight). Colors are NOT
 * included here — apply `color: colors.text` (or textSub/textMuted)
 * separately from useTheme(), since color depends on light/dark mode
 * and this scale doesn't.
 */
export const TYPOGRAPHY = {
  display: { fontSize: 32, fontWeight: '700' as const, letterSpacing: 0.2, lineHeight: 38 },
  h1: { fontSize: 24, fontWeight: '700' as const, letterSpacing: 0.2, lineHeight: 30 },
  h2: { fontSize: 20, fontWeight: '600' as const, letterSpacing: 0.15, lineHeight: 26 },
  h3: { fontSize: 17, fontWeight: '600' as const, letterSpacing: 0.1, lineHeight: 22 },
  body: { fontSize: 15, fontWeight: '400' as const, letterSpacing: 0, lineHeight: 21 },
  bodyStrong: { fontSize: 15, fontWeight: '600' as const, letterSpacing: 0, lineHeight: 21 },
  bodySmall: { fontSize: 13, fontWeight: '400' as const, letterSpacing: 0, lineHeight: 18 },
  caption: { fontSize: 12, fontWeight: '400' as const, letterSpacing: 0.2, lineHeight: 16 },
  overline: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 1.1, lineHeight: 14 },
} as const;

/**
 * Elevation presets (1–4, low to high). Returns a ready-to-spread style
 * object with both iOS shadow props and Android `elevation`, tinted
 * using the current theme's `shadowColor` so light/dark modes each get
 * an appropriate shadow (light mode's shadowColor in ThemeContext.tsx
 * is a soft blue-tinted shadow, not a plain black one — this reuses
 * that rather than hardcoding black everywhere).
 */
export const getElevation = (colors: ThemeColors, level: 1 | 2 | 3 | 4) => {
  const presets = {
    1: { offsetY: 1, opacity: 0.18, radius: 3, elevation: 2 },
    2: { offsetY: 2, opacity: 0.22, radius: 6, elevation: 4 },
    3: { offsetY: 4, opacity: 0.26, radius: 10, elevation: 6 },
    4: { offsetY: 8, opacity: 0.3, radius: 16, elevation: 10 },
  } as const;
  const p = presets[level];
  return {
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: p.offsetY },
    shadowOpacity: p.opacity,
    shadowRadius: p.radius,
    elevation: p.elevation,
  };
};

/**
 * Glass-specific tokens. `blurIntensity` maps a light/medium/heavy
 * scale onto the theme's own `glassBlur` value (DARK_THEME=20,
 * LIGHT_THEME=30 as of Phase 4 — light mode needs a stronger blur to
 * read well against its lighter, more detailed gradient background).
 * `surface`/`surfaceBorder` just re-export the existing
 * surfaceGlass/surfaceGlassBorder colors so glass components (Phase 5)
 * have one place to pull both the blur amount and the tint from
 * together, instead of importing colors and a hardcoded intensity
 * number separately in every component.
 *
 * `tint` follows `isDark` for general app-UI glass surfaces (cards,
 * modals, headers — they sit over the app's own background, so they
 * need to match its mode to blend in). Pass `overrideTint: 'dark'` for
 * glass surfaces that sit over video/media content specifically (e.g.
 * the player controls from Phase 2), which should stay dark-tinted
 * regardless of the app's light/dark mode, since they're reading
 * against video content, not app chrome.
 */
export const getGlassTokens = (
  colors: ThemeColors,
  isDark: boolean,
  overrideTint?: 'light' | 'dark',
) => ({
  blurIntensity: {
    light: Math.round(colors.glassBlur * 0.6),
    medium: colors.glassBlur,
    heavy: Math.round(colors.glassBlur * 1.5),
  },
  surface: colors.surfaceGlass,
  surfaceBorder: colors.surfaceGlassBorder,
  tint: overrideTint ?? (isDark ? ('dark' as const) : ('light' as const)),
});
