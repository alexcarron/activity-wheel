import type { Activity, FeedbackAction, PreferenceEstimateSnapshot, RatingFeedbackAction } from '../types';
import { getConfidenceAfterChangedEnjoymentRule, getUnexpectedRatingStreakAfterRating } from './changed-enjoyment-rule-logic';
import { getDecayedPreferenceScoreConfidence } from './confidence-decay-logic';
import {
	FEEDBACK_STRENGTH,
	MINIMUM_MILLISECONDS_BETWEEN_RATINGS_OF_SAME_ACTIVITY,
	PREFERENCE_POINTS_AWARDED_BY_FEEDBACK_ACTION,
} from './weight-constants';

function getSnapshotOfPreferenceEstimate(activity: Activity): PreferenceEstimateSnapshot {
	return {
		preferenceScore: activity.preferenceScore,
		preferenceScoreConfidence: activity.preferenceScoreConfidence,
		lastFeedbackAt: activity.lastFeedbackAt,
		acceptCount: activity.acceptCount,
		rejectCount: activity.rejectCount,
		lastFeedbackAction: activity.lastFeedbackAction,
		unexpectedRatingStreak: activity.unexpectedRatingStreak,
	};
}

export function isRepeatRatingTooSoon({ lastFeedbackAt, now }: { lastFeedbackAt: number; now: number }): boolean {
	const millisecondsSinceLastFeedback = now - lastFeedbackAt;
	return millisecondsSinceLastFeedback >= 0 && millisecondsSinceLastFeedback < MINIMUM_MILLISECONDS_BETWEEN_RATINGS_OF_SAME_ACTIVITY;
}

export function getUndoableRatingAction({ activity, pageLoadedAt }: { activity: Activity; pageLoadedAt: number }): RatingFeedbackAction | undefined {
	const isRatedSincePageLoaded = activity.lastFeedbackAt >= pageLoadedAt;
	if (!activity.preferenceEstimateHistory || !isRatedSincePageLoaded) return undefined;
	return activity.lastFeedbackAction;
}

export function applyFeedbackToActivity(activity: Activity, action: FeedbackAction, now: number): Activity {
	if (action === 'undo') {
		const history = activity.preferenceEstimateHistory;
		if (!history) return activity;
		return {
			...activity,
			preferenceScore: history.preferenceScore,
			preferenceScoreConfidence: history.preferenceScoreConfidence,
			lastFeedbackAt: history.lastFeedbackAt,
			acceptCount: history.acceptCount ?? activity.acceptCount,
			rejectCount: history.rejectCount ?? activity.rejectCount,
			lastFeedbackAction: history.lastFeedbackAction,
			unexpectedRatingStreak: history.unexpectedRatingStreak ?? 0,
			preferenceEstimateHistory: undefined,
		};
	}

	const preferenceEstimateHistory = getSnapshotOfPreferenceEstimate(activity);
	const preferencePointsAwarded = PREFERENCE_POINTS_AWARDED_BY_FEEDBACK_ACTION[action];

	const decayedPreferenceScoreConfidence = getDecayedPreferenceScoreConfidence({
		preferenceScoreConfidence: activity.preferenceScoreConfidence,
		lastFeedbackAt: activity.lastFeedbackAt,
		now,
	});
	const unexpectedRatingStreak = getUnexpectedRatingStreakAfterRating({
		unexpectedRatingStreak: activity.unexpectedRatingStreak,
		preferenceScore: activity.preferenceScore,
		preferencePointsAwarded,
	});
	const confidenceBeforeRating = getConfidenceAfterChangedEnjoymentRule({
		preferenceScoreConfidence: decayedPreferenceScoreConfidence,
		unexpectedRatingStreak,
	});
	const preferenceScoreConfidence = confidenceBeforeRating + FEEDBACK_STRENGTH;
	const preferenceScore =
		(confidenceBeforeRating * activity.preferenceScore + FEEDBACK_STRENGTH * preferencePointsAwarded) /
		preferenceScoreConfidence;

	const wasPositive = preferencePointsAwarded > 0;
	const wasNegative = preferencePointsAwarded < 0;

	return {
		...activity,
		preferenceScore,
		preferenceScoreConfidence,
		lastFeedbackAt: now,
		lastFeedbackAction: action,
		unexpectedRatingStreak,
		preferenceEstimateHistory,
		acceptCount: wasPositive ? activity.acceptCount + 1 : activity.acceptCount,
		rejectCount: wasNegative ? activity.rejectCount + 1 : activity.rejectCount,
	};
}
