# Handover — Netflix Pro

## Read this first

This project started as a piracy-streaming app: it scraped/decrypted video
from sites like vidsrc, MovieBox, and Consumet, and bundled a bandwidth-
monetization SDK ("Pawns") that shared users' internet connections in the
background. **Phase 1, done in this session, removed that entire layer.**
Do not re-add stream-scraping providers, the Pawns/mavin-engine SDKs, or
any "bypass"/"embed" style video extraction — that's a hard line, not a
style preference, for whoever picks this up next (human or AI).

The app now has a clean, legal metadata layer (TMDB) for browsing, search,
and details. It has **no video playback source**. That's the main gap.

---

## Delivery workflow — how to hand this user a patch (read before doing anything else)

This user works from **Termux on their phone**, pulls files from their
**Downloads folder**, and wants **git patch files**, not zips. They will run
`git am`/`git apply` + `git push` themselves on a branch of their choosing
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
   yourself).
5. Generate the patch:
   ```
   git format-patch -1 HEAD -o /mnt/user-data/outputs/
   ```
   This produces a `NNNN-description.patch` file in the mailbox format
   `git am` expects (headers + commit message + diff all in one file).
   Use `-1 HEAD` for a single commit; use `-N HEAD~N` (or
   `<since>..<until>`) if you've made several commits and want them all
   as a numbered series.
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



### Removed entirely (files/dirs deleted)
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
- Junk/scratch files at repo root: all `.bak`/`.backup` files, `dump*.txt`,
  `*-structure.txt`, `*.ps1`/`.bat` one-off scripts, `wiring-report.txt`,
  `migration-log.txt`, `gradle-error.txt`, `export_log.txt`, `temp_wheels/`
  (a MovieBox downloader wheel), old test scripts (`test-vidsrc.*`,
  `test-boxoffice.ts`), and the throwaway test screens
  (`BoxOfficeTest*.tsx`, `VidSrcTestScreen.tsx`, `*QuickTest.tsx`)
- **Committed secrets**: `env.b64`, `keystore.b64`, `android/keystore.properties`
  — these were committed to git history. Deleting them from the working tree
  is NOT enough — see "Urgent, not done" below.
- `package.json` deps: `@consumet/extensions`, `@movie-web/providers`,
  `@hyrosrc/providers`, `boxoffice` (file dep), `cheerio`, `@types/cheerio`,
  `react-native-consumet`

### Rewired to a legit source (working, not stubbed)
- `src/hooks/search/useSearchSuggestions.ts` — was calling the mavin-engine
  YouTube-ripping module for autocomplete; now calls TMDB's `/search/multi`
  via `searchMedia()` in `TMDBMetadata.ts`.
- `src/services/preloader/ThrillerPreloader.ts` — was searching YouTube and
  extracting raw video-stream URLs (NewPipe-style, ToS-violating) for the
  autoplay "Thriller Grid". Now pulls the **official** trailer key from
  TMDB's `/movie|tv/{id}/videos` endpoint (`fetchMovieVideos`/`fetchTVVideos`).
  `ThrillerItem.videoUrl/duration/uploaderName/viewCount` → replaced with a
  single `youtubeKey?: string`.
- `src/components/thriller/ThrillerGrid.tsx` — dropped the `expo-video`
  autoplay-loop player (it depended on the ripped stream URL, which no
  longer exists). Cells now show poster art with a small play badge when a
  trailer is available; tapping still opens details via the existing
  `onItemPress` callback. This is simpler and ToS-clean, but no longer
  autoplays video in the grid — if that visual is wanted back, it needs a
  proper YouTube embed (WebView/iframe), not a direct stream.
- `src/components/MediaCard.tsx` — the live-stream/sports card branch had no
  source left after removing `ApiService`'s `SPORT_LOGO_MAP`; it's now a
  no-op fallback rather than a crash. Sports live-stream cards are dead
  until/unless that feature is rebuilt on a licensed source.
- `src/services/unified/index.ts` — removed exports for every deleted
  provider/adapter so the barrel file doesn't reference nonexistent files.

### Already legit, untouched
- `src/services/unified/metadata/TMDBMetadata.ts` — TMDB API layer, this is
  the backbone to build on. Has trending/popular/top-rated/search/details/
  videos/reviews/recommendations already.
- `src/services/unified/metadata/KuryanaMetadata.ts` (+ its adapter) — pulls
  from `kuryana.tbdh.app`, a MyDramaList metadata mirror. Metadata only
  (titles, posters, cast, ratings), not a stream source. Left alone.
- `src/services/unified/social/TraktService.ts` — Trakt is a real watch-
  tracking service (like Letterboxd for TV). Left alone.
- Subtitle providers (`OpenSubtitlesProvider`, `SubdlProvider`,
  `UnifiedSubtitles`) — legit subtitle APIs. Left alone.

---

## Known-broken references — Phase 2 punch list

These files still import things that were deleted. The app **will not
compile** until these are addressed. None of them should be "fixed" by
re-adding a scraping provider — they need either a real licensed video
source wired in, or the feature removed/stubbed with a clear message to
the user ("playback isn't available yet").

1. **`app/_layout.tsx`** — imports `initializeStreamSources` (VidSrc),
   `EarningsConsentGate`/Pawns init, `boxOffice`. Strip all of it; there's
   no consent gate needed anymore since there's no SDK to consent to.
2. **`src/screens/details/DetailsScreenNew.tsx`** — imports `apiService`
   from the deleted `ApiService.ts` to build `/stream/{id}` URLs for the
   "Watch Now" button (lines ~489, 491, 707). This is the main UX gap:
   decide what "Watch Now" does now (play official trailer via TMDB
   `fetchMovieVideos`/`fetchTVVideos`? Point at a licensed backend? Point at
   a user's own Jellyfin/Plex server?) and wire the button to that instead.
3. **`src/screens/player/VideoPlayerScreen.tsx`** — imports the deleted
   `useStreamExtraction` hook, which was the entire multi-provider
   extraction pipeline. This file (~1000+ lines) needs to become either a
   trailer/YouTube-embed player or a licensed-source player, whichever
   direction #2 above goes. `SourceSelectionModal.tsx` (kept, unused now)
   was the picker UI for competing piracy sources — repurpose or remove.
4. **`src/services/unified/UnifiedMediaService.ts`** (~1000 lines) and
   **`src/services/unified/ProviderFactory.ts`** — these ARE the piracy
   fallback-cascade system (vidsrc-bypass → consumet → moviebox → vidsrc →
   xyra) and still reference the deleted provider files throughout. Given
   there's no provider left, the honest move is likely to delete both
   files rather than patch them, once #2/#3 land on a real replacement.
5. **`src/services/downloadManager/DownloadManager.ts`** — line 196
   `require()`s the deleted `VidSrcProvider` to resolve a download URL.
   Downloads have no source now either; same decision as #2 applies here.
6. **`src/screens/search/SearchScreen.tsx`** — imports `modules/mavin-engine`
   directly (line 38) plus references to `moviebox`/`consumet` as search
   "sources" in type unions and config objects (~lines 132, 167, 184, 1978).
   Search itself works fine off TMDB/Kuryana already; this just needs the
   dead source options removed from the type/config, and the mavin-engine
   import deleted (grep shows it may already be unused — confirm and cut).

None of these are large in count (7 files), but #3 and #4 are large in
line count and are really "design the playback story" work, not a
mechanical swap. Recommend tackling in this order: **1 → 6 → 5 → (2+3
together, since they're the same decision) → 4 last** (once 2/3 make it
obsolete).

---

## Urgent, not done — do this regardless of the above

The repo has secrets **in git history** even though the files are gone from
the working tree now (`env.b64`, `keystore.b64`, `android/keystore.properties`).
Before this repo is pushed anywhere public:
1. Rotate whatever credentials/signing keys those files contained.
2. Scrub them from git history (`git filter-repo` or BFG Repo-Cleaner), not
   just `git rm`.
3. Add them to `.gitignore` going forward.

This is independent of the piracy-removal work and matters even if Phase 2
never happens.

---

## Design constraint from the user

Keep the existing UI/UX, components, and navigation structure as-is —
this is a content-layer swap (piracy → licensed), not a redesign. TMDB
gives free access to metadata, posters, backdrops, cast, and trailer video
IDs, which covers browsing/search/details fully. It does not give full
movie/show video files — there is no free, legal way to stream full
copyrighted films without a real licensing deal or the user's own media
server (Jellyfin/Plex). Whoever continues this should raise that
explicitly with the user before assuming which direction "Watch Now"
should go (see punch-list item #2).
