/** Supabase versions of the chosen activity service, for owned wheels and for each member of a shared wheel. */

import { requireSupabase } from '../supabase-client';
import type { ChosenActivity } from '../../domain-logic/types';

export interface ChosenActivityService {
	listChosenActivitiesOfWheel(wheelID: string): Promise<ChosenActivity[]>;
	saveChosenActivity(chosenActivity: ChosenActivity): Promise<void>;
	removeChosenActivity(activityID: string): Promise<void>;
}

interface ChosenActivityRow {
	user_id: string;
	activity_id: string;
	wheel_id: string;
	chosen_at: string;
}

function rowToChosenActivity(row: ChosenActivityRow): ChosenActivity {
	return {
		activityID: row.activity_id,
		wheelID: row.wheel_id,
		chosenAt: new Date(row.chosen_at).getTime(),
	};
}

function createChosenActivityServiceForTable(tableName: string): ChosenActivityService {
	const supabase = requireSupabase();

	async function requireCurrentUserID(): Promise<string> {
		const { data } = await supabase.auth.getUser();
		if (!data.user) throw new Error('Must be signed in to save chosen activities.');
		return data.user.id;
	}

	return {
		async listChosenActivitiesOfWheel(wheelID) {
			const userID = await requireCurrentUserID();
			const { data, error } = await supabase
				.from(tableName)
				.select('*')
				.eq('wheel_id', wheelID)
				.eq('user_id', userID);
			if (error) throw error;
			return (data as ChosenActivityRow[]).map(rowToChosenActivity);
		},

		async saveChosenActivity(chosenActivity) {
			const userID = await requireCurrentUserID();
			const { error } = await supabase.from(tableName).upsert(
				{
					user_id: userID,
					activity_id: chosenActivity.activityID,
					wheel_id: chosenActivity.wheelID,
					chosen_at: new Date(chosenActivity.chosenAt).toISOString(),
				},
				{ onConflict: 'user_id,activity_id' },
			);
			if (error) throw error;
		},

		async removeChosenActivity(activityID) {
			const userID = await requireCurrentUserID();
			const { error } = await supabase
				.from(tableName)
				.delete()
				.eq('activity_id', activityID)
				.eq('user_id', userID);
			if (error) throw error;
		},
	};
}

export function createCloudChosenActivityService(): ChosenActivityService {
	return createChosenActivityServiceForTable('chosen_activities');
}

export function createSharedChosenActivityService(): ChosenActivityService {
	return createChosenActivityServiceForTable('shared_chosen_activities');
}
