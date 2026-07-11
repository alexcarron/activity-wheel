/** Shared-wheel counterpart to cloud/tag-service.ts, backed by `shared_wheel_tag_metadata`. */

import { requireSupabase } from '../supabase-client';
import type { Activity, TagMetadata } from '../../domain-logic/types';
import type { CloudTagService } from './tag-service';

interface SharedTagMetadataRow {
	id: string;
	wheel_id: string;
	name: string;
	color: string | null;
}

function rowToTagMetadata(row: SharedTagMetadataRow): TagMetadata {
	const tag: TagMetadata = { key: row.id, wheelId: row.wheel_id, name: row.name };
	if (row.color) tag.color = row.color;
	return tag;
}

export function createSharedTagService(): CloudTagService {
	const supabase = requireSupabase();

	return {
		async listTagMetadata(wheelId) {
			const { data, error } = await supabase
				.from('shared_wheel_tag_metadata')
				.select('*')
				.eq('wheel_id', wheelId);
			if (error) throw error;
			return (data as SharedTagMetadataRow[]).map(rowToTagMetadata);
		},

		async getTagMetadata(wheelId, name) {
			const { data, error } = await supabase
				.from('shared_wheel_tag_metadata')
				.select('*')
				.eq('wheel_id', wheelId)
				.eq('name', name)
				.maybeSingle();
			if (error) throw error;
			return data ? rowToTagMetadata(data as SharedTagMetadataRow) : undefined;
		},

		async setTagColor(wheelId, name, color) {
			const trimmed = name.trim();
			if (!trimmed) throw new Error('Tag name cannot be empty');
			const { data, error } = await supabase
				.from('shared_wheel_tag_metadata')
				.upsert(
					{ wheel_id: wheelId, name: trimmed, color },
					{ onConflict: 'wheel_id,name' },
				)
				.select('*')
				.single();
			if (error) throw error;
			return rowToTagMetadata(data as SharedTagMetadataRow);
		},

		async ensureTagsExist(wheelId, names) {
			const trimmedNames = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
			if (trimmedNames.length === 0) return;
			const { error } = await supabase
				.from('shared_wheel_tag_metadata')
				.upsert(
					trimmedNames.map((name) => ({ wheel_id: wheelId, name })),
					{ onConflict: 'wheel_id,name', ignoreDuplicates: true },
				);
			if (error) throw error;
		},

		async deleteTagMetadata(wheelId, name) {
			const { error } = await supabase
				.from('shared_wheel_tag_metadata')
				.delete()
				.eq('wheel_id', wheelId)
				.eq('name', name);
			if (error) throw error;
		},

		async clearWheelTagMetadata(wheelId) {
			const { error } = await supabase.from('shared_wheel_tag_metadata').delete().eq('wheel_id', wheelId);
			if (error) throw error;
		},

		async pruneOrphanTags(wheelId, activities: readonly Activity[], tagNames) {
			const used = new Set(activities.flatMap((activity) => activity.tags ?? []));
			const orphans = tagNames.filter((name) => !used.has(name));
			if (orphans.length === 0) return [];
			const { error } = await supabase
				.from('shared_wheel_tag_metadata')
				.delete()
				.eq('wheel_id', wheelId)
				.in('name', orphans);
			if (error) throw error;
			return orphans;
		},

		async copyTagMetadata(fromWheelId, toWheelId) {
			const { data, error } = await supabase
				.from('shared_wheel_tag_metadata')
				.select('*')
				.eq('wheel_id', fromWheelId);
			if (error) throw error;
			const rows = data as SharedTagMetadataRow[];
			if (rows.length === 0) return;
			const { error: insertError } = await supabase.from('shared_wheel_tag_metadata').upsert(
				rows.map((row) => ({
					wheel_id: toWheelId,
					name: row.name,
					color: row.color,
				})),
				{ onConflict: 'wheel_id,name' },
			);
			if (insertError) throw insertError;
		},
	};
}
