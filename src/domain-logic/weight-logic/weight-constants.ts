import type { FeedbackAction } from '../types';

/** Starting confidence of a new activity. Also the minimum confidence. */
export const INITIAL_PREFERENCE_SCORE_CONFIDENCE = 2.0;

/** Confidence contributed by one reaction. */
export const FEEDBACK_STRENGTH = 2.0;

/** How much the preference scores affect the weight of the activity. */
export const PREFERENCE_WEIGHT_STRENGTH = 2.25;

/** Confidence lost per day without feedback. */
export const CONFIDENCE_DECAY_PER_DAY_RATE = 0.1;

/** Feedback strength used for migrating acceptCount and rejectCount into a preference estimate. */
export const MIGRATION_PREVIOUS_FEEDBACK_STRENGTH = 1.0;

/** Preference points each feedback action awards. */
export const PREFERENCE_POINTS_AWARDED_BY_FEEDBACK_ACTION: Record<Exclude<FeedbackAction, 'undo'>, number> = {
	boost: 2,
	accept: 1,
	skip: 0,
	reject: -1,
	hate: -2,
};
