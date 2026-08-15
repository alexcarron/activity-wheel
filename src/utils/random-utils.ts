export type Rng = () => number;

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

export const defaultRng: Rng = () => Math.random();

export function hashSeed(input: string): number {
	let hash = 2166136261 >>> 0; // FNV-1a
	for (let i = 0; i < input.length; i++) {
		hash ^= input.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}
	return hash | 0;
}

export function makeRng(seed?: number | string): Rng {
	if (seed === undefined || seed === '') return defaultRng;
	const numericSeed = typeof seed === 'number' ? seed : hashSeed(seed);
	return mulberry32(numericSeed);
}

export function sampleStandardNormal(rng: Rng): number {
	const uniform1 = Math.max(rng(), Number.EPSILON);
	const uniform2 = rng();
	return Math.sqrt(-2 * Math.log(uniform1)) * Math.cos(2 * Math.PI * uniform2);
}
