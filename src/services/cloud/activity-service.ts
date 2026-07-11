/**
 * Cloud (Supabase) counterpart to activity-service.ts, used for signed-in users.
 * Same function names/signatures as the local IndexedDB service so hooks can swap
 * between the two without branching on every call site. userId is bound once via
 * the factory rather than threaded through every call.
 */

import { requireSupabase } from '../supabase-client';
import { applyFeedback } from '../../domain-logic/weight-logic/weight-feedback-response-logic';
import { newActivity } from '../../domain-logic/activity-logic/activity-factory';
import type { Activity, FeedbackAction } from '../../domain-logic/types';
import { newId } from '../../utils/id';

interface ActivityRow {
	id: string;
	wheel_id: string;
	name: string;
	weight: number;
	created_at: string;
	accept_count: number;
	reject_count: number;
	streak: number;
	last_accept_delta: number | null;
	tags: string[];
}

function rowToActivity(row: ActivityRow): Activity {
	const activity: Activity = {
		id: row.id,
		wheelId: row.wheel_id,
		name: row.name,
		weight: row.weight,
		createdAt: new Date(row.created_at).getTime(),
		acceptCount: row.accept_count,
		rejectCount: row.reject_count,
		streak: row.streak,
		tags: row.tags ?? [],
	};
	if (row.last_accept_delta !== null) activity.lastAcceptDelta = row.last_accept_delta;
	return activity;
}

function activityToRow(userId: string, activity: Activity): Omit<ActivityRow, 'created_at'> & { user_id: string; created_at: string } {
	return {
		id: activity.id,
		wheel_id: activity.wheelId,
		user_id: userId,
		name: activity.name,
		weight: activity.weight,
		created_at: new Date(activity.createdAt).toISOString(),
		accept_count: activity.acceptCount,
		reject_count: activity.rejectCount,
		streak: activity.streak,
		last_accept_delta: activity.lastAcceptDelta ?? null,
		tags: activity.tags,
	};
}

export interface CloudActivityService {
	listActivities(wheelId: string): Promise<Activity[]>;
	addActivity(name: string, wheelId: string, now?: number): Promise<Activity>;
	renameActivity(id: string, name: string): Promise<Activity>;
	deleteActivity(id: string): Promise<void>;
	updateActivityTags(id: string, tags: string[]): Promise<Activity>;
	recordFeedback(
		id: string,
		action: FeedbackAction,
		poolTotalEffective: number,
		now?: number,
	): Promise<Activity>;
	bulkPut(activities: readonly Activity[]): Promise<void>;
	clearWheelActivities(wheelId: string): Promise<void>;
}

export function createCloudActivityService(userId: string): CloudActivityService {
	const supabase = requireSupabase();

	async function getRow(id: string): Promise<ActivityRow> {
		const { data, error } = await supabase.from('activities').select('*').eq('id', id).single();
		if (error) throw error;
		return data as ActivityRow;
	}

	return {
		async listActivities(wheelId) {
			const { data, error } = await supabase.from('activities').select('*').eq('wheel_id', wheelId);
			if (error) throw error;
			return (data as ActivityRow[]).map(rowToActivity);
		},

		async addActivity(name, wheelId, now = Date.now()) {
			const trimmed = name.trim();
			if (trimmed.length === 0) throw new Error('Activity name cannot be empty');
			const activity = newActivity(newId(), trimmed, now, wheelId);
			const { error } = await supabase.from('activities').insert(activityToRow(userId, activity));
			if (error) throw error;
			return activity;
		},

		async renameActivity(id, name) {
			const trimmed = name.trim();
			if (trimmed.length === 0) throw new Error('Activity name cannot be empty');
			const { data, error } = await supabase
				.from('activities')
				.update({ name: trimmed })
				.eq('id', id)
				.select('*')
				.single();
			if (error) throw error;
			return rowToActivity(data as ActivityRow);
		},

		async deleteActivity(id) {
			const { error } = await supabase.from('activities').delete().eq('id', id);
			if (error) throw error;
		},

		async updateActivityTags(id, tags) {
			const { data, error } = await supabase
				.from('activities')
				.update({ tags })
				.eq('id', id)
				.select('*')
				.single();
			if (error) throw error;
			return rowToActivity(data as ActivityRow);
		},

		async recordFeedback(id, action, poolTotalEffective, now = Date.now()) {
			const existing = rowToActivity(await getRow(id));
			const next = applyFeedback(existing, action, now, {
				totalEffectiveWeight: poolTotalEffective,
			});
			const { data, error } = await supabase
				.from('activities')
				.update({
					weight: next.weight,
					accept_count: next.acceptCount,
					reject_count: next.rejectCount,
					streak: next.streak,
					last_accept_delta: next.lastAcceptDelta ?? null,
				})
				.eq('id', id)
				.select('*')
				.single();
			if (error) throw error;
			return rowToActivity(data as ActivityRow);
		},

		async bulkPut(activities) {
			if (activities.length === 0) return;
			const { error } = await supabase
				.from('activities')
				.upsert(activities.map((activity) => activityToRow(userId, activity)));
			if (error) throw error;
		},

		async clearWheelActivities(wheelId) {
			const { error } = await supabase.from('activities').delete().eq('wheel_id', wheelId);
			if (error) throw error;
		},
	};
}
