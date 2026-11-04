/**
 * App-specific IndexedDB schema and migrations.
 * This is the only place the activity wheel app talks to the generic IDB library about schema. New schema versions get added here as additive migrations. Never modify a previous one in place.
 */

import type { DBConfig, Migration, StoreSchema } from '../libraries/indexeddb/types';
import { newID } from '../utils/id';
import { replayMigratedPreferenceEstimate } from '../domain-logic/weight-logic/migration-replay-logic';
import { shrinkNegativePreferenceEstimate } from '../domain-logic/weight-logic/negative-score-shrink-logic';

export const ACTIVITIES_STORE: StoreSchema = {
	name: 'activities',
	keyPath: 'id',
	indexes: [
		{ name: 'createdAt', keyPath: 'createdAt' },
		{ name: 'name', keyPath: 'name' },
		{ name: 'wheelId', keyPath: 'wheelId' },
	],
};

export const TAG_METADATA_STORE: StoreSchema = {
	name: 'tag-metadata',
	keyPath: 'id',
	indexes: [{ name: 'wheelId', keyPath: 'wheelId' }],
};

export const WHEELS_STORE: StoreSchema = {
	name: 'wheels',
	keyPath: 'id',
	indexes: [{ name: 'lastUsedAt', keyPath: 'lastUsedAt' }],
};

export const CHOSEN_ACTIVITIES_STORE: StoreSchema = {
	name: 'chosen-activities',
	keyPath: 'activityID',
	indexes: [{ name: 'wheelID', keyPath: 'wheelID' }],
};

const v1Initial: Migration = {
	toVersion: 1,
	apply: ({ db }) => {
		if (!db.objectStoreNames.contains(ACTIVITIES_STORE.name)) {
			const store = db.createObjectStore(ACTIVITIES_STORE.name, {
				keyPath: ACTIVITIES_STORE.keyPath,
			});
			store.createIndex('createdAt', 'createdAt');
			store.createIndex('name', 'name');
		}
	},
};

const v2AddTagMetadata: Migration = {
	toVersion: 2,
	apply: ({ db }) => {
		if (!db.objectStoreNames.contains('tag-metadata')) {
			db.createObjectStore('tag-metadata', { keyPath: 'name' });
		}
	},
};

const v3MultiWheel: Migration = {
	toVersion: 3,
	apply: ({ db, transaction }) => {
		// 1. Add wheelId index to activities store (created in v1 without it).
		const activitiesStore = transaction.objectStore(ACTIVITIES_STORE.name);
		if (!activitiesStore.indexNames.contains('wheelId')) {
			activitiesStore.createIndex('wheelId', 'wheelId');
		}

		// 2. Cursor-update existing activities: add wheelId='default' where missing.
		const activitiesCursor = activitiesStore.openCursor();
		activitiesCursor.onsuccess = (event) => {
			const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
			if (!cursor) return;
			const row = cursor.value as Record<string, unknown>;
			if (!row.wheelId) {
				cursor.update({ ...row, wheelId: 'default' });
			}
			cursor.continue();
		};

		// 3. Migrate tag-metadata: preserve colors, re-key as "${wheelId}:${name}".
		//    The old store had keyPath='name'; the new one uses keyPath='key'.
		if (db.objectStoreNames.contains('tag-metadata')) {
			const oldStore = transaction.objectStore('tag-metadata');
			const saved: Array<{ name: string; color?: string }> = [];
			const tagCursor = oldStore.openCursor();
			tagCursor.onsuccess = (event) => {
				const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
				if (cursor) {
					saved.push(cursor.value as { name: string; color?: string });
					cursor.continue();
				}
				else {
					// All old records collected. Rebuild the store with the new keyPath.
					db.deleteObjectStore('tag-metadata');
					const newStore = db.createObjectStore('tag-metadata', { keyPath: 'key' });
					newStore.createIndex('wheelId', 'wheelId');
					for (const record of saved) {
						const entry: Record<string, unknown> = {
							key: `default:${record.name}`,
							wheelId: 'default',
							name: record.name,
						};
						if (record.color) entry.color = record.color;
						newStore.put(entry);
					}
				}
			};
		}
		else {
			const newStore = db.createObjectStore('tag-metadata', { keyPath: 'key' });
			newStore.createIndex('wheelId', 'wheelId');
		}

		// 4. Create wheels store and insert the default "My Wheel" wheel.
		if (!db.objectStoreNames.contains(WHEELS_STORE.name)) {
			const wheelsStore = db.createObjectStore(WHEELS_STORE.name, {
				keyPath: WHEELS_STORE.keyPath,
			});
			wheelsStore.createIndex('lastUsedAt', 'lastUsedAt');
			const now = Date.now();
			wheelsStore.put({ id: 'default', name: 'My Wheel', createdAt: now, lastUsedAt: now });
		}
	},
};

const v4TagIDs: Migration = {
	toVersion: 4,
	apply: ({ db, transaction }) => {
		const tagStore = transaction.objectStore('tag-metadata');
		const oldRecords: Array<{ key: string; wheelId: string; name: string; color?: string }> = [];
		const tagCursor = tagStore.openCursor();
		tagCursor.onsuccess = (event) => {
			const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
			if (cursor) {
				oldRecords.push(cursor.value as { key: string; wheelId: string; name: string; color?: string });
				cursor.continue();
				return;
			}

			const idByWheelAndName = new Map<string, string>();
			db.deleteObjectStore('tag-metadata');
			const newTagStore = db.createObjectStore('tag-metadata', { keyPath: 'id' });
			newTagStore.createIndex('wheelId', 'wheelId');
			for (const record of oldRecords) {
				const id = newID();
				idByWheelAndName.set(`${record.wheelId}:${record.name}`, id);
				const entry: Record<string, unknown> = { id, wheelId: record.wheelId, name: record.name };
				if (record.color) entry.color = record.color;
				newTagStore.put(entry);
			}

			const activitiesStore = transaction.objectStore(ACTIVITIES_STORE.name);
			const activitiesCursor = activitiesStore.openCursor();
			activitiesCursor.onsuccess = (activityEvent) => {
				const activityCursorResult = (activityEvent.target as IDBRequest<IDBCursorWithValue | null>).result;
				if (!activityCursorResult) return;
				const row = activityCursorResult.value as Record<string, unknown>;
				const names = Array.isArray(row.tags) ? (row.tags as string[]) : [];
				const tagIds = names
					.map((name) => idByWheelAndName.get(`${row.wheelId}:${name}`))
					.filter((id): id is string => !!id);
				const { tags, ...withoutTags } = row as Record<string, unknown> & { tags?: unknown };
				void tags;
				activityCursorResult.update({ ...withoutTags, tagIds });
				activityCursorResult.continue();
			};
		};
	},
};

const v5PreferenceBasedWeighting: Migration = {
	toVersion: 5,
	apply: ({ transaction }) => {
		const activitiesStore = transaction.objectStore(ACTIVITIES_STORE.name);
		const migratedAt = Date.now();
		const activitiesCursor = activitiesStore.openCursor();
		activitiesCursor.onsuccess = (event) => {
			const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
			if (!cursor) return;
			const row = cursor.value as Record<string, unknown> & {
				acceptCount?: unknown;
				rejectCount?: unknown;
				weight?: unknown;
				streak?: unknown;
				lastAcceptDelta?: unknown;
			};
			const acceptCount = typeof row.acceptCount === 'number' ? row.acceptCount : 0;
			const rejectCount = typeof row.rejectCount === 'number' ? row.rejectCount : 0;
			const { preferenceScore, preferenceScoreConfidence } = replayMigratedPreferenceEstimate(
				acceptCount,
				rejectCount,
			);
			const { weight, streak, lastAcceptDelta, ...withoutOldWeightFields } = row;
			void weight;
			void streak;
			void lastAcceptDelta;
			cursor.update({
				...withoutOldWeightFields,
				preferenceScore,
				preferenceScoreConfidence,
				lastFeedbackAt: migratedAt,
			});
			cursor.continue();
		};
	},
};

const v6EnjoymentRatings: Migration = {
	toVersion: 6,
	apply: ({ db, transaction }) => {
		const chosenActivitiesStore = db.createObjectStore(CHOSEN_ACTIVITIES_STORE.name, {
			keyPath: CHOSEN_ACTIVITIES_STORE.keyPath,
		});
		chosenActivitiesStore.createIndex('wheelID', 'wheelID');

		const migratedAt = Date.now();
		const activitiesCursor = transaction.objectStore(ACTIVITIES_STORE.name).openCursor();
		activitiesCursor.onsuccess = (event) => {
			const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
			if (!cursor) return;
			const row = cursor.value as Record<string, unknown> & {
				acceptCount?: unknown;
				rejectCount?: unknown;
				preferenceScore?: unknown;
				preferenceScoreConfidence?: unknown;
				lastFeedbackAt?: unknown;
			};
			// A browser upgrading from before v5 runs v5's cursor in the same transaction, in lockstep with this one. This cursor reads each row before v5's write lands and writes after it, so it must produce the full v5 result itself.
			const isMissingPreferenceEstimate = typeof row.preferenceScore !== 'number';
			const preferenceEstimate = isMissingPreferenceEstimate
				? replayMigratedPreferenceEstimate(
					typeof row.acceptCount === 'number' ? row.acceptCount : 0,
					typeof row.rejectCount === 'number' ? row.rejectCount : 0,
				)
				: {
					preferenceScore: row.preferenceScore as number,
					preferenceScoreConfidence: row.preferenceScoreConfidence as number,
				};
			const { weight, streak, lastAcceptDelta, ...withoutOldWeightFields } = row;
			void weight;
			void streak;
			void lastAcceptDelta;
			cursor.update({
				...withoutOldWeightFields,
				...shrinkNegativePreferenceEstimate(preferenceEstimate),
				lastFeedbackAt: typeof row.lastFeedbackAt === 'number' ? row.lastFeedbackAt : migratedAt,
				unexpectedRatingStreak: 0,
			});
			cursor.continue();
		};
	},
};

export const dbConfig: DBConfig = {
	name: 'activity-wheel',
	version: 6,
	migrations: [v1Initial, v2AddTagMetadata, v3MultiWheel, v4TagIDs, v5PreferenceBasedWeighting, v6EnjoymentRatings],
	expectedStores: [ACTIVITIES_STORE, TAG_METADATA_STORE, WHEELS_STORE, CHOSEN_ACTIVITIES_STORE],
};
