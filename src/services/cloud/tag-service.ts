/**
 * Cloud (Supabase) counterpart to tag-service.ts, used for signed-in users.
 * `tag_metadata` in Supabase has a real (wheel_id, name) unique constraint, so no
 * synthetic "${wheelId}:${name}" key is needed here. That scheme was only required
 * to give IndexedDB a single-column keyPath.
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
	const tag: TagMetadata = { key: row.id, wheelId: row.wheel_id, name: row.name };
	if (row.color) tag.color = row.color;
	return tag;
}

export interface CloudTagService {
	listTagMetadata(wheelId: string): Promise<TagMetadata[]>;
	getTagMetadata(wheelId: string, name: string): Promise<TagMetadata | undefined>;
	setTagColor(wheelId: string, name: string, color: string | null): Promise<TagMetadata>;
	ensureTagsExist(wheelId: string, names: string[]): Promise<void>;
	deleteTagMetadata(wheelId: string, name: string): Promise<void>;
	clearWheelTagMetadata(wheelId: string): Promise<void>;
	pruneOrphanTags(
		wheelId: string,
		activities: readonly Activity[],
		tagNames: string[],
	): Promise<string[]>;
	copyTagMetadata(fromWheelId: string, toWheelId: string): Promise<void>;
}

export function createCloudTagService(userId: string): CloudTagService {
	const supabase = requireSupabase();

	return {
		async listTagMetadata(wheelId) {
			const { data, error } = await supabase.from('tag_metadata').select('*').eq('wheel_id', wheelId);
			if (error) throw error;
			return (data as TagMetadataRow[]).map(rowToTagMetadata);
		},

		async getTagMetadata(wheelId, name) {
			const { data, error } = await supabase
				.from('tag_metadata')
				.select('*')
				.eq('wheel_id', wheelId)
				.eq('name', name)
				.maybeSingle();
			if (error) throw error;
			return data ? rowToTagMetadata(data as TagMetadataRow) : undefined;
		},

		async setTagColor(wheelId, name, color) {
			const trimmed = name.trim();
			if (!trimmed) throw new Error('Tag name cannot be empty');
			const { data, error } = await supabase
				.from('tag_metadata')
				.upsert(
					{ wheel_id: wheelId, user_id: userId, name: trimmed, color },
					{ onConflict: 'wheel_id,name' },
				)
				.select('*')
				.single();
			if (error) throw error;
			return rowToTagMetadata(data as TagMetadataRow);
		},

		async ensureTagsExist(wheelId, names) {
			const trimmedNames = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
			if (trimmedNames.length === 0) return;
			const { error } = await supabase
				.from('tag_metadata')
				.upsert(
					trimmedNames.map((name) => ({ wheel_id: wheelId, user_id: userId, name })),
					{ onConflict: 'wheel_id,name', ignoreDuplicates: true },
				);
			if (error) throw error;
		},

		async deleteTagMetadata(wheelId, name) {
			const { error } = await supabase
				.from('tag_metadata')
				.delete()
				.eq('wheel_id', wheelId)
				.eq('name', name);
			if (error) throw error;
		},

		async clearWheelTagMetadata(wheelId) {
			const { error } = await supabase.from('tag_metadata').delete().eq('wheel_id', wheelId);
			if (error) throw error;
		},

		async pruneOrphanTags(wheelId, activities, tagNames) {
			const used = new Set(activities.flatMap((activity) => activity.tags ?? []));
			const orphans = tagNames.filter((name) => !used.has(name));
			if (orphans.length === 0) return [];
			const { error } = await supabase
				.from('tag_metadata')
				.delete()
				.eq('wheel_id', wheelId)
				.in('name', orphans);
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
			if (rows.length === 0) return;
			const { error: insertError } = await supabase.from('tag_metadata').upsert(
				rows.map((row) => ({
					wheel_id: toWheelId,
					user_id: userId,
					name: row.name,
					color: row.color,
				})),
				{ onConflict: 'wheel_id,name' },
			);
			if (insertError) throw insertError;
		},
	};
}
