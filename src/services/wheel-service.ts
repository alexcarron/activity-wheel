/**
 * Wheel service. CRUD for the `wheels` IDB store.
 * Each wheel is a named namespace for a set of activities + tags. The active wheel ID is persisted in localStorage (UI preference state). 
 */

import type { TypedStore } from '../libraries/indexeddb/store';
import type { Activity, TagMetadata, Wheel } from '../domain-logic/types';
import { db } from './activity-service';
import { TAG_METADATA_STORE, WHEELS_STORE } from './schema';
import { newId } from '../utils/id';
import { addActivity, bulkPut, clearWheelActivities, listActivities } from './activity-service';
import {
	clearWheelTagMetadata,
	copyTagMetadata,
	ensureTagsExist,
	listTagMetadata,
} from './tag-service';
import { WEIGHT_DEFAULT } from '../domain-logic/weight-logic/weight-constants';

const wheelStore = (): TypedStore<Wheel> => db.store<Wheel>(WHEELS_STORE.name);

export const ACTIVE_WHEEL_KEY = 'activeWheelId';

// Active wheel
// `scopeUserId` keeps signed-in accounts from leaking "last active wheel" across
// each other on a shared browser; omit it for the signed-out/local-only case.

function activeWheelStorageKey(scopeUserId?: string): string {
	return scopeUserId ? `${ACTIVE_WHEEL_KEY}:${scopeUserId}` : ACTIVE_WHEEL_KEY;
}

/**
 * `'default'` is only a meaningful fallback for the local/signed-out case (it's the
 * literal ID of the pre-multi-wheel migrated wheel, see schema.ts v3). Cloud wheel
 * IDs are UUIDs, so a signed-in user with nothing stored yet gets '' instead —
 * callers must treat '' as "no active wheel resolved yet", not query it directly.
 */
export function getStoredActiveWheelId(scopeUserId?: string): string {
	const stored = localStorage.getItem(activeWheelStorageKey(scopeUserId));
	// 'default' can only ever be a legitimate value in the unscoped/local case
	// (see the doc comment above); a scoped key holding it is leftover bad state
	// from before this guard existed, and must be treated as "nothing stored".
	if (stored && !(scopeUserId && stored === 'default')) return stored;
	return scopeUserId ? '' : 'default';
}

export function persistActiveWheelId(id: string, scopeUserId?: string): void {
	localStorage.setItem(activeWheelStorageKey(scopeUserId), id);
}

// Reads

export async function listWheels(): Promise<Wheel[]> {
	const all = await wheelStore().getAll();
	// Sort by lastUsedAt descending so the most recently used appears first,
	// then fall back to createdAt for stable ordering of new wheels.
	return all.sort(
		(wheel1, wheel2) => wheel2.lastUsedAt - wheel1.lastUsedAt || wheel1.createdAt - wheel2.createdAt,
	);
}

export async function getWheel(id: string): Promise<Wheel | undefined> {
	return wheelStore().get(id);
}

// Writes

export async function createWheel(name: string): Promise<Wheel> {
	const trimmed = name.trim();
	if (!trimmed) throw new Error('Wheel name cannot be empty');
	const now = Date.now();
	const wheel: Wheel = { id: newId(), name: trimmed, createdAt: now, lastUsedAt: now };
	await wheelStore().put(wheel);
	return wheel;
}

export async function renameWheel(id: string, name: string): Promise<Wheel> {
	const trimmed = name.trim();
	if (!trimmed) throw new Error('Wheel name cannot be empty');
	const existing = await wheelStore().get(id);
	if (!existing) throw new Error(`Wheel ${id} not found`);
	const next: Wheel = { ...existing, name: trimmed };
	await wheelStore().put(next);
	return next;
}

export async function touchWheel(id: string): Promise<void> {
	const existing = await wheelStore().get(id);
	if (!existing) return;
	await wheelStore().put({ ...existing, lastUsedAt: Date.now() });
}

/**
 * Delete a wheel and all its activities + tag metadata. The caller must ensure this is not the last wheel. 
 */
export async function deleteWheel(id: string): Promise<void> {
	await clearWheelActivities(id);
	await clearWheelTagMetadata(id);
	await wheelStore().delete(id);
}

/**
 * Copy all activities (and tag metadata) from one wheel into a newly-created wheel.
 *
 * @param fromWheelId - Source wheel ID.
 * @param name - Name for the new wheel.
 * @param resetWeights - If true, all copied activities start at WEIGHT_DEFAULT. 
 */
// Backup / restore

export interface FullBackupEntry {
	wheel: Wheel;
	activities: Activity[];
	tags: TagMetadata[];
}

export interface FullBackup {
	format: 'full-backup-v2';
	exportedAt: number;
	wheels: FullBackupEntry[];
}

/** Export all wheels, their activities, and tag metadata as a portable JSON snapshot. */
export async function exportFullBackup(): Promise<string> {
	const wheels = await listWheels();
	const data: FullBackupEntry[] = await Promise.all(
		wheels.map(async (wheel) => ({
			wheel,
			activities: await listActivities(wheel.id),
			tags: await listTagMetadata(wheel.id),
		})),
	);
	return JSON.stringify(
		{ format: 'full-backup-v2', exportedAt: Date.now(), wheels: data },
		null,
		2,
	);
}

/**
 * Import a full backup. Deletes ALL existing wheels and replaces them with the wheels in the file. Returns the ID of the first wheel in the backup so the caller can switch to it. 
 */
export async function importFullBackup(json: string): Promise<string> {
	const parsed: unknown = JSON.parse(json);

	// Legacy full-DB dump (pre-multi-wheel). Restore raw IDB snapshot.
	if (isLegacyDbDump(parsed)) {
		await db.importAll(parsed as import('../libraries/indexeddb/types').DBBackup);
		const wheels = await listWheels();
		return wheels[0]?.id ?? 'default';
	}

	if (!isFullBackup(parsed)) {
		const asObj =
			typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null;
		if (asObj?.format === 'wheel-backup-v1') {
			throw new Error(
				'This is a single-wheel backup (v1). Use Export JSON to create a new multi-wheel backup, then import that.',
			);
		}
		throw new Error('Not a valid activity-wheel backup file.');
	}

	// Wipe all existing wheels at the service level (bypasses the "last wheel" UI guard).
	const existing = await listWheels();
	for (const wheel of existing) {
		await deleteWheel(wheel.id);
	}

	// Write imported wheels, activities, and tags.
	const wheelsStore = db.store<Wheel>(WHEELS_STORE.name);
	const tagMetadataStore = db.store<TagMetadata>(TAG_METADATA_STORE.name);
	for (const { wheel, activities, tags } of parsed.wheels) {
		await wheelsStore.put(wheel);
		if (activities.length > 0) await bulkPut(activities);
		for (const tag of tags) await tagMetadataStore.put(tag);
	}

	if (parsed.wheels.length === 0) {
		const fallback = await createWheel('My Wheel');
		return fallback.id;
	}
	return parsed.wheels[0].wheel.id;
}

/** Delete all wheels and their data, then create one fresh blank wheel. */
export async function resetToBlankWheel(): Promise<Wheel> {
	const all = await listWheels();
	for (const wheel of all) {
		await deleteWheel(wheel.id);
	}
	return createWheel('My Wheel');
}

function isFullBackup(value: unknown): value is FullBackup {
	if (typeof value !== 'object' || value === null) return false;
	const obj = value as Record<string, unknown>;
	return obj.format === 'full-backup-v2' && Array.isArray(obj.wheels);
}

function isLegacyDbDump(value: unknown): boolean {
	if (typeof value !== 'object' || value === null) return false;
	const obj = value as Record<string, unknown>;
	return typeof obj.name === 'string' && typeof obj.stores === 'object' && obj.stores !== null;
}

export async function copyWheel(
	fromWheelId: string,
	name: string,
	resetWeights: boolean,
): Promise<Wheel> {
	const newWheel = await createWheel(name);

	const sourceActivities = await listActivities(fromWheelId);
	const now = Date.now();
	for (const activity of sourceActivities) {
		await addActivity(activity.name, newWheel.id, now);
		// addActivity always creates at WEIGHT_DEFAULT, so resetWeights=false needs
		// us to also copy the weight. We can't use addActivity for that path.
	}

	if (!resetWeights && sourceActivities.length > 0) {
		// Overwrite the just-created activities with the source weights/feedback.
		// Re-read what was just created (they were created with default weights).
		const created = await listActivities(newWheel.id);
		// Match by name (names are unique within a wheel by convention).
		const nameToSource = new Map(sourceActivities.map((activity) => [activity.name, activity]));
		await bulkPut(
			created.map((activity) => {
				const source = nameToSource.get(activity.name);
				if (!source) return activity;
				return {
					...activity,
					weight: source.weight,
					acceptCount: source.acceptCount,
					rejectCount: source.rejectCount,
					streak: source.streak,
					tags: source.tags,
					// Do NOT copy lastAcceptDelta. Nothing to undo in the copy.
				};
			}),
		);
	}
	else if (sourceActivities.length > 0) {
		// resetWeights=true: copy tags but keep weights at default.
		const created = await listActivities(newWheel.id);
		const nameToSource = new Map(sourceActivities.map((activity) => [activity.name, activity]));
		await bulkPut(
			created.map((activity) => {
				const source = nameToSource.get(activity.name);
				return source ? { ...activity, weight: WEIGHT_DEFAULT, tags: source.tags } : activity;
			}),
		);
	}

	await copyTagMetadata(fromWheelId, newWheel.id);

	// Ensure tag names are registered for the activities we just copied.
	const allTags = [...new Set(sourceActivities.flatMap((activity) => activity.tags ?? []))];
	if (allTags.length > 0) await ensureTagsExist(newWheel.id, allTags);

	return newWheel;
}
