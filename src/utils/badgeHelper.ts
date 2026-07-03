// src/utils/badgeHelper.ts
//
// Single source of truth for "is this title tagged, and with what label/color".
// Used by:
//   - Badge.tsx            (decides what to render on a card)
//   - HomeScreen buildRows  (decides sort order within eligible rows)
//
// Keeping this in one place guarantees the badge shown on screen and the
// sort order used to place items first can never disagree with each other.

export type BadgeTier = 'hot' | 'new' | 'latest';

export interface BadgeInfo {
  tier: BadgeTier;
  label: string;
  color: string;
}

export interface BadgeCheckInput {
  mediaType?: string;
  releaseDate?: string | null;
  firstAirDate?: string | null;
  lastAirDate?: string | null;
  // True if the current user has already watched this title at all
  // (first watch suppresses the badge, per project spec).
  hasWatched?: boolean;
}

// ─── Tier windows, measured in days since the relevant date ───
const HOT_MAX_DAYS = 14; // 0–14 days
const NEW_MAX_DAYS = 45; // ~1.5 months
const LATEST_MAX_DAYS = 90; // ~3 months
// Beyond LATEST_MAX_DAYS -> no badge.

export const BADGE_COLORS: Record<BadgeTier, string> = {
  hot: '#1E90FF', // blue
  new: '#E50914', // current red (unchanged)
  latest: '#D4AF37', // gold
};

const LABELS: Record<BadgeTier, string> = {
  hot: 'HOT',
  new: 'NEW',
  latest: 'LATEST',
};

const TV_NEW_EPISODES_LABEL = 'New Episodes';

const daysSince = (dateStr?: string | null): number | null => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  const diffMs = Date.now() - date.getTime();
  return diffMs / (1000 * 60 * 60 * 24);
};

const tierFromDays = (days: number | null): BadgeTier | null => {
  if (days === null) return null;
  // Future-dated releases (not out yet) never get a tag — this also
  // fixes the old bug where upcoming movies incorrectly showed "NEW".
  if (days < 0) return null;
  if (days <= HOT_MAX_DAYS) return 'hot';
  if (days <= NEW_MAX_DAYS) return 'new';
  if (days <= LATEST_MAX_DAYS) return 'latest';
  return null;
};

/**
 * Returns badge info for a title, or null if no badge should show.
 */
export const getBadgeInfo = (input: BadgeCheckInput): BadgeInfo | null => {
  const { mediaType, releaseDate, firstAirDate, lastAirDate, hasWatched } = input;

  // Suppress immediately if the user has already watched this title,
  // regardless of how recent it is.
  if (hasWatched) return null;

  let tier: BadgeTier | null = null;
  let label: string | null = null;

  if (mediaType === 'movie' && releaseDate) {
    tier = tierFromDays(daysSince(releaseDate));
    if (tier) label = LABELS[tier];
  } else if (mediaType === 'tv') {
    // Prefer lastAirDate ("New Episodes"); fall back to firstAirDate.
    const lastAirTier = tierFromDays(daysSince(lastAirDate));
    if (lastAirTier) {
      tier = lastAirTier;
      label = tier === 'new' ? TV_NEW_EPISODES_LABEL : LABELS[tier];
    } else {
      const firstAirTier = tierFromDays(daysSince(firstAirDate));
      if (firstAirTier) {
        tier = firstAirTier;
        label = LABELS[firstAirTier];
      }
    }
  }

  if (!tier || !label) return null;

  return { tier, label, color: BADGE_COLORS[tier] };
};

// ─── Row sorting: Hot group, then New group, then Latest group, then untagged. ───
// Order *within* each group is randomized (not the same lineup every render).
const shuffleGroup = <T,>(arr: T[]): T[] => {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export interface SortableItem {
  media_type?: string;
  mediaType?: string;
  release_date?: string;
  releaseDate?: string;
  first_air_date?: string;
  firstAirDate?: string;
  last_air_date?: string;
  lastAirDate?: string;
  id?: number | string;
}

/**
 * Sorts a row's items so Hot items come first, then New, then Latest,
 * then everything untagged — shuffled within each group.
 *
 * `hasWatchedFn` should return true if the current user has watched
 * that specific item at all.
 */
export const sortByBadgeTier = <T extends SortableItem>(
  items: T[],
  hasWatchedFn?: (item: T) => boolean
): T[] => {
  const groups: { hot: T[]; new: T[]; latest: T[]; none: T[] } = {
    hot: [],
    new: [],
    latest: [],
    none: [],
  };

  for (const item of items) {
    const mediaType = item.media_type || item.mediaType;
    const releaseDate = item.release_date || item.releaseDate;
    const firstAirDate = item.first_air_date || item.firstAirDate;
    const lastAirDate = item.last_air_date || item.lastAirDate;
    const hasWatched = hasWatchedFn ? hasWatchedFn(item) : false;

    const badge = getBadgeInfo({ mediaType, releaseDate, firstAirDate, lastAirDate, hasWatched });

    if (!badge) {
      groups.none.push(item);
    } else {
      groups[badge.tier].push(item);
    }
  }

  return [
    ...shuffleGroup(groups.hot),
    ...shuffleGroup(groups.new),
    ...shuffleGroup(groups.latest),
    ...shuffleGroup(groups.none),
  ];
};

// Row IDs eligible for badge-tier sorting.
// Excluded on purpose: 'continue-watching' (titles already being watched —
// recency is irrelevant there) and any live-stream row (separate LIVE/SOON
// badge system, unrelated to release recency).
export const BADGE_SORTABLE_ROW_IDS = new Set<string>([
  'top-picks',
  'trending',
  'popular',
  'new-releases',
  'because-you-watched',
  'top-10',
  'blockbuster',
  'dramas',
  'anime',
  'action-adventure',
  'comedy',
  'sci-fi',
  'romance',
  'horror',
  'documentaries',
  'kids-family',
  'staff-picks',
  'recently-added',
]);