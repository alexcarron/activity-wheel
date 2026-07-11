/**
 * Deterministic, seedable PRNG (Mulberry32). Returns floats in [0, 1).
 * Used for two reasons:
 * - Reproducible spins when debugging.
 * - A single source of randomness so we can swap in a seeded one for tests without having to monkey-patch `Math.random`. 
 */

export type Rng = () => number;

/** Mulberry32. Small, fast, statistically good enough for selection. */
export function mulberry32(seed: number): Rng {
	let state = seed | 0;
	return () => {
		state = (state + 0x6d2b79f5) | 0;
		let hashValue = state;
		hashValue = Math.imul(hashValue ^ (hashValue >>> 15), hashValue | 1);
		hashValue ^= hashValue + Math.imul(hashValue ^ (hashValue >>> 7), hashValue | 61);
		return ((hashValue ^ (hashValue >>> 14)) >>> 0) / 4294967296;
	};
}

/** Wrap Math.random to fit the Rng signature without leaking globals. */
export const defaultRng: Rng = () => Math.random();

/** Hash a string seed into an int32. Gives users a friendly "seed" UX. */
export function hashSeed(input: string): number {
	let hash = 2166136261 >>> 0; // FNV-1a
	for (let i = 0; i < input.length; i++) {
		hash ^= input.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}
	return hash | 0;
}

/** Build an Rng from either a numeric seed, a string seed, or undefined. */
export function makeRng(seed?: number | string): Rng {
	if (seed === undefined || seed === '') return defaultRng;
	const numericSeed = typeof seed === 'number' ? seed : hashSeed(seed);
	return mulberry32(numericSeed);
}
