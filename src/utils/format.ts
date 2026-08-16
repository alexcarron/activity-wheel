/** Tiny formatting helpers used in the UI. */

export function formatDate(timestamp: number): string {
	return new Date(timestamp).toLocaleDateString(undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
	});
}

/**
 * Formats a date as M/D, or M/D/YY when its year differs from the current year.
 */
export function formatCompactDate(timestamp: number, now: number): string {
	const date = new Date(timestamp);
	const monthAndDay = `${date.getMonth() + 1}/${date.getDate()}`;
	if (date.getFullYear() === new Date(now).getFullYear()) return monthAndDay;
	return `${monthAndDay}/${String(date.getFullYear()).slice(-2)}`;
}

export function formatPercent(probability: number): string {
	if (!isFinite(probability)) return '-';
	return `${(probability * 100).toFixed(1)}%`;
}

export function formatWeight(weight: number): string {
	return weight.toFixed(1);
}

export function formatPreferenceScore(preferenceScore: number): string {
	if (!isFinite(preferenceScore)) return '-';
	return preferenceScore.toFixed(2);
}

export function formatConfidence(confidence: number): string {
	if (!isFinite(confidence)) return '-';
	return confidence.toFixed(2);
}

export function formatStandardDeviation(standardDeviation: number): string {
	if (!isFinite(standardDeviation)) return '-';
	return standardDeviation.toFixed(3);
}
