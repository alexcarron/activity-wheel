/**
 * Cloud (Supabase) counterpart to wheel-service.ts, used for signed-in users.
 * Same shape as the local IndexedDB service; RLS on the `wheels`/`activities`/
 * `tag_metadata` tables is the actual privacy boundary, not anything here.
 */

import { requireSupabase } from '../supabase-client';
import type { Activity, Wheel } from '../../domain-logic/types';
import { newId } from '../../utils/id';
import { isValidUuid } from '../../utils/uuid';
import { DEFAULT_WEIGHT } from '../../domain-logic/weight-logic/weight-constants';
import { createCloudActivityService } from './activity-service';
import { createCloudTagService } from './tag-service';
import type { FullBackup, FullBackupEntry } from '../wheel-service';

interface WheelRow {
	id: string;
	name: string;
	created_at: string;
	last_used_at: string;
}

function rowToWheel(row: WheelRow): Wheel {
	return {
		id: row.id,
		name: row.name,
		createdAt: new Date(row.created_at).getTime(),
		lastUsedAt: new Date(row.last_used_at).getTime(),
	};
}

export interface CloudWheelService {
	listWheels(): Promise<Wheel[]>;
	getWheel(id: string): Promise<Wheel | undefined>;
	createWheel(name: string): Promise<Wheel>;
	renameWheel(id: string, name: string): Promise<Wheel>;
	touchWheel(id: string): Promise<void>;
	deleteWheel(id: string): Promise<void>;
	copyWheel(fromWheelId: string, name: string, resetWeights: boolean): Promise<Wheel>;
	exportFullBackup(): Promise<string>;
	importFullBackup(json: string): Promise<string>;
	resetToBlankWheel(): Promise<Wheel>;
}

export function createCloudWheelService(userId: string): CloudWheelService {
	const supabase = requireSupabase();
	const activityService = createCloudActivityService(userId);
	const tagService = createCloudTagService(userId);

	async function listWheels(): Promise<Wheel[]> {
		const { data, error } = await supabase
			.from('wheels')
			.select('*')
			.order('last_used_at', { ascending: false });
		if (error) throw error;
		return (data as WheelRow[]).map(rowToWheel);
	}

	async function createWheel(name: string): Promise<Wheel> {
		const trimmed = name.trim();
		if (!trimmed) throw new Error('Wheel name cannot be empty');
		const now = new Date().toISOString();
		const row = { id: newId(), user_id: userId, name: trimmed, created_at: now, last_used_at: now };
		const { error } = await supabase.from('wheels').insert(row);
		if (error) throw error;
		return rowToWheel(row);
	}

	async function deleteWheel(id: string): Promise<void> {
		// activities/tag_metadata cascade via `on delete cascade` in the schema,
		// so deleting the wheel row alone is enough.
		const { error } = await supabase.from('wheels').delete().eq('id', id);
		if (error) throw error;
	}

	async function resetToBlankWheel(): Promise<Wheel> {
		const all = await listWheels();
		for (const wheel of all) await deleteWheel(wheel.id);
		return createWheel('My Wheel');
	}

	return {
		listWheels,

		async getWheel(id) {
			const { data, error } = await supabase.from('wheels').select('*').eq('id', id).maybeSingle();
			if (error) throw error;
			return data ? rowToWheel(data as WheelRow) : undefined;
		},

		createWheel,

		async renameWheel(id, name) {
			const trimmed = name.trim();
			if (!trimmed) throw new Error('Wheel name cannot be empty');
			const { data, error } = await supabase
				.from('wheels')
				.update({ name: trimmed })
				.eq('id', id)
				.select('*')
				.single();
			if (error) throw error;
			return rowToWheel(data as WheelRow);
		},

		async touchWheel(id) {
			const { error } = await supabase
				.from('wheels')
				.update({ last_used_at: new Date().toISOString() })
				.eq('id', id);
			if (error) throw error;
		},

		deleteWheel,

		async copyWheel(fromWheelId, name, resetWeights) {
			const newWheel = await createWheel(name);
			const sourceActivities = await activityService.listActivities(fromWheelId);
			const now = Date.now();

			const copiedActivities: Activity[] = sourceActivities.map((activity) => ({
				...activity,
				id: newId(),
				wheelId: newWheel.id,
				createdAt: now,
				weight: resetWeights ? DEFAULT_WEIGHT : activity.weight,
				lastAcceptDelta: undefined,
			}));
			if (copiedActivities.length > 0) await activityService.bulkPut(copiedActivities);

			await tagService.copyTagMetadata(fromWheelId, newWheel.id);

			return newWheel;
		},

		async exportFullBackup() {
			const wheels = await listWheels();
			const data: FullBackupEntry[] = await Promise.all(
				wheels.map(async (wheel) => ({
					wheel,
					activities: await activityService.listActivities(wheel.id),
					tags: await tagService.listTagMetadata(wheel.id),
				})),
			);
			return JSON.stringify(
				{ format: 'full-backup-v2', exportedAt: Date.now(), wheels: data },
				null,
				2,
			);
		},

		async importFullBackup(json) {
			const parsed = JSON.parse(json) as FullBackup;
			if (parsed.format !== 'full-backup-v2' || !Array.isArray(parsed.wheels)) {
				throw new Error('Not a valid activity-wheel backup file.');
			}

			const existing = await listWheels();
			for (const wheel of existing) await deleteWheel(wheel.id);

			for (const { wheel, activities, tags } of parsed.wheels) {
				// Local wheel/activity ids are sometimes not valid UUIDs (e.g. the
				// legacy 'default' wheel id from before multi-wheel support), but
				// Supabase's id columns are typed uuid, so remap any that don't fit.
				const wheelId = isValidUuid(wheel.id) ? wheel.id : newId();
				const { error } = await supabase.from('wheels').insert({
					id: wheelId,
					user_id: userId,
					name: wheel.name,
					created_at: new Date(wheel.createdAt).toISOString(),
					last_used_at: new Date(wheel.lastUsedAt).toISOString(),
				});
				if (error) throw error;

				const remappedActivities = activities.map((activity) => ({
					...activity,
					id: isValidUuid(activity.id) ? activity.id : newId(),
					wheelId,
				}));
				if (remappedActivities.length > 0) await activityService.bulkPut(remappedActivities);
				for (const tag of tags) await tagService.setTagColor(wheelId, tag.name, tag.color ?? null);
			}

			if (parsed.wheels.length === 0) {
				const fallback = await createWheel('My Wheel');
				return fallback.id;
			}
			return parsed.wheels[0].wheel.id;
		},

		resetToBlankWheel,
	};
}
