/**
 * Logic for the debug weight spread transform that exaggerates or compresses the differences between a pool's weights, without touching the stored weights
 */

import { WEIGHT_HARD_MINIMUM } from './weight-minimum-logic';

export const DEFAULT_SPREAD_FACTOR = 1;
export const MINIMUM_SPREAD_FACTOR = 0;
export const MAXIMUM_SPREAD_FACTOR = 3;
export const MAXIMUM_SPREAD_FACTOR_WHEN_EXTREME_ENABLED = 1000;

export function applySpreadToWeights(weights: readonly number[], spreadFactor: number): number[] {
	if (weights.length === 0) return [];
	const mean = weights.reduce((sum, weight) => sum + weight, 0) / weights.length;
	return weights.map((weight) =>
		Math.max(WEIGHT_HARD_MINIMUM, mean + (weight - mean) * spreadFactor),
	);
}

/**
 * Maps a slider position in [0, 1] to a spreadFactor, anchoring 0.5 at DEFAULT_SPREAD_FACTOR. Left half is linear and right half is exponential.
 */
export function sliderPositionToSpreadFactor(position: number, spreadFactorMax: number): number {
	if (position <= 0.5) {
		const ratio = position / 0.5;
		return MINIMUM_SPREAD_FACTOR + (DEFAULT_SPREAD_FACTOR - MINIMUM_SPREAD_FACTOR) * ratio;
	}
	const ratio = (position - 0.5) / 0.5;
	return DEFAULT_SPREAD_FACTOR * Math.pow(spreadFactorMax / DEFAULT_SPREAD_FACTOR, ratio);
}

/**
 * Inverse of sliderPositionToSpreadFactor. Derives the slider's displayed position from a stored spreadFactor
 */
export function spreadFactorToSliderPosition(
	spreadFactor: number,
	spreadFactorMax: number,
): number {
	if (spreadFactor <= DEFAULT_SPREAD_FACTOR) {
		return (
			(0.5 * (spreadFactor - MINIMUM_SPREAD_FACTOR)) /
			(DEFAULT_SPREAD_FACTOR - MINIMUM_SPREAD_FACTOR)
		);
	}
	const ratio =
		Math.log(spreadFactor / DEFAULT_SPREAD_FACTOR) / Math.log(spreadFactorMax / DEFAULT_SPREAD_FACTOR);
	return 0.5 + 0.5 * ratio;
}
