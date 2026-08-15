/** The shared wheel version of the cloud activity service */

import { requireSupabase } from '../supabase-client';
import { applyFeedbackToActivity } from '../../domain-logic/weight-logic/weight-feedback-response-logic';
import { newActivity } from '../../domain-logic/activity-logic/activity-factory';
import type { Activity, FeedbackAction, PreferenceEstimateSnapshot } from '../../domain-logic/types';
import { newID } from '../../utils/id';
import type { CloudActivityService } from './activity-service';

export interface SharedActivityRow {
	id: string;
	wheel_id: string;
	name: string;
	preference_score: number;
	preference_score_confidence: number;
	last_feedback_at: string;
	created_at: string;
	accept_count: number;
	reject_count: number;
	preference_estimate_history: PreferenceEstimateSnapshot | null;
	tag_ids: string[];
}

export function rowToSharedActivity(sharedActivityRow: SharedActivityRow): Activity {
	const activity: Activity = {
		id: sharedActivityRow.id,
		wheelId: sharedActivityRow.wheel_id,
		name: sharedActivityRow.name,
		preferenceScore: sharedActivityRow.preference_score,
		preferenceScoreConfidence: sharedActivityRow.preference_score_confidence,
		lastFeedbackAt: new Date(sharedActivityRow.last_feedback_at).getTime(),
		createdAt: new Date(sharedActivityRow.created_at).getTime(),
		acceptCount: sharedActivityRow.accept_count,
		rejectCount: sharedActivityRow.reject_count,
		tagIds: sharedActivityRow.tag_ids ?? [],
	};
	if (sharedActivityRow.preference_estimate_history !== null) 
		activity.preferenceEstimateHistory = sharedActivityRow.preference_estimate_history;
	return activity;
}

export function createSharedActivityService(): CloudActivityService {
	const supabase = requireSupabase();

	async function currentUserID(): Promise<string | null> {
		const { data } = await supabase.auth.getUser();
		return data.user?.id ?? null;
	}

	async function getRow(id: string): Promise<SharedActivityRow> {
		const { data, error } = await supabase.from('shared_activities').select('*').eq('id', id).single();
		if (error) throw error;
		return data as SharedActivityRow;
	}

	return {
		async loadActivitiesOfWheel(wheelId) {
			const { data, error } = await supabase
				.from('shared_activities')
				.select('*')
				.eq('wheel_id', wheelId);
			if (error) throw error;
			return (data as SharedActivityRow[]).map(rowToSharedActivity);
		},

		async addActivity(activityName, wheelId, now = Date.now()) {
			const trimmedName = activityName.trim();
			if (trimmedName.length === 0) throw new Error('Activity name cannot be empty');
			const activity = newActivity(newID(), trimmedName, now, wheelId);
			const updatedByUserID = await currentUserID();
			const { error } = await supabase.from('shared_activities').insert({
				id: activity.id,
				wheel_id: wheelId,
				name: activity.name,
				preference_score: activity.preferenceScore,
				preference_score_confidence: activity.preferenceScoreConfidence,
				last_feedback_at: new Date(activity.lastFeedbackAt).toISOString(),
				created_at: new Date(activity.createdAt).toISOString(),
				accept_count: activity.acceptCount,
				reject_count: activity.rejectCount,
				preference_estimate_history: activity.preferenceEstimateHistory ?? null,
				tag_ids: activity.tagIds,
				updated_by_user_id: updatedByUserID,
				updated_at: new Date().toISOString(),
			});
			if (error) throw error;
			return activity;
		},

		async renameActivity(activityID, activityName) {
			const trimmedName = activityName.trim();
			if (trimmedName.length === 0) throw new Error('Activity name cannot be empty');
			const updatedByUserID = await currentUserID();
			const { data, error } = await supabase
				.from('shared_activities')
				.update({ name: trimmedName, updated_by_user_id: updatedByUserID, updated_at: new Date().toISOString() })
				.eq('id', activityID)
				.select('*')
				.single();
			if (error) throw error;
			return rowToSharedActivity(data as SharedActivityRow);
		},

		async deleteActivity(id) {
			const { error } = await supabase.from('shared_activities').delete().eq('id', id);
			if (error) throw error;
		},

		async updateActivityTagIDs(id, tagIds) {
			const updatedByUserID = await currentUserID();
			const { data, error } = await supabase
				.from('shared_activities')
				.update({ tag_ids: tagIds, updated_by_user_id: updatedByUserID, updated_at: new Date().toISOString() })
				.eq('id', id)
				.select('*')
				.single();
			if (error) throw error;
			return rowToSharedActivity(data as SharedActivityRow);
		},

		async recordFeedback(activityID, feedbackAction: FeedbackAction, now = Date.now()) {
			const existingActivity = rowToSharedActivity(await getRow(activityID));
			const nextActivity = applyFeedbackToActivity(existingActivity, feedbackAction, now);
			const updatedByUserID = await currentUserID();
			const { data, error } = await supabase
				.from('shared_activities')
				.update({
					preference_score: nextActivity.preferenceScore,
					preference_score_confidence: nextActivity.preferenceScoreConfidence,
					last_feedback_at: new Date(nextActivity.lastFeedbackAt).toISOString(),
					accept_count: nextActivity.acceptCount,
					reject_count: nextActivity.rejectCount,
					preference_estimate_history: nextActivity.preferenceEstimateHistory ?? null,
					updated_by_user_id: updatedByUserID,
					updated_at: new Date().toISOString(),
				})
				.eq('id', activityID)
				.select('*')
				.single();
			if (error) throw error;
			return rowToSharedActivity(data as SharedActivityRow);
		},

		async bulkPut(activities) {
			if (activities.length === 0) return;
			const updatedByUserID = await currentUserID();
			const now = new Date().toISOString();
			const { error } = await supabase.from('shared_activities').upsert(
				activities.map((activity) => ({
					id: activity.id,
					wheel_id: activity.wheelId,
					name: activity.name,
					preference_score: activity.preferenceScore,
					preference_score_confidence: activity.preferenceScoreConfidence,
					last_feedback_at: new Date(activity.lastFeedbackAt).toISOString(),
					created_at: new Date(activity.createdAt).toISOString(),
					accept_count: activity.acceptCount,
					reject_count: activity.rejectCount,
					preference_estimate_history: activity.preferenceEstimateHistory ?? null,
					tag_ids: activity.tagIds,
					updated_by_user_id: updatedByUserID,
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
