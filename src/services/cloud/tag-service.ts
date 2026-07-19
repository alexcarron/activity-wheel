/**
 * Cloud (Supabase) counterpart to tag-service.ts, used for signed-in users.
 * `tag_metadata` in Supabase has a real `id uuid` primary key plus a `(wheel_id, name)` unique constraint, used here for rename-conflict detection.
 */

import { requireSupabase } from '../supabase-client';
import type { Activity, TagMetadata } from '../../domain-logic/types';

interface TagMetadataRow {
	id: string;
	wheel_id: string;
	name: string;
	color: string | null;
}

function rowToTagMetadata(row: TagMetadataRow): TagMetadata {
	const tag: TagMetadata = { id: row.id, wheelId: row.wheel_id, name: row.name };
	if (row.color) tag.color = row.color;
	return tag;
}

const UNIQUE_VIOLATION = '23505';

export interface CloudTagService {
	listTagMetadata(wheelId: string): Promise<TagMetadata[]>;
	getTagMetadata(wheelId: string, id: string): Promise<TagMetadata | undefined>;
	setTagColor(wheelId: string, id: string, color: string | null): Promise<TagMetadata>;
	renameTag(wheelId: string, id: string, newName: string): Promise<TagMetadata>;
	ensureTagsExist(wheelId: string, names: string[]): Promise<TagMetadata[]>;
	deleteTagMetadata(wheelId: string, id: string): Promise<void>;
	clearWheelTagMetadata(wheelId: string): Promise<void>;
	pruneOrphanTags(
		wheelId: string,
		activities: readonly Activity[],
		tagIds: string[],
	): Promise<string[]>;
	copyTagMetadata(fromWheelId: string, toWheelId: string): Promise<Map<string, string>>;
}

export function createCloudTagService(userId: string): CloudTagService {
	const supabase = requireSupabase();

	return {
		async listTagMetadata(wheelId) {
			const { data, error } = await supabase.from('tag_metadata').select('*').eq('wheel_id', wheelId);
			if (error) throw error;
			return (data as TagMetadataRow[]).map(rowToTagMetadata);
		},

		async getTagMetadata(wheelId, id) {
			const { data, error } = await supabase
				.from('tag_metadata')
				.select('*')
				.eq('wheel_id', wheelId)
				.eq('id', id)
				.maybeSingle();
			if (error) throw error;
			return data ? rowToTagMetadata(data as TagMetadataRow) : undefined;
		},

		async setTagColor(wheelId, id, color) {
			const { data, error } = await supabase
				.from('tag_metadata')
				.update({ color })
				.eq('wheel_id', wheelId)
				.eq('id', id)
				.select('*')
				.single();
			if (error) throw error;
			return rowToTagMetadata(data as TagMetadataRow);
		},

		async renameTag(wheelId, id, newName) {
			const trimmed = newName.trim();
			if (!trimmed) throw new Error('Tag name cannot be empty');
			const { data, error } = await supabase
				.from('tag_metadata')
				.update({ name: trimmed })
				.eq('wheel_id', wheelId)
				.eq('id', id)
				.select('*')
				.single();
			if (error) {
				if (error.code === UNIQUE_VIOLATION) throw new Error(`Tag "${trimmed}" already exists`);
				throw error;
			}
			return rowToTagMetadata(data as TagMetadataRow);
		},

		async ensureTagsExist(wheelId, names) {
			const trimmedNames = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
			if (trimmedNames.length === 0) return [];
			const { error } = await supabase
				.from('tag_metadata')
				.upsert(
					trimmedNames.map((name) => ({ wheel_id: wheelId, user_id: userId, name })),
					{ onConflict: 'wheel_id,name', ignoreDuplicates: true },
				);
			if (error) throw error;
			const { data, error: selectError } = await supabase
				.from('tag_metadata')
				.select('*')
				.eq('wheel_id', wheelId)
				.in('name', trimmedNames);
			if (selectError) throw selectError;
			return (data as TagMetadataRow[]).map(rowToTagMetadata);
		},

		async deleteTagMetadata(wheelId, id) {
			const { error } = await supabase
				.from('tag_metadata')
				.delete()
				.eq('wheel_id', wheelId)
				.eq('id', id);
			if (error) throw error;
		},

		async clearWheelTagMetadata(wheelId) {
			const { error } = await supabase.from('tag_metadata').delete().eq('wheel_id', wheelId);
			if (error) throw error;
		},

		async pruneOrphanTags(wheelId, activities, tagIds) {
			const used = new Set(activities.flatMap((activity) => activity.tagIds ?? []));
			const orphans = tagIds.filter((id) => !used.has(id));
			if (orphans.length === 0) return [];
			const { error } = await supabase
				.from('tag_metadata')
				.delete()
				.eq('wheel_id', wheelId)
				.in('id', orphans);
			if (error) throw error;
			return orphans;
		},

		async copyTagMetadata(fromWheelId, toWheelId) {
			const { data, error } = await supabase
				.from('tag_metadata')
				.select('*')
				.eq('wheel_id', fromWheelId);
			if (error) throw error;
			const rows = data as TagMetadataRow[];
			if (rows.length === 0) return new Map();
			const { data: inserted, error: insertError } = await supabase
				.from('tag_metadata')
				.insert(
					rows.map((row) => ({
						wheel_id: toWheelId,
						user_id: userId,
						name: row.name,
						color: row.color,
					})),
				)
				.select('*');
			if (insertError) throw insertError;
			const insertedRows = inserted as TagMetadataRow[];
			const idMap = new Map<string, string>();
			rows.forEach((row, index) => {
				idMap.set(row.id, insertedRows[index].id);
			});
			return idMap;
		},
	};
}
