/**
 * Logic for the cumulative weighted random selection.
 */
import type { Rng } from '../utils/random-utils';
import { defaultRng } from '../utils/random-utils';

export interface Weighted<T> {
	item: T;
	weight: number;
}

const SCALE = 10000;
const BINARY_SEARCH_THRESHOLD = 32;

/**
 * Pick exactly one item from the given weighted items using their weights. Returns undefined if there are no items or all weights are non-positive.
 */
export function pickFromWeightedItems<T>({ weightedItems, rng = defaultRng }: { weightedItems: Weighted<T>[]; rng?: Rng }): T | undefined {
	if (weightedItems.length === 0) return undefined;

	const cumulativeWeights: number[] = new Array(weightedItems.length);
	let total = 0;
	for (let i = 0; i < weightedItems.length; i++) {
		const weight = weightedItems[i].weight;
		if (weight > 0) total += Math.round(weight * SCALE);
		cumulativeWeights[i] = total;
	}
	if (total === 0) return undefined;

	const randomValue = Math.floor(rng() * total);

	if (weightedItems.length < BINARY_SEARCH_THRESHOLD) {
		for (let i = 0; i < weightedItems.length; i++) {
			if (randomValue < cumulativeWeights[i]) return weightedItems[i].item;
		}
		return weightedItems[weightedItems.length - 1].item;
	}

	let low = 0;
	let high = weightedItems.length - 1;
	while (low < high) {
		const mid = (low + high) >>> 1;
		if (cumulativeWeights[mid] <= randomValue) low = mid + 1;
		else high = mid;
	}
	return weightedItems[low].item;
}

/**
 * Calculates the display probabilities of the given weighted items, parallel to the weighted items array.
 */
export function getProbabilitiesOfWeightedItems<T>(weightedItems: Weighted<T>[]): number[] {
	let total = 0;
	for (const entry of weightedItems) total += Math.max(0, entry.weight);
	if (total === 0) return weightedItems.map(() => 0);
	return weightedItems.map((entry) => Math.max(0, entry.weight) / total);
}
