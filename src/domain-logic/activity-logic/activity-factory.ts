/**
 * Activity factory — constructs a fresh Activity with neutral weight and
 * empty feedback history.
 *
 * The recency boost is NOT baked into the stored weight here; it is computed
 * at runtime by effectiveWeight() so the boost fades naturally over 7 days
 * without requiring any scheduled work.
 */

import type { Activity } from '../types';
import { WEIGHT_DEFAULT } from '../weight-logic/weight-constants';

/**
 * Create a brand-new Activity.
 *
 * @param id      Stable unique identifier (UUID v4 or similar).
 * @param name    User-facing display name.
 * @param now     Current timestamp (ms since epoch). Drives the recency window.
 * @param wheelId Which wheel this activity belongs to.
 */
export function newActivity(id: string, name: string, now: number, wheelId: string): Activity {
  return {
    id,
    wheelId,
    name,
    weight: WEIGHT_DEFAULT,
    createdAt: now,
    acceptCount: 0,
    rejectCount: 0,
    streak: 0,
    tags: [],
    // lastAcceptDelta intentionally omitted — nothing to undo yet.
  };
}
