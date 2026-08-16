import type { TypedStore } from '../libraries/indexeddb/store';
import type { Activity, TagMetadata, Wheel } from '../domain-logic/types';
import { db } from './activity-service';
import { TAG_METADATA_STORE, WHEELS_STORE } from './schema';
import { newID } from '../utils/id';
import { LOCAL_STORAGE_KEYS, loadStringFromLocalStorage, saveStringToLocalStorage } from '../utils/local-storage';
import { addActivity, bulkPut, clearWheelActivities, loadActivitiesOfWheel } from './activity-service';
import { clearWheelTagMetadata, copyTagMetadata, listTagMetadata } from './tag-service';
import { replayMigratedPreferenceEstimate } from '../domain-logic/weight-logic/migration-replay-logic';

const wheelStore = (): TypedStore<Wheel> => db.store<Wheel>(WHEELS_STORE.name);

function getActiveWheelStorageKey(scopeUserID?: string): string {
	return scopeUserID ? `${LOCAL_STORAGE_KEYS.activeWheelID}:${scopeUserID}` : LOCAL_STORAGE_KEYS.activeWheelID;
}

export function getStoredActiveWheelID(scopeUserID?: string): string {
	const storedActiveWheelID = loadStringFromLocalStorage(getActiveWheelStorageKey(scopeUserID));
	if (storedActiveWheelID && !(scopeUserID && storedActiveWheelID === 'default'))
		return storedActiveWheelID;

	return scopeUserID ? '' : 'default';
}

export function persistActiveWheelID(id: string, scopeUserID?: string): void {
	saveStringToLocalStorage(getActiveWheelStorageKey(scopeUserID), id);
}

export async function getWheelsInOrder(): Promise<Wheel[]> {
	const allWheels = await wheelStore().getAll();
	return allWheels.sort(
		(wheel1, wheel2) => wheel2.lastUsedAt - wheel1.lastUsedAt || wheel1.createdAt - wheel2.createdAt,
	);
}

export async function getWheel(id: string): Promise<Wheel | undefined> {
	return wheelStore().get(id);
}

export async function createWheel(wheelName: string): Promise<Wheel> {
	const trimmedName = wheelName.trim();
	if (!trimmedName) 
		throw new Error('Wheel name cannot be empty');

	const now = Date.now();
	const wheel: Wheel = { id: newID(), name: trimmedName, createdAt: now, lastUsedAt: now };
	await wheelStore().put(wheel);
	return wheel;
}

export async function renameWheel(wheelID: string, wheelName: string): Promise<Wheel> {
	const trimmedName = wheelName.trim();
	if (!trimmedName) 
		throw new Error('Wheel name cannot be empty');

	const existingWheel = await wheelStore().get(wheelID);
	if (!existingWheel) 
		throw new Error(`Wheel ${wheelID} not found`);

	const nextWheel: Wheel = { ...existingWheel, name: trimmedName };
	await wheelStore().put(nextWheel);
	return nextWheel;
}

export async function recordWheelBeingUsed(WheelID: string): Promise<void> {
	const existingWheel = await wheelStore().get(WheelID);
	if (!existingWheel) return;
	await wheelStore().put({ ...existingWheel, lastUsedAt: Date.now() });
}

/**
 * Delete a wheel and all its activities and tag metadata. 
 * The caller of this function must ensure this is not the last wheel. 
 */
export async function deleteWheel(wheelID: string): Promise<void> {
	await clearWheelActivities(wheelID);
	await clearWheelTagMetadata(wheelID);
	await wheelStore().delete(wheelID);
}

export interface FullBackupEntry {
	wheel: Wheel;
	activities: Activity[];
	tags: TagMetadata[];
}

/**
 * All fields required for migrating to the estimated preference model
 */
interface WeightBasedActivityFields {
	id: string;
	wheelId: string;
	name: string;
	createdAt: number;
	acceptCount: number;
	rejectCount: number;
	tagIds: string[];
}

/**
 * Replays a legacy activity's acceptCount and rejectCount into a preference estimate. 
 * Drops the old weight, streak, and lastAcceptDelta fields.
 */
function migrateWeightBasedActivityToPreferenceBased(
	legacyActivity: WeightBasedActivityFields,
	migratedAt: number,
): Activity {
	const { preferenceScore, preferenceScoreConfidence } = replayMigratedPreferenceEstimate(
		legacyActivity.acceptCount,
		legacyActivity.rejectCount,
	);
	return {
		id: legacyActivity.id,
		wheelId: legacyActivity.wheelId,
		name: legacyActivity.name,
		preferenceScore,
		preferenceScoreConfidence,
		lastFeedbackAt: migratedAt,
		createdAt: legacyActivity.createdAt,
		acceptCount: legacyActivity.acceptCount,
		rejectCount: legacyActivity.rejectCount,
		tagIds: legacyActivity.tagIds,
	};
}

export const CURRENT_FULL_BACKUP_FORMAT = 'full-backup-v4';

export interface FullBackup {
	format: typeof CURRENT_FULL_BACKUP_FORMAT;
	exportedAt: number;
	wheels: FullBackupEntry[];
}

/** The weight-based, tagIds-based shape backups were exported in before preference-based weighting. */
interface LegacyActivityV3 {
	id: string;
	wheelId: string;
	name: string;
	weight: number;
	createdAt: number;
	acceptCount: number;
	rejectCount: number;
	streak: number;
	lastAcceptDelta?: number;
	tagIds: string[];
}

interface LegacyFullBackupEntryV3 {
	wheel: Wheel;
	activities: LegacyActivityV3[];
	tags: TagMetadata[];
}

export interface LegacyFullBackupV3 {
	format: 'full-backup-v3';
	exportedAt: number;
	wheels: LegacyFullBackupEntryV3[];
}

export function convertLegacyBackupEntryV3(entry: LegacyFullBackupEntryV3): FullBackupEntry {
	const migratedAt = Date.now();
	const activities = entry.activities.map((legacyActivity) =>
		migrateWeightBasedActivityToPreferenceBased(legacyActivity, migratedAt),
	);
	return { wheel: entry.wheel, activities, tags: entry.tags };
}

/** The weight-based, tag-name-based (pre-tagIds) shape backups were exported in. */
interface LegacyActivity {
	id: string;
	wheelId: string;
	name: string;
	weight: number;
	createdAt: number;
	acceptCount: number;
	rejectCount: number;
	streak: number;
	lastAcceptDelta?: number;
	tags?: string[];
}

interface LegacyTagMetadata {
	key: string;
	wheelId: string;
	name: string;
	color?: string;
}

interface LegacyFullBackupEntry {
	wheel: Wheel;
	activities: LegacyActivity[];
	tags: LegacyTagMetadata[];
}

export interface LegacyFullBackup {
	format: 'full-backup-v2';
	exportedAt: number;
	wheels: LegacyFullBackupEntry[];
}

export function convertLegacyBackupEntry(entry: LegacyFullBackupEntry): FullBackupEntry {
	const migratedAt = Date.now();
	const tags: TagMetadata[] = entry.tags.map((legacyTag) => {
		const tag: TagMetadata = { id: newID(), wheelId: legacyTag.wheelId, name: legacyTag.name };
		if (legacyTag.color) tag.color = legacyTag.color;
		return tag;
	});
	const idByName = new Map(tags.map((tag) => [tag.name, tag.id]));
	const activities: Activity[] = entry.activities.map((legacyActivity) => {
		const tagIds = (legacyActivity.tags ?? [])
			.map((name) => idByName.get(name))
			.filter((id): id is string => !!id);
		return migrateWeightBasedActivityToPreferenceBased({ ...legacyActivity, tagIds }, migratedAt);
	});
	return { wheel: entry.wheel, activities, tags };
}

/** Export all wheels, their activities, and tag metadata as a portable JSON snapshot. */
export async function exportFullBackup(): Promise<string> {
	const wheels = await getWheelsInOrder();
	const data: FullBackupEntry[] = await Promise.all(
		wheels.map(async (wheel) => ({
			wheel,
			activities: await loadActivitiesOfWheel(wheel.id),
			tags: await listTagMetadata(wheel.id),
		})),
	);
	return JSON.stringify(
		{ format: CURRENT_FULL_BACKUP_FORMAT, exportedAt: Date.now(), wheels: data },
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
		const wheels = await getWheelsInOrder();
		return wheels[0]?.id ?? 'default';
	}

	let backup: FullBackup;
	if (isFullBackup(parsed)) {
		backup = parsed;
	}
	else if (isLegacyFullBackupV3(parsed)) {
		backup = {
			format: CURRENT_FULL_BACKUP_FORMAT,
			exportedAt: parsed.exportedAt,
			wheels: parsed.wheels.map(convertLegacyBackupEntryV3),
		};
	}
	else if (isLegacyFullBackupV2(parsed)) {
		backup = {
			format: CURRENT_FULL_BACKUP_FORMAT,
			exportedAt: parsed.exportedAt,
			wheels: parsed.wheels.map(convertLegacyBackupEntry),
		};
	}
	else {
		const asObj =
			typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null;
		if (asObj?.format === 'wheel-backup-v1') {
			throw new Error(
				'This is a single-wheel backup (v1). Use Export JSON to create a new multi-wheel backup, then import that.',
			);
		}
		throw new Error('Not a valid activity-wheel backup file.');
	}

	const existing = await getWheelsInOrder();
	for (const wheel of existing) {
		await deleteWheel(wheel.id);
	}

	const wheelsStore = db.store<Wheel>(WHEELS_STORE.name);
	const tagMetadataStore = db.store<TagMetadata>(TAG_METADATA_STORE.name);
	for (const { wheel, activities, tags } of backup.wheels) {
		await wheelsStore.put(wheel);
		if (activities.length > 0) await bulkPut(activities);
		for (const tag of tags) await tagMetadataStore.put(tag);
	}

	if (backup.wheels.length === 0) {
		const fallback = await createWheel('My Wheel');
		return fallback.id;
	}
	return backup.wheels[0].wheel.id;
}

/** Delete all wheels and their data, then create one fresh blank wheel. */
export async function resetToBlankWheel(): Promise<Wheel> {
	const all = await getWheelsInOrder();
	for (const wheel of all) {
		await deleteWheel(wheel.id);
	}
	return createWheel('My Wheel');
}

function isFullBackup(value: unknown): value is FullBackup {
	if (typeof value !== 'object' || value === null) return false;
	const obj = value as Record<string, unknown>;
	return obj.format === CURRENT_FULL_BACKUP_FORMAT && Array.isArray(obj.wheels);
}

export function isLegacyFullBackupV3(value: unknown): value is LegacyFullBackupV3 {
	if (typeof value !== 'object' || value === null) return false;
	const obj = value as Record<string, unknown>;
	return obj.format === 'full-backup-v3' && Array.isArray(obj.wheels);
}

export function isLegacyFullBackupV2(value: unknown): value is LegacyFullBackup {
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
	fromWheelID: string,
	name: string,
	resetWeights: boolean,
): Promise<Wheel> {
	const newWheel = await createWheel(name);
	const tagIDMap = await copyTagMetadata(fromWheelID, newWheel.id);

	const sourceActivities = await loadActivitiesOfWheel(fromWheelID);
	const now = Date.now();
	for (const activity of sourceActivities) {
		await addActivity(activity.name, newWheel.id, now);
	}

	if (sourceActivities.length > 0) {
		const created = await loadActivitiesOfWheel(newWheel.id);
		const nameToSource = new Map(sourceActivities.map((activity) => [activity.name, activity]));
		await bulkPut(
			created.map((activity) => {
				const source = nameToSource.get(activity.name);
				if (!source) return activity;
				const tagIds = source.tagIds
					.map((tagID) => tagIDMap.get(tagID))
					.filter((tagID): tagID is string => !!tagID);
				return resetWeights
					? { ...activity, tagIds }
					: {
						...activity,
						preferenceScore: source.preferenceScore,
						preferenceScoreConfidence: source.preferenceScoreConfidence,
						lastFeedbackAt: source.lastFeedbackAt,
						acceptCount: source.acceptCount,
						rejectCount: source.rejectCount,
						tagIds,
					};
			}),
		);
	}

	return newWheel;
}
