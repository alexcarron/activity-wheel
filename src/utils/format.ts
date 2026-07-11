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
