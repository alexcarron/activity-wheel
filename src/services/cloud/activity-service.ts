/**
 * Supabase veresion of the activity service for signed-in users.
 */

import { requireSupabase } from '../supabase-client';
import { applyFeedbackToActivity } from '../../domain-logic/weight-logic/weight-feedback-response-logic';
import { newActivity } from '../../domain-logic/activity-logic/activity-factory';
import type { Activity, FeedbackAction, PreferenceEstimateSnapshot } from '../../domain-logic/types';
import { newID } from '../../utils/id';

interface ActivityRow {
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

function rowToActivity(activityRow: ActivityRow): Activity {
	const activity: Activity = {
		id: activityRow.id,
		wheelId: activityRow.wheel_id,
		name: activityRow.name,
		preferenceScore: activityRow.preference_score,
		preferenceScoreConfidence: activityRow.preference_score_confidence,
		lastFeedbackAt: new Date(activityRow.last_feedback_at).getTime(),
		createdAt: new Date(activityRow.created_at).getTime(),
		acceptCount: activityRow.accept_count,
		rejectCount: activityRow.reject_count,
		tagIds: activityRow.tag_ids ?? [],
	};
	if (activityRow.preference_estimate_history !== null) activity.preferenceEstimateHistory = activityRow.preference_estimate_history;
	return activity;
}

function activityToRow(userID: string, activity: Activity): Omit<ActivityRow, 'created_at' | 'last_feedback_at'> & {
	user_id: string;
	created_at: string;
	last_feedback_at: string;
} {
	return {
		id: activity.id,
		wheel_id: activity.wheelId,
		user_id: userID,
		name: activity.name,
		preference_score: activity.preferenceScore,
		preference_score_confidence: activity.preferenceScoreConfidence,
		last_feedback_at: new Date(activity.lastFeedbackAt).toISOString(),
		created_at: new Date(activity.createdAt).toISOString(),
		accept_count: activity.acceptCount,
		reject_count: activity.rejectCount,
		preference_estimate_history: activity.preferenceEstimateHistory ?? null,
		tag_ids: activity.tagIds,
	};
}

export interface CloudActivityService {
	loadActivitiesOfWheel(wheelId: string): Promise<Activity[]>;
	addActivity(name: string, wheelId: string, now?: number): Promise<Activity>;
	renameActivity(id: string, name: string): Promise<Activity>;
	deleteActivity(id: string): Promise<void>;
	updateActivityTagIDs(id: string, tagIds: string[]): Promise<Activity>;
	recordFeedback(id: string, action: FeedbackAction, now?: number): Promise<Activity>;
	bulkPut(activities: readonly Activity[]): Promise<void>;
	clearWheelActivities(wheelId: string): Promise<void>;
}

export function createCloudActivityService(userID: string): CloudActivityService {
	const supabase = requireSupabase();

	async function getRow(id: string): Promise<ActivityRow> {
		const { data, error } = await supabase.from('activities').select('*').eq('id', id).single();
		if (error) throw error;
		return data as ActivityRow;
	}

	return {
		async loadActivitiesOfWheel(wheelId) {
			const { data, error } = await supabase.from('activities').select('*').eq('wheel_id', wheelId);
			if (error) throw error;
			return (data as ActivityRow[]).map(rowToActivity);
		},

		async addActivity(name, wheelId, now = Date.now()) {
			const trimmed = name.trim();
			if (trimmed.length === 0) throw new Error('Activity name cannot be empty');
			const activity = newActivity(newID(), trimmed, now, wheelId);
			const { error } = await supabase.from('activities').insert(activityToRow(userID, activity));
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

		async updateActivityTagIDs(id, tagIds) {
			const { data, error } = await supabase
				.from('activities')
				.update({ tag_ids: tagIds })
				.eq('id', id)
				.select('*')
				.single();
			if (error) throw error;
			return rowToActivity(data as ActivityRow);
		},

		async recordFeedback(activityID, feedbackAction, now = Date.now()) {
			const existingActivity = rowToActivity(await getRow(activityID));
			const nextActivity = applyFeedbackToActivity(existingActivity, feedbackAction, now);
			const { data, error } = await supabase
				.from('activities')
				.update({
					preference_score: nextActivity.preferenceScore,
					preference_score_confidence: nextActivity.preferenceScoreConfidence,
					last_feedback_at: new Date(nextActivity.lastFeedbackAt).toISOString(),
					accept_count: nextActivity.acceptCount,
					reject_count: nextActivity.rejectCount,
					preference_estimate_history: nextActivity.preferenceEstimateHistory ?? null,
				})
				.eq('id', activityID)
				.select('*')
				.single();
			if (error) throw error;
			return rowToActivity(data as ActivityRow);
		},

		async bulkPut(activities) {
			if (activities.length === 0) return;
			const { error } = await supabase
				.from('activities')
				.upsert(activities.map((activity) => activityToRow(userID, activity)));
			if (error) throw error;
		},

		async clearWheelActivities(wheelId) {
			const { error } = await supabase.from('activities').delete().eq('wheel_id', wheelId);
			if (error) throw error;
		},
	};
}
