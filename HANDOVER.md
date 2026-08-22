# HANDOVER.md — Netflix-pro Pro-Level Overhaul

**Read this file FIRST, in full, before touching any code.**
This project is being upgraded from a "working but scaffolded" app into a
professional, modern streaming app (theming, glassmorphism, real gesture
controls, polish, performance) across **30 phases**. Each phase is done by a
**separate AI session**. You are one session. You do **one phase only**,
unless the human explicitly asks you to do more.

If you are an AI reading this: scroll to **"CURRENT STATUS"** near the top
to find out which phase to do next. Do not skip ahead. Do not redo a phase
marked ✅. Do not silently expand scope into later phases.

---

## 0. REPO BASICS

- **Repo:** `https://github.com/Zapier-codes/Netflix-pro`
- **Branch: `termux` — NOT `main`.** All work since patch 0012 lives on
  a branch called `termux`, which forked from `main` at commit
  `8635d39` ("fixed all component issues"). `main` has since moved on
  with its own extra commit (`cd7c8b1`, "start from here") that
  `termux` does not have — the two branches have diverged. A plain
  `git clone` checks out `main` by default, which has **no
  `HANDOVER.md` at all**. Always explicitly check out `termux` (see
  Clone instructions below) before doing anything else, and build every
  patch on top of `termux`'s tip — a patch built against `main` will
  fail `git am` on the human's device, exactly as happened once
  already.
- **Owner/dev (human):** "Pops" — Android/full-stack dev, works from
  Termux on Android with SSH access to GitHub, prefers numbered
  `git format-patch`-style `.patch` files applied via
  `git am <patch> && git push`.
- **Stack:** Expo SDK 55, React Native, TypeScript, `expo-router`
  (file-based routing). **As of 2026-08-20 (see §3B): no Supabase, no
  custom native modules** — the app was rewired away from a
  multi-source piracy streaming layer to a licensed-backend model
  (`src/services/licensedPlayback/LicensedPlaybackService.ts`), and
  `modules/` (which held `mavin-engine`, `boxoffice`, `pawns`) was
  deleted outright. State management is down to **two** parallel
  systems, not three: `src/store/store.ts` (RTK) and
  `src/store/zustand/*` — see §3B before touching state in any phase.
- **App identity:** Netflix-style streaming client. Movies/TV via TMDB
  (and Trakt/Kuryana) metadata, playback via a licensed backend,
  subtitles via OpenSubtitles/SubDL (+ local `.srt` import, once Phase
  2 lands), downloads, continue-watching, live sports.

### Clone instructions (for every session)

```bash
git clone https://github.com/Zapier-codes/Netflix-pro.git
cd Netflix-pro
git checkout termux         # NOT main — see "Branch" note in section 0 above
git log --oneline -5        # sanity check you're on latest
cat HANDOVER.md             # this file — always re-read it fresh, don't trust memory
```

Do **not** run `npm install` / try to boot the Metro bundler in a sandbox —
there is no working device/emulator in these AI sessions. Work is
source-only: read, edit, patch. The human builds and runs on their own
Android device via Termux + `gradlew` / EAS.

---

## 1. THE WORKFLOW (every session follows this exactly)

1. **Clone** the repo fresh (instructions above).
2. **Read `HANDOVER.md`**, find the current phase in the status table.
3. **Read the phase's own section below** (goal, scope, files, acceptance
   criteria) carefully. Stay inside that scope. If you discover something
   broken that's out of scope, **note it in the "Known Issues / Notes for
   Next Session" section at the bottom of this file** — do not fix it
   yourself unless it blocks your phase.
4. **Do the work**: edit files directly in the cloned repo.
5. **Commit** your work yourself:
   ```bash
   git add -A
   git commit -m "Phase N: <short description>"
   ```
6. **Generate a patch file** for the human (they only ever run `git push`,
   never `git am` themselves in front of you — they apply your patch
   locally in Termux):
   ```bash
   git format-patch -1 HEAD --start-number <NNNN> -o /mnt/user-data/outputs/
   ```
   Where `<NNNN>` is the next number in their patch sequence (see
   "Patch numbering" below). This produces a file like
   `0021-phase-9-glassmorphism-theme-system.patch`.
7. **Present the patch file** to the human via `present_files`. Tell them
   plainly:
   - what phase this was
   - what changed (short bullet list)
   - the exact command to apply it:
     ```
     git am ~/storage/downloads/0021-phase-9-glassmorphism-theme-system.patch && git push
     ```
8. **Update `HANDOVER.md` itself** as part of your commit:
   - Mark your phase ✅ in the status table with the date and patch number.
   - Fill in "Notes for Next Session" if relevant.
   - Do this as part of the same commit / same patch, so the log stays
     self-updating and the next AI session isn't lost.

### Patch numbering

Look at the highest existing patch number the human has applied (ask them,
or infer from the status table below — each completed phase row records
its patch number). Increment by one. If unsure, ask the human "what was
the last patch number you applied?" before generating yours.

### Non-negotiable rules for every session

- **One phase per session.** If a phase is too big, split it into
  sub-patches (1a, 1b, ...) but say so explicitly in your handoff message
  and update the status table accordingly.
- **Never re-architect something a previous phase already finished**
  without saying so loudly and getting explicit confirmation — later
  phases build on earlier ones.
- **Never touch `.env`, `env.b64`, `keystore.b64`, `keystore.properties`,
  signing config, or CI/release files** unless a phase explicitly says to.
- **Don't delete existing working functionality** to "clean up" unless the
  phase says to. Prefer additive, reversible changes.
- **Always leave the repo in a state that would plausibly compile** —
  even though you can't run it, read your own diffs carefully, check
  imports exist, check prop names match between components/hooks.
- **TypeScript**: this repo is mid-migration to TS (see
  `TYPESCRIPT-MIGRATION.md`). New files you create should be `.tsx`/`.ts`.
  Don't rename existing `.tsx`/`.jsx` files' extensions unless the phase
  is specifically about that.

---

## 2. CURRENT STATUS

| Phase | Title | Status | Patch # | Session Date |
|---|---|---|---|---|
| 1 | Video player: gesture engine + volume/brightness/seek | ✅ Complete | 0015 | 2026-08-17 |
| 2 | Video player: local subtitle import + modern visual pass | ✅ Complete | 0019 | 2026-08-20 |
| 3 | Video player: routing fix + full hook wiring | ✅ Complete (retroactive — see §3B) | unknown | pre-2026-08-20 |
| 4 | Design system foundation: design tokens, spacing, typography scale | ✅ Complete | 0020 | 2026-08-21 |
| 5 | Theming: glassmorphism component primitives (GlassCard, GlassPanel, BlurHeader) | ✅ Complete | 0021 | 2026-08-21 |
| 6 | Theming: apply glassmorphism to modals (Episodes, Subtitles, Buffering) | ✅ Complete | 0022 | 2026-08-22 |
| 7 | Home screen redesign: hero section, modern row layout, parallax/scroll polish | 🔲 Not started | — | — |
| 8 | MediaCard / MediaRow visual overhaul (hover-like press states, shimmer skeletons) | 🔲 Not started | — | — |
| 9 | Details screen redesign: modern hero, glass action bar, animated tab sections | 🔲 Not started | — | — |
| 10 | Search screen redesign: live results, modern filter chips, empty/error states | 🔲 Not started | — | — |
| 11 | Library / Downloads screen redesign: grid/list toggle, glass cards, progress rings | 🔲 Not started | — | — |
| 12 | Settings screen redesign: grouped sections, modern switches, theme picker UI | 🔲 Not started | — | — |
| 13 | Sports screen redesign: live badges, score ticker polish, modern layout | 🔲 Not started | — | — |
| 14 | Notifications screen: modern list, swipe actions, empty state | 🔲 Not started | — | — |
| 15 | Navigation shell: tab bar redesign (glass/blur tab bar, active-state motion) | 🔲 Not started | — | — |
| 16 | Global loading & skeleton system consistency pass | 🔲 Not started | — | — |
| 17 | Global error/empty state system (illustrated, consistent, reusable component) | 🔲 Not started | — | — |
| 18 | Micro-interactions & animation pass (Reanimated-based transitions, haptics) | 🔲 Not started | — | — |
| 19 | Continue Watching panel redesign (progress rings, swipe-to-remove, glass) | 🔲 Not started | — | — |
| 20 | Downloads UX pass (download queue UI, storage usage bar, pro-level manager) | 🔲 Not started | — | — |
| 21 | Comments / social features UI pass (`src/components/comments`) | 🔲 Not started | — | — |
| 22 | Licensed backend integration audit (repurposed — see §3B, watch-together no longer exists) | 🔲 Not started | — | — |
| 23 | Accessibility pass: dynamic text scaling, screen reader labels, contrast check | 🔲 Not started | — | — |
| 24 | Performance pass: image caching/optimization, list virtualization audit, memo audit | 🔲 Not started | — | — |
| 25 | Error boundary & crash resilience pass (`ErrorBoundary.tsx` and friends) | 🔲 Not started | — | — |
| 26 | Onboarding / first-run experience (if absent, design one; if present, polish it) | 🔲 Not started | — | — |
| 27 | Icon & branding pass: app icon, splash screen, adaptive icon consistency | 🔲 Not started | — | — |
| 28 | Code health pass: dead file cleanup (`*.backup`, `*.bak`, dump/log txt files) | 🔲 Not started | — | — |
| 29 | TypeScript migration completion pass (remaining `.jsx`/untyped files) | 🔲 Not started | — | — |
| 30 | Final QA pass: cross-screen consistency audit, theming audit, handover retrospective | 🔲 Not started | — | — |

Legend: 🔲 not started · 🟡 in progress / partially done · ✅ complete

**➡️ NEXT SESSION STARTS AT: Phase 7** (Phases 1–6 all ✅)

---

## 3. WHY PHASES 1–3 EXIST (context from the discovery session)

Before this handover doc was written, a session audited the video player
and found:

- `src/screens/player/VideoPlayerScreen.tsx` is a **placeholder stub**
  (literally renders "🎬 Video Player / Player controls will appear
  here"). It has never been wired up.
- Almost everything the player needs **already exists but is
  disconnected**:
  - Hooks: `useStreamExtraction.ts`, `useVideoControls.ts`,
    `useBrightness.ts`, `useSubtitles.tsx`, `useAutoPlay.ts`
  - Components: `src/components/video/*` (`VideoControlsOverlay`,
    `BrightnessSlider`, `SubtitleOverlay`, `SeekIndicators`,
    `EpisodesModal`, `LoadingOverlay`, `ErrorOverlay`,
    `BufferingAlertModal`, `NextEpisodeButton`, `LiveIndicator`)
  - Also found at top level of `src/components/`:
    `SourceSelectionModal.tsx`, `SubtitlesModal.tsx` (already built,
    unused — check these before building new ones in Phase 2/3, they may
    already do most of the job)
  - `src/components/player/CCControls.tsx` — a closed-captions control
    component that also appears unused — check before duplicating work.
- **Routing bug**: `DetailsScreen.tsx` navigates via
  `router.push('/player?title=...&poster_path=...')` — it never passes
  `id` (TMDB id) or `mediaType`. The only existing route file,
  `app/player/[id].tsx`, expects a URL **segment** (`/player/123`), not
  query params. Net effect: the player screen, even once built, has no
  way to know *what* to play. **Phase 3 must fix this** (recommended
  fix: add `app/player/index.tsx` for query-param based nav, and fix the
  3 `router.push` call sites in `DetailsScreen.tsx` to pass `id` +
  `mediaType`, ideally using expo-router's object form
  `router.push({ pathname: '/player', params: {...} })` so values get
  auto-encoded — the current template-literal approach will break on
  titles containing `&` or `?`).
- Subtitles: `DetailsScreen.tsx` already searches and lists available
  subtitles for a title (`unifiedSubtitlesService.searchSubtitles`) but
  never passes selection through to the player. The player's own
  `useSubtitles.tsx` hook independently does its own OpenSubtitles
  search/download/parse — it's functional but never called from the
  screen. Local subtitle import (from the user's downloaded `.srt`
  files) does not exist yet — needs `expo-document-picker` (not yet a
  dependency — a prior session added it to `package.json` as
  `~55.0.9`, plus `react-native-volume-manager` `^2.0.9` for the
  right-side volume gesture — **verify these two lines are still in
  `package.json` when you start Phase 1**; if a previous incomplete
  session added them without finishing, that's fine, just continue).

Phases 1–3 exist specifically to finish assembling the player before any
visual "pro-level" polish is applied to it in later phases (Phase 2 also
covers the modern UI for the player itself — don't wait for Phase 5's
design system to make the player look decent; Phase 2 should use
reasonable modern styling directly, and Phase 5+ can later reconcile it
with the app-wide design system).

---

## 3A. RE-AUDIT — 2026-08-17 (doc-only pass, no phase work done)

This session did **not** do phase work. It re-cloned the repo, read every
screen/service/store directory, and found the Section 3 discovery notes
above are **out of date on the player**, and that phases 4–30 were written
from the phase-title list only, without touching the actual code. This
section corrects that. **Read this before starting Phase 1.**

**The player is not a stub.** `src/screens/player/VideoPlayerScreen.tsx`
is 1,114 lines and already imports/wires `useVideoControls`,
`useBrightness`, `useBuffering`, `useSeekBar`, `useGestures`,
`useWatchProgress`, `useSubtitles`, `useAutoPlay`,
`useEpisodeNavigation`, and `useStreamExtraction`, plus
`SourceSelectionModal`/`SubtitlesModal`. None of these extra hooks
(`useBuffering.ts`, `useSeekBar.ts`, `useGestures.ts`,
`useWatchProgress.ts`, `useEpisodeNavigation.ts`) are mentioned anywhere
above — re-read all five before starting Phase 1, they likely already
cover ground the old Phase 1/3 scope assumed was missing.

**Routing is already largely fixed.** `app/player/index.tsx` already
exists and handles query params via `useLocalSearchParams`. The details
screen already calls `router.push({ pathname: '/player', params: {...} })`
(object form, not the broken template-literal form Section 3 describes)
at two call sites. **However the file is not `DetailsScreen.tsx` — it's
`src/screens/details/DetailsScreenNew.tsx`.** Every reference to
`DetailsScreen.tsx` anywhere in this doc (including Phase 9) means
`DetailsScreenNew.tsx`. Phase 3 should re-verify end-to-end wiring and
prop-shape matching rather than rebuild routing from scratch.

**Gestures are partial, not absent.** `useGestures.ts` (252 lines)
already implements double-tap left/right seek with debounced batching.
It has **no** drag-to-seek-with-preview and **no** volume handling —
`react-native-volume-manager` is in `package.json` but unused anywhere in
`src/`. So Phase 1's real scope is: add horizontal-drag seek + the
volume hook/slider into the *existing* `useGestures.ts`, not build a
gesture layer from zero.

**Undocumented architecture issue for a later phase:** the app runs
**three parallel state systems** at once — `src/store/store.ts` (plain
RTK, `contentApi`/`downloadsApi` + slices), `src/store/rtk/store.ts`
(a *second*, differently-configured RTK store with `redux-persist` and
its own `streamingApi`), and `src/store/zustand/*` (used by
`app/_layout.tsx`, `ThemeContext.tsx`, `useApp.ts`,
`CleanupService.ts`, `DownloadManager.ts`, `NetworkMonitor.ts` — i.e.
Zustand is what's actually wired into the live app; the two Redux stores
look largely dead/duplicate code). Not in scope for any existing phase —
added to Known Issues below, needs a decision (likely as part of Phase
24 performance/dead-code work, or its own phase) before Phase 24 runs.

**Other undocumented items found in this pass**, added to Known Issues:
a `modules/python-scraper/` directory (empty in this clone — check
whether it's meant to be a submodule that didn't get added, or dead
scaffolding), a 19MB `Demo.mp4` committed at repo root, and `.bak` files
for `LibraryScreen.tsx`, `DownloadsScreen.tsx`, `SettingsScreen.tsx`, and
`AnimatedHeader.tsx` (Phase 28's clutter list below has been expanded
with these plus several root-level files it missed: `check.ps1`,
`rn_complete_structure.txt`, `run_export.bat`).

Section 4 below (Phase 4–30 details) has been expanded with real file
paths from this audit so later sessions aren't starting from a bare
phase title the way this doc originally left them.

---

## 3B. RE-AUDIT — 2026-08-20 (post piracy-removal reconciliation)

This session also did **not** do numbered phase work — it re-cloned
`termux`, found four commits (`3683dc6` "remove piracy streaming layer
and Pawns bandwidth SDK", `42066cc` "wire playback to licensed
backend", `c67be57` "fix remaining broken imports", `f79fa43` "remove
Supabase, stop using EAS for releases, wire licensed backend to a
working Render placeholder") that landed **after** the 2026-08-17
audit above and were never reflected in this doc's status table or
phase text. This section corrects that. **Read this before starting
any phase**, especially 1–3 and 22.

**The piracy/multi-source streaming layer is completely gone.** Confirmed
deleted: `useStreamExtraction.ts`, `src/utils/streamExtractor.ts`, the
VidSrc/Xyra/Consumet adapters, `SourceSelectionModal.tsx`. Every
reference to any of these anywhere in this doc (Section 3, old Phase
2/3 text, Quick Reference) is now historical context only, not current
file paths — the rewritten Phase 2/3 sections above reflect the actual
current state; don't trust older text in this doc that still names
these files.

**Playback is now routed through a licensed backend.**
`src/hooks/useLicensedPlaybackSource.ts` and
`src/services/licensedPlayback/LicensedPlaybackService.ts` are the new
core of playback. Per the Phase 4 commit message this is currently "a
working Render placeholder" — not yet audited for what that actually
means in practice. See the repurposed Phase 22 above.

**All three custom native modules are gone.** `modules/` (which
contained `mavin-engine`, `boxoffice`, and `pawns`) **does not exist at
all** on `termux` anymore — confirmed via a fresh clone, not just a
stale note. This resolves what would have been Phase 6 in the original
plan (there's nothing left to "audit" — the modules were removed
outright as part of the piracy-layer cleanup, which is a reasonable
outcome, not a gap). However:

- **`package.json` still lists two dependencies pointing at the deleted
  folder**: `"mavin-engine": "file:./modules/mavin-engine"` and
  `"pawns": "file:./modules/pawns"`. This would make `npm ci`/`npm
  install` fail outright on a clean clone. **Fixed as part of this same
  reconciliation pass** (see the commit this patch is attached to) —
  both lines removed from `package.json`. If a future session finds
  they've reappeared (e.g. from a merge), remove them again; they have
  no valid target.
- `react-native-nitro-modules` and `nitrogen` remain in `package.json`
  — these are general-purpose libraries (not specific to the deleted
  `boxoffice` module) and may still be legitimately used elsewhere;
  **not removed**, but worth a `grep -r "nitro" src app` check in
  whichever phase next touches dependencies, in case they're now also
  unused.
- No lingering plugin/module references were found in `app.config.ts`
  for any of the three — that side was already clean.

**State management duplication is down to two systems, not three.**
The 2026-08-17 audit found `store/store.ts` + `store/rtk/store.ts`
(two separate RTK stores) + `store/zustand/*`. As of this audit,
`store/rtk/store.ts` no longer exists — `src/store/index.ts` is now a
plain re-export barrel for the Zustand hooks
(`useDownloads`, `useNotifications`, `useContinueWatching`,
`useAppStore`, `useSettings`, `usePlayer`, `useUI`), and
`src/store/store.ts` remains as the one real RTK store (`contentApi`/
`downloadsApi` + `settingsSlice`/`downloadsSlice`/`playerSlice`/
`cacheSlice`). So it's now **RTK (`store/store.ts`) vs. Zustand
(`store/zustand/*`)** — still needs the same consolidation decision as
before, just one fewer contender. Update any phase text that still
says "three parallel systems" mentally to "two."

**Service duplication partially resolved itself.** Top-level
`src/services/DownloadManager.ts` and `CleanupService.ts` no longer
exist — only the `src/services/downloadManager/` subfolder versions
remain, which resolves that part of the duplication Known Issues used
to flag. **Still duplicated as of this audit:**
`src/services/NetworkMonitor.ts` vs.
`src/services/downloadManager/NetworkMonitor.ts`, and
`src/services/cacheService.ts` vs. `src/services/cache/CacheManager.ts`.
Whichever phase covers service-layer dedup should scope to just these
two pairs now, not the longer original list.

**`CCControls.tsx` confirmed dead code, not just "appears unused."**
`grep -r "CCControls" src app` (excluding its own file) returns
nothing — it's genuinely never imported. Addressed in the rewritten
Phase 2 above (decide: wire it in or flag for Phase 29 cleanup).

**Volume gesture (Phase 1) is genuinely done, not just partially.**
Confirmed `src/hooks/useVolume.ts` and
`src/components/video/VolumeSlider.tsx` both exist, matching the
Phase 1 ✅ status already recorded — this audit found no reason to
dispute that completion, just confirming it holds.

---

## 4. PHASE DETAILS

Each phase below has: **Goal**, **Scope / files likely touched**,
**Acceptance criteria**, **Do not**.

### Phase 1 — Video player: gesture engine + volume/brightness/seek

**Goal:** Build the touch-gesture layer for the video player: horizontal
drag anywhere on the video to scrub/seek with live preview, vertical drag
on the left half to adjust screen brightness, vertical drag on the right
half to adjust system volume, single tap toggles the controls overlay,
double-tap left/right seeks ±10s. This should be ONE unified gesture
responder (not 3 competing `PanResponder`s) to avoid touch conflicts.

**Scope:**
- New: `src/hooks/useVolume.ts` (mirror `useBrightness.ts`'s API shape:
  `{ volumeLevel, hasVolumePermission?, handleVolumeChange }` — use
  `react-native-volume-manager`; hide native volume UI while dragging).
- New: `src/components/video/VolumeSlider.tsx` (mirror
  `BrightnessSlider.tsx`, right-aligned, volume icon).
- New: `src/hooks/useGestureControls.ts` — the unified PanResponder
  described above. Drives: seek preview position + `SeekIndicators`
  animated values, `handleBrightnessChange`, `handleVolumeChange`, and
  calls into `useVideoControls`'s `toggleControls` / `seekBackward` /
  `seekForward` for taps.
- `package.json`: confirm/add `expo-document-picker` and
  `react-native-volume-manager` (see notes in section 3 above).
- Existing `BrightnessSlider.tsx` / new `VolumeSlider.tsx` are **pure
  visual indicators** in this new design — the screen's central gesture
  responder computes values and calls the handlers directly; the
  sliders don't need (and shouldn't fight over) their own touch capture.
  Pass an empty/no-op pan responder or make the prop optional — check
  `BrightnessSlider.tsx`'s current implementation before deciding the
  least-invasive way to do this.

**Acceptance criteria:**
- Gesture logic is isolated in the new hook — doesn't yet need to be
  wired into `VideoPlayerScreen.tsx` (that's Phase 3), but should be
  written against the real prop shapes of `SeekIndicators`,
  `BrightnessSlider`, and the new `VolumeSlider` so Phase 3 can just
  import and use it.
- No regressions to `useBrightness.ts`'s existing exported API (Phase 3
  and other code may still rely on it).

**Do not:** touch subtitle logic, touch routing, redesign visuals beyond
what's needed for the volume slider to visually match brightness.

---

### Phase 2 — Video player: local subtitle import + modern visual pass

> **Rescoped 2026-08-20** — see §3B. The routing/hook-wiring half of
> the original combined Phase 2/3 write-up is done (that's now Phase
> 3's retroactive ✅). `SourceSelectionModal.tsx` no longer exists (no
> multi-source switching needed with a single licensed backend) — drop
> any reference to it. `SubtitlesModal.tsx` still exists and is already
> wired into `VideoPlayerScreen.tsx`, but has **no local-file-import
> option** — that's this phase's real remaining scope, alongside the
> visual modernization that was always part of Phase 2.

**Goal:** Add local `.srt` import to the subtitle picker, and give the
player controls a modern visual pass (the "old fashioned" complaint
from the original ask — dated-looking bars/buttons should become
something with proper spacing, rounded glass-like surfaces, better
iconography weight, smooth fades).

**Scope:**
- Extend `src/hooks/useSubtitles.tsx` with a `loadLocalSubtitle(uri,
  fileName)` method: read the file with
  `import * as LegacyFileSystem from 'expo-file-system/legacy'` (SDK
  55's new `expo-file-system` API differs — check whether any other
  current hook still uses this legacy-import pattern now that
  `useStreamExtraction.ts` is gone; if none do, verify the legacy
  import still works under SDK 55 before relying on it), parse with the
  existing `parse-srt` package, feed into the same
  `parsedSubtitles`/`subtitlesEnabled` state so existing timing logic
  "just works" for local files too. Support `.srt` only for now; show a
  clear error (via `useAlert`'s `showAlert`) for unsupported formats.
- Add `expo-document-picker` to `package.json` if it isn't already
  there (check first — an earlier session may have added it; if not,
  add it matching the SDK 55 version range, e.g. `~55.0.x`).
- Wire an "Import from device" action into `SubtitlesModal.tsx`.
- Visual pass on `VideoControlsOverlay.tsx`, `BrightnessSlider.tsx`,
  `VolumeSlider.tsx`, `SeekIndicators.tsx`, `SubtitleOverlay.tsx`:
  modernize spacing/typography/icon sizing, add subtle blur/translucency
  behind control bars (`expo-blur` is not currently a dependency —
  confirmed absent as of the 2026-08-20 audit, add it). Keep all
  existing prop APIs intact unless you update every call site in the
  same patch.
- Decide what to do with `src/components/player/CCControls.tsx` —
  confirmed unused/dead as of the 2026-08-20 audit (not imported
  anywhere). Either wire it in if it does something
  `SubtitlesModal`/`SubtitleOverlay` don't, or flag it clearly for
  Phase 29's cleanup pass rather than leaving it silently dead.

**Acceptance criteria:**
- Subtitle language selection + local import both feed into the same
  `SubtitleOverlay` rendering path.
- Controls look visibly more modern than the current flat style, but
  functionality (play/pause, seek, episodes, subtitles, live indicator)
  is unchanged in behavior.

**Do not:** change licensed-backend playback logic, change routing.

---

### Phase 3 — Video player: routing fix + full hook wiring

> **Retroactively complete as of 2026-08-20 — do not redo this phase.**
> This was finished as part of the "remove piracy streaming layer /
> wire licensed backend" work (commits `3683dc6`..`f79fa43`), without a
> dedicated patch number recorded against this phase. Confirmed during
> the 2026-08-20 audit: `app/player/index.tsx` exists and handles
> query-param navigation; `DetailsScreenNew.tsx` (not `DetailsScreen.tsx`
> — see Known Issues) calls `router.push({ pathname: '/player', params:
> {...} })` using the object form, not template-literal query strings;
> `VideoPlayerScreen.tsx` (968 lines) wires `useVideoControls`,
> `useBrightness`, `useVolume`, `useBuffering`, `useSeekBar`,
> `useGestures`, `useWatchProgress`, `useSubtitles`, `useAutoPlay`,
> `useEpisodeNavigation`, and `useLicensedPlaybackSource` together. If a
> future session finds this is actually broken/incomplete in some
> specific way, treat that as a **bug report against working code**,
> not a reason to rebuild — scope a narrow fix, don't redo the whole
> phase.

Original goal/scope preserved below for historical context only:

**Goal (historical):** Make the player screen actually work end-to-end:
real navigation params, and every hook plus every component assembled
into `VideoPlayerScreen.tsx`.

---

### Phase 4 — Design system foundation

**Goal:** Establish reusable design tokens so phases 5–30 aren't each
inventing their own spacing/colors ad hoc.

**Scope:** Extend `src/contexts/ThemeContext.tsx` (already has `dark`/
`light` palettes with `gold`, `surfaceRaised`, `playerBackground`, etc.
— check it fully before adding) with: a proper 4/8pt spacing scale, a
type scale (display/heading/body/caption sizes+weights), radius scale,
elevation/shadow presets, and glass-specific tokens (blur intensity,
translucent surface colors for light/dark). Create
`src/theme/tokens.ts` (or extend the theme file directly — inspect
current file organization first and follow its existing conventions)
documenting all of it. This phase is **tokens and docs only** — no
screen visuals change yet.

**Acceptance criteria:** tokens exported and typed; a short
`src/theme/README.md` (or section in this file) explaining how future
phases should consume them.

---

### Phase 5 — Glassmorphism component primitives

**Goal:** Build the actual reusable glass/blur components every later
screen-redesign phase will use, so there's one consistent implementation.

**Scope:** New `src/components/glass/` folder:
`GlassCard.tsx`, `GlassPanel.tsx`, `BlurHeader.tsx`, `GlassButton.tsx`
(or similar — name sensibly). Built on `expo-blur` (add dependency if
missing) + tokens from Phase 4. Should support light/dark theme
automatically via `useTheme()`.

**Acceptance criteria:** components render correctly conceptually (can't
runtime-test, so review carefully), documented with prop tables in
comments, at least one usage example left in comments or a demo screen
under `app/` gated behind dev-only access (optional).

---

### Phase 6 — Apply glassmorphism to existing modals

**Goal:** Retrofit `EpisodesModal`, `SubtitlesModal`, `BufferingAlertModal`
(and any others found — `SourceSelectionModal` no longer exists, see §3B,
don't look for it) to use the Phase 5 primitives instead of flat
`#141414`/`#282828` solid backgrounds.

**Scope/acceptance:** visual only, no behavior changes; every modal's
existing props/callbacks stay identical.

---

### Phase 7 — Home screen redesign

**Goal:** Modernize `src/screens/home/HomeScreen.tsx` (single file —
there's no other file under `src/screens/home/`) plus
`src/components/FeaturedContent.tsx` (hero) and
`src/components/content/ContinueWatchingRow.tsx` — hero section, row
layout, scroll polish (parallax on hero as user scrolls is a nice pro
touch if `react-native-reanimated` — already a dependency — supports it
cleanly).

---

### Phase 8 — MediaCard / MediaRow visual overhaul

**Goal:** `src/components/MediaCard.tsx`, `MediaRow.tsx`,
`src/components/skeleton/SkeletonLoader.tsx` (the skeleton dir has just
this one file, despite the plural folder name) — modern press states
(scale/opacity feedback), better shimmer skeleton loading, consistent
card radii per Phase 4 tokens.

---

### Phase 9 — Details screen redesign

**Goal:** `src/screens/details/DetailsScreenNew.tsx` — **note the
filename**: earlier phases/discovery notes in this doc call it
`DetailsScreen.tsx`, that file does not exist, the real one is
`DetailsScreenNew.tsx`. Large file; modern hero image treatment, glass
action bar (play/download/add to list), animated section transitions
(cast, episodes, subtitles list, recommendations). This screen also
renders `src/components/comments/CommentItem.tsx` — that's currently the
*only* comments component (see Phase 21, the comments feature is
thinner than its own phase title implies).

---

### Phase 10 — Search screen redesign

**Goal:** `src/screens/search/SearchScreen.tsx`,
`src/components/search/AdvancedFilters.tsx`,
`src/components/search/SearchSuggestions.tsx` — live/typed results,
modern filter chips, proper empty and error states using the Phase 17
system if it exists yet (if not yet, use sensible interim styling and
flag it for a Phase 17 revisit).

---

### Phase 11 — Library / Downloads screen redesign

**Goal:** `src/screens/library/LibraryScreen.tsx`,
`src/screens/downloads/DownloadsScreen.tsx`,
`DownloadedMediaCard.tsx`, `DownloadProgressCard.tsx` — grid/list view
toggle, glass cards, download progress rings instead of flat bars.
`LibraryScreen.tsx.bak` and `DownloadsScreen.tsx.bak` sit next to the
live files — don't edit the `.bak` copies, and leave their cleanup to
Phase 28.

---

### Phase 12 — Settings screen redesign

**Goal:** `src/screens/settings/SettingsScreen.tsx` (a
`SettingsScreen.tsx.bak` also exists — same note as Phase 11, ignore it)
— grouped sections (iOS-Settings-app style groupings), modern switches,
a proper in-app theme picker UI (now that Phase 4's tokens support it).

---

### Phase 13 — Sports screen redesign

**Goal:** `app/sports.tsx`, `src/components/SportCard.tsx`,
`SportRow.tsx` — live badges, score ticker visual polish, modern layout
consistent with Phase 7/8's card language. There is no
`src/screens/sports/` directory — the whole screen lives in the single
`app/sports.tsx` route file plus the two shared components above.

---

### Phase 14 — Notifications screen

**Goal:** `src/screens/notifications/NotificationsScreen.tsx` (single
file), backed by `src/store/notificationsStore.ts` — modern list
styling, swipe actions (mark read / dismiss) if not present, empty
state.

---

### Phase 15 — Navigation shell redesign

**Goal:** `app/(tabs)/_layout.tsx`, `src/components/TopNavigation.tsx`,
`src/components/header/AnimatedHeader.tsx` (an `AnimatedHeader.tsx.bak`
also exists — ignore it, Phase 28 territory) — glass/blur tab bar,
active-tab motion (icon scale/color transition), header behavior on
scroll.

---

### Phase 16 — Global loading & skeleton consistency

**Goal:** Audit every screen for ad hoc `ActivityIndicator` usage vs.
`src/components/skeleton/*` — make loading states consistent
app-wide using the Phase 4 tokens.

---

### Phase 17 — Global error/empty state system

**Goal:** Build one reusable `EmptyState`/`ErrorState` component (with
illustration/icon, message, optional retry action) and replace ad hoc
inline error text across screens (search results, downloads, library,
etc.) with it.

---

### Phase 18 — Micro-interactions & animation pass

**Goal:** Use `react-native-reanimated` (already a dependency) for
button press feedback, screen-transition polish, and haptics (add
`expo-haptics` if missing) on key interactions (play button, download
start, add-to-list, tab switch).

---

### Phase 19 — Continue Watching panel redesign

**Goal:** `src/components/ContinueWatchingPanel.tsx` — progress rings
instead of bars, swipe-to-remove, glass card treatment.

---

### Phase 20 — Downloads UX pass

**Goal:** `src/services/downloadManager/*`,
`src/services/DownloadManager.ts` — confirmed still duplicated as of
this audit: `src/services/DownloadManager.ts` (single file) vs.
`src/services/downloadManager/` (a whole folder: `DownloadManager.ts`,
`DownloadQueue.ts`, `FFmpegConverter.ts`, `HLSDownloader.ts`,
`MP4Downloader.ts`, `StorageManager.ts`, plus its own
`CleanupService.ts` and `NetworkMonitor.ts` that also duplicate the
top-level `src/services/CleanupService.ts` and
`src/services/NetworkMonitor.ts`). That's three duplicated
service pairs, not one — resolve/document which set is canonical before
touching UI. Download queue UI + storage usage bar work should sit on
top of whichever set wins.

---

### Phase 21 — Comments / social features UI pass

**Goal:** `src/components/comments/*`, `src/services/comments/*` —
modernize UI, ensure consistent theming. As of this audit the comments
feature is minimal: `src/components/comments/CommentItem.tsx` is the
only component (rendered from `DetailsScreenNew.tsx`, see Phase 9) and
`src/services/comments/commentService.ts` is the only service file —
there's no list/thread/composer component yet. This phase may need to
build those, not just "modernize" existing ones — flag scope with the
human before assuming it's a pure visual pass.

---

### Phase 22 — Licensed backend integration audit

> **Repurposed 2026-08-20** — this phase originally covered
> "watch-together" polish keyed off `modules/mavin-engine`. That native
> module (and all of `modules/`) no longer exists — it was removed in
> the "remove piracy streaming layer" commits (see §3B). No
> `listentogether.*`/`together.*` watch-together code was found either;
> the feature appears to not exist in the current app at all. Rather
> than leave this phase orphaned, it now covers the thing that actually
> replaced that architecture and has never been audited: the licensed
> playback backend.

**Goal:** Review `src/services/licensedPlayback/LicensedPlaybackService.ts`
and `src/hooks/useLicensedPlaybackSource.ts` in full. As of this audit
the backend is described (in the Phase 4 piracy-removal commit message)
as "a working Render placeholder" — confirm what that means concretely:
is it a real, deployed licensed-content backend, a stub returning fake
URLs for development, or something in between? Check error handling
(network failure, no-source-available, expired-license responses),
check whether the Render URL is hardcoded or environment-configured,
and document the actual current playback flow end-to-end (Details
screen → `useLicensedPlaybackSource` → `LicensedPlaybackService` →
`VideoPlayerScreen`) so future phases touching playback aren't
guessing. If the backend is genuinely just a placeholder, say so
plainly and flag what a real integration would need — don't imply it's
production-ready if it isn't.

**Do not:** change the backend's actual behavior/contract unless a
clear bug is found — this phase is primarily an audit + documentation
pass, matching the "polish"-level effort the original phase intended.

---

### Phase 23 — Accessibility pass

**Goal:** Dynamic text scaling support, `accessibilityLabel`s on
interactive elements app-wide, contrast check against Phase 4's tokens
(especially light theme).

---

### Phase 24 — Performance pass

**Goal:** Audit `OptimizedImage.tsx`/`ImagePlaceholder.tsx` usage
coverage, `FlatList`/`RefreshableFlatList` virtualization settings
(`initialNumToRender`, `windowSize`, `getItemLayout` where lists are
fixed-size), unnecessary re-renders (missing `memo`/`useMemo`/
`useCallback` in hot paths like row renderers).

---

### Phase 25 — Error boundary & crash resilience pass

**Goal:** `src/components/ErrorBoundary.tsx` — ensure it wraps all major
screens/route groups, has a proper modern fallback UI (using Phase 17's
EmptyState/ErrorState system), and logs errors somewhere useful.

---

### Phase 26 — Onboarding / first-run experience

**Goal:** Check if any onboarding flow currently exists (search `app/`
and `src/screens/` — none was found during the discovery session, but
re-verify). If absent, design a minimal, tasteful first-run flow
(permissions priming for brightness/volume/notifications, theme choice).
If present, polish it to match the new design system.

---

### Phase 27 — Icon & branding pass

**Goal:** `assets/icon.png`, `assets/icon-dev.png`,
`assets/adaptive-icon.png`, `assets/splash-icon.png`,
`app.config.ts` — ensure consistent branding, proper adaptive icon
safe zones, splash screen matches the new theme.

---

### Phase 28 — Code health: dead file cleanup

**Goal:** The repo root has a lot of clutter accumulated from prior
sessions/debugging: `App.tsx.backup`, `App.tsx.bak`,
`app.config.ts.backup`, `package.json.backup`, `fix-navigation.js.bak`,
`index.ts.backup`, `dump1.txt`, `dump2.txt`, `dump2b.txt`,
`boxoffice_nitro_dump.txt`, `nitro_generated_dump.txt`,
`export_log.txt`, `gradle-error.txt`, `migration-log.txt`,
`research.ps1`, `fix-boxoffice-nitro.ps1`, `eventemitter_search_results.tsx`,
`project-structure.txt`, `folder-structure-tree.txt`,
`app-structure.txt`, stray zero-byte files (`$null`, `borderColor`,
`const`), `temp_wheels/`. **Confirm with the human before deleting
anything** — some of these may be intentionally kept for reference.
Recommend moving genuinely obsolete ones to a `.archive/` folder (git
history preserves them either way) rather than hard-deleting, unless
told otherwise.

---

### Phase 29 — TypeScript migration completion

**Goal:** Per `TYPESCRIPT-MIGRATION.md`, find remaining `.jsx`/untyped
`.js` files under `src/` and `app/` and convert them, adding proper
types. Cross-check against `migration-log.txt` if still present at this
point (see Phase 28) for what was already tracked as done/pending.

---

### Phase 30 — Final QA pass

**Goal:** Full read-through of every screen's styling against Phase 4's
design tokens for consistency (no leftover hardcoded hex colors that
should be theme tokens, no leftover flat-black modals that should be
glass per Phase 5/6, consistent spacing). Write a short retrospective
in this file (`## Retrospective` section) summarizing what shipped
across all 30 phases and any follow-up work for a "Phase 31+" if the
human wants to keep going.

---

## 5. KNOWN ISSUES / NOTES FOR NEXT SESSION

*(Each session should append findings here — don't delete prior
entries, just add yours with your phase number and date.)*

- **[Phase 6, complete, 2026-08-22]** Retrofitted `BufferingAlertModal.tsx`,
  `SubtitlesModal.tsx`, and `EpisodesModal.tsx` (video's `SourceSelectionModal`
  no longer exists, per §3B — nothing to do there) onto the Phase 5 glass
  primitives (`GlassPanel`/`GlassButton`). Confirmed every prop each modal
  destructures still matches exactly what `VideoPlayerScreen.tsx` passes
  in before committing (diffed the destructure list against git HEAD,
  then grepped the actual `<EpisodesModal .../>`/`<SubtitlesModal .../>`/
  `<BufferingAlertModal .../>` call sites) — no behavior changes, visual
  only, per this phase's scope.
  - Found and fixed a real bug while touching `SubtitlesModal.tsx`: it
    had a **duplicate `export default SubtitlesModal;`** at the end of
    the file (two identical export lines), which would fail to
    compile/bundle. Not something Phase 6 was asked to look for, but it
    was sitting right there in the file this phase already needed to
    touch, so fixed it in the same pass rather than leaving a broken
    file for whoever hit it next.
  - Found, deliberately NOT fixed (out of scope for a visual-only
    phase): `EpisodesModal`'s `onSelectEpisode` callback, in
    `VideoPlayerScreen.tsx`, builds its navigation URL with
    `new URLSearchParams({...}).toString()` +
    `router.push(`/player?${queryParams}`)` — the same
    template-literal-query-string pattern that Phase 2/3 already fixed
    elsewhere (`useAutoPlay.ts`, `DetailsScreenNew.tsx`) in favor of
    `router.push({ pathname, params })` object form. This one manually
    `encodeURIComponent`s each value so it's less broken than the
    original `DetailsScreen` bug was, but it's still inconsistent with
    the object-form pattern established elsewhere, and worth
    normalizing in whichever phase next touches `VideoPlayerScreen.tsx`'s
    episode-selection logic — did not touch it here since it's
    functional, not visual, and this phase's acceptance criteria is
    explicitly "no behavior changes."
  - Also noticed in that same callback: it already passes a `subtitles`
    param built from `JSON.stringify(subtitleTracks)` on episode switch.
    This doesn't contradict the Phase 2 finding that the **licensed
    backend** has no subtitle data of its own — `subtitleTracks` here is
    local hook state (OpenSubtitles results / locally-imported tracks
    already loaded into `useSubtitles`), not something the backend
    response provides. Phase 22's backend audit is still the right place
    to confirm whether the backend itself could ever supply tracks.
  - `GlassButton` has no built-in way to accent/color an individual
    button's label (e.g. a "destructive" or "primary" action) — worked
    around this in `BufferingAlertModal` with a border-color tint
    instead. If a future phase wants a proper `labelColor`/`variant`
    prop on `GlassButton`, that's a small additive change to a Phase-5
    file, not a Phase-6 concern.

- **[Phase 5, complete, 2026-08-21]** Added `src/components/glass/`:
  `GlassPanel.tsx` (base — BlurView + translucent border + optional
  elevation), `GlassCard.tsx` (GlassPanel + card padding + optional
  `onPress`), `BlurHeader.tsx` (safe-area-aware header bar, left/
  center/right slots), `GlassButton.tsx` (icon-only circular or
  icon+label pill button), plus an `index.ts` barrel. All four consume
  `src/theme/tokens.ts`'s `getGlassTokens`/`getElevation`/`SPACING`/
  `RADIUS`/`TYPOGRAPHY` from Phase 4 rather than hardcoding their own
  numbers, and read colors via `useTheme()` so they follow light/dark
  mode automatically. Verified `ThemeColors`/`ThemeContextValue`'s
  actual shape in `ThemeContext.tsx` directly before writing the
  `{ colors, isDark }` destructuring used throughout, rather than
  assuming it matched Phase 4's tokens file usage example.
  - Each component's usage example lives in its own top-of-file
    comment block (satisfies the "at least one usage example... in
    comments" acceptance criterion). Did **not** add the optional
    dev-only demo screen under `app/` — the phase text marked it
    optional, and adding a new route felt like unnecessary risk for a
    components-only phase where nothing renders on screen yet anyway
    (nothing consumes these components until Phase 6+ retrofits the
    existing modals). If a future session wants a visual sanity-check
    screen before Phase 6 starts wiring things in, that's still open.
  - Not yet wired into anything — per Phase 5's own scope, retrofitting
    existing modals onto these primitives is Phase 6's job, not this
    one. Nothing to functionally test/break in this phase since no
    existing screen imports from `src/components/glass/` yet.

- **[Phase 4, complete, 2026-08-21]** Added `src/theme/tokens.ts` +
  `src/theme/README.md`. Tokens-and-docs only, exactly per scope — no
  screen visuals touched, `ThemeContext.tsx`'s colors/logic untouched.
  Note for Phase 5 (glass primitives): `getGlassTokens(colors, isDark,
  overrideTint?)` defaults `tint` to follow `isDark` (for general
  app-UI glass — cards/modals/headers should blend into the current
  theme mode), and only forces `tint: 'dark'` when you explicitly pass
  `overrideTint: 'dark'` (intended for glass over video/media content
  specifically, like the Phase 2 player controls, which stayed
  hardcoded `tint="dark"` in-place rather than being retrofitted onto
  these tokens in this pass — Phase 2 was already ✅ before Phase 4
  existed, and retrofitting it wasn't in Phase 4's scope; a later phase
  can migrate it to use `getGlassTokens(..., overrideTint: 'dark')` for
  consistency if desired, but it isn't required — it already works).
  Phase 5 should import `SPACING`/`RADIUS`/`TYPOGRAPHY`/`getElevation`/
  `getGlassTokens` from `src/theme/tokens.ts` rather than re-deriving
  its own numbers, per the README.

- **[Phase 2, complete, 2026-08-20]** Finished the remaining Phase 2
  scope from the previous partial session:
  - `useAutoPlay.ts`'s `playNextEpisode` no longer calls the dead
    `navigation.replace('VideoPlayer', ...)` React Navigation API —
    confirmed via `useNavigation()` that expo-router's navigation
    object has no screen literally named `'VideoPlayer'` (routes are
    file-based), so this silently did nothing. Switched to
    `router.replace({ pathname: '/player', params: {...} })`, matching
    the same param shape (`mediaId`, `mediaType`, `title`,
    `episodeTitle`, `poster_path`, `season`, `episode`) already used by
    `DetailsScreenNew.tsx` and the `EpisodesModal` episode-select
    handler in `VideoPlayerScreen.tsx`. Removed the now-fully-unused
    `useNavigation` import/`navigation`/`navigationRef` from
    `VideoPlayerScreen.tsx` as a direct consequence, not a separate
    cleanup pass.
  - Checked (not fixed): `DetailsScreenNew.tsx` not populating a
    `subtitles` route param is **not a frontend bug** — grepped
    `LicensedPlaybackService.ts` and `useLicensedPlaybackSource.ts` for
    any mention of subtitles and found none. The licensed backend
    (still "a working Render placeholder" per the Phase 4 commit) does
    not return subtitle track data at all right now, so there's
    nothing to wire through on the frontend side. This belongs to
    Phase 22's licensed-backend audit, not Phase 2 — don't attempt to
    fix this in the player/details screens without first confirming
    the backend can actually supply subtitle URLs.
  - Modern visual pass done on `VideoControlsOverlay.tsx`,
    `BrightnessSlider.tsx`, `VolumeSlider.tsx`, `SeekIndicators.tsx`:
    glass/blur capsules (`expo-blur`) for the brightness/volume
    sliders and seek indicators, gradient scrims (`expo-linear-gradient`,
    already a dependency) replacing the old flat black overlay,
    circular glass buttons for play/pause/mute, glass bottom bar with
    rounded top corners, refined progress-bar thumb (smaller, glowing).
    Diffed every change against the previous file before committing —
    all prop names/callbacks are unchanged, confirmed against exactly
    how `VideoPlayerScreen.tsx` calls `<VideoControlsOverlay ... />`
    (nothing dropped; a couple of props/styles that verifiably weren't
    referenced anywhere in the original JSX either, like `seekThumb`
    and the `isChangingSource`/`isInitialLoading`/`videoUrl` props,
    were the only things not carried forward as dead code).
    `SubtitlesModal.tsx` was NOT touched in this pass (already
    modernized in the prior partial session per patch `0018`).
  - Not touched, still open for a future phase/session:
    `src/components/player/CCControls.tsx` remains confirmed dead code
    (still not imported anywhere) — the rewritten Phase 2 text gave two
    options (wire it in or flag for Phase 29); this session flagged it
    rather than wiring it in, since it wasn't clear it does anything
    `SubtitlesModal` doesn't already cover, and guessing at reviving
    dead code without understanding its original intent seemed riskier
    than leaving it for the dedicated cleanup phase.

- **[Phase 2, partial, 2026-08-20]** Fixed the actual subtitle
  rendering bug (this is what the original "video page isn't showing
  subtitles" complaint was about): both subtitle systems
  (OpenSubtitles search via `useSubtitles.tsx`, and licensed-backend
  `subtitleTracks`) were previously non-functional — `findSubtitles()`
  was never called, and the licensed-backend path just set the on-screen
  text to the literal string `'Subtitle loaded'` forever instead of
  parsing real timed cues. Both now feed one real pipeline; added
  `loadTrackSubtitle()` (handles `.srt`/`.vtt`) and `loadLocalSubtitle()`
  (device `.srt` import via `expo-document-picker`) to
  `useSubtitles.tsx`; wired local import into `SubtitlesModal.tsx` as a
  new list entry; gave `SubtitlesModal.tsx` a glass/blur visual pass
  (`expo-blur` added to `package.json`).
  **Still not done from this phase's original scope:** the visual pass
  on `VideoControlsOverlay.tsx`, `BrightnessSlider.tsx`,
  `VolumeSlider.tsx`, `SeekIndicators.tsx` — only `SubtitlesModal.tsx`
  got modernized so far. Whoever picks this up next should do that
  visual pass, not redo the subtitle-pipeline fix (that part is
  genuinely done — verify by reading `VideoPlayerScreen.tsx`'s subtitle
  wiring before assuming it's still broken).
  Also worth double-checking: `DetailsScreenNew.tsx` still doesn't
  populate `subtitlesParam` at all (confirmed via `grep -i subtitle` on
  that file returning nothing) — so the licensed-backend track path,
  while now functional in the player, has no current source feeding it.
  Whether that's in scope for a future session or intentionally
  deferred (relying on OpenSubtitles + local import only) is an open
  question, not a bug in what was fixed here.

- **[Doc reconciliation, 2026-08-20]** Full reconciliation pass against
  the piracy-removal/licensed-backend commits — see §3B for the
  complete write-up. Summary of what changed in this same patch:
  - `package.json`: removed the two orphaned dependencies
    `"mavin-engine": "file:./modules/mavin-engine"` and
    `"pawns": "file:./modules/pawns"` — both pointed at a folder
    (`modules/`) that no longer exists, which would have made `npm ci`
    fail outright on a clean clone. If you ever see these reappear
    (e.g. from a merge with an old branch/commit), remove them again.
  - Status table: Phase 2 rescoped (local subtitle import + visual
    pass only — remote subtitles/routing already work), Phase 3 marked
    ✅ retroactively complete, Phase 22 repurposed from "watch-together
    polish" (feature doesn't exist) to a licensed-backend audit.
  - Phase 2/3 detail sections rewritten to drop references to deleted
    files (`useStreamExtraction.ts`, `SourceSelectionModal.tsx`, VidSrc/
    Xyra/Consumet adapters).
  - Confirmed `react-native-nitro-modules`/`nitrogen` remain in
    `package.json` and were **not** removed — they're general-purpose,
    not specific to the deleted `boxoffice` module — but flagged for a
    `grep -r "nitro" src app` check whenever a phase next touches
    dependencies, in case they've also gone unused.
  - Checked, still broken: `useAutoPlay.ts` line ~103 still calls
    `navigation.replace('VideoPlayer', nextDetails)` — dead React
    Navigation API, never migrated to expo-router's `router.replace`.
    This means **autoplay-next-episode is likely non-functional** right
    now (the `navigation` object it receives probably doesn't have a
    React-Navigation-style `.replace(routeName, params)` method in an
    expo-router app). Not fixed in this pass since it's a functional
    change beyond doc reconciliation — flagged here as a concrete bug
    for whichever phase next touches the player (Phase 2, or its own
    quick fix if the human wants it sooner).

- **[CI fix, 2026-08-20]** `.github/workflows/android.yml` previously
  only triggered on push to `main` (so pushes to `termux` never built
  anything), and its cleanup step deleted **every** GitHub release on
  every run, always publishing to a single shared tag
  `android-apk-latest` — meaning a build on either branch would wipe
  out whatever the other branch had just published. Fixed on both
  branches (separate patches, since `main` and `termux` have diverged
  and each needs its own copy patched): `termux`'s trigger now includes
  `termux`; cleanup on both branches now only deletes that branch's own
  previous release; release tag/name are branch-scoped
  (`android-apk-main`, `android-apk-termux`); only `main`'s release gets
  GitHub's "Latest" badge, `termux` still gets its own always-current
  release without the badge. **If you add a third branch that needs its
  own CI build, remember to add it to that branch's own copy of the
  trigger list** — GitHub Actions reads the workflow file as it exists
  on the branch/ref being pushed to, not from `main`.
- **[Doc-staleness flag, 2026-08-20]** This file's Section 3/3A audit
  and much of Phases 2–30 below were written against an earlier state
  of `termux` and still reference files/services that the
  "Phase 1–4: remove piracy streaming layer / wire licensed backend /
  remove Supabase" commits (`3683dc6`..`f79fa43`) have since deleted or
  replaced (e.g. `useStreamExtraction.ts`, VidSrc/Xyra/Consumet
  adapters, `src/utils/streamExtractor.ts` no longer exist on
  `termux`). Those four commits are **not reflected in the Section 2
  status table at all** — they happened outside this doc's phase
  numbering. Before running any further phase on `termux`, especially
  anything touching playback/streaming (Phases 1–3) or state/services
  (referenced in Known Issues above), **re-audit the actual current
  file tree first** rather than trusting this doc's file paths — a full
  reconciliation pass (re-numbering or explicitly absorbing the
  piracy-removal work into the tracked phases, updating every stale
  file reference) is still needed and hasn't been done yet.

- **[Pre-Phase-1, discovery session]** `src/components/SourceSelectionModal.tsx`
  and `src/components/SubtitlesModal.tsx` exist at the top level of
  `src/components/` (not under `src/components/video/`) and appear
  unused. Also `src/components/player/CCControls.tsx` (a captions
  control) appears unused. Check all three before building new
  equivalents in Phases 2/3.
- **[Pre-Phase-1, discovery session]** Possible duplication between
  `src/services/DownloadManager.ts` and
  `src/services/downloadManager/DownloadManager.ts` — not investigated,
  flagged for Phase 20.
- **[Pre-Phase-1, discovery session]** `useAutoPlay.ts`'s
  `playNextEpisode` calls `navigation.replace('VideoPlayer', ...)` —
  dead React Navigation API from before the expo-router migration.
  Must be fixed in Phase 3.
- **[Pre-Phase-1, discovery session]** Two parallel "Together"
  (watch-together) systems reportedly exist per earlier project history
  (`listentogether.*` protobuf-based, `together.*` JSON-based) —
  unconfirmed whether both are still present; check in Phase 22.
- **[2026-08-17, doc-audit session]** The video player is substantially
  built already, not a stub — see Section 3A for the full correction.
  Phase 1's real remaining scope is drag-to-seek + volume gesture only;
  Phase 3's real remaining scope is verification, not construction.
- **[2026-08-17, doc-audit session]** `DetailsScreen.tsx` does not
  exist anywhere in this repo — the real file is
  `src/screens/details/DetailsScreenNew.tsx`. Every mention of
  `DetailsScreen.tsx` in this doc (Section 3, Phase 3, Phase 9) refers
  to that file.
- **[2026-08-17, doc-audit session]** Three parallel state-management
  systems coexist: `src/store/zustand/*` (what `app/_layout.tsx`,
  `ThemeContext.tsx`, `useApp.ts`, and the top-level
  `CleanupService.ts`/`DownloadManager.ts`/`NetworkMonitor.ts` actually
  import), plus two separate Redux Toolkit stores
  (`src/store/store.ts` and `src/store/rtk/store.ts`, the latter with
  `redux-persist` and its own `streamingApi`) that don't appear to be
  wired into the live app. Needs a decision (keep Zustand, delete the
  Redux stores, or something else) before Phase 24's dead-code/perf
  audit — flagged as a candidate for its own phase (30+) rather than
  silently deleted by a later phase without the human's sign-off.
- **[2026-08-17, doc-audit session]** `modules/python-scraper/` exists
  as an empty directory in a fresh clone (not a registered git
  submodule — no `.gitmodules` file). Worth asking the human whether
  it's meant to hold something that never got committed, or is dead
  scaffolding — don't build against it assuming content will appear.
- **[2026-08-17, doc-audit session]** Root-level clutter for Phase 28 is
  larger than originally listed: also present are `check.ps1` (~101KB),
  `rn_complete_structure.txt`, `run_export.bat`, and a **19MB `Demo.mp4`**
  committed at repo root (worth asking the human if that should move to
  Git LFS or out of the repo entirely — it bloats every clone). Also
  `.bak` copies of `LibraryScreen.tsx`, `DownloadsScreen.tsx`,
  `SettingsScreen.tsx`, and `AnimatedHeader.tsx` sit next to their live
  versions (screens/components, not just repo root — Phase 28's original
  scope only mentioned root-level files).
- **[2026-08-17, doc-audit session]** No remaining `.jsx`/untyped `.js`
  files were found under `src/` or `app/` in this audit — Phase 29
  (TypeScript migration) may already be effectively done; next session
  on that phase should verify and, if so, just confirm/close it rather
  than hunt for files that aren't there.
- **[Phase 1, 2026-08-17]** Implemented as scoped in Section 3A rather
  than the original Phase 1 write-up: drag-to-seek and volume were
  **added** to the existing `useGestures.ts`/`useSeekBar.ts`/
  `useBrightness.ts`, not built as a brand-new isolated layer. New:
  `src/hooks/useVolume.ts` (mirrors `useBrightness.ts`),
  `src/components/video/VolumeSlider.tsx` (mirrors `BrightnessSlider.tsx`,
  right-aligned). `useSeekBar.ts` gained `beginExternalSeek` /
  `previewExternalSeek` / `commitExternalSeek` / `cancelExternalSeek` so
  the new drag-anywhere-on-video seek reuses the *same* preview box and
  commit logic as the existing progress-bar drag, instead of
  duplicating it. `useGestures.ts` gained a single `Gesture.Pan` (in
  `Gesture.Race` alongside the existing pinch/double-tap/tap gestures)
  that resolves to seek/brightness/volume based on drag direction and
  which half of the screen the drag started on, mirroring the
  brightness slider's left-side convention for volume on the right.
  **Not done, left for a later phase/pass:** this is unrun/unbuilt code
  (no sandbox emulator, per Section 0) — the human should smoke-test on
  device before relying on it, in particular the drag sensitivity
  constants (`secondsPerScreenWidth`, the 200px brightness/volume
  sweep) which are a first guess, not tuned against a real screen.

---

## 6. QUICK REFERENCE — key files a new session will likely need

- Player hooks: `useVideoControls.ts`, `useBrightness.ts`,
  `useVolume.ts`, `useBuffering.ts`, `useSeekBar.ts`, `useGestures.ts`,
  `useWatchProgress.ts`, `useEpisodeNavigation.ts`, `useSubtitles.tsx`,
  `useAutoPlay.ts`, `useLicensedPlaybackSource.ts` (replaces the old,
  now-deleted `useStreamExtraction.ts` — see §3B)
- Player screen: `src/screens/player/VideoPlayerScreen.tsx` (968 lines
  as of 2026-08-20 — already wires all the hooks above, see §3B)
- Licensed playback: `src/services/licensedPlayback/LicensedPlaybackService.ts`
  (see repurposed Phase 22)
- Player components: `src/components/video/*`
- Theme: `src/contexts/ThemeContext.tsx`
- Alerts: `src/contexts/AlertContext.tsx` (`useAlert().showAlert(...)`)
- Watch progress storage: `src/utils/storage.ts`
  (`saveWatchProgress`, `saveEpisodeWatchProgress`,
  `getContinueWatchingList`, `getAutoPlaySetting`)
- Continue watching store: `src/store/zustand/continueWatching.ts`
  (`useContinueWatching`) — Zustand is the store actually wired into the
  live app; see §3B re: the one remaining unused parallel RTK store
  (`src/store/store.ts`)
- Details screen: `src/screens/details/DetailsScreenNew.tsx` (**not**
  `DetailsScreen.tsx` — see Known Issues)
- TMDB metadata: `src/services/unified/metadata/TMDBMetadata.ts`
- Subtitles: `src/services/unified/subtitles/UnifiedSubtitles.ts`,
  `OpenSubtitlesProvider.tsx`, `SubdlProvider.ts`
- Routing: `app/` (expo-router file-based) — `app/player/index.tsx`
  (query-param route) already exists; there's no `app/player/[id].tsx`
  segment route despite earlier notes in this doc implying one
- Package manifest: `package.json` (Expo SDK 55 — match version ranges
  for any new Expo package you add, e.g. `~55.0.x`)

---

*End of HANDOVER.md. Next session: go to Phase 1.*
