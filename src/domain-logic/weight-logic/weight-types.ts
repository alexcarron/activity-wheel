/**
 * Internal types used within the weightLogic module.
 * The core domain types (Activity, FeedbackAction) live in src/domain-logic/types.ts so the rest of the app can import them without pulling in weight-calculation internals. 
 */

/**
 * Optional context passed to feedback and effective-weight calculations.
 * Providing pool context enables two features: 1. Dominance guard — suppresses accept growth if one activity already dominates the pool. 2. Context-aware recency boost — scales the new-activity bonus relative to the pool's current average weight rather than using a flat fallback. 
 */
export interface GlobalWeightContext {
	/** Sum of all activities' effective weights in the current pool. */
	totalEffectiveWeight?: number;
	/** Number of activities in the pool (used to derive average weight). */
	numTotalActivities?: number;
}
