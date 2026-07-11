/**
 * App-specific IndexedDB schema and migrations.
 * This is the only place the activity wheel app talks to the generic IDB library about schema. New schema versions get added here as additive migrations. Never modify a previous one in place.
 * Version history: v1 - initial: activities store v2 - tagging: tag-metadata store (tag name → optional color) v3 - multi-wheel: wheels store; wheelId on activities; tag-metadata re-keyed to "${wheelId}:${tagName}" with keyPath changed to 'key'. Existing activities → wheelId='default'; existing tag colors preserved. 
 */

import type { DBConfig, Migration, StoreSchema } from '../libraries/indexeddb/types';

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
	keyPath: 'key',
	indexes: [{ name: 'wheelId', keyPath: 'wheelId' }],
};

export const WHEELS_STORE: StoreSchema = {
	name: 'wheels',
	keyPath: 'id',
	indexes: [{ name: 'lastUsedAt', keyPath: 'lastUsedAt' }],
};

// Migrations

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

export const dbConfig: DBConfig = {
	name: 'activity-wheel',
	version: 3,
	migrations: [v1Initial, v2AddTagMetadata, v3MultiWheel],
	expectedStores: [ACTIVITIES_STORE, TAG_METADATA_STORE, WHEELS_STORE],
};
