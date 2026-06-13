/**
 * Domain types for the activity wheel.
 *
 * The persistent shape (Activity) is kept intentionally lean. Only the data
 * needed to reconstruct preferences from scratch is stored. Recency boost is
 * computed at runtime from createdAt so the stored weight is always a stable,
 * time-independent baseline.
 *
 * NOTE: Daily decay has been removed. Weights no longer drift over time;
 * they only change through explicit user feedback.
 */

export interface Activity {
  /** Stable identifier (UUID v4-ish, generated client-side). */
  id: string;
  /** Which wheel this activity belongs to. Defaults to 'default' for migrated records. */
  wheelId: string;
  /** User-facing display name. */
  name: string;
  /**
   * Stored weight — the permanent baseline.
   * Use effectiveWeight() (which adds the recency bonus) for selection and display.
   */
  weight: number;
  /** Unix ms when the activity was first added. Drives the 7-day recency boost. */
  createdAt: number;
  /** Total accept/boost presses ever (informational + diagnostics). */
  acceptCount: number;
  /** Total reject presses ever (informational + diagnostics). */
  rejectCount: number;
  /**
   * Signed streak of consecutive same-direction feedback.
   *   > 0  consecutive accepts or boosts
   *   < 0  consecutive rejects
   *   = 0  neutral / just reset
   * Reset by an opposite-direction action; skip leaves it untouched.
   */
  streak: number;
  /**
   * The exact weight delta applied by the most recent accept or boost.
   * Stored so UNDO can reverse it precisely.
   * Cleared after an undo; undefined when nothing is undoable.
   */
  lastAcceptDelta?: number;
  /**
   * Freeform tag labels for this activity (e.g. ["Gaming", "PC"]).
   * Tag names are arbitrary strings. Colors are stored globally in the
   * tag-metadata IDB store keyed by name — not here.
   * Default: empty array. Old records without this field are normalised to []
   * by the service layer on load.
   */
  tags: string[];
}

/**
 * Persisted metadata for a tag name.
 * Stored in the `tag-metadata` IDB store with keyPath = 'key'.
 *
 * Every tag name ever typed within a wheel is registered here (for autocomplete).
 * Color is optional and wheel-scoped per name.
 */
export interface TagMetadata {
  /** Composite IDB key: "${wheelId}:${name}". */
  key: string;
  /** Which wheel this tag belongs to. */
  wheelId: string;
  /** The tag display name (e.g. "Gaming"). Used everywhere in the UI. */
  name: string;
  /** Optional CSS color string (e.g. "#3b82f6"). Undefined = no color. */
  color?: string;
}

/**
 * A named set of activities + tags that the user can switch between.
 * The active wheel ID is persisted in localStorage; wheel metadata in IDB.
 */
export interface Wheel {
  /** Stable identifier (UUID v4 or 'default' for the migrated wheel). */
  id: string;
  /** User-facing display name shown in the tab bar. */
  name: string;
  /** Unix ms when the wheel was created. */
  createdAt: number;
  /** Unix ms when the wheel was last made active. Used for ordering. */
  lastUsedAt: number;
}

/**
 * Action the user takes after a spin (or via manual controls in the list).
 *
 *  accept  Moderate weight increase.
 *  reject  Weight decrease.
 *  skip    No weight change; activity leaves the session pool anyway.
 *  boost   Large weight increase (user was very enthusiastic — Super Fun!).
 *  hate    Large weight decrease (user strongly dislikes — Hate It!). Mirror of boost.
 *  undo    Reverses the weight delta from the last accept or boost.
 */
export type FeedbackAction = 'accept' | 'reject' | 'skip' | 'boost' | 'hate' | 'undo';

/** Sort orders available in the activity list view. */
export type SortKey = 'name' | 'createdAt' | 'weight';
export type SortDirection = 'asc' | 'desc';
