import { requireSupabase } from '../supabase-client';
import type { Wheel } from '../../domain-logic/types';
import type { FullBackup } from '../wheel-service';
import { CURRENT_FULL_BACKUP_FORMAT } from '../wheel-service';
import { createSharedActivityService } from './shared-activity-service';
import { createSharedTagService } from './shared-tag-service';

interface SharedWheelRow {
	id: string;
	name: string;
	created_at: string;
	last_used_at: string;
}

function toSharedWheelFromRow(sharedWheelRow: SharedWheelRow): Wheel {
	return {
		id: sharedWheelRow.id,
		name: sharedWheelRow.name,
		createdAt: new Date(sharedWheelRow.created_at).getTime(),
		lastUsedAt: new Date(sharedWheelRow.last_used_at).getTime(),
		kind: 'shared',
	};
}

export async function getSharedWheelMetadata(sharedWheelID: string): Promise<Wheel | undefined> {
	const supabase = requireSupabase();
	const { data, error } = await supabase
		.from('shared_wheels')
		.select('id, name, created_at, last_used_at')
		.eq('id', sharedWheelID)
		.maybeSingle();
	if (error) throw error;
	return data ? toSharedWheelFromRow(data as SharedWheelRow) : undefined;
}

/** Gets shared wheel the current session is a member of. */
export async function listAccessibleSharedWheels(): Promise<Wheel[]> {
	const supabase = requireSupabase();
	const { data, error } = await supabase.from('shared_wheels').select('id, name, created_at, last_used_at');
	if (error) throw error;
	return (data as SharedWheelRow[]).map(toSharedWheelFromRow);
}

/** Export a single shared wheel's activities and tag metadata as a portable JSON file in the same format as exportFullBackup. */
export async function exportSharedWheelBackup(sharedWheelID: string): Promise<string> {
	const wheel = await getSharedWheelMetadata(sharedWheelID);
	if (!wheel) throw new Error('Shared wheel not found.');
	const activities = await createSharedActivityService().loadActivitiesOfWheel(sharedWheelID);
	const tags = await createSharedTagService().listTagMetadata(sharedWheelID);
	const backup: FullBackup = {
		format: CURRENT_FULL_BACKUP_FORMAT,
		exportedAt: Date.now(),
		wheels: [{ wheel, activities, tags }],
	};
	return JSON.stringify(backup, null, 2);
}

export async function recordSharedWheelBeingUsed(sharedWheelID: string): Promise<void> {
	const supabase = requireSupabase();
	try {
		await supabase
			.from('shared_wheels')
			.update({ last_used_at: new Date().toISOString() })
			.eq('id', sharedWheelID);
	}
	catch {
		// Ignored.
	}
}
