/**
 * Cumulative weighted random selection.
 *
 * Implementation notes:
 *  - We work in integer-scaled space (× 10000) when building the cumulative
 *    array to avoid floating-point drift on large pools. The final compare is
 *    integer vs integer.
 *  - `pick` is unbiased: P(item i) = w_i / Σ w_j, exactly.
 *  - For small pools we use a linear scan; for >= 32 items a binary search.
 *    Both are O(n) total because we still build the cumulative array, but the
 *    binary search reduces post-build cost to O(log n).
 *  - Items with weight ≤ 0 are silently dropped from the candidate set (we
 *    enforce a positive floor elsewhere; this is just defensive).
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
 * Pick exactly one item from `pool` using its weight. Returns `undefined` if
 * the pool is empty or all weights are non-positive.
 */
export function pick<T>(pool: Weighted<T>[], rng: Rng = defaultRng): T | undefined {
  if (pool.length === 0) return undefined;

  // Build cumulative integer weights.
  const cum: number[] = new Array(pool.length);
  let total = 0;
  for (let i = 0; i < pool.length; i++) {
    const w = pool[i].weight;
    if (w > 0) total += Math.round(w * SCALE);
    cum[i] = total;
  }
  if (total === 0) return undefined;

  // r ∈ [0, total)
  const r = Math.floor(rng() * total);

  if (pool.length < BINARY_SEARCH_THRESHOLD) {
    for (let i = 0; i < pool.length; i++) {
      if (r < cum[i]) return pool[i].item;
    }
    return pool[pool.length - 1].item; // floating-point safety net
  }

  // Binary search the smallest cum[i] strictly greater than r.
  let lo = 0;
  let hi = pool.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (cum[mid] <= r) lo = mid + 1;
    else hi = mid;
  }
  return pool[lo].item;
}

/**
 * Compute display probabilities (each in [0, 1], summing to 1). Useful for
 * the debug panel. Returns parallel array to `pool`.
 */
export function probabilities<T>(pool: Weighted<T>[]): number[] {
  let total = 0;
  for (const p of pool) total += Math.max(0, p.weight);
  if (total === 0) return pool.map(() => 0);
  return pool.map((p) => Math.max(0, p.weight) / total);
}
