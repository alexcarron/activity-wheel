/**
 * All tuning constants for the weight system.
 */

// Weight bounds

export const WEIGHT_DEFAULT = 100;

// Feedback step sizes

/** Moderate positive step applied on ACCEPT. */
export const ACCEPT_STEP = 7;
/** Negative step applied on REJECT. */
export const REJECT_STEP = 5;
/** Large positive step applied on BOOST (intentional, user-driven enthusiasm). */
export const BOOST_STEP = 25;
/** Large negative step applied on HATE (strong dislike — ~5× reject, mirrors BOOST_STEP). */
export const HATE_STEP = 25;

// Momentum (streak multiplier)

/** Multiplier added per consecutive same-direction action (after the first). */
export const MOMENTUM_PER_STREAK = 0.25;
/** Hard cap on the momentum multiplier. 1 + 0.25 * 4 = 2.0× max. 
 */
export const MOMENTUM_MAX = 2.0;

// Diminishing returns

/** Exponent on the diminishing-returns curve near the weight bounds. */
export const DIMINISHING_EXPONENT = 0.7;
/** Minimum factor: even at the bound, a tiny nudge still registers. */
export const DIMINISHING_FLOOR = 0.1;

// Dominance guard

/**
 * If a single activity's effective weight exceeds this fraction of the pool's total effective weight, accept-driven increases are suppressed (×0.1). Boost is intentionally exempt. It's always honoured. 
 */
export const DOMINANCE_GUARD = 0.6;

// Recency boost

/** Days over which the recency bonus linearly fades to zero. */
export const RECENCY_BOOST_DURATION_DAYS = 7;
/**
 * When pool context is available, the initial recency bonus is this fraction of the pool's current average effective weight. Scales with the pool so new activities are always competitive relative to the existing crowd. 
 */
export const RECENCY_BOOST_MULTIPLIER = 0.3;
/**
 * Fallback recency bonus (flat points) used when no pool context is provided (e.g. debug panel, unit tests, first activity ever added). 
 */
export const RECENCY_BOOST_AVG_WEIGHT_FALLBACK = 30;

export const DAY_MS = 24 * 60 * 60 * 1000;

// Weight spread (debug)

/** Identity spread factor. Matches default, untransformed behaviour. */
export const SPREAD_FACTOR_DEFAULT = 1;
/** At this factor, every weight collapses to the pool mean (equal odds). */
export const SPREAD_FACTOR_MIN = 0;
/** Upper bound on how far the slider can amplify weight differences by default. */
export const SPREAD_FACTOR_MAX = 3;
/**
 * Upper bound when the "extreme" checkbox is enabled. High enough that the lowest-weight activity's displayed probability rounds down to 0.0% well before this is reached. `WEIGHT_HARD_MINIMUM` keeps it non-zero in reality. 
 */
export const SPREAD_FACTOR_MAX_EXTENDED = 1000;
