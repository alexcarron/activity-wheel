/** Tiny formatting helpers used in the UI. */

export function formatDate(timestamp: number): string {
	return new Date(timestamp).toLocaleDateString(undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
	});
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
