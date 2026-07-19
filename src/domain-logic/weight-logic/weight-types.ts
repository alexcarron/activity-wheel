/**
 * Optional context passed to feedback and effective-weight calculations.
 */
export interface GlobalWeightContext {
	/** Sum of all activities' effective weights in the current pool. */
	totalEffectiveWeight?: number;
	/** Number of activities in the pool */
	numTotalActivities?: number;
}
