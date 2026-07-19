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
 * Pick exactly one item from the given pool using its weight. Returns undefined if the pool is empty or all weights are non-positive. 
 */
export function pickFromWeightedPool<T>(weightedPool: Weighted<T>[], rng: Rng = defaultRng): T | undefined {
	if (weightedPool.length === 0) return undefined;

	const cumulativeWeights: number[] = new Array(weightedPool.length);
	let total = 0;
	for (let i = 0; i < weightedPool.length; i++) {
		const weight = weightedPool[i].weight;
		if (weight > 0) total += Math.round(weight * SCALE);
		cumulativeWeights[i] = total;
	}
	if (total === 0) return undefined;

	const randomValue = Math.floor(rng() * total);

	if (weightedPool.length < BINARY_SEARCH_THRESHOLD) {
		for (let i = 0; i < weightedPool.length; i++) {
			if (randomValue < cumulativeWeights[i]) return weightedPool[i].item;
		}
		return weightedPool[weightedPool.length - 1].item;
	}

	let low = 0;
	let high = weightedPool.length - 1;
	while (low < high) {
		const mid = (low + high) >>> 1;
		if (cumulativeWeights[mid] <= randomValue) low = mid + 1;
		else high = mid;
	}
	return weightedPool[low].item;
}

/**
 * Calculates the display probabilities of a given weighted pool parallel to the weighted pool array. 
 */
export function getProbabilitiesOfWeightedPool<T>(weightedPool: Weighted<T>[]): number[] {
	let total = 0;
	for (const entry of weightedPool) total += Math.max(0, entry.weight);
	if (total === 0) return weightedPool.map(() => 0);
	return weightedPool.map((entry) => Math.max(0, entry.weight) / total);
}
