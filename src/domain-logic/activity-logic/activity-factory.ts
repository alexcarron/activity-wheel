/**
 * Logic for creating a new activity with initial values.
 */
import type { Activity } from '../types';
import { INITIAL_PREFERENCE_SCORE_CONFIDENCE } from '../weight-logic/weight-constants';

/**
 * Creates a brand-new Activity, at the neutral preference prior.
 * @param id - Stable unique identifier (UUID v4 or similar)
 * @param name - User-facing display name
 * @param now - Current timestamp.
 * @param wheelId - Which wheel this activity belongs to
 */
export function newActivity(id: string, name: string, now: number, wheelId: string): Activity {
	return {
		id,
		wheelId,
		name,
		preferenceScore: 0,
		preferenceScoreConfidence: INITIAL_PREFERENCE_SCORE_CONFIDENCE,
		lastFeedbackAt: now,
		createdAt: now,
		acceptCount: 0,
		rejectCount: 0,
		tagIds: [],
		preferenceEstimateHistory: undefined,
	};
}
