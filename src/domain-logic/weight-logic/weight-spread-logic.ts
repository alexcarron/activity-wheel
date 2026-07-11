/**
 * Debug-only transform that exaggerates or compresses the differences between a pool's weights, without touching the stored weights themselves.
 * Each weight's deviation from the pool's mean is scaled by `spreadFactor`:
 * - 1.0. Identity, matches default behaviour.
 * - > 1. Amplifies deviations (heavy activities get heavier, light ones lighter).
 * - < 1. Compresses deviations toward the mean (toward equal odds at 0). 
 */

import { WEIGHT_HARD_MINIMUM } from './weight-minimum-logic';
import { SPREAD_FACTOR_DEFAULT, SPREAD_FACTOR_MIN } from './weight-constants';

export function applySpreadToWeights(weights: readonly number[], spreadFactor: number): number[] {
	if (weights.length === 0) return [];
	const mean = weights.reduce((sum, weight) => sum + weight, 0) / weights.length;
	return weights.map((weight) =>
		Math.max(WEIGHT_HARD_MINIMUM, mean + (weight - mean) * spreadFactor),
	);
}

/**
 * Maps a slider position in [0, 1] to a spreadFactor, anchoring 0.5 at SPREAD_FACTOR_DEFAULT. Left half is linear (the compress range is small); right half is exponential so the slider stays controllable near the default even when spreadFactorMax is huge. 
 */
export function sliderPositionToSpreadFactor(position: number, spreadFactorMax: number): number {
	if (position <= 0.5) {
		const ratio = position / 0.5;
		return SPREAD_FACTOR_MIN + (SPREAD_FACTOR_DEFAULT - SPREAD_FACTOR_MIN) * ratio;
	}
	const ratio = (position - 0.5) / 0.5;
	return SPREAD_FACTOR_DEFAULT * Math.pow(spreadFactorMax / SPREAD_FACTOR_DEFAULT, ratio);
}

/**
 * Inverse of sliderPositionToSpreadFactor. Derives the slider's displayed position from a stored spreadFactor (e.g. on load, or when the extreme-mode max changes). 
 */
export function spreadFactorToSliderPosition(
	spreadFactor: number,
	spreadFactorMax: number,
): number {
	if (spreadFactor <= SPREAD_FACTOR_DEFAULT) {
		return (0.5 * (spreadFactor - SPREAD_FACTOR_MIN)) / (SPREAD_FACTOR_DEFAULT - SPREAD_FACTOR_MIN);
	}
	const ratio =
		Math.log(spreadFactor / SPREAD_FACTOR_DEFAULT) /
		Math.log(spreadFactorMax / SPREAD_FACTOR_DEFAULT);
	return 0.5 + 0.5 * ratio;
}
