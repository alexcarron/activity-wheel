/**
 * All tuning constants for the weight system.
 *
 * Exported from here and re-exported by src/domain-logic/constants.ts for
 * backward-compatibility with any code that imports from the parent module.
 *
 * Design notes:
 *  - DEFAULT (100) is the neutral baseline. New activities start here.
 *  - MIN (20) > 0 guarantees every activity always has a non-zero selection
 *    probability — nothing is permanently blacklisted.
 *  - MAX (300) caps runaway favourites. The MAX/MIN ratio of 15:1 means a
 *    single heavily favoured item among 20 peers at MIN is ~43% likely per spin.
 *  - ACCEPT_STEP (7) and REJECT_STEP (5) are intentionally asymmetric so
 *    positive feedback wins slightly — keeps the system from collapsing.
 *  - BOOST_STEP (25) is a deliberate large jump for when the user is really
 *    enthusiastic; roughly 3.5× an accept.
 *  - Momentum caps at 2× so streaks matter but can't run forever.
 *  - RECENCY_BOOST_FRACTION: new activities get a bonus proportional to the
 *    pool's average weight, fading linearly over 7 days. This ensures they
 *    get discovered without permanently dominating.
 *  - DOMINANCE_GUARD: suppresses accept-driven growth if a single activity
 *    already holds ≥60% of the pool's total effective weight.
 *
 * NOTE: Daily decay has been intentionally removed. Weights are permanent
 * until the user explicitly changes them via accept/reject/boost/undo.
 */

// ─── Weight bounds ────────────────────────────────────────────────────────────

export const WEIGHT_DEFAULT = 100;

// ─── Feedback step sizes ──────────────────────────────────────────────────────

/** Moderate positive step applied on ACCEPT. */
export const ACCEPT_STEP = 7;
/** Negative step applied on REJECT. */
export const REJECT_STEP = 5;
/** Large positive step applied on BOOST (intentional, user-driven enthusiasm). */
export const BOOST_STEP = 25;
/** Large negative step applied on HATE (strong dislike — ~5× reject, mirrors BOOST_STEP). */
export const HATE_STEP = 25;

// ─── Momentum (streak multiplier) ────────────────────────────────────────────

/** Multiplier added per consecutive same-direction action (after the first). */
export const MOMENTUM_PER_STREAK = 0.25;
/** Hard cap on the momentum multiplier. 1 + 0.25 * 4 = 2.0× max. */
export const MOMENTUM_MAX = 2.0;

// ─── Diminishing returns ──────────────────────────────────────────────────────

/** Exponent on the diminishing-returns curve near the weight bounds. */
export const DIMINISHING_EXPONENT = 0.7;
/** Minimum factor: even at the bound, a tiny nudge still registers. */
export const DIMINISHING_FLOOR = 0.1;

// ─── Dominance guard ─────────────────────────────────────────────────────────

/**
 * If a single activity's effective weight exceeds this fraction of the pool's
 * total effective weight, accept-driven increases are suppressed (×0.1).
 * Boost is intentionally exempt — it's always honoured.
 */
export const DOMINANCE_GUARD = 0.6;

// ─── Recency boost ────────────────────────────────────────────────────────────

/** Days over which the recency bonus linearly fades to zero. */
export const RECENCY_BOOST_DURATION_DAYS = 7;
/**
 * When pool context is available, the initial recency bonus is this fraction
 * of the pool's current average effective weight. Scales with the pool so
 * new activities are always competitive relative to the existing crowd.
 */
export const RECENCY_BOOST_MULTIPLIER = 0.3;
/**
 * Fallback recency bonus (flat points) used when no pool context is provided
 * (e.g. debug panel, unit tests, first activity ever added).
 */
export const RECENCY_BOOST_AVG_WEIGHT_FALLBACK = 30;

export const DAY_MS = 24 * 60 * 60 * 1000;
