import type { Activity, FeedbackAction, PreferenceEstimateSnapshot } from '../types';
import { getDecayedPreferenceScoreConfidence } from './confidence-decay-logic';
import { FEEDBACK_STRENGTH, PREFERENCE_POINTS_AWARDED_BY_FEEDBACK_ACTION } from './weight-constants';

function getSnapshotOfPreferenceEstimate(activity: Activity): PreferenceEstimateSnapshot {
	return {
		preferenceScore: activity.preferenceScore,
		preferenceScoreConfidence: activity.preferenceScoreConfidence,
		lastFeedbackAt: activity.lastFeedbackAt,
	};
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
			preferenceEstimateHistory: undefined,
		};
	}

	const preferenceEstimateHistory = getSnapshotOfPreferenceEstimate(activity);
	const preferencePointsAwarded = PREFERENCE_POINTS_AWARDED_BY_FEEDBACK_ACTION[action];

	if (action === 'skip') {
		return { ...activity, lastFeedbackAt: now, preferenceEstimateHistory };
	}

	const decayedPreferenceScoreConfidence = getDecayedPreferenceScoreConfidence({
		preferenceScoreConfidence: activity.preferenceScoreConfidence,
		lastFeedbackAt: activity.lastFeedbackAt,
		now,
	});
	const preferenceScoreConfidence = decayedPreferenceScoreConfidence + FEEDBACK_STRENGTH;
	const preferenceScore =
		(decayedPreferenceScoreConfidence * activity.preferenceScore + FEEDBACK_STRENGTH * preferencePointsAwarded) /
		preferenceScoreConfidence;

	const wasPositive = preferencePointsAwarded > 0;
	const wasNegative = preferencePointsAwarded < 0;

	return {
		...activity,
		preferenceScore,
		preferenceScoreConfidence,
		lastFeedbackAt: now,
		preferenceEstimateHistory,
		acceptCount: wasPositive ? activity.acceptCount + 1 : activity.acceptCount,
		rejectCount: wasNegative ? activity.rejectCount + 1 : activity.rejectCount,
	};
}
