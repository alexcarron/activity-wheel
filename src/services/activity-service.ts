/**
 * The thin app-specific layer on top of the generic IndexedDB library.
 *
 * All read/write operations are scoped to a wheelId. The wheelId is passed
 * explicitly by callers — the service is stateless with respect to the active
 * wheel.
 */

import { Database, type TypedStore } from '../libraries/indexeddb';
import { applyFeedback, getEffectiveWeight, newActivity } from '../domain-logic/weight-logic';
import type { Activity, FeedbackAction } from '../domain-logic/types';
import { newId } from '../utils/id';
import { ACTIVITIES_STORE, dbConfig } from './schema';

const db = new Database(dbConfig);

const store = (): TypedStore<Activity> => db.store<Activity>(ACTIVITIES_STORE.name);

/* ------------------------------ Reads ----------------------------------- */

/**
 * Load all activities belonging to a specific wheel.
 * Old records without a wheelId are normalised to 'default' on load.
 */
export async function listActivities(wheelId: string): Promise<Activity[]> {
  const raw = await store().getAllByIndex('wheelId', wheelId);
  return raw.map(normalizeActivity);
}

/**
 * Ensure legacy activities (before tagging / before multi-wheel) have sane defaults.
 * - missing `tags` → []
 * - missing `wheelId` → 'default'
 */
function normalizeActivity(a: Activity): Activity {
  let out = a;
  if (!Array.isArray((a as { tags?: unknown }).tags)) {
    out = { ...out, tags: [] };
  }
  if (!(a as { wheelId?: unknown }).wheelId) {
    out = { ...out, wheelId: 'default' };
  }
  return out;
}

/* ------------------------------ Writes ---------------------------------- */

export async function addActivity(
  name: string,
  wheelId: string,
  now: number = Date.now(),
): Promise<Activity> {
  const trimmed = name.trim();
  if (trimmed.length === 0) throw new Error('Activity name cannot be empty');
  const a = newActivity(newId(), trimmed, now, wheelId);
  await store().put(a);
  return a;
}

export async function renameActivity(id: string, name: string): Promise<Activity> {
  const trimmed = name.trim();
  if (trimmed.length === 0) throw new Error('Activity name cannot be empty');
  const existing = await store().get(id);
  if (!existing) throw new Error(`Activity ${id} not found`);
  const next: Activity = { ...existing, name: trimmed };
  await store().put(next);
  return next;
}

export async function deleteActivity(id: string): Promise<void> {
  await store().delete(id);
}

export async function updateActivityTags(id: string, tags: string[]): Promise<Activity> {
  const existing = await store().get(id);
  if (!existing) throw new Error(`Activity ${id} not found`);
  const next: Activity = { ...normalizeActivity(existing), tags };
  await store().put(next);
  return next;
}

export async function recordFeedback(
  id: string,
  action: FeedbackAction,
  poolTotalEffective: number,
  now: number = Date.now(),
): Promise<Activity> {
  const existing = await store().get(id);
  if (!existing) throw new Error(`Activity ${id} not found`);
  const next = applyFeedback(existing, action, now, { totalEffectiveWeight: poolTotalEffective });
  await store().put(next);
  return next;
}

export async function bulkPut(activities: readonly Activity[]): Promise<void> {
  await store().putMany(activities);
}

/** Delete all activities belonging to a specific wheel. */
export async function clearWheelActivities(wheelId: string): Promise<void> {
  const all = await store().getAllByIndex('wheelId', wheelId);
  for (const a of all) {
    await store().delete(a.id);
  }
}

/* -------------------------- Convenience reads --------------------------- */

export function totalEffective(activities: readonly Activity[], now: number): number {
  let total = 0;
  for (const a of activities) total += getEffectiveWeight(a, now, {});
  return total;
}

/** Expose the underlying database for tests / debug tools. */
export { db };
