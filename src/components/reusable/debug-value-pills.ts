import { formatConfidence, formatPercent, formatPreferenceScore, formatStandardDeviation, formatWeight } from '../../utils/format';
import { clamp } from '../../utils/math-utils';
import { INITIAL_PREFERENCE_SCORE_CONFIDENCE } from '../../domain-logic/weight-logic/weight-constants';

export type DebugValuePillKey =
	| 'actualCurrentWeight'
	| 'estimatedStableWeight'
	| 'actualCurrentProbability'
	| 'estimatedStableProbability'
	| 'preferenceScore'
	| 'preferenceScoreConfidence'
	| 'decayedPreferenceScoreConfidence'
	| 'preferenceScoreStandardDeviation';

export interface DebugValuePillRange {
	readonly min: number;
	readonly max: number;
}

export interface DebugValuePillDescriptor {
	readonly key: DebugValuePillKey;
	/** Label shown next to the debug panel checkbox that toggles this pill. */
	readonly checkboxLabel: string;
	/** Tiny abbreviation shown as the prefix on the pill itself. */
	readonly pillLabel: string;
	/** Tooltip shown when hovering the pill. */
	readonly pillTooltip: string;
	format(value: number): string;
	/** Maps a value to a 0 (red, empty) through 1 (green, full) bar-chart fill position. */
	getNormalizedFillPosition(value: number, range: DebugValuePillRange): number;
}

function getLinearNormalizedFillPosition(value: number, range: DebugValuePillRange): number {
	const rangeSize = range.max - range.min;
	if (rangeSize === 0) return 1;
	return clamp((value - range.min) / rangeSize, 0, 1);
}

function getZeroCenteredNormalizedFillPosition(value: number, range: DebugValuePillRange): number {
	if (value >= 0) {
		if (range.max <= 0) return 0.5;
		return 0.5 + 0.5 * clamp(value / range.max, 0, 1);
	}
	if (range.min >= 0) return 0.5;
	return 0.5 - 0.5 * clamp(value / range.min, 0, 1);
}

function getLogarithmicNormalizedFillPositionAboveMinimum(
	value: number,
	range: DebugValuePillRange,
	minimumPossibleValue: number,
): number {
	const valueAboveMinimum = Math.max(0, value - minimumPossibleValue);
	const maxAboveMinimum = Math.max(0, range.max - minimumPossibleValue);
	if (maxAboveMinimum === 0) return 0;
	return clamp(Math.log1p(valueAboveMinimum) / Math.log1p(maxAboveMinimum), 0, 1);
}

function getConfidenceNormalizedFillPosition(value: number, range: DebugValuePillRange): number {
	return getLogarithmicNormalizedFillPositionAboveMinimum(value, range, INITIAL_PREFERENCE_SCORE_CONFIDENCE);
}

export const DEBUG_VALUE_PILLS: readonly DebugValuePillDescriptor[] = [
	{
		key: 'preferenceScore',
		checkboxLabel: 'Preference score (ps)',
		pillLabel: 'ps',
		pillTooltip: "The app's current guess at how much you like this activity.",
		format: formatPreferenceScore,
		getNormalizedFillPosition: getZeroCenteredNormalizedFillPosition,
	},
	{
		key: 'preferenceScoreConfidence',
		checkboxLabel: 'Preference score confidence (psc)',
		pillLabel: 'psc',
		pillTooltip: 'How confident the app is in the preference score before any confidence decay.',
		format: formatConfidence,
		getNormalizedFillPosition: getConfidenceNormalizedFillPosition,
	},
	{
		key: 'decayedPreferenceScoreConfidence',
		checkboxLabel: 'Decayed preference score confidence (dpsc)',
		pillLabel: 'dpsc',
		pillTooltip: 'The preference score confidence after decaying for the time passed since the last feedback.',
		format: formatConfidence,
		getNormalizedFillPosition: getConfidenceNormalizedFillPosition,
	},
	{
		key: 'preferenceScoreStandardDeviation',
		checkboxLabel: 'Preference score standard deviation (pssd)',
		pillLabel: 'pssd',
		pillTooltip: 'How much the preference score can vary from spin to spin.',
		format: formatStandardDeviation,
		getNormalizedFillPosition: getLinearNormalizedFillPosition,
	},
	{
		key: 'estimatedStableWeight',
		checkboxLabel: 'Estimated stable weight (w)',
		pillLabel: 'w',
		pillTooltip: 'The average weight this activity gets across many spins.',
		format: formatWeight,
		getNormalizedFillPosition: getLinearNormalizedFillPosition,
	},
	{
		key: 'estimatedStableProbability',
		checkboxLabel: 'Estimated stable probability (p)',
		pillLabel: 'p',
		pillTooltip: 'The average chance this activity is picked across many spins.',
		format: formatPercent,
		getNormalizedFillPosition: getLinearNormalizedFillPosition,
	},
	{
		key: 'actualCurrentWeight',
		checkboxLabel: 'Actual current weight (cw)',
		pillLabel: 'cw',
		pillTooltip: 'The random weight this activity gets for one exact spin. Changes every spin.',
		format: formatWeight,
		getNormalizedFillPosition: getLinearNormalizedFillPosition,
	},
	{
		key: 'actualCurrentProbability',
		checkboxLabel: 'Actual current probability (cp)',
		pillLabel: 'cp',
		pillTooltip: 'The chance this activity is picked on one exact spin. Changes every spin.',
		format: formatPercent,
		getNormalizedFillPosition: getLinearNormalizedFillPosition,
	},
];

export const DEBUG_VALUE_PILL_KEYS: readonly DebugValuePillKey[] = DEBUG_VALUE_PILLS.map((pill) => pill.key);

export function createHiddenDebugValuePillKeyToIsVisible(): Record<DebugValuePillKey, boolean> {
	const debugValuePillKeyToIsVisible = {} as Record<DebugValuePillKey, boolean>;
	for (const key of DEBUG_VALUE_PILL_KEYS) debugValuePillKeyToIsVisible[key] = false;
	return debugValuePillKeyToIsVisible;
}
