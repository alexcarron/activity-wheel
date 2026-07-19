/** Shared-wheel counterpart to cloud/activity-service.ts, backed by `shared_activities`. */

import { requireSupabase } from '../supabase-client';
import { applyFeedback } from '../../domain-logic/weight-logic/weight-feedback-response-logic';
import { newActivity } from '../../domain-logic/activity-logic/activity-factory';
import type { Activity, FeedbackAction } from '../../domain-logic/types';
import { newId } from '../../utils/id';
import type { CloudActivityService } from './activity-service';

interface SharedActivityRow {
	id: string;
	wheel_id: string;
	name: string;
	weight: number;
	created_at: string;
	accept_count: number;
	reject_count: number;
	streak: number;
	last_accept_delta: number | null;
	tag_ids: string[];
}

export function rowToSharedActivity(row: SharedActivityRow): Activity {
	const activity: Activity = {
		id: row.id,
		wheelId: row.wheel_id,
		name: row.name,
		weight: row.weight,
		createdAt: new Date(row.created_at).getTime(),
		acceptCount: row.accept_count,
		rejectCount: row.reject_count,
		streak: row.streak,
		tagIds: row.tag_ids ?? [],
	};
	if (row.last_accept_delta !== null) activity.lastAcceptDelta = row.last_accept_delta;
	return activity;
}

export function createSharedActivityService(): CloudActivityService {
	const supabase = requireSupabase();

	async function currentUserId(): Promise<string | null> {
		const { data } = await supabase.auth.getUser();
		return data.user?.id ?? null;
	}

	async function getRow(id: string): Promise<SharedActivityRow> {
		const { data, error } = await supabase.from('shared_activities').select('*').eq('id', id).single();
		if (error) throw error;
		return data as SharedActivityRow;
	}

	return {
		async listActivities(wheelId) {
			const { data, error } = await supabase
				.from('shared_activities')
				.select('*')
				.eq('wheel_id', wheelId);
			if (error) throw error;
			return (data as SharedActivityRow[]).map(rowToSharedActivity);
		},

		async addActivity(name, wheelId, now = Date.now()) {
			const trimmed = name.trim();
			if (trimmed.length === 0) throw new Error('Activity name cannot be empty');
			const activity = newActivity(newId(), trimmed, now, wheelId);
			const updatedByUserId = await currentUserId();
			const { error } = await supabase.from('shared_activities').insert({
				id: activity.id,
				wheel_id: wheelId,
				name: activity.name,
				weight: activity.weight,
				created_at: new Date(activity.createdAt).toISOString(),
				accept_count: activity.acceptCount,
				reject_count: activity.rejectCount,
				streak: activity.streak,
				last_accept_delta: activity.lastAcceptDelta ?? null,
				tag_ids: activity.tagIds,
				updated_by_user_id: updatedByUserId,
				updated_at: new Date().toISOString(),
			});
			if (error) throw error;
			return activity;
		},

		async renameActivity(id, name) {
			const trimmed = name.trim();
			if (trimmed.length === 0) throw new Error('Activity name cannot be empty');
			const updatedByUserId = await currentUserId();
			const { data, error } = await supabase
				.from('shared_activities')
				.update({ name: trimmed, updated_by_user_id: updatedByUserId, updated_at: new Date().toISOString() })
				.eq('id', id)
				.select('*')
				.single();
			if (error) throw error;
			return rowToSharedActivity(data as SharedActivityRow);
		},

		async deleteActivity(id) {
			const { error } = await supabase.from('shared_activities').delete().eq('id', id);
			if (error) throw error;
		},

		async updateActivityTagIds(id, tagIds) {
			const updatedByUserId = await currentUserId();
			const { data, error } = await supabase
				.from('shared_activities')
				.update({ tag_ids: tagIds, updated_by_user_id: updatedByUserId, updated_at: new Date().toISOString() })
				.eq('id', id)
				.select('*')
				.single();
			if (error) throw error;
			return rowToSharedActivity(data as SharedActivityRow);
		},

		async recordFeedback(id, action: FeedbackAction, poolTotalEffective, now = Date.now()) {
			const existing = rowToSharedActivity(await getRow(id));
			const next = applyFeedback(existing, action, now, {
				totalEffectiveWeight: poolTotalEffective,
			});
			const updatedByUserId = await currentUserId();
			const { data, error } = await supabase
				.from('shared_activities')
				.update({
					weight: next.weight,
					accept_count: next.acceptCount,
					reject_count: next.rejectCount,
					streak: next.streak,
					last_accept_delta: next.lastAcceptDelta ?? null,
					updated_by_user_id: updatedByUserId,
					updated_at: new Date().toISOString(),
				})
				.eq('id', id)
				.select('*')
				.single();
			if (error) throw error;
			return rowToSharedActivity(data as SharedActivityRow);
		},

		async bulkPut(activities) {
			if (activities.length === 0) return;
			const updatedByUserId = await currentUserId();
			const now = new Date().toISOString();
			const { error } = await supabase.from('shared_activities').upsert(
				activities.map((activity) => ({
					id: activity.id,
					wheel_id: activity.wheelId,
					name: activity.name,
					weight: activity.weight,
					created_at: new Date(activity.createdAt).toISOString(),
					accept_count: activity.acceptCount,
					reject_count: activity.rejectCount,
					streak: activity.streak,
					last_accept_delta: activity.lastAcceptDelta ?? null,
					tag_ids: activity.tagIds,
					updated_by_user_id: updatedByUserId,
					updated_at: now,
				})),
			);
			if (error) throw error;
		},

		async clearWheelActivities(wheelId) {
			const { error } = await supabase.from('shared_activities').delete().eq('wheel_id', wheelId);
			if (error) throw error;
		},
	};
}
