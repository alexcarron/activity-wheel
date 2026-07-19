/**
 * Tag metadata service. Persistence layer for the per-wheel tag registry.
 * Tags are identified by a stable `id`, scoped to a wheelId. All functions take a wheelId so the service is stateless w.r.t. the active wheel.
 */

import type { TypedStore } from '../libraries/indexeddb/store';
import type { Activity, TagMetadata } from '../domain-logic/types';
import { db } from './activity-service';
import { TAG_METADATA_STORE } from './schema';
import { newId } from '../utils/id';

const tagStore = (): TypedStore<TagMetadata> => db.store<TagMetadata>(TAG_METADATA_STORE.name);

// Reads

/** Load all known tag metadata records for the given wheel. */
export async function listTagMetadata(wheelId: string): Promise<TagMetadata[]> {
	return tagStore().getAllByIndex('wheelId', wheelId);
}

/** Get metadata for a single tag by id within a wheel. */
export async function getTagMetadata(wheelId: string, id: string): Promise<TagMetadata | undefined> {
	const tag = await tagStore().get(id);
	return tag && tag.wheelId === wheelId ? tag : undefined;
}

async function getTagMetadataByName(wheelId: string, name: string): Promise<TagMetadata | undefined> {
	const all = await tagStore().getAllByIndex('wheelId', wheelId);
	return all.find((tag) => tag.name === name);
}

// Writes

export async function setTagColor(
	wheelId: string,
	id: string,
	color: string | null,
): Promise<TagMetadata> {
	const existing = await getTagMetadata(wheelId, id);
	if (!existing) throw new Error(`Tag ${id} not found`);
	const entry: TagMetadata = color
		? { ...existing, color }
		: { id: existing.id, wheelId: existing.wheelId, name: existing.name };
	await tagStore().put(entry);
	return entry;
}

export async function renameTag(wheelId: string, id: string, newName: string): Promise<TagMetadata> {
	const trimmed = newName.trim();
	if (!trimmed) throw new Error('Tag name cannot be empty');
	const existing = await getTagMetadata(wheelId, id);
	if (!existing) throw new Error(`Tag ${id} not found`);
	if (trimmed === existing.name) return existing;
	const conflict = await getTagMetadataByName(wheelId, trimmed);
	if (conflict) throw new Error(`Tag "${trimmed}" already exists`);
	const entry: TagMetadata = { ...existing, name: trimmed };
	await tagStore().put(entry);
	return entry;
}

/**
 * Look up each name within the wheel, creating a new tag when it doesn't already exist. Returns the resolved metadata for every input name, so callers can read back ids.
 */
export async function ensureTagsExist(wheelId: string, names: string[]): Promise<TagMetadata[]> {
	const resolved: TagMetadata[] = [];
	for (const raw of names) {
		const name = raw.trim();
		if (!name) continue;
		const existing = await getTagMetadataByName(wheelId, name);
		if (existing) {
			resolved.push(existing);
			continue;
		}
		const entry: TagMetadata = { id: newId(), wheelId, name };
		await tagStore().put(entry);
		resolved.push(entry);
	}
	return resolved;
}

export async function deleteTagMetadata(_wheelId: string, id: string): Promise<void> {
	await tagStore().delete(id);
}

/** Remove every tag entry for the given wheel (e.g. after deleting a wheel). */
export async function clearWheelTagMetadata(wheelId: string): Promise<void> {
	const all = await tagStore().getAllByIndex('wheelId', wheelId);
	for (const tag of all) {
		await tagStore().delete(tag.id);
	}
}

/** @deprecated Use clearWheelTagMetadata per wheel. */
export async function clearAllTagMetadata(): Promise<void> {
	await tagStore().clear();
}

/**
 * Delete any tags from the registry that are no longer used by any activity in this wheel. Returns the ids of the tags that were actually deleted.
 */
export async function pruneOrphanTags(
	_wheelId: string,
	activities: readonly Activity[],
	tagIds: string[],
): Promise<string[]> {
	const used = new Set(activities.flatMap((activity) => activity.tagIds ?? []));
	const orphans = tagIds.filter((id) => !used.has(id));
	await Promise.all(orphans.map((id) => tagStore().delete(id)));
	return orphans;
}

/**
 * Copy all tag metadata from one wheel to another, generating a new id per copied tag (ids are not shared across wheels). Returns a map of the source tag id to its new copied id, so callers can remap activities' tagIds.
 */
export async function copyTagMetadata(fromWheelId: string, toWheelId: string): Promise<Map<string, string>> {
	const all = await tagStore().getAllByIndex('wheelId', fromWheelId);
	const idMap = new Map<string, string>();
	for (const tag of all) {
		const newTagId = newId();
		idMap.set(tag.id, newTagId);
		const entry: TagMetadata = { id: newTagId, wheelId: toWheelId, name: tag.name };
		if (tag.color) entry.color = tag.color;
		await tagStore().put(entry);
	}
	return idMap;
}
