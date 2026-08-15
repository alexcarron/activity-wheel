import { formatConfidence, formatPercent, formatPreferenceScore, formatStandardDeviation, formatWeight } from '../utils/format';

export type DebugValuePillKey =
	| 'actualCurrentWeight'
	| 'estimatedStableWeight'
	| 'actualCurrentProbability'
	| 'estimatedStableProbability'
	| 'preferenceScore'
	| 'preferenceScoreConfidence'
	| 'decayedPreferenceScoreConfidence'
	| 'preferenceScoreStandardDeviation';

export interface DebugValuePillDescriptor {
	readonly key: DebugValuePillKey;
	/** Label shown next to the Debug panel checkbox that toggles this pill, ending with the pill abbreviation in parentheses. */
	readonly checkboxLabel: string;
	/** Tiny abbreviation shown as the prefix on the pill itself. */
	readonly pillLabel: string;
	/** Tooltip shown when hovering the pill. */
	readonly pillTooltip: string;
	format(value: number): string;
}

export const DEBUG_VALUE_PILLS: readonly DebugValuePillDescriptor[] = [
	{
		key: 'preferenceScore',
		checkboxLabel: 'Preference score (ps)',
		pillLabel: 'ps',
		pillTooltip: "The app's current guess at how much you like this activity.",
		format: formatPreferenceScore,
	},
	{
		key: 'preferenceScoreConfidence',
		checkboxLabel: 'Preference score confidence (psc)',
		pillLabel: 'psc',
		pillTooltip: 'How confident the app is in the preference score before any confidence decay.',
		format: formatConfidence,
	},
	{
		key: 'decayedPreferenceScoreConfidence',
		checkboxLabel: 'Decayed preference score confidence (dpsc)',
		pillLabel: 'dpsc',
		pillTooltip: 'The preference score confidence after decaying for the time passed since the last feedback.',
		format: formatConfidence,
	},
	{
		key: 'preferenceScoreStandardDeviation',
		checkboxLabel: 'Preference score standard deviation (pssd)',
		pillLabel: 'pssd',
		pillTooltip: 'How much the preference score can vary from spin to spin.',
		format: formatStandardDeviation,
	},
	{
		key: 'estimatedStableWeight',
		checkboxLabel: 'Estimated stable weight (w)',
		pillLabel: 'w',
		pillTooltip: 'The average weight this activity gets across many spins.',
		format: formatWeight,
	},
	{
		key: 'estimatedStableProbability',
		checkboxLabel: 'Estimated stable probability (p)',
		pillLabel: 'p',
		pillTooltip: 'The average chance this activity is picked across many spins.',
		format: formatPercent,
	},
	{
		key: 'actualCurrentWeight',
		checkboxLabel: 'Actual current weight (cw)',
		pillLabel: 'cw',
		pillTooltip: 'The random weight this activity gets for one exact spin. Changes every spin.',
		format: formatWeight,
	},
	{
		key: 'actualCurrentProbability',
		checkboxLabel: 'Actual current probability (cp)',
		pillLabel: 'cp',
		pillTooltip: 'The chance this activity is picked on one exact spin. Changes every spin.',
		format: formatPercent,
	},
];

export const DEBUG_VALUE_PILL_KEYS: readonly DebugValuePillKey[] = DEBUG_VALUE_PILLS.map((pill) => pill.key);

export function createHiddenDebugValuePillKeyToIsVisible(): Record<DebugValuePillKey, boolean> {
	const debugValuePillKeyToIsVisible = {} as Record<DebugValuePillKey, boolean>;
	for (const key of DEBUG_VALUE_PILL_KEYS) debugValuePillKeyToIsVisible[key] = false;
	return debugValuePillKeyToIsVisible;
}
