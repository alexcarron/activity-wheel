/** Metadata reads for a shared wheel. */

import { requireSupabase } from '../supabase-client';
import type { Wheel } from '../../domain-logic/types';
import type { FullBackup } from '../wheel-service';
import { createSharedActivityService } from './shared-activity-service';
import { createSharedTagService } from './shared-tag-service';

interface SharedWheelRow {
	id: string;
	name: string;
	created_at: string;
	last_used_at: string;
}

function rowToSharedWheel(row: SharedWheelRow): Wheel {
	return {
		id: row.id,
		name: row.name,
		createdAt: new Date(row.created_at).getTime(),
		lastUsedAt: new Date(row.last_used_at).getTime(),
		kind: 'shared',
	};
}

/** Resolves to undefined (not an error) when the caller isn't yet a member. */
export async function getSharedWheelMetadata(sharedWheelId: string): Promise<Wheel | undefined> {
	const supabase = requireSupabase();
	const { data, error } = await supabase
		.from('shared_wheels')
		.select('id, name, created_at, last_used_at')
		.eq('id', sharedWheelId)
		.maybeSingle();
	if (error) throw error;
	return data ? rowToSharedWheel(data as SharedWheelRow) : undefined;
}

/** Every shared wheel the current session is a member of, relying entirely on the shared_wheels_select_members RLS policy rather than any locally-cached id list. */
export async function listAccessibleSharedWheels(): Promise<Wheel[]> {
	const supabase = requireSupabase();
	const { data, error } = await supabase.from('shared_wheels').select('id, name, created_at, last_used_at');
	if (error) throw error;
	return (data as SharedWheelRow[]).map(rowToSharedWheel);
}

/** Export a single shared wheel's activities and tag metadata as a portable JSON snapshot, in the same format as exportFullBackup. */
export async function exportSharedWheelBackup(sharedWheelId: string): Promise<string> {
	const wheel = await getSharedWheelMetadata(sharedWheelId);
	if (!wheel) throw new Error('Shared wheel not found.');
	const activities = await createSharedActivityService().listActivities(sharedWheelId);
	const tags = await createSharedTagService().listTagMetadata(sharedWheelId);
	const backup: FullBackup = {
		format: 'full-backup-v3',
		exportedAt: Date.now(),
		wheels: [{ wheel, activities, tags }],
	};
	return JSON.stringify(backup, null, 2);
}

// shared_wheels has no update policy yet, so this fails silently until one exists.
export async function touchSharedWheel(sharedWheelId: string): Promise<void> {
	const supabase = requireSupabase();
	try {
		await supabase
			.from('shared_wheels')
			.update({ last_used_at: new Date().toISOString() })
			.eq('id', sharedWheelId);
	}
	catch {
		// Ignored.
	}
}
