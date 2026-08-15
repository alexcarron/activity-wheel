import { Database } from '../libraries/indexeddb/database';
import type { TypedStore } from '../libraries/indexeddb/store';
import { applyFeedbackToActivity } from '../domain-logic/weight-logic/weight-feedback-response-logic';
import { newActivity } from '../domain-logic/activity-logic/activity-factory';
import type { Activity, FeedbackAction } from '../domain-logic/types';
import { newID } from '../utils/id';
import { ACTIVITIES_STORE, dbConfig } from './schema';

const db = new Database(dbConfig);

const store = (): TypedStore<Activity> => db.store<Activity>(ACTIVITIES_STORE.name);

/**
 * Load all activities belonging to a specific wheel, normalizing legacy wheels without a wheelId to have an id of 'default' on load. 
 */
export async function loadActivitiesOfWheel(wheelId: string): Promise<Activity[]> {
	const rawActivities = await store().getAllByIndex('wheelId', wheelId);
	return rawActivities.map(normalizeLegacyActivity);
}

/**
 * Ensure legacy activities before tagging and before multiple wheels have normal defaults.
 */
function normalizeLegacyActivity(activity: Activity): Activity {
	let normalizedActivity = activity;
	if (!Array.isArray((activity as { tagIds?: unknown }).tagIds)) {
		normalizedActivity = { ...normalizedActivity, tagIds: [] };
	}
	if (!(activity as { wheelId?: unknown }).wheelId) {
		normalizedActivity = { ...normalizedActivity, wheelId: 'default' };
	}
	return normalizedActivity;
}

export async function addActivity(
	actibityName: string,
	wheelId: string,
	now: number = Date.now(),
): Promise<Activity> {
	const trimmedName = actibityName.trim();
	if (trimmedName.length === 0) throw new Error('Activity name cannot be empty');
	const activity = newActivity(newID(), trimmedName, now, wheelId);
	await store().put(activity);
	return activity;
}

export async function renameActivity(activityID: string, name: string): Promise<Activity> {
	const trimmedName = name.trim();
	if (trimmedName.length === 0) throw new Error('Activity name cannot be empty');
	const existingActivity = await store().get(activityID);
	if (!existingActivity) throw new Error(`Activity ${activityID} not found`);
	const nextActivity: Activity = { ...existingActivity, name: trimmedName };
	await store().put(nextActivity);
	return nextActivity;
}

export async function deleteActivity(activityID: string): Promise<void> {
	await store().delete(activityID);
}

export async function updateActivityTagIDs(activityID: string, tagIDs: string[]): Promise<Activity> {
	const existingActivity = await store().get(activityID);
	if (!existingActivity) throw new Error(`Activity ${activityID} not found`);
	const nextActivity: Activity = { ...normalizeLegacyActivity(existingActivity), tagIds: tagIDs };
	await store().put(nextActivity);
	return nextActivity;
}

export async function recordFeedback(
	activityID: string,
	feedbackAction: FeedbackAction,
	now: number = Date.now(),
): Promise<Activity> {
	const existingActivity = await store().get(activityID);
	if (!existingActivity) throw new Error(`Activity ${activityID} not found`);
	const nextActivity = applyFeedbackToActivity(existingActivity, feedbackAction, now);
	await store().put(nextActivity);
	return nextActivity;
}

export async function bulkPut(activities: readonly Activity[]): Promise<void> {
	await store().putMany(activities);
}

/** Delete all activities that belong to a given wheel. */
export async function clearWheelActivities(wheelID: string): Promise<void> {
	const allActivities = await store().getAllByIndex('wheelId', wheelID);
	for (const activity of allActivities) {
		await store().delete(activity.id);
	}
}

export { db };
