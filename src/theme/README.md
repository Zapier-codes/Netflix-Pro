# Design tokens (Phase 4)

This folder holds the shared design-system tokens introduced in Phase 4
so Phases 5–30 aren't each inventing their own spacing/type/shadow
values ad hoc. It does **not** replace `src/contexts/ThemeContext.tsx`
— colors still live there (`useTheme()` / `useThemeColors()`). Tokens
here are either theme-independent (spacing, radius, typography) or thin
helpers that combine `ThemeColors` with a scale to produce ready
style objects (elevation, glass).

## What's in `tokens.ts`

- `SPACING` — 4pt-based scale (`xxs`..`huge`). Use for padding/margin/gap.
- `RADIUS` — corner radius scale (`xs`..`full`). `RADIUS.full` (999) for
  pills/capsules, matching the glass-capsule style already used in the
  Phase 2 player controls.
- `TYPOGRAPHY` — a type scale (`display`, `h1`, `h2`, `h3`, `body`,
  `bodyStrong`, `bodySmall`, `caption`, `overline`). Each entry is a
  spreadable `{ fontSize, fontWeight, letterSpacing, lineHeight }` — it
  does **not** include `color`, since color depends on light/dark mode.
  Combine with `colors.text`/`textSub`/`textMuted` from `useTheme()`.
- `getElevation(colors, level)` — returns a spreadable shadow style
  (`shadowColor`/`shadowOffset`/`shadowOpacity`/`shadowRadius` for iOS,
  `elevation` for Android) for levels 1–4 (low to high), tinted with
  the current theme's own `colors.shadowColor` (dark mode uses a plain
  black shadow, light mode uses a soft blue-tinted one — already
  defined per-theme in `ThemeContext.tsx`, this just applies it
  consistently at 4 intensity levels instead of every screen picking
  its own numbers).
- `getGlassTokens(colors, isDark, overrideTint?)` — returns
  `{ blurIntensity: { light, medium, heavy }, surface, surfaceBorder, tint }`
  for use with `expo-blur`'s `<BlurView intensity={...} tint={...} />`.
  `tint` follows `isDark` by default (so general-purpose glass surfaces
  — cards, modals, headers — blend into the app's current mode). Pass
  `overrideTint: 'dark'` for glass that sits over video/media content
  specifically (like the player controls), which should stay
  dark-tinted regardless of app theme mode, since it's reading against
  video content, not app chrome.

## Example usage

```tsx
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, RADIUS, TYPOGRAPHY, getElevation, getGlassTokens } from '../theme/tokens';
import { BlurView } from 'expo-blur';

const MyCard = () => {
  const { colors, isDark } = useTheme();
  const glass = getGlassTokens(colors, isDark);

  return (
    <View style={{
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: glass.surfaceBorder,
      ...getElevation(colors, 2),
    }}>
      <BlurView intensity={glass.blurIntensity.medium} tint={glass.tint} style={StyleSheet.absoluteFill} />
      <Text style={{ ...TYPOGRAPHY.h3, color: colors.text }}>Title</Text>
      <Text style={{ ...TYPOGRAPHY.bodySmall, color: colors.textSub, marginTop: SPACING.xs }}>
        Subtitle text
      </Text>
    </View>
  );
};
```

## What Phase 4 deliberately did NOT do

- Did not touch any screen's visuals — this phase is tokens-and-docs
  only, per its scope in `HANDOVER.md`.
- Did not change any color value in `ThemeContext.tsx` — only exposed
  a `README.md`/`tokens.ts` layer on top of what already existed there
  (`gold`, `surfaceRaised`, `playerBackground`, `glassBlur`, etc.).
- Did not build the actual reusable glass components (`GlassCard`,
  `GlassPanel`, `BlurHeader`) — that's Phase 5, which should import
  `getGlassTokens`/`getElevation`/`SPACING`/`RADIUS` from here rather
  than re-deriving its own numbers.
