import type { TypedStore } from '../libraries/indexeddb/store';
import type { ChosenActivity } from '../domain-logic/types';
import { db } from './activity-service';
import { CHOSEN_ACTIVITIES_STORE } from './schema';

const store = (): TypedStore<ChosenActivity> => db.store<ChosenActivity>(CHOSEN_ACTIVITIES_STORE.name);

export async function listChosenActivitiesOfWheel(wheelID: string): Promise<ChosenActivity[]> {
	return store().getAllByIndex('wheelID', wheelID);
}

export async function saveChosenActivity(chosenActivity: ChosenActivity): Promise<void> {
	await store().put(chosenActivity);
}

export async function removeChosenActivity(activityID: string): Promise<void> {
	await store().delete(activityID);
}
