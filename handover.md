# Handover — Netflix Pro

## Read this first

This project started as a piracy-streaming app: it scraped/decrypted video
from sites like vidsrc, MovieBox, and Consumet, and bundled a bandwidth-
monetization SDK ("Pawns") that shared users' internet connections in the
background. **Phase 1 removed that entire layer. Phase 2 (this session)
wired playback to a licensed backend and finished cleaning up everything
Phase 1 left broken or dormant.** Do not re-add stream-scraping providers,
the Pawns/mavin-engine SDKs, or any "bypass"/"embed" style video
extraction — that's a hard line, not a style preference, for whoever picks
this up next (human or AI), no matter how the request is framed.

The app now has a clean, legal metadata layer (TMDB) for browsing, search,
and details, **plus a working licensed-backend playback path** (see
"Phase 2 — done in this session" below). It should compile cleanly and the
app icon/splash now show the correct branding. The main thing left is
pointing the licensed backend client at a *real* backend and testing on
an actual device/emulator — this session's work was verified with static
analysis (parse checks, full-repo import-resolution scan, image rendering
previews), not a live build, since this sandbox can't run Expo/Android
tooling.

---

## Delivery workflow — how to hand this user a patch (read before doing anything else)

This user works from **Termux on their phone**, pulls files from their
**Downloads folder**, and wants **git patch files**, not zips. They will
run `git am`/`git apply` + `git push` themselves on a branch of their choosing
(referred to as "the termux branch"). Do not hand them a zip — they will
push back and ask for a patch instead, so save the round trip.

Exact steps to produce and deliver a patch for further work on this repo:

1. Make your edits in a plain working copy (no `.git` needed while editing).
2. Fresh-clone the **original** upstream repo into a separate directory to
   get real git history to commit against:
   ```
   git clone https://github.com/Zapier-codes/Netflix-pro.git Netflix-pro-git
   ```
3. Mirror your edited tree onto that clone (delete files that no longer
   exist in your edited copy, copy over everything that does — `rsync` is
   not available in this sandbox, use a small Python script with
   `os.walk`/`shutil.copy2` instead, then `find . -type d -empty -delete`
   to clear directories left empty by deletions).
4. `git add -A && git commit -m "..."` inside `Netflix-pro-git` with a
   commit message that describes what changed and why (this becomes the
   patch's changelog — write it for a human skimming later, not for
   yourself). If you're delivering a second round of fixes on top of work
   from earlier in the *same* session that hasn't been pushed yet, prefer
   `git commit --amend` over stacking a second commit, so the user gets one
   clean patch instead of two to apply in order — only stack commits if the
   earlier one may have already been pushed/applied.
5. Generate the patch:
   ```
   git format-patch -1 HEAD -o /mnt/user-data/outputs/
   ```
   This produces a `NNNN-description.patch` file in the mailbox format
   `git am` expects (headers + commit message + diff all in one file).
   Use `-1 HEAD` for a single commit; use `-N HEAD~N` (or
   `<since>..<until>`) if you've made several commits and want them all
   as a numbered series. This format handles binary files (images, etc.)
   fine — no special handling needed for icon/asset changes.
6. Call `present_files` on the `.patch` file path. **Do not** zip it,
   and don't just print the diff inline — the user needs a real
   downloadable file, and it needs to already be a proper patch (not a
   raw `git diff`) so `git am` works and their commit message/authorship
   carries through.
7. Tell them plainly what branch to base it on (usually upstream
   `main`/current HEAD at clone time) and give the exact command. **They
   stay on their existing branch, which is called `termux` — do not tell
   them to `git checkout -b` a new one unless they explicitly ask for
   one.** Their patch files land in `~/storage/downloads/` in Termux, so
   the command is:
   ```
   cd Netflix-pro
   git am ~/storage/downloads/NNNN-description.patch
   git push origin termux
   ```
   If `git am` fails (dirty tree, conflicts), the fallback is
   `git apply ~/storage/downloads/NNNN-description.patch` which applies it
   as an uncommitted diff they can `git add -A && git commit` themselves.

Do this on the **first** attempt — don't hand over a zip "to start" and
redo it as a patch after the user has to ask twice. If you're not sure
whether they want a zip or a patch, ask before producing either.

---

## Phase 1 — removed entirely (files/dirs deleted)
- `modules/pawns/`, `modules/mavin-engine/`, `modules/boxoffice/`,
  `modules/python-scraper/` — bandwidth-sharing SDK + YouTube-extraction
  engine + piracy scraping module
- `src/components/EarningsConsentGate.tsx`, `src/services/PawnsService.ts`
  — the (non-genuine) consent flow for the bandwidth SDK
- `src/services/vidsrc-extractor/`, `src/api/xyra/`, `src/api/ApiService.ts`
  — the piracy stream backend + decoder
- `src/services/unified/providers/{vidsrc,consumet,moviebox,xyra}/` and
  their adapters in `providers/adapters/`
- `src/services/unified/metadata/{ConsumetMetadata,adapters/ConsumetMetadataAdapter,
  adapters/MovieBoxMetadataAdapter,adapters/XyraMetadataAdapter}.ts`
- `src/hooks/useStreamExtraction.ts`, `src/utils/streamExtractor.ts`
- Live "sports" streaming: `app/sports.tsx`, `src/screens/SportStreamsScreen.tsx`,
  `src/components/SportCard.tsx`, `src/components/SportRow.tsx` (same piracy
  pattern, different content type)
- `src/services/unified/subtitles/XyraSubtitleProvider.ts`
- Junk/scratch files at repo root, old test scripts and throwaway test screens
- **Committed secrets**: `env.b64`, `keystore.b64`, `android/keystore.properties`
  — deleted from the working tree, but **still in git history** — see
  "Urgent, not done" below, still open.
- `package.json` deps: `@consumet/extensions`, `@movie-web/providers`,
  `@hyrosrc/providers`, `boxoffice` (file dep), `cheerio`, `@types/cheerio`,
  `react-native-consumet`

## Phase 1 — rewired to a legit source (working, not stubbed)
- `src/hooks/search/useSearchSuggestions.ts` → TMDB `/search/multi` via
  `searchMedia()`. (Phase 2 note: this hook exists but has zero importers
  currently — `SearchScreen.tsx` calls `searchMedia()` directly instead,
  see below. Not broken, just currently dead code; harmless to leave.)
- `src/services/preloader/ThrillerPreloader.ts` → TMDB's official trailer
  key via `fetchMovieVideos`/`fetchTVVideos`, replacing YouTube-ripping.
- `src/components/thriller/ThrillerGrid.tsx` — poster + play badge instead
  of ripped-stream autoplay. No longer autoplays video in the grid; would
  need a real YouTube embed (WebView/iframe) to get that back.
- `src/components/MediaCard.tsx` — sports/live-stream card branch is now a
  no-op fallback instead of crashing. Sports live-stream cards are dead
  until/unless rebuilt on a licensed source.

## Already legit, untouched (both phases)
- `src/services/unified/metadata/TMDBMetadata.ts` — TMDB API layer, the
  backbone. Trending/popular/top-rated/search/details/videos/reviews/
  recommendations all present.
- `src/services/unified/metadata/KuryanaMetadata.ts` (+ adapter) — MyDramaList
  metadata mirror, metadata only, not a stream source.
- `src/services/unified/social/TraktService.ts` — real watch-tracking service.
- Subtitle providers (`OpenSubtitlesProvider`, `SubdlProvider`,
  `UnifiedSubtitles`) — legit subtitle APIs.

---

## Phase 2 — done in this session

**Direction chosen by the user for "Watch Now": a licensed backend they'll
provide.** Not a trailer-only fallback, not Jellyfin/Plex.

### Playback wired to a licensed backend
- **New: `src/services/licensedPlayback/LicensedPlaybackService.ts`** — thin
  HTTP client, no scraping, no embedded third-party keys. Configured via
  `EXPO_PUBLIC_LICENSED_BACKEND_URL` and `EXPO_PUBLIC_LICENSED_BACKEND_API_KEY`
  env vars. Expects `GET {baseUrl}/v1/playback?...` and
  `GET {baseUrl}/v1/download?...` returning `{ url, type, headers?, expiresAt? }`.
  **These env vars are not set yet and the endpoint contract is a guess** —
  next session needs the user's actual backend URL/key and its real
  response shape, then update this file's `LicensedPlaybackSource`/
  `LicensedDownloadSource` types and the two fetch calls to match.
- **New: `src/hooks/useLicensedPlaybackSource.ts`** — replaces the deleted
  `useStreamExtraction` hook. Much smaller: one direct URL per title
  instead of a multi-provider cascade.
- `src/screens/details/DetailsScreenNew.tsx` — "Watch Now", single-title
  downloads, and per-episode download lookups all call
  `getPlaybackSource()`/`getDownloadSource()` now.
- `src/screens/player/VideoPlayerScreen.tsx` — resolves playback through
  the licensed backend. **Removed entirely**: embed/torrent WebView player
  modes, the captcha WebView, and the multi-source selection modal
  (`SourceSelectionModal.tsx` deleted) — all piracy-bypass UI with no
  equivalent need against a single licensed source.
- `src/services/downloadManager/DownloadManager.ts` — `fetchAndStartDownload`
  now calls `getDownloadSource()` instead of `require()`-ing the deleted
  `VidSrcProvider`.

### Search / metadata layer
- `SearchScreen.tsx` — autocomplete now calls TMDB `searchMedia()` directly
  instead of the deleted MavinEngine module. Dead `moviebox`/`consumet`
  source options removed from types/config. The per-search stream-preload
  step (used to warm the old provider cascade) is gone.
- **Deleted** (dead code that still referenced already-deleted piracy
  files, or was an orphaned second copy of the piracy cascade never wired
  into the app): `UnifiedMediaService.ts`, `ProviderFactory.ts`,
  `ProviderRegistry.ts`, `StreamNormalizer.ts`,
  `providers/{ReactNativeFetcher,NoProxyFetcher}.ts`. The
  `ReactNativeFetcher.ts` one is worth knowing about specifically: it
  contained a full second `UnifiedMediaService`-style scrape engine
  (`@movie-web/providers`, hardcoded `vidsrc.to`/`2embed.cc` URLs) that
  nothing imported — inert, but exactly the kind of dormant bypass code
  that shouldn't exist in the repo.
- **New: `src/services/unified/MetadataService.ts`** — the legitimate
  metadata-only pass-through (`search`/`discover`/`getById`/`getTrending`,
  same mapping logic `UnifiedMediaService` used) that got pulled out before
  deleting `UnifiedMediaService.ts`. `SearchScreen.tsx` and
  `useSearchPreloader.ts` use this now.
- `MetadataAggregatorNew.ts` — removed imports of `MovieBoxMetadataAdapter`
  and `ConsumetMetadataAdapter` (also already-deleted files; this had been
  silently breaking metadata search/discover, not just streaming).

### Other dead piracy references found while tracing imports
- Deleted orphaned duplicates `src/services/DownloadManager.ts` and
  `src/services/CleanupService.ts` (unused copies of the real files under
  `src/services/downloadManager/`; both still had their own vidsrc/
  FluxSource references).
- Deleted orphaned `src/hooks/useMavin/` (unused hook calling the deleted
  MavinEngine native module directly).
- Deleted `src/utils/streamProcessors.ts` (unused, VidSrc-specific).
- `src/utils/storage.ts` — removed `DEFAULT_STREAM_SOURCES`/
  `FLUX_SOURCE_URL` and the stream-source-order helpers built on them.
- `src/utils/streamHeaders.ts` — removed a hardcoded `vidsrc.su` Origin/
  Referer fallback.
- `src/store/api/contentApi.ts` — removed three unused RTK Query endpoints
  labeled "Consumet API" that pointed at TMDB's base URL with Consumet-
  shaped paths (already non-functional — would 404 against TMDB — and
  never called anywhere).

### Pre-existing broken imports, unrelated to piracy, also fixed
Found while doing a full-repo static scan of every relative import
(re-run at the end of the session: **zero broken relative imports remain
anywhere in `src/` or `app/`**):
- `src/components/search/SearchSuggestions.tsx` / `AdvancedFilters.tsx` —
  `../../../contexts/ThemeContext` → `../../contexts/ThemeContext` (one
  directory too deep).
- `src/screens/notifications/NotificationsScreen.tsx` — import path typo
  (`services/notification/` → `services/notifications/`, singular vs the
  real plural folder name), plus several `case` branches with malformed
  template literals (stray `"` inside single-quoted fallback strings,
  e.g. `` 'a show"}"' ``) that failed to parse. Both fixed. **Note: this
  screen still isn't routed anywhere** (`app/` has no notifications route)
  — it now compiles but may still be unreachable in the UI; not
  investigated further, wasn't part of what broke.
- Deleted `src/services/unified/MetadataAggregator.ts` (old shim importing
  a nonexistent `./metadata/MetadataAggregator`, superseded by
  `MetadataAggregatorNew.ts`, zero importers) and `src/store/rtk/store.ts`
  (a whole orphaned duplicate Redux store importing a `./api/streamingApi`
  that never existed anywhere; zero importers — the store the app actually
  uses is `src/store/store.ts`, imported from `app/_layout.tsx`).

### App icon and splash screen (separate bug, also fixed)
Two distinct problems, both fixed:
1. **Wrong image entirely.** The native
   `android/app/src/main/res/mipmap-*/ic_launcher*.webp` and
   `drawable-*/splashscreen_logo.png` files were still the *old* "FLUX"
   branding (starfield background, white "FLUX" text) — a leftover from
   before this app was rebranded, never regenerated after
   `assets/icon.png` was updated. This is a native-build artifact issue,
   not an `app.config.ts` misconfiguration — the config already pointed
   at the right source files.
2. **Baked-in fake transparency.** `assets/icon.png` and its 3 byte-
   identical copies (`icon-dev.png`, `adaptive-icon.png`,
   `splash-icon.png`) had a light-gray checkerboard pattern baked in as
   real opaque pixels instead of true alpha (almost certainly an
   accidental flatten-and-export from a design tool's transparency
   preview). Converted to real alpha transparency in all 4 files using a
   grayness+brightness heuristic (pixels with low RGB channel spread and
   high brightness → transparent; a soft fade band for anti-aliased
   edges), then regenerated every native Android icon
   (mdpi/hdpi/xhdpi/xxhdpi/xxxhdpi — legacy `ic_launcher`,
   `ic_launcher_round`, adaptive `ic_launcher_foreground`) and every
   `splashscreen_logo.png` density from the corrected source, matching
   each file's existing pixel dimensions exactly.
   Verified by rendering composites (foreground layer over the app's
   `#141414` background color) and viewing them — icon and splash both
   correctly show the red "N PRO" logo now, not "FLUX", not a
   checkerboard box.
   Not touched (already correct): `colors.xml`'s `iconBackground` value
   and `mipmap-anydpi-v26/ic_launcher.xml`'s adaptive-icon layer
   config — both already matched `app.config.ts`, only the bitmaps
   themselves were stale.

---

## Phase 3 — done in this session

Started from "move to phase 3" after the person confirmed the Phase 2
patch was already applied and pushed to `origin/termux` (verified by
cloning fresh and comparing tree hashes — identical). Explicit
instruction: **leave the keystore/history-scrub item and the other
low-priority items alone for now.**

1. **Fixed the 4 broken imports flagged (but not yet fixed) at the end
   of Phase 2**, plus 2 more found while touching them:
   - `src/components/search/SearchSuggestions.tsx` and
     `AdvancedFilters.tsx`: wrong relative depth
     (`../../../contexts/ThemeContext` → `../../contexts/ThemeContext`).
   - `src/screens/notifications/NotificationsScreen.tsx`: wrong directory
     name (`services/notification/` → `services/notifications/`, the
     real dir is plural).
   - Deleted `src/services/unified/MetadataAggregator.ts` (old,
     non-"New" file — a dead re-export shim pointing at a deleted
     `metadata/MetadataAggregator.ts`, zero importers anywhere).
   - Deleted `src/store/rtk/store.ts` (an entire orphaned duplicate
     Redux store, zero importers, itself importing a
     `streamingApi.ts` that never existed in this repo).
   - While in `NotificationsScreen.tsx`: found and fixed a genuine
     pre-existing syntax bug unrelated to any of the above — several
     `case` branches had a stray `"` inside single-quoted fallback
     strings inside template literals (e.g. `'a show"}'`), which is a
     parse error, not just a lint nit.

2. **Fixed the app icon and splash screen.** This turned out to be two
   separate bugs, not one:
   - The native `android/app/src/main/res/mipmap-*/ic_launcher*.webp`
     and `drawable-*/splashscreen_logo.png` files were still the app's
     **old "FLUX" branding** (a starfield background with "FLUX" text) —
     leftover from before this app was rebranded, never regenerated
     after `assets/icon.png` was updated. This is a native-build
     artifact issue, not an `app.config.ts` misconfiguration — the
     config already pointed at the right source files.
   - `assets/icon.png` and its 3 byte-identical copies (`icon-dev.png`,
     `adaptive-icon.png`, `splash-icon.png`) had a light-gray
     checkerboard pattern baked in as real opaque pixels instead of
     true alpha (almost certainly an accidental flatten-and-export from
     a design tool's transparency preview). Converted to real alpha
     transparency in all 4 files using a grayness+brightness heuristic,
     then regenerated every native Android icon (mdpi through xxxhdpi —
     legacy `ic_launcher`, `ic_launcher_round`, adaptive
     `ic_launcher_foreground`) and every `splashscreen_logo.png`
     density from the corrected source, matching each file's existing
     pixel dimensions exactly.
   - Verified by rendering composites (foreground layer over the app's
     `#141414` background color) and viewing them — confirmed showing
     the red "N PRO" logo, not "FLUX", not a checkerboard box.

3. **Ran a real build-verification pass** — this is new; Phase 1/2 only
   had `@babel/parser` syntax checks and an import-resolution scan
   available, no toolchain. This session actually got `npm install` and
   `npx tsc --noEmit` running:
   - `npm install` initially failed: `package.json` pinned
     `react-native-volume-manager@^2.0.9`, which was never published
     (latest on npm is 2.0.8). Fixed the pin. Had to use
     `--legacy-peer-deps` for an unrelated react/react-dom peer version
     mismatch (19.2.0 vs required ^19.2.8) — not fixed, just worked
     around, since resolving it means picking a side in a pre-existing
     version conflict without knowing which one the person wants.
   - `tsc --noEmit` initially failed immediately on `tsconfig.json`
     itself: it explicitly overrides `moduleResolution: "node"` and
     `module: "commonjs"`, which conflict with `customConditions` and
     `moduleResolution: "bundler"` inherited from the project's own
     `expo/tsconfig.base`. Removed both overrides so the file cleanly
     inherits the Expo base config's values instead.
   - Real compilation then surfaced two more genuine parse errors,
     unrelated to piracy removal, that `@babel/parser` had never been
     asked to check because these files were never touched before now:
     `src/components/comments/CommentItem.tsx` and
     `src/services/comments/commentService.ts` both had template
     literals missing their backticks entirely (e.g. `return ${x}m;`
     instead of `` return `${x}m`; ``, and a Supabase channel/filter
     string with the interpolated `contentId` variable name stripped
     out: `` .channel(comments:) ``). Fixed both, reconstructing the
     obviously-intended Supabase realtime channel/filter strings
     (`comments:${contentId}`, `content_id=eq.${contentId}`).
   - With all of the above fixed, `tsc --noEmit` actually runs end to
     end now. It reports **~1056 pre-existing strict-mode errors**
     (`noUnusedLocals`/`noUnusedParameters`/implicit-`any` mostly),
     spread across ~60 files — the majority in files this project has
     never touched (e.g. `HLSDownloader.ts` alone has 178,
     `DownloadQueue.ts` 71, `MP4Downloader.ts` 69). This looks like a
     codebase that has never been run through `tsc --noEmit` cleanly —
     Metro/Babel transpile without enforcing types, so none of this
     ever blocked `expo start`. **Left alone per instruction** — this
     is the same category as the keystore/history item: real, but
     pre-existing and out of scope for piracy-removal/licensed-backend
     work. Two exceptions, both found and fixed because they were
     regressions in code touched this session, not pre-existing debt:
     - `src/store/api/contentApi.ts` had a genuine leftover duplicate
       `export default contentApi` block (with dead
       `useSearchMoviesQuery`/etc. re-exports) from an incomplete
       Phase-2 edit — "a module cannot have multiple default exports."
       Removed the duplicate block.
     - `src/screens/search/SearchScreen.tsx` had a dangling reference
       to `validStreams`, a variable removed during Phase 2's
       stream-preload cleanup but left behind in a return statement.
       Removed the reference.
     - Also fixed one real type error in `MetadataService.ts` (built
       this session): `type: type ? [type] : [...]` passed `'tv'`
       through unchanged, but `SearchRequest.type` expects `'show'` not
       `'tv'`. Now maps `'tv' → 'show'` explicitly.
   - **Confirmed pre-existing, not a regression**: `SearchScreen.tsx`
     has several `UnifiedMediaResult` vs `IMetadataResult` type
     mismatches (`discover()`/`search()` return one, `getTrending()`
     returns the other, then they get merged into one array/state slot
     expecting a single type). Checked this against the original
     deleted `UnifiedMediaService.ts` (recovered via `git show`) — it
     had the exact same signature split
     (`search`/`discover` → `Promise<UnifiedMediaResult[]>`,
     `getTrending`/`getTrendingByCategory` → `Promise<IMetadataResult[]>`).
     `MetadataService.ts` (this session's replacement) faithfully
     reproduced that same pre-existing inconsistency rather than
     silently picking one type and guessing which call sites need to
     change. Left alone.

---

## Next session — where to start

1. **Get the real licensed backend URL/key and its actual response
   shape from the user**, then:
   - Set `EXPO_PUBLIC_LICENSED_BACKEND_URL` / `EXPO_PUBLIC_LICENSED_BACKEND_API_KEY`
     (in whatever env-file mechanism this project uses — check
     `app.config.ts` for how other `EXPO_PUBLIC_*` vars are loaded).
   - Update `LicensedPlaybackSource`/`LicensedDownloadSource` types and
     the two `callBackend()` calls in `LicensedPlaybackService.ts` to
     match the real API's request params and response JSON shape — what's
     there now is a reasonable guess (`/v1/playback`, `/v1/download`,
     `{url, type, headers?, expiresAt?}`), not a confirmed contract.
2. **Finish the build/run pass.** `npm install` and `tsc --noEmit` now
   run for real (see "Phase 3" above) — that's static verification
   only. Still not done, and this sandbox has no Android/Expo toolchain
   to do it:
   - `npx expo prebuild` / build the Android APK — confirm a real Metro
     bundler pass succeeds, not just `tsc`.
   - Install and confirm the launcher icon and splash screen render
     correctly on a device — the fix was verified by
     compositing/viewing the generated bitmaps, not an installed APK.
   - Exercise "Watch Now" and downloads end-to-end once the backend URL
     is real, since `getPlaybackSource()`/`getDownloadSource()` have
     never been called against a live server.
3. **Decide what to do with the ~1056 pre-existing `tsc --noEmit`
   errors** found in Phase 3 (see above) — not blocking, not part of
   piracy removal, but real. Concentrated in the download-manager
   internals (`HLSDownloader.ts`, `DownloadQueue.ts`, `MP4Downloader.ts`,
   `NetworkMonitor.ts`, `StorageManager.ts`) and several hooks/screens.
   Mostly `noUnusedLocals`/`noUnusedParameters`/implicit-`any` noise,
   plus the one confirmed pre-existing `UnifiedMediaResult`/
   `IMetadataResult` type-contract split noted above.
4. **Still open from Phase 1, explicitly deferred twice now (Phase 2
   and Phase 3)**: `env.b64`, `keystore.b64`,
   `android/keystore.properties` are still in git **history**. Rotate
   whatever credentials/signing keys they contained, scrub them from
   history with `git filter-repo` or BFG (not just `git rm`), and add
   them to `.gitignore`. Independent of everything else — matters
   regardless of what happens with playback. The person has said
   explicitly to leave this for now; don't do it without them asking.
5. **Low-priority, found but intentionally not chased further** (same
   status as Phase 2 left them — still real, still unreachable, still
   not "fixed" by guessing intent):
   - `src/screens/notifications/NotificationsScreen.tsx` compiles now
     (Phase 3 fixed its import path and a syntax bug) but still has no
     route pointing to it anywhere in `app/`.
   - `src/hooks/search/useSearchSuggestions.ts` compiles but has zero
     importers (`SearchScreen.tsx` calls `searchMedia()` directly
     instead).
   - The `react`/`react-dom` peer-dependency version mismatch worked
     around (not fixed) to get `npm install` running (see Phase 3
     above) — `react@19.2.0` vs `react-dom` wanting `^19.2.8`.
   These aren't bugs to "fix" so much as things to ask the person
   about — were they meant to be wired in / resolved a specific way,
   or are they leftover from an earlier version of the app?

---

## Urgent, not done — do this regardless of the above

The repo has secrets **in git history** even though the files are gone from
the working tree now (`env.b64`, `keystore.b64`, `android/keystore.properties`).
Before this repo is pushed anywhere public:
1. Rotate whatever credentials/signing keys those files contained.
2. Scrub them from git history (`git filter-repo` or BFG Repo-Cleaner), not
   just `git rm`.
3. Add them to `.gitignore` going forward.

This is independent of the piracy-removal/playback work and matters no
matter what else happens next.

---

## Design constraint from the user

Keep the existing UI/UX, components, and navigation structure as-is —
this is a content-layer swap (piracy → licensed), not a redesign. TMDB
gives free access to metadata, posters, backdrops, cast, and trailer video
IDs, which covers browsing/search/details fully. It does not give full
movie/show video files. The user has confirmed the direction for actual
playback: **a licensed backend they'll provide** (not a trailer-only
fallback, not the user's own Jellyfin/Plex media server) — see "Phase 2 —
done in this session" above for what's wired up and "Next session" for
what's still needed to make it real.
