/**
 * Cumulative weighted random selection.
 * Implementation notes:
 * - We work in integer-scaled space (× 10000) when building the cumulative array to avoid floating-point drift on large pools. The final compare is integer vs integer.
 * - `pick` is unbiased: P(item i) = w_i / Σ w_j, exactly.
 * - For small pools we use a linear scan; for >= 32 items a binary search. Both are O(n) total because we still build the cumulative array, but the binary search reduces post-build cost to O(log n).
 * - Items with weight ≤ 0 are silently dropped from the candidate set (we enforce a positive floor elsewhere; this is just defensive). 
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
 * Pick exactly one item from `pool` using its weight. Returns `undefined` if the pool is empty or all weights are non-positive. 
 */
export function pick<T>(pool: Weighted<T>[], rng: Rng = defaultRng): T | undefined {
	if (pool.length === 0) return undefined;

	// Build cumulative integer weights.
	const cumulativeWeights: number[] = new Array(pool.length);
	let total = 0;
	for (let i = 0; i < pool.length; i++) {
		const weight = pool[i].weight;
		if (weight > 0) total += Math.round(weight * SCALE);
		cumulativeWeights[i] = total;
	}
	if (total === 0) return undefined;

	// randomValue ∈ [0, total)
	const randomValue = Math.floor(rng() * total);

	if (pool.length < BINARY_SEARCH_THRESHOLD) {
		for (let i = 0; i < pool.length; i++) {
			if (randomValue < cumulativeWeights[i]) return pool[i].item;
		}
		return pool[pool.length - 1].item; // floating-point safety net
	}

	// Binary search the smallest cumulativeWeights[i] strictly greater than randomValue.
	let low = 0;
	let high = pool.length - 1;
	while (low < high) {
		const mid = (low + high) >>> 1;
		if (cumulativeWeights[mid] <= randomValue) low = mid + 1;
		else high = mid;
	}
	return pool[low].item;
}

/**
 * Compute display probabilities (each in [0, 1], summing to 1). Useful for the debug panel. Returns parallel array to `pool`. 
 */
export function probabilities<T>(pool: Weighted<T>[]): number[] {
	let total = 0;
	for (const entry of pool) total += Math.max(0, entry.weight);
	if (total === 0) return pool.map(() => 0);
	return pool.map((entry) => Math.max(0, entry.weight) / total);
}
