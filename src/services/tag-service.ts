/**
 * Tag metadata service. Persistence layer for the per-wheel tag registry.
 * Tag metadata is scoped to a wheelId. The IDB key is "${wheelId}:${tagName}". All functions take a wheelId so the service is stateless w.r.t. the active wheel. 
 */

import type { TypedStore } from '../libraries/indexeddb/store';
import type { Activity, TagMetadata } from '../domain-logic/types';
import { db } from './activity-service';
import { TAG_METADATA_STORE } from './schema';

const tagStore = (): TypedStore<TagMetadata> => db.store<TagMetadata>(TAG_METADATA_STORE.name);

const tagKey = (wheelId: string, name: string): string => `${wheelId}:${name}`;

// Reads

/** Load all known tag metadata records for the given wheel. */
export async function listTagMetadata(wheelId: string): Promise<TagMetadata[]> {
	return tagStore().getAllByIndex('wheelId', wheelId);
}

/** Get metadata for a single tag by name within a wheel. */
export async function getTagMetadata(
	wheelId: string,
	name: string,
): Promise<TagMetadata | undefined> {
	return tagStore().get(tagKey(wheelId, name));
}

// Writes

export async function setTagColor(
	wheelId: string,
	name: string,
	color: string | null,
): Promise<TagMetadata> {
	const trimmed = name.trim();
	if (!trimmed) throw new Error('Tag name cannot be empty');
	const entry: TagMetadata = color
		? { key: tagKey(wheelId, trimmed), wheelId, name: trimmed, color }
		: { key: tagKey(wheelId, trimmed), wheelId, name: trimmed };
	await tagStore().put(entry);
	return entry;
}

export async function ensureTagsExist(wheelId: string, names: string[]): Promise<void> {
	for (const raw of names) {
		const name = raw.trim();
		if (!name) continue;
		const existing = await tagStore().get(tagKey(wheelId, name));
		if (!existing) {
			await tagStore().put({ key: tagKey(wheelId, name), wheelId, name });
		}
	}
}

export async function deleteTagMetadata(wheelId: string, name: string): Promise<void> {
	await tagStore().delete(tagKey(wheelId, name));
}

/** Remove every tag entry for the given wheel (e.g. after deleting a wheel). */
export async function clearWheelTagMetadata(wheelId: string): Promise<void> {
	const all = await tagStore().getAllByIndex('wheelId', wheelId);
	for (const tag of all) {
		await tagStore().delete(tag.key);
	}
}

/** @deprecated Use clearWheelTagMetadata per wheel. */
export async function clearAllTagMetadata(): Promise<void> {
	await tagStore().clear();
}

/**
 * Delete any tags from the registry that are no longer used by any activity in this wheel. Returns the names of the tags that were actually deleted. 
 */
export async function pruneOrphanTags(
	wheelId: string,
	activities: readonly Activity[],
	tagNames: string[],
): Promise<string[]> {
	const used = new Set(activities.flatMap((activity) => activity.tags ?? []));
	const orphans = tagNames.filter((name) => !used.has(name));
	await Promise.all(orphans.map((name) => tagStore().delete(tagKey(wheelId, name))));
	return orphans;
}

/**
 * Copy all tag metadata from one wheel to another. Used when duplicating a wheel. 
 */
export async function copyTagMetadata(fromWheelId: string, toWheelId: string): Promise<void> {
	const all = await tagStore().getAllByIndex('wheelId', fromWheelId);
	for (const tag of all) {
		const entry: TagMetadata = {
			key: tagKey(toWheelId, tag.name),
			wheelId: toWheelId,
			name: tag.name,
		};
		if (tag.color) entry.color = tag.color;
		await tagStore().put(entry);
	}
}
