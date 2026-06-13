/** Base duration for the very first spin (ms) */
const INITIAL_SPIN_DURATION_MS = 2_000;

/**
 * Half-range of the uniform jitter applied to the base duration (ms).
 */
const INITIAL_JITTER_RANGE_MS = 1000;
const MIN_JITTER_RANGE_MS = 300;

/** How much the base duration drops per spin (ms). */
const PER_SPIN_DURATION_DECREMENT_MS = 250;

/** Lowest possible base duration (ms). */
const MIN_SPIN_DURATION_MS = 250;

/**
 * Target milliseconds-per-rotation used to derive a natural-looking rotation count
 */
const MS_PER_ROTATION = 300;

/** Minimum number of full rotations regardless of duration. */
const MIN_ROTATIONS = 1;

export interface SpinTiming {
  durationMs: number;
  fullRotations: number;
}

export interface SpinTimingResult extends SpinTiming {
  /** The next spinCount value to be stored by the caller. */
  nextSpinCount: number;
}

function getValueBetweenNumbers(num1: number, num2: number, percentageBetween: number): number {
  return num1 + (num2 - num1) * percentageBetween;
}

function getPercentageOfValueBetweenNumbers(num: number, num1: number, num2: number): number {
	if (num1 === num2) {
		return 0;
		
	}
	return (num - num1) / (num2 - num1);
}

function withMinAndMax(num: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, num));
}

/**
 * Compute and return the timing for the next spin based on the provided spinCount.
 * The caller is responsible for managing and storing the spinCount state.
 * Call this exactly once per spin, just before triggering the animation.
 */
export function getNextSpinTiming(currentSpinCount: number): SpinTimingResult {
	const decrementedDuration = currentSpinCount * PER_SPIN_DURATION_DECREMENT_MS;
	const calculatedDuration = INITIAL_SPIN_DURATION_MS - decrementedDuration;

  const expectedDurationMS = Math.max(
    MIN_SPIN_DURATION_MS,
    calculatedDuration,
  );

  const jitterRangePercentage = withMinAndMax(
		getPercentageOfValueBetweenNumbers(expectedDurationMS, 
			MIN_SPIN_DURATION_MS, INITIAL_SPIN_DURATION_MS
		),
		0, 1,
	)

  const jitterRangeMS = getValueBetweenNumbers(
		MIN_JITTER_RANGE_MS, 
		INITIAL_JITTER_RANGE_MS, 
		jitterRangePercentage
	);

  const jitterMS = (Math.random() - 0.5) * jitterRangeMS;

  const durationMs = Math.round(Math.max(MIN_SPIN_DURATION_MS, expectedDurationMS + jitterMS));
  const fullRotations = Math.max(MIN_ROTATIONS, Math.round(durationMs / MS_PER_ROTATION));

  return { durationMs, fullRotations, nextSpinCount: currentSpinCount + 1 };
}
