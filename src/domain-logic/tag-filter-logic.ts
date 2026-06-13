/**
 * Pure tag-filter functions. No React, no IO.
 *
 * filterActivitiesByTags is the core function used everywhere a tag filter
 * needs to be applied — wheel pool, activity list, debug panel, etc.
 */

import type { Activity } from './types';

export type FilterMode = 'OR' | 'AND';

/**
 * Filter an activity list based on the active tag filter.
 *
 * @param activities   Full or partial activity list to filter.
 * @param activeTags   Tag names the user has toggled on. Empty = no filter.
 * @param mode         'OR' = at least one tag matches; 'AND' = all tags match.
 * @param untaggedOnly When true, returns only activities with zero tags
 *                     (activeTags is ignored in this mode).
 *
 * Returns the original array reference unchanged if no filter is active
 * (avoids unnecessary downstream re-renders).
 */
export function filterActivitiesByTags(
  activities: readonly Activity[],
  activeTags: readonly string[],
  mode: FilterMode,
  untaggedOnly: boolean,
): readonly Activity[] {
  if (untaggedOnly) {
    return activities.filter((a) => a.tags.length === 0);
  }
  if (activeTags.length === 0) {
    return activities; // return same reference — no filter active
  }
  return activities.filter((a) => {
    if (mode === 'OR') {
      return activeTags.some((t) => a.tags.includes(t));
    }
    // AND: every active tag must be present
    return activeTags.every((t) => a.tags.includes(t));
  });
}

/**
 * Returns true when any tag filter is currently active (either tag pills
 * selected, or untaggedOnly mode, but NOT when filter would return everything).
 */
export function isFilterActive(activeTags: readonly string[], untaggedOnly: boolean): boolean {
  return untaggedOnly || activeTags.length > 0;
}

/**
 * Compute the count of activities that have each tag, across the full
 * (unfiltered) activity list. Used for the count badges on filter pills.
 */
export function computeTagCounts(activities: readonly Activity[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const a of activities) {
    for (const tag of a.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return counts;
}

/** Count activities with zero tags — for the "Untagged" pseudo-pill. */
export function countUntagged(activities: readonly Activity[]): number {
  return activities.filter((a) => a.tags.length === 0).length;
}
