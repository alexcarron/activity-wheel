/**
 * Deterministic, seedable PRNG (Mulberry32). Returns floats in [0, 1).
 *
 * Used for two reasons:
 *  - Reproducible spins when debugging.
 *  - A single source of randomness so we can swap in a seeded one for tests
 *    without having to monkey-patch `Math.random`.
 */

export type Rng = () => number;

/** Mulberry32 — small, fast, statistically good enough for selection. */
export function mulberry32(seed: number): Rng {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Wrap Math.random to fit the Rng signature without leaking globals. */
export const defaultRng: Rng = () => Math.random();

/** Hash a string seed into an int32 — gives users a friendly "seed" UX. */
export function hashSeed(input: string): number {
  let h = 2166136261 >>> 0; // FNV-1a
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h | 0;
}

/** Build an Rng from either a numeric seed, a string seed, or undefined. */
export function makeRng(seed?: number | string): Rng {
  if (seed === undefined || seed === '') return defaultRng;
  const n = typeof seed === 'number' ? seed : hashSeed(seed);
  return mulberry32(n);
}
