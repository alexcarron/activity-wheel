/**
 * Logic for creating a new activity with initial values.
 */
import type { Activity } from '../types';
import { DEFAULT_WEIGHT } from '../weight-logic/weight-constants';

/**
 * Creates a brand-new Activity
 * @param id - Stable unique identifier (UUID v4 or similar)
 * @param name - User-facing display name
 * @param now - Current timestamp (ms since epoch). Drives the recency window
 * @param wheelId - Which wheel this activity belongs to
 */
export function newActivity(id: string, name: string, now: number, wheelId: string): Activity {
	return {
		id,
		wheelId,
		name,
		weight: DEFAULT_WEIGHT,
		createdAt: now,
		acceptCount: 0,
		rejectCount: 0,
		streak: 0,
		tagIds: [],
		lastAcceptDelta: undefined,
	};
}
