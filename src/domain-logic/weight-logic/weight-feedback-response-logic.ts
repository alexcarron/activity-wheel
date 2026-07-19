/**
 * Logic for the change to activity data applied for each possible feedback response
 */
import type { Activity, FeedbackAction } from '../types';
import { getDiminishingFactor } from './weight-diminishing-returns-logic';
import type { GlobalWeightContext } from './weight-types';
import { getMinimumWeight } from './weight-minimum-logic';
import { getMaximumWeight } from './weight-maximum-logic';
import { clamp, roundTo4DecimalPlaces } from '../../utils/math-utils';

const ACCEPT_FEEDBACK_STEP = 7;
const REJECT_FEEDBACK_STEP = 5;
const LOVE_IT_FEEDBACK_STEP = 25;
const HATE_IT_FEEDBACK_STEP = 25;

type StreakDirection = 'positive' | 'negative' | 'neutral';

function getStreakDirectionFromAction(action: FeedbackAction): StreakDirection {
	if (action === 'accept' || action === 'boost') return 'positive';
	if (action === 'reject' || action === 'hate') return 'negative';
	return 'neutral';
}

function getNextStreak(action: FeedbackAction, prevStreak: number): number {
	const direction = getStreakDirectionFromAction(action);
	if (direction === 'neutral') return 0;

	const isSameDirection =
		(direction === 'positive' && prevStreak > 0) || (direction === 'negative' && prevStreak < 0);

	if (isSameDirection) return prevStreak + (direction === 'positive' ? 1 : -1);
	return direction === 'positive' ? 1 : -1;
}

export function applyFeedback(
	activity: Activity,
	action: FeedbackAction,
	_now: number,
	globalWeightContext: GlobalWeightContext = {},
): Activity {
	const minWeight = getMinimumWeight(activity, globalWeightContext);
	const maxWeight = getMaximumWeight(activity, globalWeightContext);

	if (action === 'skip') return activity;

	if (action === 'undo') {
		const delta = activity.lastAcceptDelta ?? 0;
		if (delta === 0) return activity;

		const next = roundTo4DecimalPlaces(clamp(activity.weight - delta, minWeight, maxWeight));
		return {
			...activity,
			weight: next,
			lastAcceptDelta: undefined,
			streak: 0,
		};
	}

	if (action === 'reject') {
		const factor = getDiminishingFactor(activity, 'negative', globalWeightContext);
		const delta = roundTo4DecimalPlaces(REJECT_FEEDBACK_STEP * factor);
		const next = roundTo4DecimalPlaces(clamp(activity.weight - delta, minWeight, maxWeight));

		return {
			...activity,
			weight: next,
			streak: getNextStreak(action, activity.streak),
			rejectCount: activity.rejectCount + 1,
		};
	}

	if (action === 'hate') {
		const factor = getDiminishingFactor(activity, 'negative', globalWeightContext);
		const delta = roundTo4DecimalPlaces(HATE_IT_FEEDBACK_STEP * factor);
		const next = roundTo4DecimalPlaces(clamp(activity.weight - delta, minWeight, maxWeight));

		return {
			...activity,
			weight: next,
			streak: getNextStreak(action, activity.streak),
			rejectCount: activity.rejectCount + 1,
		};
	}

	const baseStep = action === 'boost' ? LOVE_IT_FEEDBACK_STEP : ACCEPT_FEEDBACK_STEP;
	const factor = getDiminishingFactor(activity, 'positive', globalWeightContext);
	const delta = roundTo4DecimalPlaces(baseStep * factor);
	const next = roundTo4DecimalPlaces(clamp(activity.weight + delta, minWeight, maxWeight));

	return {
		...activity,
		weight: next,
		streak: getNextStreak(action, activity.streak),
		acceptCount: activity.acceptCount + 1,
		lastAcceptDelta: delta,
	};
}
