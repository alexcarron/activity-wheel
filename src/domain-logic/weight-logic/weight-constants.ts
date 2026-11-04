import type { RatingFeedbackAction } from '../types';

/** Initial preference score confidence of a new activity. Also the minimum confidence. */
export const INITIAL_PREFERENCE_SCORE_CONFIDENCE = 2.0;

export const MAXIMUM_PREFERENCE_SCORE_CONFIDENCE = 10000;

export const MINIMUM_PREFERENCE_SCORE = -2;

export const MAXIMUM_PREFERENCE_SCORE = 2;

/** Confidence contributed by one reaction. */
export const FEEDBACK_STRENGTH = 2.0;

/** How much the preference scores affect the weight of the activity. */
export const PREFERENCE_WEIGHT_STRENGTH = 2.25;

/** Confidence lost per day without feedback. */
export const CONFIDENCE_DECAY_PER_DAY_RATE = 0.1;

/** Feedback strength used for migrating acceptCount and rejectCount into a preference estimate. */
export const MIGRATION_PREVIOUS_FEEDBACK_STRENGTH = 1.0;

export const MINIMUM_POINTS_FROM_SCORE_FOR_UNEXPECTED_RATING = 1.5;

export const UNEXPECTED_RATINGS_IN_A_ROW_TO_LOWER_CONFIDENCE = 2;

export const CHANGED_ENJOYMENT_CONFIDENCE_MULTIPLIER = 0.25;

/** Multiplier for the one-time fix of negative scores that mostly came from mood-based ratings. */
export const NEGATIVE_PREFERENCE_SCORE_SHRINK_MULTIPLIER = 0.25;

export const MINIMUM_MILLISECONDS_BETWEEN_RATINGS_OF_SAME_ACTIVITY = 1000;

/** Preference points each feedback action awards. */
export const PREFERENCE_POINTS_AWARDED_BY_FEEDBACK_ACTION: Record<RatingFeedbackAction, number> = {
	love: 2,
	like: 1,
	neutral: 0,
	dislike: -1,
	hate: -2,
};
