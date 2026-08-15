/**
 * Supabase version of the wheel service for signed-in users.
 */

import { requireSupabase } from '../supabase-client';
import type { Activity, Wheel } from '../../domain-logic/types';
import { newID } from '../../utils/id';
import { isValidUuid } from '../../utils/uuid';
import { INITIAL_PREFERENCE_SCORE_CONFIDENCE } from '../../domain-logic/weight-logic/weight-constants';
import { createCloudActivityService } from './activity-service';
import { createCloudTagService } from './tag-service';
import {
	convertLegacyBackupEntry,
	convertLegacyBackupEntryV3,
	CURRENT_FULL_BACKUP_FORMAT,
	isLegacyFullBackupV2,
	isLegacyFullBackupV3,
} from '../wheel-service';
import type { FullBackup, FullBackupEntry } from '../wheel-service';

function isFullBackup(value: unknown): value is FullBackup {
	if (typeof value !== 'object' || value === null) return false;
	const obj = value as Record<string, unknown>;
	return obj.format === CURRENT_FULL_BACKUP_FORMAT && Array.isArray(obj.wheels);
}

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
	getWheelsInOrder(): Promise<Wheel[]>;
	getWheel(id: string): Promise<Wheel | undefined>;
	createWheel(name: string): Promise<Wheel>;
	renameWheel(id: string, name: string): Promise<Wheel>;
	recordWheelBeingUsed(id: string): Promise<void>;
	deleteWheel(id: string): Promise<void>;
	copyWheel(fromWheelID: string, name: string, resetWeights: boolean): Promise<Wheel>;
	exportFullBackup(): Promise<string>;
	importFullBackup(json: string): Promise<string>;
	resetToBlankWheel(): Promise<Wheel>;
}

export function createCloudWheelService(userID: string): CloudWheelService {
	const supabase = requireSupabase();
	const activityService = createCloudActivityService(userID);
	const tagService = createCloudTagService(userID);

	async function getWheelsInOrder(): Promise<Wheel[]> {
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
		const row = { id: newID(), user_id: userID, name: trimmed, created_at: now, last_used_at: now };
		const { error } = await supabase.from('wheels').insert(row);
		if (error) throw error;
		return rowToWheel(row);
	}

	async function deleteWheel(id: string): Promise<void> {
		const { error } = await supabase.from('wheels').delete().eq('id', id);
		if (error) throw error;
	}

	async function resetToBlankWheel(): Promise<Wheel> {
		const all = await getWheelsInOrder();
		for (const wheel of all) await deleteWheel(wheel.id);
		return createWheel('My Wheel');
	}

	return {
		getWheelsInOrder,

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

		async recordWheelBeingUsed(id) {
			const { error } = await supabase
				.from('wheels')
				.update({ last_used_at: new Date().toISOString() })
				.eq('id', id);
			if (error) throw error;
		},

		deleteWheel,

		async copyWheel(fromWheelID, name, shouldResetWeights) {
			const newWheel = await createWheel(name);
			const sourceActivities = await activityService.loadActivitiesOfWheel(fromWheelID);
			const now = Date.now();
			const tagIDMap = await tagService.copyTagMetadata(fromWheelID, newWheel.id);

			const copiedActivities: Activity[] = sourceActivities.map((activity) => ({
				...activity,
				id: newID(),
				wheelId: newWheel.id,
				createdAt: now,
				preferenceScore: shouldResetWeights ? 0 : activity.preferenceScore,
				preferenceScoreConfidence: shouldResetWeights
					? INITIAL_PREFERENCE_SCORE_CONFIDENCE
					: activity.preferenceScoreConfidence,
				lastFeedbackAt: shouldResetWeights ? now : activity.lastFeedbackAt,
				preferenceEstimateHistory: undefined,
				tagIds: activity.tagIds
					.map((tagID) => tagIDMap.get(tagID))
					.filter((tagID): tagID is string => !!tagID),
			}));
			if (copiedActivities.length > 0) await activityService.bulkPut(copiedActivities);

			return newWheel;
		},

		async exportFullBackup() {
			const wheels = await getWheelsInOrder();
			const data: FullBackupEntry[] = await Promise.all(
				wheels.map(async (wheel) => ({
					wheel,
					activities: await activityService.loadActivitiesOfWheel(wheel.id),
					tags: await tagService.listTagMetadata(wheel.id),
				})),
			);
			return JSON.stringify(
				{ format: CURRENT_FULL_BACKUP_FORMAT, exportedAt: Date.now(), wheels: data },
				null,
				2,
			);
		},

		async importFullBackup(json) {
			const parsed: unknown = JSON.parse(json);
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
				throw new Error('Not a valid activity-wheel backup file.');
			}

			const existing = await getWheelsInOrder();
			for (const wheel of existing) await deleteWheel(wheel.id);

			for (const { wheel, activities, tags } of backup.wheels) {
				const wheelId = isValidUuid(wheel.id) ? wheel.id : newID();
				const { error } = await supabase.from('wheels').insert({
					id: wheelId,
					user_id: userID,
					name: wheel.name,
					created_at: new Date(wheel.createdAt).toISOString(),
					last_used_at: new Date(wheel.lastUsedAt).toISOString(),
				});
				if (error) throw error;

				const tagIDMap = new Map<string, string>();
				for (const tag of tags) {
					const tagID = isValidUuid(tag.id) ? tag.id : newID();
					tagIDMap.set(tag.id, tagID);
					const { error: tagError } = await supabase.from('tag_metadata').insert({
						id: tagID,
						wheel_id: wheelId,
						user_id: userID,
						name: tag.name,
						color: tag.color ?? null,
					});
					if (tagError) throw tagError;
				}

				const remappedActivities = activities.map((activity) => ({
					...activity,
					id: isValidUuid(activity.id) ? activity.id : newID(),
					wheelId,
					tagIds: activity.tagIds
						.map((tagID) => tagIDMap.get(tagID))
						.filter((tagID): tagID is string => !!tagID),
				}));
				if (remappedActivities.length > 0) await activityService.bulkPut(remappedActivities);
			}

			if (backup.wheels.length === 0) {
				const fallback = await createWheel('My Wheel');
				return fallback.id;
			}
			return backup.wheels[0].wheel.id;
		},

		resetToBlankWheel,
	};
}
