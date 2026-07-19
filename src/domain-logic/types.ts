/**
 * Domain types for the activity wheel.
 */

export interface Activity {
	id: string;
	/** Which wheel this activity belongs to. Defaults to 'default' for migrated records */
	wheelId: string;
	/** User-facing display name */
	name: string;
	/** The base weight of the activity */
	weight: number;
	/** Unix ms when the activity was first added */
	createdAt: number;
	/** Total accept/love it presses ever */
	acceptCount: number;
	/** Total reject/hate it presses ever */
	rejectCount: number;
	/** Signed streak of consecutive same-direction feedback */
	streak: number;
	/** The exact weight delta applied by the most recent accept or boost. Stored so UNDO can reverse it */
	lastAcceptDelta?: number;
	/** The ids of the tags for this activity */
	tagIds: string[];
}

/**
 * Persisted metadata for a tag.
 * Every tag ever created within a wheel is registered here, identified by a stable id. Color is optional and wheel-scoped.
 */
export interface TagMetadata {
	/** Stable identity. Never changes, even when the tag is renamed */
	id: string;
	/** Which wheel this tag belongs to */
	wheelId: string;
	/** The tag display name */
	name: string;
	/** Optional CSS color string (e.g. "#3b82f6") */
	color?: string;
}

/**
 * A named set of activities and tags that the user can switch between.
 */
export interface Wheel {
	id: string;
	/** User-facing display name shown for the wheel */
	name: string;
	/** Unix ms when the wheel was created */
	createdAt: number;
	/** Unix ms when the wheel was last made active */
	lastUsedAt: number;
	/** 'shared' = a password-protected multi-user wheel. Omitted = a normal owned wheel. */
	kind?: 'shared';
}

/** Action the user takes after a spin */
export type FeedbackAction = 'accept' | 'reject' | 'skip' | 'boost' | 'hate' | 'undo';

/** Sort orders available in the activity list view. */
export type SortKey = 'name' | 'createdAt' | 'weight';
export type SortDirection = 'asc' | 'desc';
